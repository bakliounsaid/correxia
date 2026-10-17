from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = mapped_column(String(320), unique=True, nullable=False)
    full_name = mapped_column(String(255), nullable=False)
    role = mapped_column(String(32), default="teacher")
    is_active = mapped_column(Boolean, default=True)
    avatar_url = mapped_column(Text, nullable=True)
    password_hash = mapped_column(String(255), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    teacher = relationship("Teacher", back_populates="user", uselist=False)


class School(Base):
    __tablename__ = "schools"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = mapped_column(String(255), nullable=False)
    email = mapped_column(String(320), nullable=True)
    phone = mapped_column(String(64), nullable=True)
    address = mapped_column(Text, nullable=True)
    city = mapped_column(String(128), nullable=True)
    postal_code = mapped_column(String(32), nullable=True)
    country = mapped_column(String(64), default="FR")
    admin_user_id = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    subscription_plan = mapped_column(String(64), nullable=True)
    subscription_status = mapped_column(String(32), nullable=True)
    subscription_start_date = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_end_date = mapped_column(DateTime(timezone=True), nullable=True)
    max_teachers = mapped_column(Integer, default=10)
    current_teachers = mapped_column(Integer, default=0)
    stripe_customer_id = mapped_column(String(255), nullable=True)
    stripe_subscription_id = mapped_column(String(255), unique=True, nullable=True)
    is_verified = mapped_column(Boolean, default=False)
    verification_code = mapped_column(String(64), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Teacher(Base):
    __tablename__ = "teachers"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL"), nullable=True)
    subject = mapped_column(String(32), default="math")
    is_independent = mapped_column(Boolean, default=True)
    subscription_plan = mapped_column(String(32), default="free")
    subscription_status = mapped_column(String(32), nullable=True)
    subscription_start_date = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_end_date = mapped_column(DateTime(timezone=True), nullable=True)
    tests_created = mapped_column(Integer, default=0)
    tests_this_month = mapped_column(Integer, default=0)
    copies_processed = mapped_column(Integer, default=0)
    stripe_customer_id = mapped_column(String(255), nullable=True)
    stripe_subscription_id = mapped_column(String(255), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="teacher")


class Student(Base):
    __tablename__ = "students"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True)
    class_id = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    first_name = mapped_column(String(128), nullable=False)
    last_name = mapped_column(String(128), nullable=False)
    email = mapped_column(String(320), nullable=True)
    class_name = mapped_column(String(120), nullable=True)
    id_interne = mapped_column(String(64), nullable=True)
    is_active = mapped_column(Boolean, default=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Class(Base):
    __tablename__ = "classes"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Propriétaire : un établissement OU un enseignant indépendant (contrainte classes_owner_chk)
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    name = mapped_column(String(120), nullable=False)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ClassTeacher(Base):
    __tablename__ = "class_teachers"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"))
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


class TestSource(Base):
    __tablename__ = "test_sources"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL"), nullable=True)
    file_name = mapped_column(String(512), nullable=False)
    file_url = mapped_column(Text, nullable=True)
    file_type = mapped_column(String(16), nullable=True)
    file_content = mapped_column(Text, nullable=True)
    file_size_mb = mapped_column(Numeric(10, 3), nullable=True)
    upload_status = mapped_column(String(64), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Test(Base):
    __tablename__ = "tests"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL"), nullable=True)
    title = mapped_column(String(512), nullable=False)
    description = mapped_column(Text, nullable=True)
    subject = mapped_column(String(32), default="math")
    level = mapped_column(String(32), default="Terminale")
    class_name = mapped_column(String(120), nullable=True)
    subject_file_url = mapped_column(Text, nullable=True)
    subject_file_name = mapped_column(String(255), nullable=True)
    correction_file_url = mapped_column(Text, nullable=True)
    correction_file_name = mapped_column(String(255), nullable=True)
    duration_minutes = mapped_column(Integer, nullable=True)
    total_questions = mapped_column(Integer, nullable=True)
    total_points = mapped_column(Integer, nullable=True)
    passing_grade = mapped_column(Numeric(6, 2), nullable=True)
    questions = mapped_column(JSONB, nullable=False, insert_default=lambda: [])
    rubric = mapped_column(JSONB, nullable=False, insert_default=lambda: [])
    source_file_ids = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    status = mapped_column(String(32), default="draft")
    copies_generated = mapped_column(Integer, default=0)
    copies_submitted = mapped_column(Integer, default=0)
    copies_corrected = mapped_column(Integer, default=0)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TestCopy(Base):
    __tablename__ = "test_copies"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"))
    student_id = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"))
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL"), nullable=True)
    unique_test_id = mapped_column(String(255), unique=True, nullable=False)
    pdf_url = mapped_column(Text, nullable=True)
    pdf_generated_at = mapped_column(DateTime(timezone=True), nullable=True)
    scanned_image_url = mapped_column(Text, nullable=True)
    scanned_uploaded_at = mapped_column(DateTime(timezone=True), nullable=True)
    status = mapped_column(String(32), default="generated")
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CopyCorrection(Base):
    __tablename__ = "copy_corrections"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    copy_id = mapped_column(UUID(as_uuid=True), ForeignKey("test_copies.id", ondelete="CASCADE"), unique=True)
    test_id = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"))
    student_id = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"))
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    ai_analysis_json = mapped_column(JSONB, nullable=True)
    ai_confidence_score = mapped_column(Float, nullable=True)
    ai_total_points = mapped_column(Float, nullable=True)
    ai_processed_at = mapped_column(DateTime(timezone=True), nullable=True)
    teacher_validated_points = mapped_column(Float, nullable=True)
    teacher_comments = mapped_column(Text, nullable=True)
    teacher_feedback = mapped_column(Text, nullable=True)
    teacher_corrected_at = mapped_column(DateTime(timezone=True), nullable=True)
    is_validated = mapped_column(Boolean, default=False)
    validation_status = mapped_column(String(32), nullable=True)
    processing_status = mapped_column(String(32), default="pending")
    processing_error = mapped_column(Text, nullable=True)
    processing_time_ms = mapped_column(Integer, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True)
    plan_type = mapped_column(String(64), nullable=False)
    plan_name = mapped_column(String(128), nullable=True)
    price_cents = mapped_column(Integer, nullable=False)
    billing_period = mapped_column(String(16), nullable=False)
    status = mapped_column(String(32), default="active")
    stripe_customer_id = mapped_column(String(255), nullable=True)
    stripe_subscription_id = mapped_column(String(255), unique=True, nullable=True)
    stripe_invoice_id = mapped_column(String(255), nullable=True)
    start_date = mapped_column(DateTime(timezone=True), nullable=True)
    end_date = mapped_column(DateTime(timezone=True), nullable=True)
    next_billing_date = mapped_column(DateTime(timezone=True), nullable=True)
    auto_renew = mapped_column(Boolean, default=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL"), nullable=True)
    action = mapped_column(String(128), nullable=False)
    action_value = mapped_column(String(512), nullable=True)
    details = mapped_column(JSONB, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


class Statistic(Base):
    __tablename__ = "statistics"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)
    school_id = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True)
    period = mapped_column(String(7), nullable=False)
    total_tests_created = mapped_column(Integer, default=0)
    total_copies_generated = mapped_column(Integer, default=0)
    total_copies_corrected = mapped_column(Integer, default=0)
    total_copies_validated = mapped_column(Integer, default=0)
    average_ai_confidence = mapped_column(Float, nullable=True)
    average_validation_score = mapped_column(Float, nullable=True)
    total_time_saved_hours = mapped_column(Float, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
