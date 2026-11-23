-- ============================================================
-- 수료 기준(%) 자동화 + 회차별 참여시간 + 만족도 설문 오픈 창
--
-- 1) edu_courses.completion_threshold_percent: 과정별 수료 인정 기준(%),
--    기본값 80. 회차별 교육시간 대비 출석 인정 시간의 비율이 이 값
--    이상이면 수료로 판정한다.
-- 2) edu_sessions.duration_minutes: 회차별 교육시간(분). 기존 회차는
--    임시로 60분(균등 가중치)이 채워지며, 관리자가 실제 시간으로
--    수정해야 정확한 %가 계산된다.
-- 3) edu_survey_windows: 만족도 설문 "오픈" 상태를 나타내는 시간창.
--    edu_checkin_windows와 동일한 패턴이지만 session_id/checkpoint가
--    아닌 course_id 단일 스코프로 관리한다.
-- ============================================================

ALTER TABLE public.edu_courses
  ADD COLUMN completion_threshold_percent integer NOT NULL DEFAULT 80
  CHECK (completion_threshold_percent BETWEEN 1 AND 100);

ALTER TABLE public.edu_sessions
  ADD COLUMN duration_minutes integer NOT NULL DEFAULT 60
  CHECK (duration_minutes BETWEEN 1 AND 1440);

CREATE TABLE public.edu_survey_windows (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid        NOT NULL REFERENCES public.edu_courses(id) ON DELETE CASCADE,
  token             text        NOT NULL UNIQUE,
  duration_minutes  integer     NOT NULL CHECK (duration_minutes BETWEEN 1 AND 10080),
  opened_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  closed_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_survey_windows_token_idx ON public.edu_survey_windows (token);
CREATE INDEX edu_survey_windows_course_id_idx ON public.edu_survey_windows (course_id);

ALTER TABLE public.edu_survey_windows ENABLE ROW LEVEL SECURITY;
-- service_role 전용, 정책 없음 — 기존 edu_ 테이블과 동일한 패턴
