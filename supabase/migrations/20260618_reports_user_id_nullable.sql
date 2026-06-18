-- 사용자 계정 삭제 시 보고서·문의 데이터 보존
-- ON DELETE CASCADE → ON DELETE SET NULL 으로 변경
-- user_id를 nullable로 변경 (계정 삭제 후에도 리포트는 기관 소속으로 남음)

-- ── reports ──────────────────────────────────────────────────
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_user_id_fkey;

ALTER TABLE public.reports
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ── inquiries ────────────────────────────────────────────────
ALTER TABLE public.inquiries
  DROP CONSTRAINT IF EXISTS inquiries_user_id_fkey;

ALTER TABLE public.inquiries
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ── inquiry_replies ──────────────────────────────────────────
ALTER TABLE public.inquiry_replies
  DROP CONSTRAINT IF EXISTS inquiry_replies_admin_id_fkey;

ALTER TABLE public.inquiry_replies
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.inquiry_replies
  ADD CONSTRAINT inquiry_replies_admin_id_fkey
  FOREIGN KEY (admin_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
