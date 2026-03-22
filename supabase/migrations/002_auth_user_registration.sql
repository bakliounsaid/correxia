-- CORREXIA — Profil applicatif après inscription Supabase Auth
-- À exécuter sur Supabase (SQL Editor) : crée users + teachers (+ school si admin établissement).
-- Le front envoie raw_user_meta_data.account_type = 'teacher_independent' | 'school_admin'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  acc text;
  full_nm text;
  subj text;
  new_school_id uuid;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  acc := COALESCE(meta->>'account_type', 'teacher_independent');

  full_nm := TRIM(
    CONCAT(
      COALESCE(meta->>'first_name', ''),
      ' ',
      COALESCE(meta->>'last_name', '')
    )
  );
  IF full_nm = '' THEN
    full_nm := COALESCE(split_part(NEW.email, '@', 1), 'Utilisateur');
  END IF;

  INSERT INTO public.users (id, email, full_name, role, password_hash)
  VALUES (
    NEW.id,
    NEW.email,
    full_nm,
    CASE WHEN acc = 'school_admin' THEN 'school_admin' ELSE 'teacher' END,
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

  IF acc = 'school_admin' THEN
    INSERT INTO public.schools (
      name,
      email,
      phone,
      address,
      city,
      postal_code,
      admin_user_id
    )
    VALUES (
      COALESCE(
        NULLIF(TRIM(COALESCE(meta->>'school_name', '')), ''),
        'Établissement'
      ),
      NEW.email,
      NULLIF(TRIM(COALESCE(meta->>'phone', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'address', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'city', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'postal_code', '')), ''),
      NEW.id
    )
    RETURNING id INTO new_school_id;
  END IF;

  subj := lower(COALESCE(meta->>'subject', 'math'));
  IF subj LIKE '%phys%' THEN
    subj := 'physics';
  ELSIF subj LIKE '%svt%' OR subj LIKE '%chimie%' OR subj LIKE '%science%' THEN
    subj := 'science';
  ELSE
    subj := 'math';
  END IF;

  INSERT INTO public.teachers (user_id, school_id, subject, is_independent, subscription_plan)
  VALUES (
    NEW.id,
    CASE WHEN acc = 'school_admin' THEN new_school_id ELSE NULL END,
    subj,
    acc <> 'school_admin',
    'free'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crée public.users + public.teachers ; si account_type=school_admin, crée aussi public.schools.';
