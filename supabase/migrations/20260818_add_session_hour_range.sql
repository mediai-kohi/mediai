-- ============================================================
-- edu_sessions.start_hour / end_hour — 회차 참여시간을 "00시~24시 중 선택"
-- 방식으로 입력받기 위한 컬럼. duration_minutes는 계속 계산의 단일 기준으로
-- 남겨두되(수료율 계산 등 기존 로직 무변경), 이 두 컬럼은 관리자가 실제로
-- 선택한 시작/종료 시각을 보존해 편집 화면에서 다시 보여줄 수 있게 한다.
-- 기존 회차는 값이 없으므로(NULL) 화면에서 duration_minutes 기반으로만 표시된다.
-- ============================================================
ALTER TABLE public.edu_sessions
  ADD COLUMN start_hour smallint CHECK (start_hour BETWEEN 0 AND 24),
  ADD COLUMN end_hour   smallint CHECK (end_hour BETWEEN 0 AND 24),
  ADD CONSTRAINT edu_sessions_hour_range_valid CHECK (
    (start_hour IS NULL AND end_hour IS NULL) OR (end_hour > start_hour)
  );
