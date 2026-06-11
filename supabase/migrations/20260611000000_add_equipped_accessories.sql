ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS equipped_accessories JSONB NOT NULL DEFAULT '{}'::jsonb;
