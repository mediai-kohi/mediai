ALTER TABLE public.login_attempt_log
  ADD COLUMN IF NOT EXISTS user_code text;

CREATE INDEX IF NOT EXISTS login_attempt_log_ip_user_idx
  ON public.login_attempt_log (ip_address, user_code, created_at DESC);
