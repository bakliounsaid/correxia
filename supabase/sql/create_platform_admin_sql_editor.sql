-- =============================================================================
-- Créer un admin plateforme uniquement via l’éditeur SQL Supabase
-- =============================================================================
-- Prérequis : migration 003_platform_admin.sql déjà exécutée (trigger handle_new_user).
--
-- 1) Modifiez admin_email et admin_password ci-dessous.
-- 2) SQL Editor → Run.
--
-- Le mot de passe est hashé avec bcrypt (crypt / pgcrypto), comme le fait Auth.
-- Ne commitez pas ce fichier avec un vrai mot de passe : gardez-le local ou
-- remettez des placeholders après usage.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  admin_email    text := 'admin@gmail.com';
  admin_password text := '123456789'; -- à changer après premier login en prod

  v_user_id      uuid := gen_random_uuid();
  v_instance     uuid;
  v_encrypted_pw text;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    RAISE EXCEPTION 'Email déjà présent dans auth.users : %', admin_email;
  END IF;

  SELECT id INTO v_instance FROM auth.instances LIMIT 1;
  IF v_instance IS NULL THEN
    v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  v_encrypted_pw := crypt(admin_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    v_user_id,
    v_instance,
    'authenticated',
    'authenticated',
    admin_email,
    v_encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'account_type', 'platform_admin',
      'first_name', 'Admin',
      'last_name', 'Plateforme'
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- Nécessaire pour la connexion par email sur les projets Supabase récents
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', admin_email,
      'email_verified', true
    ),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Admin créé : % (id=%). Connexion /login puis /admin', admin_email, v_user_id;
END $$;

-- -----------------------------------------------------------------------------
-- PLAN B — si l’INSERT échoue (colonnes auth différentes selon la version)
-- -----------------------------------------------------------------------------
-- 1) Dashboard Supabase → Authentication → Users → « Add user »
--    (email + mot de passe, cocher email confirmé si proposé).
-- 2) Exécuter ensuite :
--
-- UPDATE auth.users
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
--   || jsonb_build_object(
--        'account_type', 'platform_admin',
--        'first_name', 'Admin',
--        'last_name', 'Plateforme'
--      )
-- WHERE email = 'admin@gmail.com';
--
-- UPDATE public.users
-- SET role = 'admin', full_name = 'Admin Plateforme'
-- WHERE email = 'admin@gmail.com';
--
-- DELETE FROM public.teachers
-- WHERE user_id IN (SELECT id FROM public.users WHERE email = 'admin@gmail.com');
-- -----------------------------------------------------------------------------
