-- profiles 테이블에 별명 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(20);
