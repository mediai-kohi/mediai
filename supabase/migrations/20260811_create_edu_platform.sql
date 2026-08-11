-- ============================================================
-- 교육 신청·출석·만족도 관리 모듈 (edu_ 접두사 테이블)
--
-- 소유권 모델: edu_courses.created_by = auth.uid() 인 사용자(role 무관, status='approved')
--   가 본인 과정을 관리한다. super_admin은 전체 과정을 관리한다.
--   edu_survey_questions는 여러 과정이 공유하는 전역 설정이며 super_admin 전용이다.
--
-- 참가자(edu_registrations)는 로그인하지 않으며 개인정보를 저장하지 않는다.
--   신원 증명은 발급된 무작위 participant_code 하나로 대체한다.
--
-- 모든 테이블은 RLS를 켜고 정책은 추가하지 않는다(service_role 전용, 기존
-- 20260624_enable_rls_all_tables.sql과 동일한 패턴). 실제 읽기/쓰기 권한 및
-- 소유권 검증은 애플리케이션 레벨(src/lib/edu/access.ts)에서 수행한다.
-- ============================================================

-- ============================================================
-- 1. edu_courses — 과정
-- ============================================================
CREATE TABLE public.edu_courses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        NOT NULL UNIQUE,
  title        text        NOT NULL,
  location     text        NOT NULL DEFAULT '',
  -- course_type: 'single'(단일 교육) | 'series'(다회차 장기 과정) — 회차 추가 UI 노출 여부에 사용
  course_type  text        NOT NULL DEFAULT 'single' CHECK (course_type IN ('single', 'series')),
  -- capacity = 0 은 "정원 무제한"을 의미한다 (프론트에서 빈 값 입력 시 0으로 저장)
  capacity     integer     NOT NULL DEFAULT 0,
  description  text        NOT NULL DEFAULT '',
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_courses_created_by_idx ON public.edu_courses (created_by);

-- ============================================================
-- 2. edu_sessions — 회차 (단일 교육도 회차 1개로 표현)
-- ============================================================
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

-- ============================================================
-- 3. edu_registrations — 참가 신청 (개인정보 없음, participant_code가 신원)
-- ============================================================
CREATE TABLE public.edu_registrations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid        NOT NULL REFERENCES public.edu_courses(id) ON DELETE CASCADE,
  participant_code  text        NOT NULL UNIQUE,
  registered_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_registrations_course_id_idx ON public.edu_registrations (course_id);

-- ============================================================
-- 4. edu_attendance — 회차별 체크포인트 출석 기록
-- ============================================================
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

-- ============================================================
-- 5. edu_survey_questions — 만족도 문항 (전역 설정, super_admin 전용)
-- ============================================================
CREATE TABLE public.edu_survey_questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('rating', 'text')),
  required    boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  -- 물리 삭제 대신 비활성화: 과거 응답(edu_survey_answers)이 참조 무결성을 유지하도록 함
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_survey_questions_active_sort_idx ON public.edu_survey_questions (is_active, sort_order);

-- ============================================================
-- 6. edu_survey_response_sets — 참가자 1인당 과정 1회 제출
-- ============================================================
CREATE TABLE public.edu_survey_response_sets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid        NOT NULL REFERENCES public.edu_courses(id) ON DELETE CASCADE,
  registration_id  uuid        NOT NULL REFERENCES public.edu_registrations(id) ON DELETE CASCADE,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id)
);

CREATE INDEX edu_survey_response_sets_course_id_idx ON public.edu_survey_response_sets (course_id);

-- ============================================================
-- 7. edu_survey_answers — 문항별 응답 (rating XOR text)
-- ============================================================
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

-- ============================================================
-- RLS 활성화 — 전 테이블 service_role 전용, 정책 없음
-- ============================================================
ALTER TABLE public.edu_courses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_registrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_attendance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_survey_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_survey_response_sets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_survey_answers        ENABLE ROW LEVEL SECURITY;
