# Hyperframes Composition Brief: RootCause

## Objective
Create a short launch-style brag video for RootCause.

## Output
- Composition directory: `brag-output-2026-10-20-031316/composition/`
- Rendered video: `brag-output-2026-10-20-031316/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `c:\Users\hp\Downloads\Root_Cause`
- Primary files read: `index.html`, `styles.css`, `dashboard.html`, `README.md`, `package.json`
- Product name: RootCause
- Tagline / strongest claim: "Know what broke. Know what to do next."
- Key UI or visual moment to recreate: Landing explainer (error → plain-English fix) and hero dashboard (waveform + incident card)
- Copy that must appear verbatim:
  - Know what broke.
  - Know what to do next.
  - Checkout cannot connect to Postgres.
  - Paste one error. Get the why and the fix.
  - Retries are climbing on checkout
  - Try free · 5 explanations a day.
  - Live now / Coming soon (status pills)
  - Alerts may be delayed or missed. (footnote)

## Creative Direction
- Tone preset: polished
- Creative direction: Quiet premium developer-tool film — terminal panic resolved into calm forest-green confidence
- Interpretation: Fewer scenes, longer holds, soft crossfades; no generic SaaS language
- Angle: Raw panic (`ECONNREFUSED`) flips into calm RootCause guidance. Live explainer now; monitoring coming soon — labeled honestly.
- Hook: Terminal error + "Know what broke."
- Outro / punchline: **r.** rootcause + "Know what broke. Know what to do next." + free CTA
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Invented metrics or capabilities

## Visual Identity
- Background: `#151e17`
- Text: `#f0f2ef` / muted `#aab5aa`
- Accent: `#95b39a` / `#66856d`
- Display font: Manrope (Google Fonts)
- Body font: DM Sans
- Accent serif: Georgia for italic emphases
- Visual references: white dashboard card on dark green; dark explainer box; sage green activity stroke; amber "Worth a look" chip

## Storyboard
Use `brag-plan.md` as the creative contract.

Scene summary:
1. Hook / Panic — 2.5s — error line + "Know what broke."
2. Reveal / Explain — 5.5s — explainer card, Live now pill, 3 checklist items
3. Monitoring tease — 6.0s — dashboard waveform + incident, Coming soon pill
4. Outro — 6.0s — brand mark + tagline + free CTA

## Audio
- Audio role: warm chillhop bed + motion-matched UI accents
- Audio arc: tension stamp → relief on explainer → confident pulse on dashboard → resolve on logo
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
- Music treatment: volume ~0.25, fade-in 0.4s, fade-out last 1.2s
- Music cue guidance: bundled preset `assets/music/cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json` (~110 BPM). Strong cues ~15.82, 18.01, 18.55, 20.19. Prefer cuts near 0.27 / 2.46 / 8.22 / 14.73 / 18.55. Readability over grid for sequential text (every other beat).
- Audio-reactive treatment: subtle; sage glow / panel presence with RMS/bass — no waveform equalizer visuals
- Audio-coupled moments:
  - Scene 1 — error stamp / optional type on hook
  - Scene 2 — card land + 3 checklist drops
  - Scene 3 — waveform draw + incident land
  - Scene 4 — logo stamp (aim ~18.55 strong cue)
- SFX selection guidance: soft drops for cards, click/switch for UI, keypress for type, restrained bell/impact for logo; prefer low HF-risk from sfx-analysis
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: Hyperframes chooses after animation exists
- Audio files: copy music + selected SFX into `composition/assets/`

## Hyperframes Instructions
Load domain skills `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. This is a `/brag` workflow — skip the HyperFrames intent interview and do not route into `/product-launch-video`. Prefer native HyperFrames conventions.

Requirements:
- Show real UI/copy from RootCause (explainer + dashboard)
- All text readable; 15–25s total (target 20s)
- Include music/SFX; cues are hints only
- Beat-lock 1–3 major moments; sequential checklist snaps to beat grid with reading holds
- Subtle audio-reactive if extraction available
- `npx hyperframes check` must pass before render
- Keep creation and rendering local
