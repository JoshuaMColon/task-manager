# XPlan — a task manager that plays like a game

XPlan is a full-stack to-do app built like a game. Tasks are **quests**. Finishing one earns **XP**, XP raises your **level**, and finishing quests on consecutive days builds a **combo** streak. Trophies unlock as you go.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, RLS) · Vitest · Playwright + axe · GitHub Actions · Vercel

## Features

- **Player dashboard (HQ):**
  - A player card with your level, XP bar, combo streak, 30-day clear rate, on-time % and XP earned today.
  - Daily missions with a progress ring.
  - Next up, an activity heatmap and recent trophies.
- **Natural-language quick add:** type `Pay rent every month on the 1st p1 #bills @Home`. Dates, times, repeats, priority, tags and project are highlighted inline, and a live preview shows the parsed quest and the XP it's worth.
- **Views:** HQ, Daily missions (Today), Upcoming (7 days + later), Inbox, Overdue (with *move all to today*), Quest log, Trophies, and one per project.
- **Quest details:** priorities as rarities (P1 Epic → P4 Common), due dates and times, notes, tags and projects.
- **Repeating quests:** daily, weekdays, weekly, monthly and yearly, every *n*. Finishing one schedules the next occurrence.
- **Feedback on every platform:** the XP pop, the level-up toast and trophy toasts run the same for mouse, keyboard and touch, with haptics on phones. All motion respects `prefers-reduced-motion`.
- **Customization:**
  - Three skins: **Forge** (gunmetal + orange), **Bloom** (rose + violet) and **Slate** (neutral).
  - An accent color, plus an avatar from a built-in set or your initials.
  - Choices are saved to your profile.
- **Keyboard first:**
  - <kbd>⌘/Ctrl K</kbd> opens the command palette.
  - <kbd>N</kbd> new quest, <kbd>G</kbd> + key to switch views, <kbd>J/K</kbd> to move, <kbd>X</kbd> to complete.
  - <kbd>E</kbd> to edit, <kbd>1–4</kbd> for priority, <kbd>S</kbd> to snooze, <kbd>Del</kbd> to delete (with undo).
  - <kbd>?</kbd> lists every shortcut.
- **Mobile:** swipe right to complete, swipe left to snooze. The app also has bottom tabs and a compact XP header.
- **Realtime + optimistic UI:** changes show up at once, then sync with the server, and other tabs and devices update live.
- **Auth:** email + password sign-in, or **Play as guest** (`/demo`), which opens a seeded save file one quest away from a level-up.

## Architecture

```
src/
  lib/       parse.ts (NL quick add) · xp.ts (rules) · engine.ts (local rules) · backend.ts (cloud/local) · views.ts · skins.ts
  hooks/     useAuth · useGame (optimistic state + realtime) · useRoute
  components/ PlayerCard · QuestItem · QuickAdd · CommandPalette · QuestEditor · Trophies · Heatmap · Customize · Nav · Feedback
supabase/migrations/  xplan schema, RLS, triggers, RPCs
e2e/                  Playwright + axe
```

**XP is decided by the server.** The `xplan.tasks` table has triggers that run on completion:

- **Award XP:** base XP by priority (10/20/35/50), +50% when the quest is on time, and XP for at most 30 completions a day.
- **Schedule repeats:** `xplan.next_due` calculates the next occurrence.
- **Unlock trophies.**

Clients can't write `xp_awarded`, `on_time` or achievements. Undoing a completion takes the XP back.

The client predicts the same numbers for instant feedback, then reconciles with the server.

**Database:**

- All tables live in a private `xplan` schema with owner-only RLS (`user_id = auth.uid()`) and indexes on every hot path.
- The app talks to them only through `security_invoker` views in `public`, plus three RPCs: `xplan_bootstrap`, `xplan_stats` and `xplan_start_demo`.
- Guest accounts are Supabase anonymous users, and are removed after a day by a scheduled cleanup.

**No XSS by design:**

- Everything is rendered as React text, with no `innerHTML` and no HTML/markdown rendering of user input. (The old version injected task titles with `innerHTML`.)
- `vercel.json` sends a strict CSP and other security headers.

**Local mode:** if `VITE_SUPABASE_*` is missing, the app runs entirely in `localStorage` using the same rules (`engine.ts`). CI and the e2e tests use this mode.

## Run it

```bash
npm ci
cp .env.example .env.local   # add your Supabase URL + publishable/anon key (or leave empty for local mode)
npm run dev
```

| Script | |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Vitest unit tests (parser, XP curve, recurrence, local rules) |
| `npm run test:e2e` | Playwright flows + axe WCAG 2.1 AA scans on every view in all three skins |
| `npm run lint` / `typecheck` | ESLint / tsc |

Database migrations are in `supabase/migrations/`. Apply them with `supabase db push`.
