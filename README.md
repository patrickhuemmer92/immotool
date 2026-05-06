# immotool

Next.js 16 (App Router) + Supabase Auth + Vercel.

## Setup

### 1. Dependencies

```bash
npm install
```

### 2. Supabase-Keys eintragen

`.env.local` ist mit der Supabase-URL bereits vorbelegt. Den **Anon Key** im
Supabase Dashboard kopieren (Project Settings → API → `anon` `public` key) und
in `.env.local` einsetzen:

```
NEXT_PUBLIC_SUPABASE_URL=https://xqkmrtjnvggayzfhfzex.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> **Sicherheitshinweis:** Das Postgres-Passwort (`postgres://…`) wird hier
> **nicht** verwendet und gehört nicht ins Frontend. Bei Bedarf rotieren unter
> *Project Settings → Database → Reset password*.

### 3. Supabase Auth: Redirect URLs

Im Supabase Dashboard unter *Authentication → URL Configuration*:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000/auth/callback` und – nach Deploy –
  `https://<dein-vercel-domain>/auth/callback`.

### 4. Lokal starten

```bash
npm run dev
```

→ http://localhost:3000 (leitet auf `/login` um, wenn nicht eingeloggt).

## Vercel Deployment

```bash
vercel link        # einmalig: Projekt anlegen / verknüpfen
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel             # Preview-Deploy
vercel --prod      # Production-Deploy
```

Nach erstem Deploy die Production-URL in Supabase als zusätzliche
**Redirect URL** und **Site URL** hinterlegen.

## Struktur

```
src/
├── app/
│   ├── (app)/             # geschützte Routen (Sidebar-Layout)
│   │   ├── layout.tsx
│   │   └── dashboard/
│   ├── auth/callback/     # OAuth/Magic-Link-Callback
│   ├── login/             # Login + Signup
│   ├── layout.tsx
│   └── page.tsx           # → /dashboard
├── lib/supabase/
│   ├── client.ts          # Browser-Client
│   ├── server.ts          # Server-Client (RSC, Actions, Routes)
│   └── middleware.ts      # Session-Refresh-Helper
└── proxy.ts               # Next.js 16 "proxy" (vorher: middleware)
```

Auth-Flow:
- Nicht eingeloggte Requests → Redirect auf `/login` (in `src/proxy.ts`).
- Login via Server Action `src/app/login/actions.ts` (`signInWithPassword`).
- Session wird in HTTP-only Cookies gehalten und bei jedem Request
  über den Proxy refresht.

## Stack

- Next.js 16.2.5 (App Router, Turbopack, TypeScript)
- Tailwind CSS v4
- Supabase JS + `@supabase/ssr`
