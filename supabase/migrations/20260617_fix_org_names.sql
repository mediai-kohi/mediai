-- 기관명 띄어쓰기 수정: profiles 테이블
UPDATE public.profiles
SET organization = '차의과학대학교 분당차병원'
WHERE organization = '차의과학대학교분당차병원';

UPDATE public.profiles
SET organization = '중앙대학교 광명병원'
WHERE organization = '중앙대학교광명병원';

-- 기관명 띄어쓰기 수정: organizations 테이블
UPDATE public.organizations
SET name = '차의과학대학교 분당차병원'
WHERE name = '차의과학대학교분당차병원';

UPDATE public.organizations
SET name = '중앙대학교 광명병원'
WHERE name = '중앙대학교광명병원';

-- events 테이블도 동기화
UPDATE public.events
SET organization = '차의과학대학교 분당차병원'
WHERE organization = '차의과학대학교분당차병원';

UPDATE public.events
SET organization = '중앙대학교 광명병원'
WHERE organization = '중앙대학교광명병원';
