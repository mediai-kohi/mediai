-- ============================================================
-- ⚠️ 테스트 프로젝트 전용 — service_role 권한 부여 스크립트
-- "permission denied for table ..." 오류가 날 때 실행합니다.
-- (일반적으로 Supabase 프로젝트는 이 grant가 기본 설정되어 있지만,
--  이 테스트 프로젝트에는 빠져있는 것으로 보입니다.)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
