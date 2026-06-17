# SB-02 — Wrist module

A **Xiaomi Smart Band 10** watchface, BPM-led. This is a **separate hardware
problem** from SB-00 and SB-01 — don't fold it into either build.

## Status: not started

Placeholder. The watchface is a glanceable, heart-rate-forward face that shows
the single most relevant SB-Σ signal of the day (an open flag, or "all clear")
alongside live BPM. It does not log — telemetry flows the other direction, from
the band into Apple Health and then into Supabase, where SB-00 reads it.

## Notes for whoever picks this up

- Xiaomi Smart Band 10 watchfaces are built with Xiaomi's own face tooling /
  Mi Fitness watchface format — this is **not** a web or React surface and
  shares no code with SB-00.
- Scope it BPM-first: the band's value here is continuous heart rate, not a
  second input surface. Anything beyond a live BPM read + one synthesized line
  is out of scope for v1.
- Data path is band → Apple Health (umbrella `device_source = 'apple_health'`)
  → Supabase `wearable_readings`. The watchface is a *display*, not an ingestion
  path.
