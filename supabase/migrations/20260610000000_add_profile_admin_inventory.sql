ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_icon TEXT,
  ADD COLUMN IF NOT EXISTS profile_icons JSONB NOT NULL DEFAULT '["shadow_rookie"]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_skins JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_profile_icons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.player_profiles
  DROP CONSTRAINT IF EXISTS profile_name_format;

ALTER TABLE public.player_profiles
  ADD CONSTRAINT profile_name_format CHECK (
    profile_name IS NULL OR (
      char_length(profile_name) BETWEEN 3 AND 20
      AND profile_name ~ '^[A-Za-z0-9_]+$'
    )
  );
