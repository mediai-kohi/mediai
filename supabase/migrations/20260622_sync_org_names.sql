-- ============================================================
-- 기관명 불일치 진단 및 동기화
-- organizations 테이블을 기준(source of truth)으로
-- profiles / reports / events 를 일괄 갱신합니다.
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. 현재 불일치 현황 확인 (실행 전 먼저 조회)
-- ──────────────────────────────────────────────

-- profiles 중 organizations에 없는 기관명 목록
SELECT 'profiles' AS "테이블", organization AS "현재 기관명", COUNT(*) AS "건수"
FROM public.profiles
WHERE organization NOT IN (SELECT name FROM public.organizations)
  AND organization IS NOT NULL AND organization <> ''
GROUP BY organization

UNION ALL

-- reports 중 organizations에 없는 기관명 목록
SELECT 'reports', organization, COUNT(*)
FROM public.reports
WHERE organization NOT IN (SELECT name FROM public.organizations)
  AND organization IS NOT NULL AND organization <> ''
GROUP BY organization

UNION ALL

-- events 중 organizations에 없는 기관명 목록
SELECT 'events', organization, COUNT(*)
FROM public.events
WHERE organization NOT IN (SELECT name FROM public.organizations)
  AND organization IS NOT NULL AND organization <> ''
GROUP BY organization

ORDER BY "테이블", "현재 기관명";

-- ──────────────────────────────────────────────
-- 2. 과거 누락된 reports 동기화
--    (20260617, 20260618 마이그레이션에서 reports를 빠뜨림)
-- ──────────────────────────────────────────────

UPDATE public.reports
SET organization = '차의과학대학교 분당차병원'
WHERE organization = '차의과학대학교분당차병원';

UPDATE public.reports
SET organization = '중앙대학교 광명병원'
WHERE organization = '중앙대학교광명병원';

UPDATE public.reports
SET organization = '순천향대학교 부속 천안병원'
WHERE organization = '순천향대 부속 천안병원';

-- ──────────────────────────────────────────────
-- 3. 진단 결과 불일치 항목 동기화
--    organizations 기준 이름으로 profiles / reports / events 갱신
-- ──────────────────────────────────────────────

-- 중앙대학교 광명병원 → 중앙대학교광명병원
UPDATE public.profiles SET organization = '중앙대학교광명병원' WHERE organization = '중앙대학교 광명병원';
UPDATE public.reports  SET organization = '중앙대학교광명병원' WHERE organization = '중앙대학교 광명병원';
UPDATE public.events   SET organization = '중앙대학교광명병원' WHERE organization = '중앙대학교 광명병원';

-- 한국의학연구소 → KMI한국의학연구소
UPDATE public.profiles SET organization = 'KMI한국의학연구소' WHERE organization = '한국의학연구소';
UPDATE public.reports  SET organization = 'KMI한국의학연구소' WHERE organization = '한국의학연구소';
UPDATE public.events   SET organization = 'KMI한국의학연구소' WHERE organization = '한국의학연구소';
