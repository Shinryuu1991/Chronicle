// ── FX.JS — Sound & Animation Effects ────────────────────────────────────────
// All audio is synthesised via Web Audio API — no external files required.
// All animations are CSS-class or DOM-injection based.

// ── AUDIO CONTEXT ─────────────────────────────────────────────────────────────
let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── LOW-LEVEL HELPERS ─────────────────────────────────────────────────────────

// Play a single oscillator tone
function tone(freq, type, startTime, duration, gainPeak, ctx) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// Play a noise burst (parchment rustle / whoosh)
function noise(startTime, duration, gainPeak, ctx) {
  const bufSize  = ctx.sampleRate * duration;
  const buffer   = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data     = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type            = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value         = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(startTime);
  source.stop(startTime + duration);
}

// ── SOUND EFFECTS ─────────────────────────────────────────────────────────────

// Quest complete — ascending chime arpeggio (coins landing on a table)
function sfxQuestComplete() {
  try {
    const ctx = getCtx();
    const t   = ctx.currentTime;
    // Coin-like metallic tones via triangle + slight detuning
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      tone(freq,     'triangle', t + i * 0.07, 0.5, 0.18, ctx);
      tone(freq * 2, 'sine',     t + i * 0.07, 0.3, 0.04, ctx); // shimmer harmonic
    });
    // Soft coin-drop noise at start
    noise(t, 0.06, 0.08, ctx);
  } catch(e) { /* audio blocked */ }
}

// Daily target hit — triumphant fanfare (short medieval horn phrase)
function sfxTargetReached() {
  try {
    const ctx = getCtx();
    const t   = ctx.currentTime;
    // Horn-like sawtooth melody
    const phrase = [
      { f: 392.00, d: 0.12 }, // G4
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.28 }, // G5 (held)
      { f: 659.25, d: 0.10 }, // E5
      { f: 783.99, d: 0.4  }, // G5 (final)
    ];
    let offset = 0;
    phrase.forEach(({ f, d }) => {
      tone(f,       'sawtooth', t + offset, d + 0.08, 0.12, ctx);
      tone(f * 1.5, 'sine',     t + offset, d + 0.08, 0.03, ctx); // fifth harmonic
      offset += d;
    });
    // Bell shimmer over the top
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(f, 'sine', t + i * 0.06, 0.8, 0.06, ctx);
    });
  } catch(e) {}
}

// Add quest — soft parchment rustle + single low chime (quill on scroll)
function sfxAddQuest() {
  try {
    const ctx = getCtx();
    const t   = ctx.currentTime;
    noise(t, 0.12, 0.06, ctx);
    tone(329.63, 'sine',     t + 0.05, 0.4, 0.10, ctx); // E4
    tone(392.00, 'triangle', t + 0.12, 0.3, 0.06, ctx); // G4
  } catch(e) {}
}

// Reset day — descending toll (like a bell marking the hour, solemn)
function sfxReset() {
  try {
    const ctx = getCtx();
    const t   = ctx.currentTime;
    const notes = [523.25, 440.00, 349.23, 261.63]; // C5 A4 F4 C4 descending
    notes.forEach((freq, i) => {
      tone(freq,       'sine',     t + i * 0.18, 0.6, 0.12, ctx);
      tone(freq * 0.5, 'triangle', t + i * 0.18, 0.5, 0.04, ctx);
    });
    noise(t + 0.6, 0.08, 0.04, ctx); // faint rustle at end
  } catch(e) {}
}

// Undo complete — single soft descending tone
function sfxUndo() {
  try {
    const ctx = getCtx();
    const t   = ctx.currentTime;
    tone(440.00, 'sine', t,      0.3, 0.08, ctx);
    tone(349.23, 'sine', t + 0.1, 0.25, 0.05, ctx);
  } catch(e) {}
}

// ── ANIMATION HELPERS ─────────────────────────────────────────────────────────

// Particle burst at a given element (sparks flying out from the task)
function particleBurst(el, color) {
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  * 0.5 + window.scrollX;
  const cy     = rect.top  + rect.height * 0.5 + window.scrollY;
  const count  = 14;
  const glyphs = ['✦', '✧', '·', '◆', '★', '✶'];

  for (let i = 0; i < count; i++) {
    const p   = document.createElement('div');
    const ang = (360 / count) * i + (Math.random() * 20 - 10);
    const rad = Math.PI * 2 * (ang / 360);
    const dist = 40 + Math.random() * 40;
    const dx   = Math.cos(rad) * dist;
    const dy   = Math.sin(rad) * dist;
    const size = 8 + Math.random() * 10;
    const dur  = 600 + Math.random() * 400;

    p.className      = 'fx-particle';
    p.textContent    = glyphs[Math.floor(Math.random() * glyphs.length)];
    p.style.cssText  = `
      position: absolute;
      left: ${cx}px;
      top:  ${cy}px;
      font-size: ${size}px;
      color: ${color};
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      opacity: 1;
      transition: transform ${dur}ms ease-out, opacity ${dur}ms ease-out;
    `;
    document.body.appendChild(p);

    // Trigger animation next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`;
        p.style.opacity   = '0';
      });
    });

    setTimeout(() => p.remove(), dur + 50);
  }
}

// Flash the task row gold then fade back
function flashTask(el) {
  el.classList.add('fx-flash');
  setTimeout(() => el.classList.remove('fx-flash'), 600);
}

// Slide task out, then re-render (gives time for animation before DOM rebuild)
function slideOutTask(el, callback) {
  el.classList.add('fx-slide-out');
  setTimeout(callback, 380);
}

// Animate XP bar from old value to new (called before render updates width)
function animateXPBar(fromPct, toPct) {
  const bar  = document.getElementById('xp-bar');
  const glow = document.getElementById('xp-bar-glow');
  if (!bar) return;
  // Force start position
  bar.style.transition  = 'none';
  glow.style.transition = 'none';
  bar.style.width  = (fromPct * 100) + '%';
  glow.style.width = (fromPct * 100) + '%';
  // Let browser paint, then animate to new
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition  = 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
      glow.style.transition = 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
      bar.style.width  = (Math.min(1, toPct) * 100) + '%';
      glow.style.width = (Math.min(1, toPct) * 100) + '%';
    });
  });
}

// Full-screen golden flash for hitting daily target
function targetReachedFlash() {
  const el = document.createElement('div');
  el.className = 'fx-target-flash';
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 600);
  }, 500);
}
