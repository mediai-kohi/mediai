CREATE TABLE IF NOT EXISTS ai_analysis_reports (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  organization text        NOT NULL DEFAULT 'all',
  period_label text        NOT NULL,
  result       jsonb       NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE ai_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all" ON ai_analysis_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
