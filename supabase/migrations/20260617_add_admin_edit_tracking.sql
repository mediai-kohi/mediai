-- 관리자 수정 추적 컬럼 추가
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz;
