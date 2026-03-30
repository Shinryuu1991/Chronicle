# Habit Tracker — Daily XP

A gamified daily habit tracker. Complete tasks to earn XP. Hit your daily target. Build streaks.

## Features

- **XP system** — each task awards XP points on completion
- **Daily target** — configurable daily XP goal (default: 100)
- **Streak tracking** — consecutive days hitting target, with best-streak record
- **Week heatmap** — visual overview of XP earned each day this week
- **Category filter** — filter tasks by Body / Mind / Nutrition / Recovery / Home / Work
- **Full task management** — add, edit (name, category, XP), and delete tasks
- **One-off tasks** — mark tasks as one-time (useful for specific goals)
- **Persistent** — all data stored in localStorage, survives browser restarts
- **PWA-ready** — installable as a mobile/desktop app via browser

## Preinstalled Tasks

Comes with 22 default tasks across 6 categories — self-care, training, nutrition, recovery, home, and work. All can be edited or deleted.

## Setup

No build step. No dependencies. Just open `index.html` in a browser.

```bash
git clone https://github.com/yourusername/habit-tracker.git
cd habit-tracker
# Open index.html in your browser
```

For PWA installation (optional), serve over HTTPS and add icons to `assets/`.

## File Structure

```
habit-tracker/
├── index.html          # Entry point
├── manifest.json       # PWA manifest
├── css/
│   └── style.css       # All styling
├── js/
│   ├── data.js         # Default task data & category definitions
│   ├── storage.js      # localStorage layer (tasks, history, settings, today state)
│   └── app.js          # App logic, rendering, event handling
└── assets/             # Icons (add icon-192.png and icon-512.png for PWA)
```

## Customisation

- **Default tasks**: edit `js/data.js` — `DEFAULT_TASKS` array
- **Categories**: edit `CATEGORIES` in `js/data.js`
- **Default XP target**: change `DEFAULT_XP_TARGET` in `js/data.js`
- **Colours**: all design tokens are CSS variables in `css/style.css`

## Data

All data lives in `localStorage` under the `ht_` prefix:
- `ht_tasks` — current task list
- `ht_today` — today's completions
- `ht_history` — archived daily XP records
- `ht_settings` — target XP and best streak

To reset everything: open DevTools → Application → Local Storage → clear `ht_*` keys.

## Roadmap / Ideas

- [ ] Export history to CSV
- [ ] Monthly heatmap view
- [ ] XP multipliers for streaks
- [ ] Sound effects on completion
- [ ] Service worker for offline PWA support
- [ ] Per-category XP breakdown chart
