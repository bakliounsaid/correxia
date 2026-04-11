-- Ajoute un champ classe libre pour les évaluations (sans contrainte niveau).
ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS class_name VARCHAR(128);