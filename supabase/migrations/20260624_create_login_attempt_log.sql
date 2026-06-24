CREATE TABLE IF NOT EXISTS public.login_attempt_log (
  id          bigserial   PRIMARY KEY,
  ip_address  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempt_log_ip_idx
  ON public.login_attempt_log (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS login_attempt_log_created_at_idx
  ON public.login_attempt_log (created_at);
