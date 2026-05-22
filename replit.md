# SoundTrace

Music identification web app for Indian social media creators — paste a video URL (Instagram/YouTube reel) to get Spotify and YouTube links for the identified song.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/soundtrace run dev` — run the frontend (port 18695, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, run after schema edits)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + Framer Motion + Wouter (routing)
- API: Express 5 with pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth for all endpoints)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit)
- `lib/db/src/schema/songs.ts` — DB schema: `songsTable`, `historyTable`, `trendingTable`
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/soundtrace/src/pages/` — React page components
- `artifacts/soundtrace/src/components/` — AnimatedBackground, WaveArt, BottomNav, etc.

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks used in every page
- Shared DB package (`@workspace/db`) imported by API server routes
- Song identification is mocked (random pick from MOCK_SONGS with 1.2s simulated delay) — ready to swap for a real audio fingerprint API
- History is stored per-session (no auth), identified songs are written to `historyTable` immediately after identification
- Trending data is seeded manually; `search_count` incremented on each identify call

## Product

- **Hook screen** — animated typewriter intro with glassmorphism blobs
- **Onboarding** — 4-slide carousel explaining key features
- **Home** — paste URL → identify song; shows 3 recent searches inline
- **Result** — displays song card with Spotify/YouTube CTAs, share button
- **History** — searchable full history with delete-by-entry or clear-all
- **Trending** — top 10 songs with viral badges and growth %, premium-gated
- **Profile** — premium upsell, linked accounts, settings toggle

## Design

White/Grey Glassmorphism palette:
- bg: `#F7F7F5` | card: `#EFEFED` | text: `#1A1A1A` | muted: `#8A8A88` | border: `#DDDDD9`
- Spotify: `#1DB954` | YouTube: `#FF0000` | Viral accent: `#FF6B35`
- Font: Inter (system), tracking tight, uppercase headings

## User preferences

- Target: Indian social media creators
- Keep all monetary values in ₹ (INR)
- Mobile-first layout, max-width 430px centered

## Gotchas

- After editing `lib/db/src/schema/`, run `pnpm run typecheck:libs` then `pnpm --filter @workspace/db run push`
- Do NOT run `pnpm dev` at workspace root — use individual workflow restarts
- The generated api client lives in `lib/api-client-react` — run codegen after any openapi.yaml change
- `useClearHistory` mutate signature is `void` — call as `mutate(undefined, {...})` not `mutate({}, ...)`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
