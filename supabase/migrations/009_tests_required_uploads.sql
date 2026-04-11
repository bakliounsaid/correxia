-- Documents requis avant démarrage de la correction.
ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS subject_file_url TEXT,
ADD COLUMN IF NOT EXISTS subject_file_name VARCHAR(512),
ADD COLUMN IF NOT EXISTS correction_file_url TEXT,
ADD COLUMN IF NOT EXISTS correction_file_name VARCHAR(512);

