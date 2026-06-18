-- profiles.email 컬럼 제거
-- 로그인은 user_code 기반으로 {user_code}@eduops.internal 내부 이메일을 직접 계산하므로 불필요
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
