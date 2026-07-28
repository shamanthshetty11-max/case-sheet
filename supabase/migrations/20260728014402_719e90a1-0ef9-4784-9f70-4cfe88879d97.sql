
-- Extend procedures
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS scrub_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS scrub_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_name text,
  ADD COLUMN IF NOT EXISTS ip_number text,
  ADD COLUMN IF NOT EXISTS closed_by text,
  ADD COLUMN IF NOT EXISTS preset_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preset_id uuid;

-- sort_order on team tables
ALTER TABLE public.team_surgeons ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.team_pas ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Presets
CREATE TABLE IF NOT EXISTS public.procedure_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_presets TO authenticated;
GRANT ALL ON public.procedure_presets TO service_role;
ALTER TABLE public.procedure_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presets" ON public.procedure_presets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_presets_updated BEFORE UPDATE ON public.procedure_presets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Preset custom fields
CREATE TABLE IF NOT EXISTS public.procedure_preset_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.procedure_presets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_preset_fields TO authenticated;
GRANT ALL ON public.procedure_preset_fields TO service_role;
ALTER TABLE public.procedure_preset_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preset fields" ON public.procedure_preset_fields FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Procedure names catalog
CREATE TABLE IF NOT EXISTS public.procedure_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  preset_id uuid REFERENCES public.procedure_presets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_names TO authenticated;
GRANT ALL ON public.procedure_names TO service_role;
ALTER TABLE public.procedure_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own procedure names" ON public.procedure_names FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
