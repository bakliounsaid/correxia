-- Correctif : la table classes a été créée par une version antérieure de
-- 20261017120000_add_missing_schema.sql (sans propriétaire enseignant).
-- Une classe appartient soit à un établissement, soit à un enseignant indépendant.
alter table public.classes
  add column if not exists teacher_id uuid references public.teachers (id) on delete cascade;

alter table public.classes alter column name type varchar(120);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'classes_teacher_id_name_key') then
    alter table public.classes add constraint classes_teacher_id_name_key unique (teacher_id, name);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'classes_owner_chk') then
    alter table public.classes add constraint classes_owner_chk check ((school_id is null) <> (teacher_id is null));
  end if;
end $$;
