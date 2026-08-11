-- ============================================================
-- ⚠️ 테스트 프로젝트 전용 부트스트랩 스크립트 — supabase/migrations/에 포함되지 않음
--
-- 목적: feature/edu-platform 개발을 위해 준비한 "무료 테스트용" Supabase
--       프로젝트는 완전히 빈 프로젝트이므로, 로그인이 동작하려면 운영(mediai)
--       프로젝트의 profiles 테이블(최종 형태)을 먼저 재현해야 합니다.
--
-- 운영 프로젝트에는 이미 profiles 테이블이 있으므로 이 파일을 절대 운영에
-- 실행하지 마세요. 이 파일은 테스트 프로젝트의 SQL Editor에서 1회만 실행합니다.
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
-- service_role(createAdminClient)만 접근 — 운영 프로젝트와 동일한 패턴, 정책 없음
