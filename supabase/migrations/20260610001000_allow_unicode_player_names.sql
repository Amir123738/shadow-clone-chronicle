ALTER TABLE public.player_profiles
  DROP CONSTRAINT IF EXISTS nickname_format;

ALTER TABLE public.player_profiles
  ADD CONSTRAINT nickname_format CHECK (
    char_length(nickname) BETWEEN 2 AND 64
    AND nickname !~ '[[:cntrl:]]'
  );

ALTER TABLE public.player_profiles
  DROP CONSTRAINT IF EXISTS profile_name_format;

ALTER TABLE public.player_profiles
  ADD CONSTRAINT profile_name_format CHECK (
    profile_name IS NULL OR (
      char_length(profile_name) BETWEEN 2 AND 64
      AND profile_name !~ '[[:cntrl:]]'
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_profiles (user_id, nickname, profile_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nickname', ''),
      'player_' || substr(NEW.id::text, 1, 8)
    ),
    NULLIF(NEW.raw_user_meta_data->>'display_name', '')
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_player() FROM PUBLIC, anon, authenticated;
