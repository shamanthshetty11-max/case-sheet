
CREATE TABLE public.team_surgeons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_surgeons TO authenticated;
GRANT ALL ON public.team_surgeons TO service_role;
ALTER TABLE public.team_surgeons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own surgeons" ON public.team_surgeons FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.team_pas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_pas TO authenticated;
GRANT ALL ON public.team_pas TO service_role;
ALTER TABLE public.team_pas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pas" ON public.team_pas FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS pa_names text[] NOT NULL DEFAULT '{}';
