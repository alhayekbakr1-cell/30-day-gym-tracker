# 30-Day Gym Tracker

An interactive, shift-friendly strength program for returning to the gym. The challenge schedules three full-body workouts per week on alternating days, keeps each session inside 30–40 minutes, and adapts the plan for a basic apartment gym.

## What is included

- 30-day calendar that begins when the user presses **Start**
- Three rotating full-body workouts with progressive overload guidance
- Five-minute warm-up before every session, including an interactive timer
- Checkable warm-up tasks, working-set logs, reps, load, reps in reserve, and notes
- Short-sleep mode that condenses a session to about 20 minutes
- Account-based progress sync across devices, with a local preview fallback
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
