# Brag Plan: RootCause

## What is this app?
RootCause is an intelligent developer log-monitoring service and error explainer that translates raw stack traces and database latency spikes into plain-English root causes and practical next steps.

## The angle
"Your app is talking. We're listening."
Every developer knows the dreaded 2 AM wake-up call: an unreadable, cryptic stack trace (`connect ECONNREFUSED 127.0.0.1:5432`) or an obscure climbing retry rate. RootCause strips the mystery away, replacing panicked dashboard babysitting with instant, calm, actionable plain English.

## Hook (first 3.5 seconds)
A raw terminal-style error pops up against the signature dark green canvas:
`2026-10-19 ERROR checkout-api: connect ECONNREFUSED 127.0.0.1:5432 · HTTP 500`
The hook line stamps in: "Know what broke."

## Key moments (the middle)
- **Instant Plain-English Translation (Live now):**
  The raw error transforms into a crisp explainer card: "Checkout cannot connect to Postgres." with clear checks.
  Caption: "Paste an error. Get the why and the fix."
- **Code Security Review (Coming soon):**
  Connect GitHub button and repo card (`checkout-api`). A cursor clicks Connect.
  Scan bar sweeps repo files. A 10-segment OWASP Top 10 ring (A01-A10) fills in one segment at a time; two turn red.
  Findings card slides in with "Fix first" list:
  1. Broken access control: /admin route has no auth check (High)
  2. No rate limiting on /login, easier to overwhelm (Medium)
  3. Secret found in config file (High)
  Thin A-Z ruler along bottom with red tick: "Warning sign found."
  Caption: "Connect your code. See weak spots and warning signs, with fixes."
  Footnote: "Automated review, not a full security audit."
- **24/7 Continuous Monitoring (Coming soon):**
  24h log activity waveform and incident card: "Retries are climbing on checkout · Database latency rising too".
  Caption: "Get alerted when your app breaks."
  Footnote: "Alerts may be delayed or missed."

## Outro / punchline
The RootCause mark stamps down:
**r.** rootcause
"Know what broke. Know what to do next."
Line: "Try it free: explain errors today. Code review and monitoring: coming soon."
Footnote: "Beta. May miss errors or delay alerts."

## User flow worth showing
1. Entry: Raw log / error paste into the explainer (`connect ECONNREFUSED 127.0.0.1:5432`) -> plain-English diagnosis [Live now].
2. Code review: GitHub repo connection -> OWASP Top 10 ring scan & A-Z security check with prioritized fixes [Coming soon].
3. Proactive 24/7 monitoring: Log activity anomaly detection & instant multi-channel alert delivery [Coming soon].

## Tone
- Preset: `polished`
- Creative direction: Sleek, confident developer tool film with satisfying terminal-to-insight resolution and honest status transparency
- Interpretation: Restrained, premium dark forest green aesthetic, prominent status pill labels (≥40px tall), softened panels for coming-soon features, and rhythmic auditory feedback.

## Format: landscape — 1920x1080
## Duration: 27.0s

## Status Labels Rule
Each feature scene shows a pill label for the entire scene, at least 40px tall:
- Scene 2 (Explain an error): Green "Live now" pill
- Scene 3 (Code security review): Pale "Coming soon" pill, panel slightly softened
- Scene 4 (Continuous monitoring): Pale "Coming soon" pill, panel slightly softened
- Scene 5 (Outro): Line "Code review and monitoring: coming soon."

## Visual identity (from the project)
- Background: `#151e17` (deep forest green)
- Accent: `#95b39a` (sage green glow) / `#66856d`
- Status Green (Live now): `#22482c`, border `#3f784d`, text `#8ee49d`
- Status Pale (Coming soon): `#28332a`, border `#485a4b`, text `#b8cbb9`
- Warning/Alert: `#d49a69` / `#b87947` / `#e06c75`
- Text: `#f0f2ef` (primary) / `#aab5aa` (muted)
- Display font: `Manrope`, sans-serif
- Accent serif: `Georgia`, serif
- Code font: `Consolas`, monospace

## Share copy (replaced)
Paste an error and get the fix in plain English. Code security review and monitoring are coming soon. Try RootCause free.

## Audio direction
- Role: Warm rhythmic electronic chillhop bed with tactile UI sound effects
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (60s duration, tempo ~110 BPM, ~0.55s per beat)
- Scene cuts re-locked to beat grid at ~110 BPM:
  - 0.0s - 3.5s (Scene 1)
  - 3.5s - 9.0s (Scene 2: ~10 beats)
  - 9.0s - 16.5s (Scene 3: ~13.6 beats)
  - 16.5s - 22.5s (Scene 4: ~11 beats)
  - 22.5s - 27.0s (Scene 5: ~8 beats)
- SFX:
  - Keystrokes on error typing (`keypress-005.wav`)
  - Crisp switches/whooshes on scene arrivals (`switch_004.ogg`)
  - Sequential clicks on checklist and OWASP ring ticks (`click_002.ogg`)
  - Scan whoosh on code review sweep
  - Warning tone on security finding / red segment
  - Background Music: High-energy Phonk Beat (*TheQLon - Phonk Vibe*, 0.85 volume)
  - Voiceover: Removed completely
  - Precise UI SFX & Haptics: Key clacks (`keypress-005.wav`), tap pops (`click_002.ogg`), mouse click (`mouseclick1.ogg`), laser sweep (`rollover1.ogg`), error warning tone (`error_005.ogg`), bell chime (`impactBell_heavy_004.ogg`)

## Storyboard & Kinetic Camera Choreography (27.0s Duration)

### Scene 1 — The Confusing Error Hook (4.5s) [0.0s - 4.5s]
- **Camera Motion**: Starts wide (`1.0x`) -> Typewriter headline *Manually monitoring logs 24/7?* -> **SUDDEN WHIP ZOOM IN** (`1.55x`) directly into the terminal error line -> Simulated cursor glides in and **TAPS IN** on the error card (0.88x compress + emerald shockwave ripple) -> **SUDDEN WHIP ZOOM OUT** (`1.0x`) as scene cuts.
- **Audio**: Fast Phonk intro beat + mechanical key clacks (`keypress-005.wav`) + tap click (`click_002.ogg`).

### Scene 2 — The Plain-English Fix (6.0s) [4.5s - 10.5s] — Status: Live now
- **Status Pill**: `● LIVE NOW` (42px tall, vibrant green).
- **Camera Motion**: Status pill slams down -> Title types in -> **SUDDEN WHIP ZOOM IN** (`1.5x`) on `Checkout cannot connect to Postgres.` -> **TAP IN** on diagnostic card with emerald ripple -> While zoomed in, the 3 checklist items strike through with electric emerald punch -> **SUDDEN WHIP ZOOM OUT** (`1.0x`) revealing floating badges `● Instant Plain English`, `( Zero Friction )`.
- **Audio**: Heavy phonk 808 bass kick + sequenced check clicks (`click_002.ogg`).

### Scene 3 — Code Security Review (5.5s) [10.5s - 16.0s] — Status: Coming soon
- **Status Pill**: `⏱ COMING SOON` (42px tall, pale glass pill). Panel softened (0.88 opacity).
- **Camera Motion**: **SUDDEN WHIP ZOOM IN** (`1.6x`) on `Connect GitHub` button -> Simulated cursor **TAPS IN** (button compresses, ripple flashes, mouse click SFX) -> Laser scan sweeps down files -> **WHIP PAN ZOOM SHIFT** (`1.55x`) across to the OWASP A01 High Priority finding card which pulses warning amber/red -> **SUDDEN WHIP ZOOM OUT** (`1.0x`).
- **Audio**: Phonk synth lead + mouse click (`mouseclick1.ogg`) + laser scan (`rollover1.ogg`) + alert pop (`error_005.ogg`).

### Scene 4 — 24/7 Production Monitoring (5.5s) [16.0s - 21.5s] — Status: Coming soon
- **Status Pill**: `⏱ COMING SOON` (42px tall, pale glass pill). Panel softened.
- **Camera Motion**: **SUDDEN WHIP ZOOM IN** (`1.6x`) on real-time latency chart -> SVG waveform draws aggressively with pulsing live emerald ping -> **WHIP PAN ZOOM SHIFT** (`1.55x`) to Incident #419 auto-diagnostic box which flashes open -> **SUDDEN WHIP ZOOM OUT** (`1.0x`).
- **Audio**: Phonk rhythm drop + switch pop.

### Scene 5 — Outro (5.5s) [21.5s - 27.0s] — Exact Spotify Reel Style
- **Camera Motion**: Dramatic impact zoom settle (`1.15x -> 1.0x`) into radiant Spotify emerald glow.
- **Visuals**: Pulsing aura, `r. rootcause` brand mark, typewriter tagline *Know what broke. Fix it before customers notice.*, glowing CTA pill `rootcause.dev`, and footnote *Beta. May miss errors or delay alerts.*
- **Poster**: Settled frame baked into frame 0 of `brag.mp4`.
- **Audio**: Phonk outro sustain + brand bell chime (`impactBell_heavy_004.ogg`).


