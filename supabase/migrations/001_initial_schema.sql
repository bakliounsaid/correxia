-- CORREXIA — schéma initial PostgreSQL (Supabase ou Postgres local)
-- Exécuter dans l’éditeur SQL Supabase ou : psql $DATABASE_URL -f 001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optionnel : lier à auth.users (Supabase). Décommentez si vous utilisez uniquement Supabase Auth
-- et supprimez password_hash côté app si vous ne faites pas login FastAPI.
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'teacher'
        CHECK (role IN ('admin', 'teacher', 'school_admin', 'director')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url TEXT,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320),
    phone VARCHAR(64),
    address TEXT,
    city VARCHAR(128),
    postal_code VARCHAR(32),
    country VARCHAR(64) DEFAULT 'FR',
    admin_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
    subscription_plan VARCHAR(64),
    subscription_status VARCHAR(32),
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    max_teachers INTEGER DEFAULT 10,
    current_teachers INTEGER DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE SET NULL,
    subject VARCHAR(32) NOT NULL DEFAULT 'math'
        CHECK (subject IN ('math', 'physics', 'science')),
    is_independent BOOLEAN NOT NULL DEFAULT TRUE,
    subscription_plan VARCHAR(32) NOT NULL DEFAULT 'free'
        CHECK (subscription_plan IN ('free', 'advanced', 'mastery')),
    subscription_status VARCHAR(32),
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    tests_created INTEGER NOT NULL DEFAULT 0,
    tests_this_month INTEGER NOT NULL DEFAULT 0,
    copies_processed INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools (id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    email VARCHAR(320),
    class_name VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.test_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE SET NULL,
    file_name VARCHAR(512) NOT NULL,
    file_url TEXT,
    file_type VARCHAR(16) CHECK (file_type IN ('pdf', 'docx', 'txt')),
    file_content TEXT,
    file_size_mb NUMERIC(10, 3),
    upload_status VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE SET NULL,
    title VARCHAR(512) NOT NULL,
    description TEXT,
    subject VARCHAR(32) NOT NULL DEFAULT 'math'
        CHECK (subject IN ('math', 'physics', 'science')),
    level VARCHAR(32) NOT NULL DEFAULT 'Terminale'
        CHECK (level IN ('2nde', '1ère', 'Terminale')),
    duration_minutes INTEGER,
    total_questions INTEGER,
    total_points INTEGER,
    passing_grade NUMERIC(6, 2),
    questions JSONB DEFAULT '[]'::JSONB,
    rubric JSONB DEFAULT '[]'::JSONB,
    source_file_ids UUID[] DEFAULT ARRAY[]::UUID[],
    status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'created', 'in_progress', 'completed')),
    copies_generated INTEGER NOT NULL DEFAULT 0,
    copies_submitted INTEGER NOT NULL DEFAULT 0,
    copies_corrected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.test_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE SET NULL,
    unique_test_id VARCHAR(255) NOT NULL UNIQUE,
    pdf_url TEXT,
    pdf_generated_at TIMESTAMPTZ,
    scanned_image_url TEXT,
    scanned_uploaded_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'generated'
        CHECK (status IN (
            'generated', 'printed', 'in_exam', 'submitted', 'pending_review',
            'auto_corrected', 'validated', 'archived'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.copy_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copy_id UUID NOT NULL UNIQUE REFERENCES public.test_copies (id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers (id) ON DELETE CASCADE,
    ai_analysis_json JSONB,
    ai_confidence_score DOUBLE PRECISION,
    ai_total_points DOUBLE PRECISION,
    ai_processed_at TIMESTAMPTZ,
    teacher_validated_points DOUBLE PRECISION,
    teacher_comments TEXT,
    teacher_feedback TEXT,
    teacher_corrected_at TIMESTAMPTZ,
    is_validated BOOLEAN NOT NULL DEFAULT FALSE,
    validation_status VARCHAR(32) DEFAULT 'pending'
        CHECK (validation_status IN ('pending', 'accepted_ai', 'modified', 'rejected_ai')),
    processing_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
    processing_error TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE CASCADE,
    plan_type VARCHAR(64) NOT NULL,
    plan_name VARCHAR(128),
    price_cents INTEGER NOT NULL,
    billing_period VARCHAR(16) NOT NULL
        CHECK (billing_period IN ('monthly', 'quarterly', 'yearly')),
    status VARCHAR(32) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'cancelled')),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_invoice_id VARCHAR(255),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subscriptions_owner_chk CHECK (
        (teacher_id IS NOT NULL AND school_id IS NULL)
        OR (teacher_id IS NULL AND school_id IS NOT NULL)
    )
);

CREATE TABLE public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers (id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools (id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    action_value VARCHAR(512),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers (id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools (id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL,
    total_tests_created INTEGER DEFAULT 0,
    total_copies_generated INTEGER DEFAULT 0,
    total_copies_corrected INTEGER DEFAULT 0,
    total_copies_validated INTEGER DEFAULT 0,
    average_ai_confidence DOUBLE PRECISION,
    average_validation_score DOUBLE PRECISION,
    total_time_saved_hours DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX statistics_teacher_period_uq
    ON public.statistics (teacher_id, period)
    WHERE teacher_id IS NOT NULL;

CREATE UNIQUE INDEX statistics_school_period_uq
    ON public.statistics (school_id, period)
    WHERE school_id IS NOT NULL;

CREATE INDEX idx_teachers_user_id ON public.teachers (user_id);
CREATE INDEX idx_students_teacher_id ON public.students (teacher_id);
CREATE INDEX idx_tests_teacher_id ON public.tests (teacher_id);
CREATE INDEX idx_test_copies_test_id ON public.test_copies (test_id);
CREATE INDEX idx_copy_corrections_test_id ON public.copy_corrections (test_id);
