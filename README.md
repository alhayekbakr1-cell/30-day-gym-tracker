# 30-Day Gym Tracker

An interactive, shift-friendly strength program for returning to the gym. The challenge schedules three full-body workouts per week on alternating days, keeps each session inside 30–40 minutes, and adapts the plan for a basic apartment gym.

## What is included

- 30-day calendar that begins when the user presses **Start**
- Thirteen sessions across 30 days: three workouts per week with full recovery days
- Flexible shift scheduling with safe date validation and one-tap day changes
- Three rotating full-body workouts with automatic next-load guidance
- Five-minute warm-up before every session, including an interactive timer
- Automatic 60–90 second rest timer after completed sets
- Checkable warm-up tasks, working-set logs, reps, load, reps in reserve, and notes
- Previous-performance cards beside every exercise
- One-tap equipment substitutions that preserve the matching form guide
- Sleep, energy, and soreness check-ins with full, short, or postpone guidance
- Short-sleep mode that condenses a session to about 20 minutes
- Account-based progress sync across devices, with a local preview fallback
- Sync diagnostics, JSON/CSV exports, and a protected challenge restart flow
- Progress dashboard with consistency, volume, strength, weight, protein, and steps
- Daily protein, steps, body weight, waist, and sleep tracking with editable goals
- Installable phone experience with a custom Home Screen icon and app manifest
- Responsive layout for phones, tablets, and desktop browsers
- Accessible controls, keyboard-friendly disclosure panels, and reduced-motion support

## Visual form library

Every programmed movement includes an expandable guide directly beneath the exercise:

- 16 exercise illustrations and 2 warm-up movement illustrations
- Side-by-side start and finish positions
- Set-up instructions and three movement steps
- Quick self-check cues and clear stop warnings
- Links to official ACE or Mayo Clinic technique demonstrations

The illustrations are teaching aids, not a substitute for in-person coaching. Begin with a light practice set and stop for sharp pain, dizziness, or loss of control.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
```

## Stack

- Next.js and React
- Vinext/Vite on Cloudflare Workers
- Cloudflare D1 for signed-in progress storage
- TypeScript and custom responsive CSS

The production exercise artwork lives in `public/exercises`, and the guide content is defined in `app/exercise-guides.ts`.
