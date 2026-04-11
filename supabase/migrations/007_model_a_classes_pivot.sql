-- Modèle A :
-- - un élève appartient à une classe (students.class_id)
-- - les enseignants sont liés aux classes via class_teachers

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools (id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT classes_school_name_uq UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes (school_id);

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes (id) ON DELETE RESTRICT;

-- Backfill classes depuis l'existant (class_name)
INSERT INTO public.classes (school_id, name)
SELECT DISTINCT
    s.school_id,
    COALESCE(NULLIF(trim(s.class_name), ''), 'Sans classe') AS name
FROM public.students s
ON CONFLICT ON CONSTRAINT classes_school_name_uq DO NOTHING;

-- Backfill class_id sur les élèves
UPDATE public.students s
SET class_id = c.id
FROM public.classes c
WHERE c.school_id IS NOT DISTINCT FROM s.school_id
  AND c.name = COALESCE(NULLIF(trim(s.class_name), ''), 'Sans classe')
  AND s.class_id IS NULL;

-- Pivot classes <-> enseignants
CREATE TABLE IF NOT EXISTS public.class_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT class_teachers_uq UNIQUE (class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON public.class_teachers (class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON public.class_teachers (teacher_id);

-- Backfill pivot depuis students.teacher_id + class_id
INSERT INTO public.class_teachers (class_id, teacher_id)
SELECT DISTINCT s.class_id, s.teacher_id
FROM public.students s
WHERE s.class_id IS NOT NULL
  AND s.teacher_id IS NOT NULL
ON CONFLICT ON CONSTRAINT class_teachers_uq DO NOTHING;

-- Nettoyage ancien modèle
DROP TRIGGER IF EXISTS trg_students_sync_teacher_class ON public.students;
DROP FUNCTION IF EXISTS public.teacher_classes_sync_from_student();
DROP TABLE IF EXISTS public.teacher_classes;

-- L'élève appartient désormais à une classe
ALTER TABLE public.students
    ALTER COLUMN class_id SET NOT NULL;

ALTER TABLE public.students
    DROP COLUMN IF EXISTS teacher_id,
    DROP COLUMN IF EXISTS class_name;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students (class_id);

COMMENT ON TABLE public.classes IS
  'Classe pédagogique. Une classe appartient à un établissement.';
COMMENT ON TABLE public.class_teachers IS
  'Table pivot classes <-> enseignants (N:N).';
