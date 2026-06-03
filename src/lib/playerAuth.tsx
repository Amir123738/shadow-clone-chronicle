import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const EMAIL_DOMAIN = "shadowclone.local";
const NICK_RE = /^[A-Za-z0-9_]{3,20}$/;

export type PlayerProfile = {
  user_id: string;
  nickname: string;
  shadow_coins: number;
  owned: string[];
  selected: string;
  accessories: string[];
  equipped_accessory: string | null;
};

function nickToEmail(nick: string) {
  return `${nick.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (nickname: string, password: string) => {
    if (!NICK_RE.test(nickname)) {
      throw new Error("Nickname must be 3–20 letters, numbers or underscores.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    const { error } = await supabase.auth.signUp({
      email: nickToEmail(nickname),
      password,
      options: {
        data: { nickname },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      if (/registered|exists/i.test(error.message)) {
        throw new Error("That nickname is already taken.");
      }
      throw error;
    }
  }, []);

  const signIn = useCallback(async (nickname: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: nickToEmail(nickname),
      password,
    });
    if (error) {
      if (/invalid/i.test(error.message)) {
        throw new Error("Wrong nickname or password.");
      }
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
  }, []);


  return { user, loading, signUp, signIn, signOut };
}

export async function loadProfile(userId: string): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("user_id,nickname,shadow_coins,owned,selected,accessories,equipped_accessory")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    toast.error("Couldn't load your save: " + error.message);
    return null;
  }
  if (!data) return null;
  return {
    user_id: data.user_id,
    nickname: data.nickname,
    shadow_coins: data.shadow_coins ?? 0,
    owned: Array.isArray(data.owned) ? (data.owned as string[]) : ["violet"],
    selected: data.selected ?? "violet",
    accessories: Array.isArray(data.accessories) ? (data.accessories as string[]) : [],
    equipped_accessory: data.equipped_accessory ?? null,
  };
}

export async function saveProfile(
  userId: string,
  data: {
    shadow_coins: number;
    owned: string[];
    selected: string;
    accessories: string[];
    equipped_accessory: string | null;
  },
) {
  const { error } = await supabase
    .from("player_profiles")
    .update(data)
    .eq("user_id", userId);
  if (error) console.error("Save failed:", error);
}

export function AuthGate({
  children,
}: {
  children: (ctx: { user: User; signOut: () => Promise<void>; nickname: string }) => React.ReactNode;
}) {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nick, setNick] = useState<string>("");

  useEffect(() => {
    if (!user) { setNick(""); return; }
    const n = (user.user_metadata as { nickname?: string } | null)?.nickname;
    if (n) setNick(n);
    else {
      supabase.from("player_profiles").select("nickname").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => setNick(data?.nickname ?? "Player"));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d1a] text-white">
        Loading…
      </div>
    );
  }

  if (user) {
    return <>{children({ user, signOut, nickname: nick })}</>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(nickname, password);
      else await signIn(nickname, password);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0d1a] via-[#161a2e] to-[#0b0d1a] text-white p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur"
      >
        <h1 className="text-3xl font-black text-center mb-1 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Shadow Clone Survivor
        </h1>
        <p className="text-center text-white/60 text-sm mb-6">
          {mode === "signup" ? "Create your player account" : "Welcome back"}
        </p>

        <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Nickname</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="username"
          minLength={3}
          maxLength={20}
          required
          className="w-full mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-purple-400 outline-none"
          placeholder="ShadowHero"
        />

        <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          required
          className="w-full mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-purple-400 outline-none"
          placeholder="••••••"
        />

        {err && <div className="mb-3 text-sm text-red-400">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {busy ? "..." : mode === "signup" ? "Create account" : "Log in"}
        </button>

        <button
          type="button"
          onClick={() => { setErr(null); setMode(mode === "signup" ? "login" : "signup"); }}
          className="w-full mt-3 text-sm text-white/70 hover:text-white"
        >
          {mode === "signup" ? "Already have an account? Log in" : "New player? Create an account"}
        </button>

        <p className="mt-4 text-[10px] text-center text-white/40">
          Your skins and shadow coins are saved to your account.
        </p>
      </form>
    </div>
  );
}
