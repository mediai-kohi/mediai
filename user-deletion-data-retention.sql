-- ============================================================
-- 사용자 계정 삭제 시 데이터 보존 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================
-- 목적: 사용자 계정(auth.users + profiles)이 삭제되더라도
--       보고서·문의·답변 데이터는 그대로 남도록
--       FK 제약을 ON DELETE CASCADE → ON DELETE SET NULL 으로 변경.
--
-- chat_histories, push_subscriptions 은 에피메럴 데이터이므로
-- CASCADE 유지 (계정 삭제 시 함께 제거).
-- ============================================================

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
-- 답변 작성자는 admin_id 컬럼으로 참조 (user_id 아님)
ALTER TABLE public.inquiry_replies
  DROP CONSTRAINT IF EXISTS inquiry_replies_admin_id_fkey;

ALTER TABLE public.inquiry_replies
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.inquiry_replies
  ADD CONSTRAINT inquiry_replies_admin_id_fkey
  FOREIGN KEY (admin_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ── 확인 쿼리 ────────────────────────────────────────────────
-- SELECT tc.table_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON tc.constraint_name = rc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'user_id'
-- ORDER BY tc.table_name;
