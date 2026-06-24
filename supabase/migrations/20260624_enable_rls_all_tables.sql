-- ============================================================
-- 전체 테이블 RLS 활성화
-- 배경: 앱의 모든 DB 쿼리는 service_role(createAdminClient)을 사용하므로
--       RLS를 활성화해도 앱 기능은 그대로 동작한다.
--       단, anon/authenticated 키로 Supabase REST API를 직접 호출하면
--       이 설정으로 인해 차단된다.
-- 예외: notifications 테이블은 user client로 직접 쿼리하므로 별도 policy 필요.
-- ============================================================

-- profiles (service_role only — no user policy needed)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- reports (service_role only)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- weekly_summaries (service_role only)
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

-- inquiries (service_role only)
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- inquiry_replies (service_role only)
ALTER TABLE public.inquiry_replies ENABLE ROW LEVEL SECURITY;

-- attachments (service_role only)
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- admin_notifications (service_role only)
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- documents (service_role only)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- document_chunks (service_role only)
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- chat_histories (service_role only)
ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- notifications: user client(createClient)로 직접 쿼리하므로
--               authenticated user가 자신의 알림만 접근할 수 있도록 policy 추가
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
