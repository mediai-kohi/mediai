-- 보건복지부 주간업무보고 기능: role 확장 + 부서 구분 컬럼 추가
-- role: 'super_admin' | 'user' 2단계 → 'moh_editor'(바이오헬스교육부 작성자),
--       'ministry_viewer'(보건복지부 열람자) 추가
-- department: 인재원 내부 부서 구분(신규 기능 전용, organization과는 별개의 독립 필드)

-- profiles.role CHECK 제약을 이름에 의존하지 않고 동적으로 찾아 재정의
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'user', 'moh_editor', 'ministry_viewer'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text
  CHECK (department IN ('바이오헬스교육부', '의료AI교육팀'));

-- 배포 후 수동 실행 필요 (계정 UUID 확인 후):
-- UPDATE public.profiles SET department = '의료AI교육팀' WHERE role = 'super_admin' AND id = '<기존 슈퍼관리자 uuid>';
