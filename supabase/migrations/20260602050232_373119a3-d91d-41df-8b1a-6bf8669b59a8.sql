-- Player profile (one per auth user). Stores nickname + all game progress.
CREATE TABLE public.player_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL UNIQUE,
  shadow_coins INTEGER NOT NULL DEFAULT 0,
  owned JSONB NOT NULL DEFAULT '["violet"]'::jsonb,
  selected TEXT NOT NULL DEFAULT 'violet',
  accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipped_accessory TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness for nicknames
CREATE UNIQUE INDEX player_profiles_nickname_lower_idx
  ON public.player_profiles (LOWER(nickname));

-- Length / format constraint on nickname
ALTER TABLE public.player_profiles
  ADD CONSTRAINT nickname_format CHECK (
    char_length(nickname) BETWEEN 3 AND 20
    AND nickname ~ '^[A-Za-z0-9_]+$'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_profiles TO authenticated;
GRANT ALL ON public.player_profiles TO service_role;

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own profile"
  ON public.player_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Players can insert their own profile"
  ON public.player_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can update their own profile"
  ON public.player_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_player_profiles_updated_at
  BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile row on signup using nickname from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_profiles (user_id, nickname)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'player_' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_player();
