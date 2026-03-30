// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  tasks:       [],
  today:       { date: '', completed: [] },
  settings:    { target: DEFAULT_XP_TARGET, streakBest: 0 },
  activeFilter: 'all',
};

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.tasks    = loadTasks();
  state.today    = loadToday();
  state.settings = loadSettings();

  // Prune completed one-offs from previous days
  const completedToday = new Set(state.today.completed);
  state.tasks = state.tasks.filter(t => {
    // Keep if: not one-off, OR not yet completed today, OR completed today (so it shows as done)
    return !t.oneoff || completedToday.has(t.id) || true;
    // Actual pruning happens on reset/next-day load
  });

  bindEvents();
  buildFilterTabs();
  populateCategoryDropdown('new-task-cat');
  render();
  setInterval(checkMidnight, 60_000);
});

// ── MIDNIGHT CHECK ────────────────────────────────────────────────────────────
let lastDate = todayKey();
function checkMidnight() {
  if (todayKey() !== lastDate) {
    lastDate = todayKey();
    state.today    = loadToday();
    state.settings = loadSettings();
    render();
    showToast('New day — quest log refreshed.');
  }
}

// ── EVENT BINDING ─────────────────────────────────────────────────────────────
function bindEvents() {
  // Theme toggle
  const savedTheme = localStorage.getItem('ht_theme') || 'night';
  applyTheme(savedTheme);
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'night' ? 'day' : 'night';
    applyTheme(next);
    localStorage.setItem('ht_theme', next);
  });

  document.getElementById('btn-manage').addEventListener('click', openModal);
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset all completions for today?')) {
      state.today.completed = [];
      saveToday(state.today);
      render();
      showToast('Today reset.');
    }
  });
  document.getElementById('btn-add-task').addEventListener('click', handleAddTask);
  document.getElementById('btn-save-settings').addEventListener('click', handleSaveSettings);

  document.getElementById('new-task-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddTask();
  });
}

// ── FILTER TABS ───────────────────────────────────────────────────────────────
function buildFilterTabs() {
  const el = document.getElementById('filter-tabs');
  el.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-tab' + (cat.id === state.activeFilter ? ' active' : '');
    btn.textContent = cat.label;
    btn.dataset.cat = cat.id;
    btn.style.setProperty('--cat-color', cat.color);
    btn.addEventListener('click', () => {
      state.activeFilter = cat.id;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTaskList();
      renderTasksCount();
    });
    el.appendChild(btn);
  });
}

function populateCategoryDropdown(id) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  CATEGORIES.filter(c => c.id !== 'all').forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    el.appendChild(opt);
  });
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  renderHeader();
  renderXP();
  renderStats();
  renderWeek();
  renderTaskList();
  renderTasksCount();
}

function renderHeader() {
  const el = document.getElementById('date-display');
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).toUpperCase();
}

function renderXP() {
  const { earned, target } = getXPData();
  const pct = Math.min(1, earned / target);

  document.getElementById('xp-earned').textContent = earned;
  document.getElementById('xp-target-display').textContent = target;
  document.getElementById('xp-bar').style.width = (pct * 100) + '%';
  document.getElementById('xp-bar-glow').style.width = (pct * 100) + '%';
  document.getElementById('xp-pct').textContent = Math.round(pct * 100) + '%';

  const overflow = document.getElementById('xp-overflow');
  if (earned > target) {
    overflow.textContent = '+' + (earned - target) + ' OVERFLOW';
    overflow.classList.remove('hidden');
  } else {
    overflow.classList.add('hidden');
  }
}

function renderStats() {
  const streak = calcStreak(state.settings);
  if (streak > state.settings.streakBest) {
    state.settings.streakBest = streak;
    saveSettings(state.settings);
  }
  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('stat-done').textContent = state.today.completed.length;
  document.getElementById('stat-best').textContent = state.settings.streakBest;
}

function renderWeek() {
  const weekData = loadWeekData(state.settings.target);
  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';
  weekData.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'week-cell' + (day.isToday ? ' today' : '') + (day.isFuture ? ' future' : '');
    const intensity = day.isFuture ? 0 : Math.min(1, day.pct);
    cell.style.setProperty('--intensity', intensity);
    cell.innerHTML = `
      <div class="week-label">${day.label}</div>
      <div class="week-xp">${day.isFuture ? '—' : day.xp}</div>
    `;
    grid.appendChild(cell);
  });
}

function renderTaskList() {
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  const completedSet = new Set(state.today.completed);
  let filtered = state.tasks;

  // Filter by category
  if (state.activeFilter !== 'all') {
    filtered = filtered.filter(t => t.category === state.activeFilter);
  }

  // Sort: incomplete first, then by category, then by xp desc
  filtered.sort((a, b) => {
    const aDone = completedSet.has(a.id) ? 1 : 0;
    const bDone = completedSet.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.xp - a.xp;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No tasks in this category.</div>';
    return;
  }

  filtered.forEach(task => {
    const done = completedSet.has(task.id);
    const cat  = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[1];
    const item = document.createElement('div');
    item.className = 'task-item' + (done ? ' done' : '');
    item.dataset.id = task.id;
    item.style.setProperty('--cat-color', cat.color);
    item.innerHTML = `
      <button class="task-check" aria-label="${done ? 'Undo' : 'Complete'} ${task.name}">
        ${done ? '✓' : ''}
      </button>
      <div class="task-body">
        <span class="task-name">${escHtml(task.name)}</span>
        <span class="task-cat">${cat.label}</span>
      </div>
      <div class="task-xp">+${task.xp}<span class="task-xp-unit">XP</span></div>
    `;
    item.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id));
    list.appendChild(item);
  });
}

function renderTasksCount() {
  const completedSet = new Set(state.today.completed);
  let filtered = state.tasks;
  if (state.activeFilter !== 'all') {
    filtered = filtered.filter(t => t.category === state.activeFilter);
  }
  const remaining = filtered.filter(t => !completedSet.has(t.id)).length;
  document.getElementById('tasks-remaining').textContent =
    remaining === 0 ? '✓ all done!' : `${remaining} remaining`;
}

function renderEditList() {
  const el = document.getElementById('edit-task-list');
  el.innerHTML = '';
  state.tasks.forEach(task => {
    const cat = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[1];
    const row = document.createElement('div');
    row.className = 'edit-task-row';
    row.dataset.id = task.id;
    row.innerHTML = `
      <div class="edit-task-info">
        <input class="edit-name-input" type="text" value="${escHtml(task.name)}" maxlength="60" />
        <div class="edit-task-meta">
          <select class="edit-cat-select">${CATEGORIES.filter(c=>c.id!=='all').map(c =>
            `<option value="${c.id}"${c.id===task.category?' selected':''}>${c.label}</option>`
          ).join('')}</select>
          <input class="edit-xp-input" type="number" value="${task.xp}" min="1" max="200" />
          <span class="edit-oneoff-label" title="${task.oneoff ? 'One-off task' : 'Recurring task'}">
            ${task.oneoff ? '⚑' : '↺'}
          </span>
        </div>
      </div>
      <div class="edit-task-actions">
        <button class="btn-edit-save" title="Save changes">✓</button>
        <button class="btn-edit-delete" title="Delete task">✕</button>
      </div>
    `;
    row.querySelector('.btn-edit-save').addEventListener('click', () => saveTaskEdit(task.id, row));
    row.querySelector('.btn-edit-delete').addEventListener('click', () => deleteTask(task.id));
    el.appendChild(row);
  });
}

// ── TASK ACTIONS ──────────────────────────────────────────────────────────────
function toggleTask(id) {
  const set = new Set(state.today.completed);
  let earned = 0;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  if (set.has(id)) {
    set.delete(id);
    earned = -task.xp;
  } else {
    set.add(id);
    earned = task.xp;
    showXPBurst(earned);
  }
  state.today.completed = Array.from(set);
  saveToday(state.today);
  render();
}

function handleAddTask() {
  const name   = document.getElementById('new-task-name').value.trim();
  const cat    = document.getElementById('new-task-cat').value;
  const xp     = parseInt(document.getElementById('new-task-xp').value, 10);
  const oneoff = document.getElementById('new-task-oneoff').checked;

  if (!name) { showToast('Enter a task name.'); return; }
  if (!xp || xp < 1) { showToast('Enter an XP value (min 1).'); return; }

  const task = { id: generateId(), name, category: cat, xp, oneoff };
  state.tasks.push(task);
  saveTasks(state.tasks);

  // Clear form
  document.getElementById('new-task-name').value  = '';
  document.getElementById('new-task-xp').value    = '';
  document.getElementById('new-task-oneoff').checked = false;

  render();
  renderEditList();
  showToast(`"${name}" added — ${xp} XP.`);
}

function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Delete "${task.name}"?`)) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  state.today.completed = state.today.completed.filter(cid => cid !== id);
  saveTasks(state.tasks);
  saveToday(state.today);
  renderEditList();
  render();
  showToast(`"${task.name}" deleted.`);
}

function saveTaskEdit(id, row) {
  const name = row.querySelector('.edit-name-input').value.trim();
  const cat  = row.querySelector('.edit-cat-select').value;
  const xp   = parseInt(row.querySelector('.edit-xp-input').value, 10);
  if (!name || !xp || xp < 1) { showToast('Invalid name or XP.'); return; }
  state.tasks = state.tasks.map(t => t.id === id ? { ...t, name, category: cat, xp } : t);
  saveTasks(state.tasks);
  render();
  renderEditList();
  showToast('Task updated.');
}

function handleSaveSettings() {
  const target = parseInt(document.getElementById('settings-target').value, 10);
  if (!target || target < 10) { showToast('Target must be at least 10 XP.'); return; }
  state.settings.target = target;
  saveSettings(state.settings);
  render();
  showToast('Target updated to ' + target + ' XP.');
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal() {
  document.getElementById('settings-target').value = state.settings.target;
  renderEditList();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getXPData() {
  const earned = state.today.completed.reduce((sum, id) => {
    const t = state.tasks.find(t => t.id === id);
    return sum + (t ? t.xp : 0);
  }, 0);
  return { earned, target: state.settings.target };
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('visible');
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, 2500);
}

function showXPBurst(xp) {
  const el = document.createElement('div');
  el.className = 'xp-burst';
  el.textContent = '+' + xp + ' XP';
  document.body.appendChild(el);
  // Position near XP bar
  const bar = document.getElementById('xp-bar-track');
  if (bar) {
    const rect = bar.getBoundingClientRect();
    el.style.left = (rect.left + rect.width * 0.5) + 'px';
    el.style.top  = (rect.top + window.scrollY) + 'px';
  }
  setTimeout(() => el.remove(), 900);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-theme').textContent = theme === 'night' ? '☀' : '☽';
}

function escHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
