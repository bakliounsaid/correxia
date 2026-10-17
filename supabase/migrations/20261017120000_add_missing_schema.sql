-- Aligne la base sur le code Next.js : tables et colonnes manquantes,
-- création automatique des profils à l'inscription, bucket de stockage.
-- RLS des tables volontairement non activée (décision projet).

-- 1) Classes : appartiennent soit à un établissement (créées par l'admin d'établissement,
--    cf. src/lib/supabase-classes-admin.ts), soit à un enseignant indépendant (teacher_id).
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete cascade,
  name varchar(120) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_school_id_name_key unique (school_id, name),
  constraint classes_teacher_id_name_key unique (teacher_id, name),
  constraint classes_owner_chk check ((school_id is null) <> (teacher_id is null))
);

-- 2) Rattachement enseignant ↔ classe (upsert onConflict "class_id,teacher_id")
create table if not exists public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint class_teachers_class_id_teacher_id_key unique (class_id, teacher_id)
);
create index if not exists class_teachers_teacher_id_idx on public.class_teachers (teacher_id);

-- Création d'une classe par un enseignant indépendant : classe + rattachement
-- dans une seule transaction (la fonction entière est atomique).
create or replace function public.create_teacher_class(p_name text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_class_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Nom de classe requis.' using errcode = '22023';
  end if;

  select id into v_teacher_id
  from public.teachers
  where user_id = auth.uid() and is_independent = true;
  if v_teacher_id is null then
    raise exception 'Réservé aux enseignants indépendants : les classes d''un établissement sont gérées par celui-ci.'
      using errcode = '42501';
  end if;

  insert into public.classes (teacher_id, name)
  values (v_teacher_id, v_name)
  on conflict (teacher_id, name) do update set updated_at = now()
  returning id into v_class_id;

  insert into public.class_teachers (class_id, teacher_id)
  values (v_class_id, v_teacher_id)
  on conflict (class_id, teacher_id) do nothing;

  return v_class_id;
end;
$$;

-- 3) Élèves : rattachés à une classe ; le code n'envoie pas teacher_id
alter table public.students
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists id_interne varchar(64);
alter table public.students alter column teacher_id drop not null;
create index if not exists students_class_id_idx on public.students (class_id);

-- 4) Évaluations : classe + fichiers sujet / correction type
alter table public.tests
  add column if not exists class_name varchar(120),
  add column if not exists subject_file_url text,
  add column if not exists subject_file_name varchar(255),
  add column if not exists correction_file_url text,
  add column if not exists correction_file_name varchar(255);

-- 5) Profils créés à l'inscription selon user_metadata.account_type
--    (src/lib/account-types.ts, RegisterForm, RegisterSchoolForm, create-platform-admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  account_type text := coalesce(meta ->> 'account_type', 'teacher_independent');
  full_name text := nullif(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), '');
  subject text := case
    when meta ->> 'subject' in ('math', 'physics', 'science') then meta ->> 'subject'
    else 'math'
  end;
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(full_name, new.email),
    case account_type
      when 'platform_admin' then 'admin'
      when 'school_admin' then 'school_admin'
      else 'teacher'
    end
  )
  on conflict (id) do nothing;

  if account_type = 'school_admin' then
    insert into public.schools (
      name, email, phone, address, city, postal_code, admin_user_id,
      subscription_plan, subscription_status, subscription_start_date, subscription_end_date
    )
    values (
      coalesce(nullif(trim(meta ->> 'school_name'), ''), 'Établissement'),
      new.email,
      nullif(meta ->> 'phone', ''),
      nullif(meta ->> 'address', ''),
      nullif(meta ->> 'city', ''),
      nullif(meta ->> 'postal_code', ''),
      new.id,
      'evaluation', 'active', now(), now() + interval '14 days'
    );
  elsif account_type = 'teacher_independent' then
    insert into public.teachers (
      user_id, subject, is_independent,
      subscription_plan, subscription_status, subscription_start_date
    )
    values (new.id, subject, true, 'free', 'active', now())
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) Bucket « tests » (sujets, corrections type, copies scannées).
--    Public car le code affiche les fichiers via getPublicUrl().
insert into storage.buckets (id, name, public)
values ('tests', 'tests', true)
on conflict (id) do nothing;

-- storage.objects a la RLS activée par Supabase : sans ces règles, aucun upload ne passe.
drop policy if exists "tests_bucket_authenticated_rw" on storage.objects;
create policy "tests_bucket_authenticated_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'tests')
  with check (bucket_id = 'tests');
