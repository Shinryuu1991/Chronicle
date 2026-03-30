// ── STORAGE ──────────────────────────────────────────────────────────────────
// All localStorage interactions are isolated here so the rest of the app
// doesn't need to know about keys or serialisation.

const KEYS = {
  TASKS:    'ht_tasks',
  HISTORY:  'ht_history',   // { 'YYYY-MM-DD': { xp, completed: [id,...] } }
  SETTINGS: 'ht_settings',  // { target, streakBest }
  TODAY:    'ht_today',     // { date, completed: [id,...] }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function loadTasks() {
  const stored = load(KEYS.TASKS, null);
  if (stored !== null) return stored;
  // First launch: seed defaults
  save(KEYS.TASKS, DEFAULT_TASKS);
  return DEFAULT_TASKS;
}

function saveTasks(tasks) {
  save(KEYS.TASKS, tasks);
}

function generateId() {
  return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

// ── Today State ───────────────────────────────────────────────────────────────

function loadToday() {
  const stored = load(KEYS.TODAY, null);
  const key = todayKey();
  if (stored && stored.date === key) return stored;
  // New day: archive yesterday if needed, then start fresh
  if (stored && stored.date !== key) {
    archiveDay(stored);
  }
  const fresh = { date: key, completed: [] };
  save(KEYS.TODAY, fresh);
  return fresh;
}

function saveToday(todayState) {
  save(KEYS.TODAY, todayState);
}

// ── History / Archiving ───────────────────────────────────────────────────────

function archiveDay(todayState) {
  const tasks  = loadTasks();
  const earned = todayState.completed.reduce((sum, id) => {
    const t = tasks.find(t => t.id === id);
    return sum + (t ? t.xp : 0);
  }, 0);
  const history = load(KEYS.HISTORY, {});
  history[todayState.date] = { xp: earned, completed: todayState.completed };
  save(KEYS.HISTORY, history);
}

function loadHistory() {
  return load(KEYS.HISTORY, {});
}

// ── Settings ──────────────────────────────────────────────────────────────────

function loadSettings() {
  return load(KEYS.SETTINGS, { target: DEFAULT_XP_TARGET, streakBest: 0 });
}

function saveSettings(settings) {
  save(KEYS.SETTINGS, settings);
}

// ── Streak Calculation ────────────────────────────────────────────────────────

function calcStreak(settings) {
  const history = loadHistory();
  const target  = settings.target;
  let streak    = 0;
  const today   = new Date();

  // Walk backwards through days (skip today — it's still in progress)
  for (let i = 1; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = history[key];
    if (entry && entry.xp >= target) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Week Heatmap Data ─────────────────────────────────────────────────────────
// Returns array of 7 objects: { date, label, xp, pct }
// Index 0 = Monday, Index 6 = Sunday

function loadWeekData(target) {
  const history = loadHistory();
  const today   = loadToday();
  const tasks   = loadTasks();
  const todayXP = today.completed.reduce((sum, id) => {
    const t = tasks.find(t => t.id === id);
    return sum + (t ? t.xp : 0);
  }, 0);

  const now = new Date();
  // Find Monday of this week
  const dow = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  const days = [];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const isToday = key === todayKey();
    const entry = isToday ? { xp: todayXP } : history[key];
    const xp = entry ? entry.xp : 0;
    days.push({
      date:    key,
      label:   dayLabels[i],
      xp,
      pct:     Math.min(1, xp / target),
      isToday,
      isFuture: d > now && !isToday,
    });
  }
  return days;
}

// ── Cleanup: remove one-off tasks that were completed yesterday ───────────────
function pruneOneoffs(tasks, today) {
  // Called at the start of a new day (handled in loadToday archiving path).
  // We don't auto-delete here — let the user see them and clear explicitly.
  // One-offs are filtered out of tomorrow's task list once completed.
  return tasks;
}
