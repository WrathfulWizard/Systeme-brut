# Systeme Brut — handoff brief

Read this first. Everything else in this folder is reference material it points
to.

## What this is

A personal tracking system across three nodes — training (DC-style lifting plus
a 10k running build-up), pharmacology (continuous regimen, titrated against
bloodwork, no cycle planning), and nutrition/telemetry (Cronometer, Apple
Health, Strava). **SB-Σ**, the Synthesizer, cross-references all three and
surfaces what's worth noticing rather than just logging what happened.

## Two surfaces, one wrist module

- **SB-01, mobile** — fast input where logging is actually needed, plus
  glanceable status where it isn't. Training splits into **Lifts** (logging —
  sets, rest-pause bursts) and **Cardio** (read-only progression toward the 10k
  goal, synced from Strava — no manual entry). **Pharm** is dose logging.
  **Flags** is by node. _On hold — see status note below._
- **SB-00, the hub** — dense viewer. Everything SB-01 logs, plus PR history, the
  10k progression chart, titration history, full bloodwork, and SB-Σ's deep,
  by-node + cross-node flag view.
- **SB-02** — a Xiaomi Smart Band 10 watchface, BPM-led. Separate problem from
  the other two; see its own README before touching it.

## Status — read before picking a starting point

SB-01 was going to be React Native targeting both phone platforms. iOS blocks
that for casual personal use (no App Store sideloading outside the EU, and the
realistic alternative is TestFlight or a $99/yr developer account just to run an
app on your own phone). Rather than fight that, the plan is now a dedicated
**Android device** bought specifically to run SB-01 and nothing else — which
also means this tracking data never touches the phone used for everything else.

Practical effect: **SB-01 is paused** until that device exists. **Build SB-00
first** — it's a web app, no platform fight, and it's genuinely usable on its
own once data is flowing in. When the Android device shows up, SB-01 becomes a
much simpler problem: a single target platform means the React Native + Expo
build is just a plain APK, sideloaded by toggling "install unknown apps" — no
signing, no store, no review, no account.

## File map

| File                                         | What it's for                                                        |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `systeme-brut-architecture-v2.md`            | Current schema. Supersedes the v1 architecture doc — read v2 only.    |
| `systeme-brut-ia-closed.md`                  | The nav/category decisions this schema is built from.                |
| `mockups/systeme-brut-ia-buildout.html`      | Visual ref: Lifts, Cardio, Pharmacology, Flags-by-node, SB-01 states.|
| `mockups/systeme-brut-b-refined.html`        | Visual ref: Overview and the design system itself.                   |
| `mockups/systeme-brut-nutrition-update.html` | Visual ref: the Nutrition screen.                                    |
| `mockups/serumliquidrender-prototype.tsx`    | The serum "visual readout" prototype, ported into `sb-00`.           |
| `sb-02-watchface/`                           | The wrist module — separate hardware problem, own README inside.     |

The CSS in the HTML files is **not meant to ship as-is** — it's the spec for the
token system (the `:root` variables, the type pairing, the one-flag-one-colour
rule), not production code. Translate the intent, not the markup. That
translation lives in `sb-00/app/globals.css`.

## Tech stack (decided, not re-litigated)

- **Hub (SB-00):** SvelteKit or Next.js against Supabase. This build went with
  **Next.js** — the serum render is already React + Three.js. D3 / Observable
  Plot for real charts; the ASCII matrices stay real monospace text.
- **Backend:** Supabase — managed Postgres running the v2 schema, plus Edge
  Functions as the webhook receivers for Apple Health and Strava.
- **Mobile (SB-01), paused:** React Native + Expo, local-first SQLite, synced to
  Supabase. Android-only sideloaded APK. AliExpress hardware in this price range
  tends to be low-to-mid spec — don't reach for anything dependency-heavy on the
  mobile side when that work starts.
