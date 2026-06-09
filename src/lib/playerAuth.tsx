import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PlayerProfile = {
  user_id: string;
  nickname: string;
  shadow_coins: number;
  owned: string[];
  selected: string;
  accessories: string[];
  equipped_accessory: string | null;
};

function getAuthRedirectUrl() {
  return `${window.location.origin}/`;
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

  const signUp = useCallback(async (email: string, password: string) => {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) {
      if (/registered|exists/i.test(error.message)) {
        throw new Error("That email is already registered.");
      }
      throw error;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      if (/invalid/i.test(error.message)) {
        throw new Error("Wrong email or password.");
      }
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  return { user, loading, signUp, signIn, signInWithGoogle, signOut };
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
  children: (ctx: { user: User; signOut: () => Promise<void>; email: string }) => React.ReactNode;
}) {
  const { user, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d1a] text-white">
        Loading...
      </div>
    );
  }

  if (user) {
    return <>{children({ user, signOut, email: user.email ?? "Signed in" })}</>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email, password);
      else await signIn(email, password);
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

        <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-purple-400 outline-none"
          placeholder="player@example.com"
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
          placeholder="******"
        />

        {err && <div className="mb-3 text-sm text-red-400">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {busy ? "..." : mode === "signup" ? "Create account" : "Log in"}
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider text-white/40">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setErr(null);
            setBusy(true);
            try {
              await signInWithGoogle();
            } catch (e: unknown) {
              setErr(e instanceof Error ? e.message : "Google sign-in failed.");
              setBusy(false);
            }
          }}
          className="w-full py-2.5 rounded-lg bg-white text-gray-800 font-semibold hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => {
            setErr(null);
            setMode(mode === "signup" ? "login" : "signup");
          }}
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
