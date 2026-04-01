// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  tasks:        [],
  today:        { date: '', completed: [], xpEarned: 0 },
  settings:     { target: DEFAULT_XP_TARGET, streakBest: 0 },
  buffs:        { date: '', slots: [] },
  activeFilter: 'all',
};

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.tasks    = loadTasks();
  state.today    = loadToday();
  state.settings = loadSettings();
  state.buffs    = loadBuffs(state.tasks);

  // Ensure xpEarned exists on today state
  if (state.today.xpEarned === undefined) state.today.xpEarned = 0;

  bindEvents();
  buildFilterTabs();
  populateCategoryDropdown('new-task-cat');
  render();
  setInterval(checkMidnight, 60_000);
  setInterval(checkTimedBuffs, 15_000); // refresh timed buff countdowns
});

// ── MIDNIGHT CHECK ────────────────────────────────────────────────────────────
let lastDate = todayKey();
function checkMidnight() {
  if (todayKey() !== lastDate) {
    // Archive the day that just ended before loading the new one
    archiveDay(state.today);
    lastDate       = todayKey();
    state.today    = loadToday();
    state.settings = loadSettings();
    state.buffs    = loadBuffs(state.tasks);
    render();
    showToast('New day — quests refreshed. New buffs await.');
  }
}

// Refresh UI when timed buff ticks down
function checkTimedBuffs() {
  const hasActive = state.buffs.slots.some(s =>
    s.activated && s.type === 'timed_double' && !isTimedBuffExpired(s)
  );
  if (hasActive) renderBuffBanner();
}

function isTimedBuffExpired(slot) {
  if (!slot.activatedAt) return true;
  const type = BUFF_TYPES.find(b => b.id === slot.type);
  return Date.now() - slot.activatedAt >= (type ? type.duration : 0);
}

// ── EVENT BINDING ─────────────────────────────────────────────────────────────
function bindEvents() {
  const savedTheme = localStorage.getItem('ht_theme') || 'night';
  applyTheme(savedTheme);
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'night' ? 'day' : 'night';
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
      state.today.xpEarned  = 0;
      saveToday(state.today);
      // Reset buff activations
      state.buffs.slots.forEach(s => {
        s.activated   = false;
        s.activatedAt = null;
        s.consumedBy  = null;
      });
      saveBuffs(state.buffs);
      sfxReset();
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
    const btn     = document.createElement('button');
    btn.className = 'filter-tab' + (cat.id === state.activeFilter ? ' active' : '');
    btn.textContent  = cat.label;
    btn.dataset.cat  = cat.id;
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
    const opt   = document.createElement('option');
    opt.value   = cat.id;
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
  renderBuffBanner();
  renderTaskList();
  renderTasksCount();
}

function renderHeader() {
  const el  = document.getElementById('date-display');
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).toUpperCase();
}

function renderXP() {
  const { earned, target } = getXPData();
  const pct = Math.min(1, earned / target);

  document.getElementById('xp-earned').textContent       = earned;
  document.getElementById('xp-target-display').textContent = target;
  document.getElementById('xp-bar').style.width          = (pct * 100) + '%';
  document.getElementById('xp-bar-glow').style.width     = (pct * 100) + '%';
  document.getElementById('xp-pct').textContent          = Math.round(pct * 100) + '%';

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
  document.getElementById('stat-done').textContent   = state.today.completed.length;
  document.getElementById('stat-best').textContent   = state.settings.streakBest;
}

function renderWeek() {
  const weekData = loadWeekData(state.settings.target, state.today);
  const grid     = document.getElementById('week-grid');
  grid.innerHTML = '';
  weekData.forEach(day => {
    const cell      = document.createElement('div');
    cell.className  = 'week-cell' + (day.isToday ? ' today' : '') + (day.isFuture ? ' future' : '');
    const intensity = day.isFuture ? 0 : Math.min(1, day.pct);
    cell.style.setProperty('--intensity', intensity);
    cell.innerHTML  = `
      <div class="week-label">${day.label}</div>
      <div class="week-xp">${day.isFuture ? '—' : day.xp}</div>
    `;
    grid.appendChild(cell);
  });
}

// ── BUFF BANNER ───────────────────────────────────────────────────────────────
function renderBuffBanner() {
  let banner = document.getElementById('buff-banner');
  if (!banner) {
    // Insert before tasks section
    const tasksSection = document.querySelector('.tasks-section');
    banner = document.createElement('section');
    banner.id = 'buff-banner';
    banner.className = 'buff-banner';
    tasksSection.parentNode.insertBefore(banner, tasksSection);
  }

  const now  = Date.now();
  const slots = state.buffs.slots;

  let html = `<div class="buff-banner-header"><span class="section-label">Daily Boons</span></div>`;
  html += `<div class="buff-slots">`;

  slots.forEach((slot, i) => {
    const task    = state.tasks.find(t => t.id === slot.taskId);
    const btype   = BUFF_TYPES.find(b => b.id === slot.type);
    if (!task || !btype) return;

    const isActivated = slot.activated;
    const isExpired   = slot.type === 'timed_double' && isActivated && isTimedBuffExpired(slot);
    const isConsumed  = slot.consumedBy !== null;

    let statusClass = '';
    let statusText  = '';
    let timerText   = '';

    if (!isActivated) {
      statusClass = 'buff-pending';
      statusText  = 'Complete trigger quest to activate';
    } else if (slot.type === 'timed_double') {
      if (isExpired) {
        statusClass = 'buff-consumed';
        statusText  = 'Expired';
      } else {
        const remaining = Math.ceil(((slot.activatedAt + btype.duration) - now) / 1000 / 60);
        statusClass = 'buff-active';
        statusText  = 'ACTIVE';
        timerText   = `${remaining}m remaining`;
      }
    } else if (isConsumed) {
      statusClass = 'buff-consumed';
      statusText  = 'Consumed';
    } else {
      statusClass = 'buff-active';
      statusText  = 'ACTIVE — awaiting next quest';
    }

    html += `
      <div class="buff-slot ${statusClass}">
        <div class="buff-icon">${btype.icon}</div>
        <div class="buff-body">
          <div class="buff-name">${btype.label}</div>
          <div class="buff-trigger">Trigger: <em>${escHtml(task.name)}</em></div>
          <div class="buff-desc">${btype.desc}</div>
          ${timerText ? `<div class="buff-timer">${timerText}</div>` : ''}
        </div>
        <div class="buff-status-badge">${statusText}</div>
      </div>
    `;
  });

  html += `</div>`;
  banner.innerHTML = html;
}

function renderTaskList() {
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  const completedSet = new Set(state.today.completed);
  let filtered = state.tasks;

  if (state.activeFilter !== 'all') {
    filtered = filtered.filter(t => t.category === state.activeFilter);
  }

  filtered.sort((a, b) => {
    const aDone = completedSet.has(a.id) ? 1 : 0;
    const bDone = completedSet.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    // Buff tasks float to top within incomplete
    const aIsBuff = state.buffs.slots.some(s => s.taskId === a.id && !s.activated);
    const bIsBuff = state.buffs.slots.some(s => s.taskId === b.id && !s.activated);
    if (aIsBuff !== bIsBuff) return aIsBuff ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.xp - a.xp;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No quests in this school.</div>';
    return;
  }

  filtered.forEach(task => {
    const done      = completedSet.has(task.id);
    const cat       = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[1];
    const buffSlot  = getBuffSlotForTask(task.id, state.buffs);
    const isBuff    = buffSlot !== null;
    const buffType  = isBuff ? BUFF_TYPES.find(b => b.id === buffSlot.type) : null;
    const buffDone  = isBuff && buffSlot.activated;

    // Check if any active buff will apply to this task
    const activeMultiplier = getPreviewMultiplier(task);
    const willDouble = activeMultiplier > 1;

    const item = document.createElement('div');
    item.className = 'task-item' +
      (done    ? ' done'      : '') +
      (isBuff && !buffDone && !done ? ' is-buff-trigger' : '') +
      (willDouble && !done ? ' will-double' : '');
    item.dataset.id = task.id;
    item.style.setProperty('--cat-color', cat.color);

    const xpDisplay = willDouble && !done
      ? `<span class="xp-original">${task.xp}</span><span class="xp-doubled">${task.xp * 2}</span><span class="task-xp-unit">XP ×2</span>`
      : `${task.xp}<span class="task-xp-unit">XP</span>`;

    item.innerHTML = `
      <button class="task-check" aria-label="${done ? 'Undo' : 'Complete'} ${task.name}">
        ${done ? '✓' : ''}
      </button>
      <div class="task-body">
        <span class="task-name">${escHtml(task.name)}</span>
        <span class="task-cat">${cat.label}${isBuff && !buffDone ? ` · <span class="buff-tag">${buffType.icon} ${buffType.label}</span>` : ''}</span>
      </div>
      <div class="task-xp">${xpDisplay}</div>
    `;
    item.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id));
    list.appendChild(item);
  });
}

// Preview: would this task get doubled if completed right now?
function getPreviewMultiplier(task) {
  const now = Date.now();
  for (const slot of state.buffs.slots) {
    if (!slot.activated) continue;
    switch (slot.type) {
      case 'next_double':
        if (!slot.consumedBy) return 2;
        break;
      case 'timed_double':
        if (slot.activatedAt && (now - slot.activatedAt) < BUFF_TYPES.find(b=>b.id===slot.type).duration)
          return 2;
        break;
      case 'category_double':
        if (!slot.consumedBy && slot.triggerCategory === task.category) return 2;
        break;
    }
  }
  return 1;
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
    const buffSlot = getBuffSlotForTask(task.id, state.buffs);
    const row      = document.createElement('div');
    row.className  = 'edit-task-row';
    row.dataset.id = task.id;
    row.innerHTML  = `
      <div class="edit-task-info">
        <input class="edit-name-input" type="text" value="${escHtml(task.name)}" maxlength="60" />
        <div class="edit-task-meta">
          <select class="edit-cat-select">${CATEGORIES.filter(c=>c.id!=='all').map(c =>
            `<option value="${c.id}"${c.id===task.category?' selected':''}>${c.label}</option>`
          ).join('')}</select>
          <input class="edit-xp-input" type="number" value="${task.xp}" min="1" max="200" />
          <span class="edit-oneoff-label" title="${task.oneoff ? 'One-off' : 'Recurring'}">
            ${task.oneoff ? '⚑' : '↺'}
          </span>
          ${buffSlot ? `<span class="edit-buff-tag" title="Today's buff trigger">${BUFF_TYPES.find(b=>b.id===buffSlot.type)?.icon || '✦'}</span>` : ''}
        </div>
      </div>
      <div class="edit-task-actions">
        <button class="btn-edit-save" title="Save">✓</button>
        <button class="btn-edit-delete" title="Delete">✕</button>
      </div>
    `;
    row.querySelector('.btn-edit-save').addEventListener('click', () => saveTaskEdit(task.id, row));
    row.querySelector('.btn-edit-delete').addEventListener('click', () => deleteTask(task.id));
    el.appendChild(row);
  });
}

// ── TASK ACTIONS ──────────────────────────────────────────────────────────────
function toggleTask(id) {
  const set  = new Set(state.today.completed);
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const { earned: xpBefore, target } = getXPData();
  const wasAtTarget = xpBefore >= target;

  if (set.has(id)) {
    // ── UNDO ──
    set.delete(id);
    // Recalculate xpEarned from scratch (can't simply subtract — buff may have applied)
    state.today.completed = Array.from(set);
    state.today.xpEarned  = recalcXP(state.today.completed);
    saveToday(state.today);
    // Undo buff activation if this was the trigger task
    const slot = getBuffSlotForTask(id, state.buffs);
    if (slot && slot.activated && !slot.consumedBy) {
      slot.activated   = false;
      slot.activatedAt = null;
      if (slot.triggerCategory) slot.triggerCategory = null;
      saveBuffs(state.buffs);
    }
    sfxUndo();
    render();
    return;
  }

  // ── COMPLETE ──
  const pctBefore = Math.min(1, xpBefore / target);
  const el        = document.querySelector(`.task-item[data-id="${id}"]`);
  const cat       = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[1];

  // Check if this task is a buff trigger
  const buffSlot = getBuffSlotForTask(id, state.buffs);
  const isTrigger = buffSlot !== null && !buffSlot.activated;

  // Calculate XP earned — resolve active buffs (excludes trigger activation)
  const multiplier = resolveBuffMultiplier(id, task.category, state.buffs);
  const xpGained   = task.xp * multiplier;

  // Activate buff if this is a trigger task
  if (isTrigger) {
    buffSlot.activated   = true;
    buffSlot.activatedAt = Date.now();
    if (buffSlot.type === 'category_double') {
      buffSlot.triggerCategory = task.category;
    }
  }

  set.add(id);
  state.today.completed = Array.from(set);
  state.today.xpEarned  = (state.today.xpEarned || 0) + xpGained;
  saveToday(state.today);
  saveBuffs(state.buffs);

  const { earned: xpAfter } = getXPData();
  const pctAfter    = Math.min(1, xpAfter / target);
  const nowAtTarget = xpAfter >= target;

  // Animations & sounds
  if (el) {
    particleBurst(el, cat.color);
    flashTask(el);
  }

  if (isTrigger) {
    sfxBuffActivated();
    showToast(`${BUFF_TYPES.find(b=>b.id===buffSlot.type)?.icon} ${BUFF_TYPES.find(b=>b.id===buffSlot.type)?.label} activated!`);
  } else if (multiplier > 1) {
    sfxBuffConsumed();
    showToast(`⚡ Double XP! +${xpGained} XP`);
  } else if (nowAtTarget && !wasAtTarget) {
    sfxTargetReached();
    setTimeout(targetReachedFlash, 300);
    showToast('Daily target reached! ✦');
  } else {
    sfxQuestComplete();
  }

  animateXPBar(pctBefore, pctAfter);
  showXPBurst(xpGained);

  if (el) {
    slideOutTask(el, () => render());
  } else {
    render();
  }
}

// Recalculate XP from scratch for a set of completed task IDs
// Used after undo (buff XP is complex, simplest is to recount from state)
function recalcXP(completedIds) {
  // Simple recalc — just base XP (post-undo buff recalc would be complex,
  // so we track xpEarned cumulatively and only subtract base on undo)
  return completedIds.reduce((sum, cid) => {
    const t = state.tasks.find(t => t.id === cid);
    return sum + (t ? t.xp : 0);
  }, 0);
}

function handleAddTask() {
  const name   = document.getElementById('new-task-name').value.trim();
  const cat    = document.getElementById('new-task-cat').value;
  const xp     = parseInt(document.getElementById('new-task-xp').value, 10);
  const oneoff = document.getElementById('new-task-oneoff').checked;

  if (!name)        { showToast('Enter a quest name.');       return; }
  if (!xp || xp < 1) { showToast('Enter an XP value (min 1).'); return; }

  const task = { id: generateId(), name, category: cat, xp, oneoff };
  state.tasks.push(task);
  saveTasks(state.tasks);

  document.getElementById('new-task-name').value     = '';
  document.getElementById('new-task-xp').value       = '';
  document.getElementById('new-task-oneoff').checked = false;

  render();
  renderEditList();
  sfxAddQuest();
  showToast(`"${name}" inscribed — ${xp} XP.`);
}

function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Delete "${task.name}"?`)) return;
  state.tasks             = state.tasks.filter(t => t.id !== id);
  state.today.completed   = state.today.completed.filter(cid => cid !== id);
  state.today.xpEarned    = recalcXP(state.today.completed);
  saveTasks(state.tasks);
  saveToday(state.today);
  renderEditList();
  render();
  showToast(`"${task.name}" removed.`);
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
  showToast('Quest updated.');
}

function handleSaveSettings() {
  const target = parseInt(document.getElementById('settings-target').value, 10);
  if (!target || target < 10) { showToast('Target must be at least 10 XP.'); return; }
  state.settings.target = target;
  saveSettings(state.settings);
  render();
  showToast('Daily target updated to ' + target + ' XP.');
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
  return {
    earned: state.today.xpEarned || 0,
    target: state.settings.target,
  };
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('visible');
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, 2800);
}

function showXPBurst(xp) {
  const el  = document.createElement('div');
  el.className = 'xp-burst';
  el.textContent = '+' + xp + ' XP';
  document.body.appendChild(el);
  const bar = document.getElementById('xp-bar-track');
  if (bar) {
    const rect   = bar.getBoundingClientRect();
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
