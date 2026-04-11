-- Suppression des colonnes élèves non utilisées côté produit

ALTER TABLE public.students
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS is_active;

COMMENT ON TABLE public.students IS
  'Élèves : first_name, last_name, id_interne, class_name, teacher_id, school_id.';

