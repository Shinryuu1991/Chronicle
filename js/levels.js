// ── LEVEL PROGRESSION ────────────────────────────────────────────────────────

const MAX_LEVEL = 20;

// Renown required to reach each level (index = level, value = cumulative total needed)
// Level 1 starts at 0. Level 20 cap = ~72,500 total renown.
const LEVEL_THRESHOLDS = [
  0,        // L1  — start
  25,       // L2
  85,       // L3
  205,      // L4
  425,      // L5
  795,      // L6
  1375,     // L7
  2250,     // L8
  3500,     // L9
  5250,     // L10
  7650,     // L11
  10850,    // L12
  15050,    // L13
  20450,    // L14
  27250,    // L15
  35250,    // L16
  44050,    // L17
  53250,    // L18
  62750,    // L19
  72550,    // L20 — max
];

// Daily XP cap per level
const LEVEL_CAPS = [
  80,   // L1
  90,   // L2
  100,  // L3
  112,  // L4
  125,  // L5
  138,  // L6
  152,  // L7
  167,  // L8
  183,  // L9
  200,  // L10
  215,  // L11
  230,  // L12
  246,  // L13
  263,  // L14
  280,  // L15
  295,  // L16
  310,  // L17
  325,  // L18
  338,  // L19
  350,  // L20
];

// Streak multiplier tiers
const STREAK_MULTIPLIERS = [
  { minDays: 30, multiplier: 1.6  },
  { minDays: 14, multiplier: 1.5  },
  { minDays: 7,  multiplier: 1.35 },
  { minDays: 3,  multiplier: 1.15 },
  { minDays: 0,  multiplier: 1.0  },
];

function getStreakMultiplier(streakDays) {
  for (const tier of STREAK_MULTIPLIERS) {
    if (streakDays >= tier.minDays) return tier.multiplier;
  }
  return 1.0;
}

function getLevelFromRenown(renown) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (renown >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  return Math.min(level, MAX_LEVEL);
}

function getCapForLevel(level) {
  return LEVEL_CAPS[Math.min(level, MAX_LEVEL) - 1];
}

function getRenownForNextLevel(level) {
  if (level >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[level]; // index = level means "threshold to reach level+1"
}

function getLevelProgress(renown) {
  const level       = getLevelFromRenown(renown);
  const thisFloor   = LEVEL_THRESHOLDS[level - 1];
  const nextCeil    = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[level - 1];
  const span        = nextCeil - thisFloor;
  const progress    = renown - thisFloor;
  const pct         = level >= MAX_LEVEL ? 1 : Math.min(1, progress / span);
  return { level, renown, thisFloor, nextCeil, progress, span, pct };
}

// ── SHIELD BADGE SVG GENERATOR ────────────────────────────────────────────────
// Returns an SVG string sized to `size` px.
// Tiers: 1-4 wood, 5-9 wood+metal trim, 10-14 iron, 15-19 silver, 20 silver+gold

function generateShieldSVG(level, size = 56) {
  const s = size;
  const cx = s / 2;

  // ── Tier palette ──
  let palette;
  if (level >= 20) {
    palette = {
      body:    ['#c8d4e0', '#9aaec2', '#d8e8f4'],
      rim:     '#d4a830',
      rivets:  '#e8c84a',
      scratch: null,
      sheen:   true,
      gold:    true,
      label:   'silver-gold',
    };
  } else if (level >= 15) {
    palette = {
      body:    ['#bccad8', '#8aa0b4', '#ccdaec'],
      rim:     '#8090a4',
      rivets:  '#a8b8cc',
      scratch: null,
      sheen:   true,
      gold:    false,
      label:   'silver',
    };
  } else if (level >= 10) {
    palette = {
      body:    ['#5a5a62', '#3a3a42', '#7a7a84'],
      rim:     '#484850',
      rivets:  '#686872',
      scratch: '#2a2a32',
      sheen:   false,
      gold:    false,
      label:   'iron',
    };
  } else if (level >= 5) {
    palette = {
      body:    ['#8B6340', '#5c3e22', '#a8784e'],
      rim:     '#707070',
      rivets:  '#909090',
      scratch: '#3a2510',
      sheen:   false,
      gold:    false,
      label:   'wood-metal',
    };
  } else {
    // Wood — gets progressively more battered at lower levels
    const damage = 5 - level; // 4=very battered, 1=almost repaired
    palette = {
      body:    ['#7a5230', '#4e3218', '#96683c'],
      rim:     null,
      rivets:  null,
      scratch: '#2e1a08',
      damage,
      sheen:   false,
      gold:    false,
      label:   'wood',
    };
  }

  // ── Shield path (classic heater shape) ──
  // Top corners at (pad, pad), point at bottom centre
  const pad   = s * 0.06;
  const top   = pad;
  const left  = pad;
  const right = s - pad;
  const mid   = s * 0.62; // shoulder height
  const bot   = s * 0.96; // tip

  const shieldPath = `
    M ${left} ${top}
    L ${right} ${top}
    L ${right} ${mid}
    Q ${right} ${mid + s*0.08} ${cx} ${bot}
    Q ${left} ${mid + s*0.08} ${left} ${mid}
    Z
  `;

  // Slightly inset path for inner panel
  const ip   = s * 0.1;
  const itop = top + ip * 0.7;
  const ileft = left + ip;
  const iright = right - ip;
  const imid  = mid - ip * 0.3;
  const ibot  = bot - ip * 1.2;

  const innerPath = `
    M ${ileft} ${itop}
    L ${iright} ${itop}
    L ${iright} ${imid}
    Q ${iright} ${imid + s*0.07} ${cx} ${ibot}
    Q ${ileft} ${imid + s*0.07} ${ileft} ${imid}
    Z
  `;

  // ── Scratch lines for wood/iron ──
  let scratches = '';
  if (palette.scratch) {
    const count = palette.damage != null ? palette.damage + 1 : (level <= 12 ? 2 : 1);
    const scratchDefs = [
      `<line x1="${cx - s*0.1}" y1="${top + s*0.15}" x2="${cx + s*0.15}" y2="${top + s*0.45}" stroke="${palette.scratch}" stroke-width="${s*0.018}" stroke-linecap="round" opacity="0.7"/>`,
      `<line x1="${cx + s*0.05}" y1="${top + s*0.25}" x2="${cx - s*0.12}" y2="${top + s*0.5}" stroke="${palette.scratch}" stroke-width="${s*0.012}" stroke-linecap="round" opacity="0.5"/>`,
      `<line x1="${cx - s*0.18}" y1="${top + s*0.35}" x2="${cx + s*0.08}" y2="${top + s*0.6}" stroke="${palette.scratch}" stroke-width="${s*0.01}" stroke-linecap="round" opacity="0.4"/>`,
      `<line x1="${cx + s*0.1}" y1="${top + s*0.45}" x2="${cx - s*0.05}" y2="${top + s*0.7}" stroke="${palette.scratch}" stroke-width="${s*0.009}" stroke-linecap="round" opacity="0.35"/>`,
      `<line x1="${cx - s*0.08}" y1="${top + s*0.18}" x2="${cx + s*0.18}" y2="${top + s*0.55}" stroke="${palette.scratch}" stroke-width="${s*0.008}" stroke-linecap="round" opacity="0.3"/>`,
    ];
    scratches = scratchDefs.slice(0, count).join('');
  }

  // ── Rivets for metal-trim and above ──
  let rivets = '';
  if (palette.rivets) {
    const rr   = s * 0.04;
    const rpos = [
      [left  + s*0.1, top + s*0.1],
      [right - s*0.1, top + s*0.1],
      [left  + s*0.1, mid - s*0.08],
      [right - s*0.1, mid - s*0.08],
    ];
    rivets = rpos.map(([rx, ry]) => `
      <circle cx="${rx}" cy="${ry}" r="${rr}" fill="${palette.rivets}" opacity="0.9"/>
      <circle cx="${rx}" cy="${ry}" r="${rr * 0.45}" fill="${palette.body[2]}" opacity="0.6"/>
    `).join('');
  }

  // ── Sheen highlight for silver/gold ──
  let sheen = '';
  if (palette.sheen) {
    sheen = `
      <ellipse cx="${cx - s*0.08}" cy="${top + s*0.22}" rx="${s*0.14}" ry="${s*0.22}"
        fill="white" opacity="0.18" transform="rotate(-15 ${cx} ${top + s*0.22})"/>
    `;
  }

  // ── Gold filigree for level 20 ──
  let filigree = '';
  if (palette.gold) {
    filigree = `
      <path d="M ${left+s*0.12} ${top+s*0.18} Q ${cx} ${top+s*0.08} ${right-s*0.12} ${top+s*0.18}"
        stroke="#e8c84a" stroke-width="${s*0.022}" fill="none" opacity="0.7" stroke-linecap="round"/>
      <path d="M ${left+s*0.16} ${imid-s*0.05} Q ${cx} ${imid+s*0.06} ${right-s*0.16} ${imid-s*0.05}"
        stroke="#e8c84a" stroke-width="${s*0.018}" fill="none" opacity="0.6" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${top+s*0.14}" r="${s*0.03}" fill="#e8c84a" opacity="0.8"/>
      <circle cx="${left+s*0.14}" cy="${top+s*0.28}" r="${s*0.02}" fill="#e8c84a" opacity="0.7"/>
      <circle cx="${right-s*0.14}" cy="${top+s*0.28}" r="${s*0.02}" fill="#e8c84a" opacity="0.7"/>
    `;
  }

  // ── Wood grain lines ──
  let grain = '';
  if (palette.label === 'wood' || palette.label === 'wood-metal') {
    grain = `
      <line x1="${ileft+s*0.04}" y1="${itop+s*0.12}" x2="${ileft+s*0.04}" y2="${imid-s*0.05}"
        stroke="${palette.body[1]}" stroke-width="${s*0.012}" opacity="0.35"/>
      <line x1="${cx}" y1="${itop+s*0.08}" x2="${cx}" y2="${ibot-s*0.12}"
        stroke="${palette.body[1]}" stroke-width="${s*0.012}" opacity="0.3"/>
      <line x1="${iright-s*0.04}" y1="${itop+s*0.12}" x2="${iright-s*0.04}" y2="${imid-s*0.05}"
        stroke="${palette.body[1]}" stroke-width="${s*0.012}" opacity="0.35"/>
    `;
  }

  // ── Hammered texture for iron ──
  let hammered = '';
  if (palette.label === 'iron') {
    const dents = [
      [cx-s*0.15, top+s*0.2], [cx+s*0.12, top+s*0.3],
      [cx-s*0.05, top+s*0.45], [cx+s*0.18, top+s*0.5],
      [cx-s*0.2,  top+s*0.55],
    ];
    hammered = dents.map(([dx, dy]) =>
      `<ellipse cx="${dx}" cy="${dy}" rx="${s*0.035}" ry="${s*0.025}"
        fill="${palette.body[1]}" opacity="0.25"/>`
    ).join('');
  }

  // ── Number label ──
  const numSize  = level >= 10 ? s * 0.28 : s * 0.32;
  const numY     = s * 0.63;
  const numColor = level >= 20 ? '#e8c84a'
    : level >= 15 ? '#e8f0f8'
    : level >= 10 ? '#c8ccd4'
    : level >= 5  ? '#e0c89a'
    : '#f0d4a8';
  const numShadow = level >= 10 ? palette.body[1] : '#1a0c04';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <defs>
    <linearGradient id="bodyGrad${level}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${palette.body[2]}"/>
      <stop offset="50%"  stop-color="${palette.body[0]}"/>
      <stop offset="100%" stop-color="${palette.body[1]}"/>
    </linearGradient>
    <filter id="shadow${level}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.5"/>
    </filter>
    <clipPath id="shieldClip${level}">
      <path d="${shieldPath}"/>
    </clipPath>
  </defs>

  <!-- Shield body -->
  <path d="${shieldPath}" fill="url(#bodyGrad${level})" filter="url(#shadow${level})"/>

  <!-- Inner panel -->
  <path d="${innerPath}" fill="${palette.body[1]}" opacity="0.35"/>

  <!-- Wood grain -->
  ${grain}

  <!-- Hammered texture -->
  ${hammered}

  <!-- Scratches / damage -->
  <g clip-path="url(#shieldClip${level})">${scratches}</g>

  <!-- Metal rim -->
  ${palette.rim ? `<path d="${shieldPath}" fill="none" stroke="${palette.rim}" stroke-width="${s*0.045}"/>` : ''}

  <!-- Rivets -->
  ${rivets}

  <!-- Gold filigree -->
  ${filigree}

  <!-- Sheen -->
  <g clip-path="url(#shieldClip${level})">${sheen}</g>

  <!-- Level number -->
  <text x="${cx}" y="${numY}"
    font-family="Cinzel, serif" font-size="${numSize}" font-weight="700"
    text-anchor="middle" dominant-baseline="middle"
    fill="${numShadow}" opacity="0.6" dx="0.5" dy="0.5">${level}</text>
  <text x="${cx}" y="${numY}"
    font-family="Cinzel, serif" font-size="${numSize}" font-weight="700"
    text-anchor="middle" dominant-baseline="middle"
    fill="${numColor}">${level}</text>
</svg>`;
}
