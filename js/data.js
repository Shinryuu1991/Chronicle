// ── DEFAULT CATEGORIES ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',        label: 'ALL',       color: '#7dd3fc' },
  { id: 'body',       label: 'BODY',      color: '#4ade80' },
  { id: 'mind',       label: 'MIND',      color: '#c084fc' },
  { id: 'nutrition',  label: 'NUTRITION', color: '#fb923c' },
  { id: 'home',       label: 'HOME',      color: '#f9a8d4' },
  { id: 'work',       label: 'WORK',      color: '#60a5fa' },
  { id: 'recovery',   label: 'RECOVERY',  color: '#a78bfa' },
];

// ── DEFAULT TASKS ────────────────────────────────────────────────────────────
// These are preloaded on first launch only.
// XP values are intentionally tiered: tiny tasks exist so bad days still score.
const DEFAULT_TASKS = [

  // BODY
  { id: 'default-01', name: 'Training session',       category: 'body',      xp: 30, oneoff: false },
  { id: 'default-02', name: 'Stretching / mobility',  category: 'body',      xp: 10, oneoff: false },
  { id: 'default-03', name: 'Walk 30+ min',            category: 'body',      xp: 10, oneoff: false },
  { id: 'default-04', name: 'Hit step goal',           category: 'body',      xp: 10, oneoff: false },

  // NUTRITION
  { id: 'default-05', name: 'Hit protein target',      category: 'nutrition', xp: 15, oneoff: false },
  { id: 'default-06', name: 'Meal prepped',            category: 'nutrition', xp: 20, oneoff: false },
  { id: 'default-07', name: 'Stayed gluten free',      category: 'nutrition', xp: 10, oneoff: false },
  { id: 'default-08', name: 'Drank 2.5L+ water',       category: 'nutrition', xp: 10, oneoff: false },

  // MIND
  { id: 'default-09', name: 'Meditation',              category: 'mind',      xp: 15, oneoff: false },
  { id: 'default-10', name: 'Journalling',             category: 'mind',      xp: 10, oneoff: false },
  { id: 'default-11', name: 'Read 20+ min',            category: 'mind',      xp: 10, oneoff: false },
  { id: 'default-12', name: 'No doom scrolling',       category: 'mind',      xp: 10, oneoff: false },
  { id: 'default-13', name: 'Impulse check practiced', category: 'mind',      xp: 10, oneoff: false },

  // RECOVERY
  { id: 'default-14', name: 'In bed by target time',   category: 'recovery',  xp: 15, oneoff: false },
  { id: 'default-15', name: 'Slept 7+ hours',          category: 'recovery',  xp: 15, oneoff: false },
  { id: 'default-16', name: 'Magnesium taken',         category: 'recovery',  xp:  5, oneoff: false },
  { id: 'default-17', name: 'Screen-off 30 min before bed', category: 'recovery', xp: 10, oneoff: false },

  // HOME
  { id: 'default-18', name: 'Kitchen clean before bed', category: 'home',     xp: 10, oneoff: false },
  { id: 'default-19', name: 'One household chore done', category: 'home',     xp: 10, oneoff: false },

  // WORK
  { id: 'default-20', name: 'Lesson resources prepped', category: 'work',     xp: 20, oneoff: false },
  { id: 'default-21', name: 'Marking completed',        category: 'work',     xp: 15, oneoff: false },
  { id: 'default-22', name: 'Admin cleared',            category: 'work',     xp: 10, oneoff: false },
];

// ── DAILY XP TARGET DEFAULT ──────────────────────────────────────────────────
const DEFAULT_XP_TARGET = 100;
