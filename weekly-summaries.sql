-- 주간 실적 요약 확정본 저장 테이블
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label text        NOT NULL,
  period_start date        NOT NULL,
  period_end   date        NOT NULL,
  year         integer     NOT NULL,
  week_number  integer     NOT NULL,
  status       text        NOT NULL DEFAULT 'partial'
               CHECK (status IN ('partial', 'confirmed')),
  confirmed_at timestamptz,
  snapshot     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 확정된 요약은 주차당 하나만 존재
CREATE UNIQUE INDEX IF NOT EXISTS weekly_summaries_confirmed_unique
  ON public.weekly_summaries (year, week_number)
  WHERE status = 'confirmed';

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
