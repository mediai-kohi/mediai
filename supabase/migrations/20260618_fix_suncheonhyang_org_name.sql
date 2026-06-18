-- 기관명 수정: 순천향대 부속 천안병원 → 순천향대학교 부속 천안병원

UPDATE public.profiles
SET organization = '순천향대학교 부속 천안병원'
WHERE organization = '순천향대 부속 천안병원';

UPDATE public.organizations
SET name = '순천향대학교 부속 천안병원'
WHERE name = '순천향대 부속 천안병원';

UPDATE public.events
SET organization = '순천향대학교 부속 천안병원'
WHERE organization = '순천향대 부속 천안병원';
