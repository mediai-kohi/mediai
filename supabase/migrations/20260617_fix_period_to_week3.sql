-- 모든 보고서의 기간을 2026년 6월 3주차로 일괄 변경
-- period_start: 2026-06-15 (월), period_end: 2026-06-21 (일)
UPDATE reports
SET
  period_start  = '2026-06-15',
  period_end    = '2026-06-21',
  period_label  = '2026년 6월 3주'
WHERE
  period_start >= '2026-06-01'
  AND period_start <= '2026-06-30';
