-- ============================================================
-- SQL Editor 붙여넣기용 통합 스크립트 — 무료 테스트용 Supabase 프로젝트 전용
--
-- 구성:
--   1) test-project-only-bootstrap.sql  (테스트 DB에 profiles 테이블 재현)
--   2) migrations/20260811_create_edu_platform.sql  (edu_ 테이블 — 운영에도 그대로 적용 가능한 실제 기능 마이그레이션)
--
-- 사용법: 이 파일 전체를 테스트 Supabase 프로젝트의 SQL Editor에 붙여넣고 1회 실행합니다.
-- 운영(mediai) 프로젝트에는 이미 profiles가 있으므로, 나중에 실제로 합칠 때는
-- 이 파일이 아니라 supabase/migrations/20260811_create_edu_platform.sql 부분만 실행하세요.
-- ============================================================


-- ============================================================
-- PART 1 — 테스트 전용 profiles 재현 (운영에는 이미 존재, 실행 금지)
-- ============================================================

CREATE TABLE public.profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization       text NOT NULL DEFAULT '',
  agency_type        text CHECK (agency_type IN ('운영기관', '협력기관', '주관기관')),
  role               text NOT NULL DEFAULT 'user'
                     CHECK (role IN ('user', 'super_admin', 'moh_editor', 'ministry_viewer')),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  privacy_agreed     boolean NOT NULL DEFAULT false,
  privacy_agreed_at  timestamptz,
  user_code          text NOT NULL UNIQUE,
  memo               text,
  display_name       varchar(20),
  department         text CHECK (department IN ('바이오헬스교육부', '의료AI교육팀')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_code ON public.profiles (user_code);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART 2 — edu_ 플랫폼 테이블 (운영 이관 시 그대로 재사용 가능한 실제 기능 마이그레이션)
-- ============================================================

CREATE TABLE public.edu_courses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        NOT NULL UNIQUE,
  title        text        NOT NULL,
  location     text        NOT NULL DEFAULT '',
  course_type  text        NOT NULL DEFAULT 'single' CHECK (course_type IN ('single', 'series')),
  capacity     integer     NOT NULL DEFAULT 0,
  description  text        NOT NULL DEFAULT '',
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_courses_created_by_idx ON public.edu_courses (created_by);

CREATE TABLE public.edu_sessions (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id                 uuid        NOT NULL REFERENCES public.edu_courses(id) ON DELETE CASCADE,
  label                     text        NOT NULL,
  session_date              date,
  checkpoint_start_enabled  boolean     NOT NULL DEFAULT true,
  checkpoint_mid_enabled    boolean     NOT NULL DEFAULT false,
  checkpoint_end_enabled    boolean     NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edu_sessions_at_least_one_checkpoint
    CHECK (checkpoint_start_enabled OR checkpoint_mid_enabled OR checkpoint_end_enabled)
);

CREATE INDEX edu_sessions_course_id_idx ON public.edu_sessions (course_id);

CREATE TABLE public.edu_registrations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid        NOT NULL REFERENCES public.edu_courses(id) ON DELETE CASCADE,
  participant_code  text        NOT NULL UNIQUE,
  registered_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_registrations_course_id_idx ON public.edu_registrations (course_id);

CREATE TABLE public.edu_attendance (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.edu_sessions(id) ON DELETE CASCADE,
  registration_id  uuid        NOT NULL REFERENCES public.edu_registrations(id) ON DELETE CASCADE,
  checkpoint       text        NOT NULL CHECK (checkpoint IN ('start', 'mid', 'end')),
  checked_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, registration_id, checkpoint)
);

CREATE INDEX edu_attendance_registration_id_idx ON public.edu_attendance (registration_id);
CREATE INDEX edu_attendance_session_id_idx      ON public.edu_attendance (session_id);

CREATE TABLE public.edu_survey_questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('rating', 'text')),
  required    boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_survey_questions_active_sort_idx ON public.edu_survey_questions (is_active, sort_order);

CREATE TABLE public.edu_survey_response_sets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid        NOT NULL REFERENCES public.edu_courses(id) ON DELETE CASCADE,
  registration_id  uuid        NOT NULL REFERENCES public.edu_registrations(id) ON DELETE CASCADE,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id)
);

CREATE INDEX edu_survey_response_sets_course_id_idx ON public.edu_survey_response_sets (course_id);

CREATE TABLE public.edu_survey_answers (
  id                 uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  response_set_id    uuid  NOT NULL REFERENCES public.edu_survey_response_sets(id) ON DELETE CASCADE,
  question_id        uuid  NOT NULL REFERENCES public.edu_survey_questions(id),
  rating_value       integer CHECK (rating_value BETWEEN 1 AND 5),
  text_value         text,
  CONSTRAINT edu_survey_answers_one_value_only
    CHECK (num_nonnulls(rating_value, text_value) = 1)
);

CREATE INDEX edu_survey_answers_response_set_id_idx ON public.edu_survey_answers (response_set_id);
CREATE INDEX edu_survey_answers_question_id_idx     ON public.edu_survey_answers (question_id);

ALTER TABLE public.edu_courses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_registrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_attendance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_survey_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_survey_response_sets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_survey_answers        ENABLE ROW LEVEL SECURITY;
