
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS patient_height_cm numeric,
  ADD COLUMN IF NOT EXISTS patient_weight_kg numeric;

CREATE TABLE public.surgical_approaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgical_approaches TO authenticated;
GRANT ALL ON public.surgical_approaches TO service_role;
ALTER TABLE public.surgical_approaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own surgical approaches" ON public.surgical_approaches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.procedure_reexplorations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_reexplorations TO authenticated;
GRANT ALL ON public.procedure_reexplorations TO service_role;
ALTER TABLE public.procedure_reexplorations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reexplorations" ON public.procedure_reexplorations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
