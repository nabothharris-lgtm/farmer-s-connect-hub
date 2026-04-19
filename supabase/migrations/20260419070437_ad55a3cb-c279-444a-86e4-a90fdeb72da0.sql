
-- 1. Add verification + agent fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unsubmitted' CHECK (verification_status IN ('unsubmitted','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS agent_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_agent UUID REFERENCES public.profiles(id);

-- 2. Verification documents (uploaded by experts & stores)
CREATE TABLE IF NOT EXISTS public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('national_id','license','certificate','other')),
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own docs" ON public.verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own docs" ON public.verification_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own docs" ON public.verification_documents
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin updates docs" ON public.verification_documents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Agent earnings ledger
CREATE TABLE IF NOT EXISTS public.agent_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('signup','booking','subscription')),
  amount NUMERIC NOT NULL DEFAULT 0,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent views own earnings" ON public.agent_earnings
  FOR SELECT TO authenticated
  USING (auth.uid() = agent_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent leaderboard view" ON public.agent_earnings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'agent'::app_role));

CREATE POLICY "System inserts earnings" ON public.agent_earnings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('weather','earning','booking','system','market')),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User updates own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User deletes own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. Helper: generate unique agent code
CREATE OR REPLACE FUNCTION public.generate_agent_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    new_code := 'AG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE agent_code = new_code);
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique agent code';
    END IF;
  END LOOP;
  RETURN new_code;
END;
$$;

-- 6. Trigger: auto-assign agent code when user_role = 'agent'
CREATE OR REPLACE FUNCTION public.assign_agent_code_on_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'agent' THEN
    UPDATE public.profiles
       SET agent_code = COALESCE(agent_code, public.generate_agent_code())
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_agent_code ON public.user_roles;
CREATE TRIGGER trg_assign_agent_code
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.assign_agent_code_on_role();

-- 7. Helper to look up agent by code (security definer so signup can validate before login)
CREATE OR REPLACE FUNCTION public.find_agent_by_code(_code TEXT)
RETURNS TABLE(agent_id UUID, agent_name TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name FROM public.profiles WHERE agent_code = upper(_code) LIMIT 1;
$$;

-- 8. Storage bucket for verification docs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verification-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users delete own verification docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 9. Enable realtime on notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
