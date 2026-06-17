# SB-00 — Master Hub

The dense web viewer for Systeme Brut. Next.js 16 (App Router) + Supabase.
See the repo root `README.md` and `docs/HANDOFF.md` for the full picture.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # verify before committing
```

## Layout

- `app/` — one route per IA screen: `/` (Overview), `/lifts`, `/cardio`,
  `/pharmacology`, `/nutrition`, `/flags`.
- `components/` — `HubFrame` (frame + nav + side rail chrome), `Nav`, `Ascii`,
  `Feed`, and `SerumLiquidRender` (the WebGL serum readout).
- `lib/data.ts` — static data mirroring `supabase/seed.sql`. Swap for Supabase
  queries when the backend is live; the shapes already match the v2 schema.
- `lib/ascii.ts` — builds the real-monospace `█`/`░` bar matrices.
- `app/globals.css` — the design tokens, translated from the mockup `:root`
  spec (one flag colour, corner marks, the type pairing).

> `AGENTS.md` notes Next 16 has breaking changes vs. earlier versions — check
> `node_modules/next/dist/docs/` before writing Next-specific code.
