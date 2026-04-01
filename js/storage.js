// ── STORAGE ──────────────────────────────────────────────────────────────────

const KEYS = {
  TASKS:    'ht_tasks',
  HISTORY:  'ht_history',
  SETTINGS: 'ht_settings',
  TODAY:    'ht_today',
  BUFFS:    'ht_buffs',
};

// ── BUFF TYPES ────────────────────────────────────────────────────────────────
const BUFF_TYPES = [
  {
    id:       'next_double',
    label:    'Arcane Surge',
    icon:     '⚡',
    desc:     'Next quest completed earns double XP',
  },
  {
    id:       'timed_double',
    label:    'Blessing of Haste',
    icon:     '⏳',
    desc:     'Double XP on all quests for 30 minutes',
    duration: 30 * 60 * 1000,
  },
  {
    id:       'category_double',
    label:    'School Mastery',
    icon:     '📖',
    desc:     'Next quest in the same school earns double XP',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

// BUG FIX 1: Use LOCAL date, not UTC. toISOString() is UTC and rolls over at
// 10am AEST. We build the key from local year/month/day instead.
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  // First launch only — seed defaults
  save(KEYS.TASKS, DEFAULT_TASKS);
  return JSON.parse(JSON.stringify(DEFAULT_TASKS)); // deep copy
}

function saveTasks(tasks) {
  save(KEYS.TASKS, tasks);
}

function generateId() {
  return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

// ── Today State ───────────────────────────────────────────────────────────────
// BUG FIX 2: loadToday must NOT call any function that itself calls loadToday
// (loadWeekData previously did this, creating a recursive overwrite).
// archiveDay now receives the state directly and does NOT call loadToday.

function loadToday() {
  const stored = load(KEYS.TODAY, null);
  const key    = todayKey();

  if (stored && stored.date === key) {
    // Same day — return as-is, ensure xpEarned field exists
    if (stored.xpEarned === undefined) stored.xpEarned = 0;
    return stored;
  }

  // New day: archive yesterday before creating fresh state
  if (stored && stored.date !== key) {
    archiveDay(stored);
  }

  const fresh = { date: key, completed: [], xpEarned: 0 };
  save(KEYS.TODAY, fresh);
  return fresh;
}

function saveToday(todayState) {
  save(KEYS.TODAY, todayState);
}

// ── History / Archiving ───────────────────────────────────────────────────────
// Receives the previous day's state directly — never calls loadToday().

function archiveDay(prevState) {
  if (!prevState || !prevState.date) return;

  const history = load(KEYS.HISTORY, {});

  // Don't re-archive if already saved
  if (history[prevState.date]) return;

  const xp = prevState.xpEarned != null
    ? prevState.xpEarned
    : (() => {
        // Fallback: recalculate from task list if xpEarned wasn't tracked
        const tasks = load(KEYS.TASKS, []);
        return (prevState.completed || []).reduce((sum, id) => {
          const t = tasks.find(t => t.id === id);
          return sum + (t ? t.xp : 0);
        }, 0);
      })();

  history[prevState.date] = {
    xp,
    completed: prevState.completed || [],
  };
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

// ── Buff State ────────────────────────────────────────────────────────────────

function loadBuffs(tasks) {
  const stored = load(KEYS.BUFFS, null);
  const key    = todayKey();
  if (stored && stored.date === key) return stored;
  return generateDailyBuffs(tasks, key);
}

function generateDailyBuffs(tasks, dateKey) {
  const seed = dateKey.replace(/-/g, '');
  const rng  = seededRng(parseInt(seed, 10));

  const pool = [...tasks];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, Math.min(3, pool.length));

  const types = [...BUFF_TYPES];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  const slots = chosen.map((task, i) => ({
    taskId:          task.id,
    type:            types[i].id,
    activated:       false,
    activatedAt:     null,
    consumedBy:      null,
    triggerCategory: null,
  }));

  const buffs = { date: dateKey, slots };
  save(KEYS.BUFFS, buffs);
  return buffs;
}

function saveBuffs(buffs) {
  save(KEYS.BUFFS, buffs);
}

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed >>> 0;
  return function() {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Buff Resolution ───────────────────────────────────────────────────────────

function resolveBuffMultiplier(taskId, taskCategory, buffState) {
  const now = Date.now();
  let multiplier = 1;

  for (const slot of buffState.slots) {
    if (!slot.activated) continue;
    const type = BUFF_TYPES.find(b => b.id === slot.type);
    if (!type) continue;

    switch (slot.type) {
      case 'next_double':
        if (!slot.consumedBy) {
          multiplier    = Math.max(multiplier, 2);
          slot.consumedBy = taskId;
        }
        break;
      case 'timed_double':
        if (slot.activatedAt && (now - slot.activatedAt) < type.duration) {
          multiplier = Math.max(multiplier, 2);
        }
        break;
      case 'category_double':
        if (!slot.consumedBy && slot.triggerCategory === taskCategory) {
          multiplier    = Math.max(multiplier, 2);
          slot.consumedBy = taskId;
        }
        break;
    }
  }

  return multiplier;
}

function getBuffSlotForTask(taskId, buffState) {
  return buffState.slots.find(s => s.taskId === taskId) || null;
}

// ── Streak Calculation ────────────────────────────────────────────────────────

function calcStreak(settings) {
  const history = loadHistory();
  const target  = settings.target;
  let streak    = 0;
  const today   = new Date();

  for (let i = 1; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Use local date key for history lookup
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
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
// BUG FIX 3: Does NOT call loadToday() — receives today's state as a parameter
// to avoid the recursive overwrite bug.

function loadWeekData(target, todayState) {
  const history = loadHistory();
  const todayXP = todayState.xpEarned || 0;
  const todayDateKey = todayState.date;

  const now    = new Date();
  const dow    = (now.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  const days      = [];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  for (let i = 0; i < 7; i++) {
    const d   = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y   = d.getFullYear();
    const mo  = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${mo}-${day}`;

    const isToday  = key === todayDateKey;
    const isFuture = !isToday && d > now;
    const entry    = isToday ? { xp: todayXP } : history[key];
    const xp       = entry ? entry.xp : 0;

    days.push({
      date: key, label: dayLabels[i], xp,
      pct: Math.min(1, xp / target),
      isToday, isFuture,
    });
  }
  return days;
}

function pruneOneoffs(tasks, today) {
  return tasks;
}
