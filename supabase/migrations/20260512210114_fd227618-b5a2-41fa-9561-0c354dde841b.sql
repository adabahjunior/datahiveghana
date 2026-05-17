-- Allow subagents to create their own pending assignment when signing up
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subagent_assignments'
      AND policyname = 'Subagents create own pending assignment'
  ) THEN
    CREATE POLICY "Subagents create own pending assignment"
    ON public.subagent_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (subagent_user_id = auth.uid() AND status = 'pending');
  END IF;
END $$;

-- Ensure unique subagent per user (used by upsert in edge functions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subagent_assignments_subagent_user_id_key'
  ) THEN
    ALTER TABLE public.subagent_assignments
    ADD CONSTRAINT subagent_assignments_subagent_user_id_key UNIQUE (subagent_user_id);
  END IF;
END $$;