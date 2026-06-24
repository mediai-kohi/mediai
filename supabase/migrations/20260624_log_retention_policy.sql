-- ============================================================
-- 로그 보관 기간 정책 (Phase 2-2)
-- 근거: 제55조 — rate_limit_log 1년, ai_audit_log 1년, audit_log 3년
-- 전제: Supabase pg_cron 확장이 활성화되어 있어야 합니다.
--   (Supabase 대시보드 → Database → Extensions → pg_cron 검색 → Enable)
-- ============================================================

-- rate_limit_log 보관 기간: 24시간 → 1년
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.rate_limit_log WHERE created_at < now() - INTERVAL '1 year';
$$;

-- rate_limit_log 정기 실행 (매일 02:00 UTC)
SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '0 2 * * *',
  $$ SELECT public.cleanup_rate_limit_log() $$
);

-- ai_audit_log 보관 기간: 1년
SELECT cron.schedule(
  'cleanup-ai-audit-log',
  '0 3 * * *',
  $$ DELETE FROM public.ai_audit_log WHERE created_at < now() - INTERVAL '1 year' $$
);

-- audit_log 보관 기간: 3년 (계정 이력 요건 제75조)
SELECT cron.schedule(
  'cleanup-audit-log',
  '0 4 * * *',
  $$ DELETE FROM public.audit_log WHERE created_at < now() - INTERVAL '3 years' $$
);
