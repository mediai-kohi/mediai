-- 보건복지부 주간업무보고: 주(period_start)당 1행, 부서(바이오헬스교육부/의료AI교육팀)별
-- 컬럼을 좌우로 분리해 저장. 각 부서는 결재 없이 독립적으로 draft/submitted 전환.
CREATE TABLE IF NOT EXISTS public.moh_weekly_reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label      text        NOT NULL,
  period_start      date        NOT NULL,
  period_end        date        NOT NULL,

  bio_prev_week     text        NOT NULL DEFAULT '',
  bio_next_week     text        NOT NULL DEFAULT '',
  bio_status        text        NOT NULL DEFAULT 'draft' CHECK (bio_status IN ('draft', 'submitted')),
  bio_submitted_at  timestamptz,
  bio_updated_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  bio_updated_at    timestamptz,

  ai_prev_week      text        NOT NULL DEFAULT '',
  ai_next_week      text        NOT NULL DEFAULT '',
  ai_status         text        NOT NULL DEFAULT 'draft' CHECK (ai_status IN ('draft', 'submitted')),
  ai_submitted_at   timestamptz,
  ai_updated_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ai_updated_at     timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (period_start)
);

ALTER TABLE public.moh_weekly_reports ENABLE ROW LEVEL SECURITY;
-- 정책 없음: 이 앱은 항상 service_role(createAdminClient())로 접근하며 애플리케이션 코드에서
-- 권한을 검증함 (profiles/reports/weekly_summaries와 동일한 패턴, 20260624_enable_rls_all_tables.sql 참고)
