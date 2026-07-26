
CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  category TEXT,
  patient_ref TEXT,
  indication TEXT,
  site TEXT,
  supervisor TEXT,
  role TEXT CHECK (role IN ('observed','assisted','performed','supervised')),
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  outcome TEXT,
  complications TEXT,
  lessons TEXT,
  notes TEXT,
  total_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own procedures" ON public.procedures FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX procedures_user_date_idx ON public.procedures(user_id, performed_at DESC);
CREATE INDEX procedures_user_category_idx ON public.procedures(user_id, category);

CREATE TABLE public.procedure_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  order_idx INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_steps TO authenticated;
GRANT ALL ON public.procedure_steps TO service_role;
ALTER TABLE public.procedure_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own steps" ON public.procedure_steps FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX procedure_steps_procedure_idx ON public.procedure_steps(procedure_id, order_idx);

CREATE TABLE public.procedure_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_attachments TO authenticated;
GRANT ALL ON public.procedure_attachments TO service_role;
ALTER TABLE public.procedure_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments" ON public.procedure_attachments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER procedures_updated_at BEFORE UPDATE ON public.procedures
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "own files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'procedure-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'procedure-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'procedure-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'procedure-files' AND auth.uid()::text = (storage.foldername(name))[1]);
