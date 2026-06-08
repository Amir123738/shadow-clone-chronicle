# Project Rules

## Deployment

- This is a TanStack Start / Nitro app deployed from the repository root.
- Vercel should use Framework Preset `TanStack Start`, Root Directory `.`, Install Command `npm ci`, Build Command `npm run build`, and no manual Output Directory override.
- Keep `vercel.json` minimal. It exists to force TanStack Start detection and npm usage because this repo has both `package-lock.json` and `bun.lock`.
- `npm run build` must pass before deployment. On Vercel, Nitro should create `.vercel/output`; if logs only show a static `dist/`, the framework/package-manager settings are wrong.

## Environment Safety

- Never commit real secrets. `.env`, `.env.*`, `VERCEL_ENV_IMPORT.local.env`, and `VERCEL_ENV_VALUES.local.md` must stay ignored.
- Keep `.env.example` committed with variable names only.
- Public browser variables use `VITE_*` and are visible to users. Do not put private keys in `VITE_*`.
- Ready-to-copy Vercel handoff files may be created locally as `VERCEL_ENV_IMPORT.local.env` and `VERCEL_ENV_VALUES.local.md`; they must never be committed.

## Supabase

- `SUPABASE_URL` is the base project URL, like `https://PROJECT_REF.supabase.co`, with no `/rest/v1`.
- `SUPABASE_PUBLISHABLE_KEY` is the anon/public key used by server-side authenticated clients.
- `VITE_SUPABASE_URL` is the same base project URL exposed to the browser.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is the same anon/public key exposed to the browser.
- `VITE_SUPABASE_PROJECT_ID` is the project ref, the part before `.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` is a secret backend/server-only key. Never expose it as `VITE_*`, never paste it into frontend config, and only require it for true backend admin actions that must bypass RLS.
- If Supabase reports `Could not find the table ... in the schema cache`, apply the SQL migrations in `supabase/migrations` to the target Supabase project.
- Migrations are SQL files that create or update database tables, policies, functions, and triggers.

## Gemini

- `GEMINI_API_KEY` is secret backend/server-only. Never expose it as `VITE_*`.
- `GEMINI_MODEL` should default to `gemini-2.5-flash-lite` for student projects unless the user explicitly asks for another model.

## Before Deploy

- Confirm the local folder matches `git rev-parse --show-toplevel`.
- Confirm `git remote -v` points to the expected GitHub repository and the branch is correct.
- Confirm `.env` is ignored and untracked, and `.env.example` is tracked.
- Confirm required Vercel env vars are set for Production, Preview, and Development.
- Run `npm ci` if dependencies are missing or stale.
- Run `npm run build`.
- Apply Supabase migrations to the target project if the app depends on tables from `supabase/migrations`.
