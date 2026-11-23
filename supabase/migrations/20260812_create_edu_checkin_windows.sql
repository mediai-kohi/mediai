-- ============================================================
-- edu_checkin_windows — 체크포인트별 "자가 체크인 QR" 유효 시간 창
--
-- 기존 방식(관리자가 참가자 QR을 카메라로 스캔)을 뒤집어서, 관리자가
-- 회차·체크포인트별로 QR을 발급/게시하면 참가자가 본인 폰으로 스캔해서
-- 셀프 체크인하는 방식으로 전환한다.
--
-- 토큰(token)이 QR에 인코딩되는 값이며, opened_at ~ expires_at 사이에만
-- 유효하다. 관리자가 유효시간(duration_minutes)을 직접 설정해 매 발급마다
-- 원하는 시간만큼만 열어둘 수 있다. 같은 (session_id, checkpoint)에 대해
-- 새로 발급하면 이전 창은 closed_at으로 즉시 무효화된다(재사용 방지).
-- ============================================================
CREATE TABLE public.edu_checkin_windows (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.edu_sessions(id) ON DELETE CASCADE,
  checkpoint        text        NOT NULL CHECK (checkpoint IN ('start', 'mid', 'end')),
  token             text        NOT NULL UNIQUE,
  duration_minutes  integer     NOT NULL CHECK (duration_minutes BETWEEN 1 AND 720),
  opened_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  closed_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edu_checkin_windows_token_idx ON public.edu_checkin_windows (token);
CREATE INDEX edu_checkin_windows_session_checkpoint_idx ON public.edu_checkin_windows (session_id, checkpoint);

ALTER TABLE public.edu_checkin_windows ENABLE ROW LEVEL SECURITY;
-- service_role 전용, 정책 없음 — 기존 edu_ 테이블과 동일한 패턴
