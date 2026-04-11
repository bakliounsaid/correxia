-- Classes enseignant : créées / mises à jour automatiquement quand un élève a une classe (import CSV, formulaire, etc.)

CREATE TABLE public.teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE SET NULL,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT teacher_classes_teacher_name_uq UNIQUE (teacher_id, name)
);

CREATE INDEX idx_teacher_classes_school_id ON public.teacher_classes (school_id);
CREATE INDEX idx_teacher_classes_teacher_id ON public.teacher_classes (teacher_id);

COMMENT ON TABLE public.teacher_classes IS
  'Une ligne par (enseignant, nom de classe) ; alimentée par trigger sur public.students.';

-- Données existantes
INSERT INTO public.teacher_classes (teacher_id, school_id, name)
SELECT DISTINCT
    s.teacher_id,
    s.school_id,
    trim(s.class_name)
FROM public.students s
WHERE s.class_name IS NOT NULL
  AND trim(s.class_name) <> ''
ON CONFLICT ON CONSTRAINT teacher_classes_teacher_name_uq DO NOTHING;

CREATE OR REPLACE FUNCTION public.teacher_classes_sync_from_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cn TEXT;
BEGIN
    cn := trim(COALESCE(NEW.class_name, ''));
    IF cn = '' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.teacher_classes (teacher_id, school_id, name)
    VALUES (NEW.teacher_id, NEW.school_id, cn)
    ON CONFLICT ON CONSTRAINT teacher_classes_teacher_name_uq DO UPDATE SET
        school_id = COALESCE(EXCLUDED.school_id, teacher_classes.school_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_sync_teacher_class ON public.students;

CREATE TRIGGER trg_students_sync_teacher_class
    AFTER INSERT OR UPDATE OF class_name, teacher_id, school_id ON public.students
    FOR EACH ROW
    EXECUTE PROCEDURE public.teacher_classes_sync_from_student();

COMMENT ON FUNCTION public.teacher_classes_sync_from_student() IS
  'Crée ou met à jour teacher_classes quand un élève porte un nom de classe non vide.';
