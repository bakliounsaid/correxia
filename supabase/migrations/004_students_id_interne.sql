-- Élèves : id_interne optionnel à l'insertion ; génération auto CIA-AAAA-NNN si vide (trigger).

CREATE TABLE IF NOT EXISTS public.student_internal_id_counters (
    year INTEGER PRIMARY KEY,
    next_val INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS id_interne VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS students_id_interne_uq
    ON public.students (id_interne)
    WHERE id_interne IS NOT NULL AND btrim(id_interne) <> '';

-- Rétrocompatibilité (sans trigger : il est créé après cette boucle)
DO $$
DECLARE
    r RECORD;
    y INTEGER;
    seq INTEGER;
BEGIN
    FOR r IN
        SELECT id, created_at
        FROM public.students
        WHERE id_interne IS NULL OR btrim(id_interne) = ''
        ORDER BY created_at NULLS LAST, id
    LOOP
        y := EXTRACT(
            YEAR FROM timezone('UTC', COALESCE(r.created_at, NOW()))
        )::INTEGER;

        INSERT INTO public.student_internal_id_counters (year, next_val)
        VALUES (y, 1)
        ON CONFLICT (year) DO UPDATE
        SET next_val = public.student_internal_id_counters.next_val + 1
        RETURNING next_val INTO seq;

        UPDATE public.students
        SET id_interne = format('CIA-%s-%s', y, lpad(seq::text, 3, '0'))
        WHERE id = r.id;
    END LOOP;
END $$;

ALTER TABLE public.students
    ALTER COLUMN id_interne SET NOT NULL;

DROP INDEX IF EXISTS students_id_interne_uq;

ALTER TABLE public.students
    ADD CONSTRAINT students_id_interne_key UNIQUE (id_interne);

COMMENT ON COLUMN public.students.id_interne IS
    'Identifiant métier unique (ex. CIA-2026-001). Saisi à la main ou généré si vide.';

CREATE OR REPLACE FUNCTION public.students_assign_id_interne()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    y INTEGER;
    seq INTEGER;
BEGIN
    IF NEW.id_interne IS NOT NULL AND btrim(NEW.id_interne) <> '' THEN
        NEW.id_interne := btrim(NEW.id_interne);
        RETURN NEW;
    END IF;

    y := EXTRACT(
        YEAR FROM timezone('UTC', COALESCE(NEW.created_at, NOW()))
    )::INTEGER;

    INSERT INTO public.student_internal_id_counters (year, next_val)
    VALUES (y, 1)
    ON CONFLICT (year) DO UPDATE
    SET next_val = public.student_internal_id_counters.next_val + 1
    RETURNING next_val INTO seq;

    NEW.id_interne := format('CIA-%s-%s', y, lpad(seq::text, 3, '0'));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_assign_id_interne ON public.students;

CREATE TRIGGER trg_students_assign_id_interne
    BEFORE INSERT OR UPDATE OF id_interne ON public.students
    FOR EACH ROW
    EXECUTE PROCEDURE public.students_assign_id_interne();
