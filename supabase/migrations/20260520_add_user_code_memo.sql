-- user_code: 8자리 영문+숫자 로그인 ID (이메일 대체)
-- memo: 관리자 전용 비고란
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_code TEXT,
  ADD COLUMN IF NOT EXISTS memo      TEXT;

-- 기존 사용자: UUID 앞 8자리(hex)를 대문자로 변환하여 코드 부여
UPDATE public.profiles
SET user_code = upper(left(replace(id::text, '-', ''), 8))
WHERE user_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN user_code SET NOT NULL,
  ADD CONSTRAINT profiles_user_code_key UNIQUE (user_code);

CREATE INDEX IF NOT EXISTS idx_profiles_user_code ON public.profiles(user_code);
