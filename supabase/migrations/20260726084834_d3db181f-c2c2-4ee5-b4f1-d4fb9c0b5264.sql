ALTER TABLE public.procedures RENAME COLUMN supervisor TO surgeon;
ALTER TABLE public.procedures ADD COLUMN assistant_surgeon text;