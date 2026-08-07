-- attachments.entity_type에 'moh_weekly_report' 추가 + 어느 부서/칸의 첨부인지 구분하는 section 컬럼 추가
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.attachments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%entity_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.attachments DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_entity_type_check
  CHECK (entity_type IN ('inquiry', 'report', 'moh_weekly_report'));

-- 'bio_prev' | 'bio_next' | 'ai_prev' | 'ai_next' (moh_weekly_report 전용, 기존 2개 타입은 항상 NULL)
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS section text;
