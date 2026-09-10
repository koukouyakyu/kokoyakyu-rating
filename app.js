const state = {
  config: { initial_rating: 1500, divisor: 600, default_k: 10, tournament_k: {} },
  teams: [],
  processedMatches: [],
  loaded: false,
};

function expected(a, b, divisor = state.config.divisor) {
  return 1 / (1 + Math.pow(10, -(a - b) / divisor));
}

function fmtDelta(v, digits = 2) {
  const n = Number(v || 0);
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
}

function csvParse(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(x => String(x).trim() !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function kForMatch(row) {
  if (row.k !== undefined && row.k !== null && String(row.k).trim() !== '') {
    const v = Number(row.k);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const mapped = state.config.tournament_k?.[row.tournament];
  return Number.isFinite(Number(mapped)) ? Number(mapped) : state.config.default_k;
}

function teamKey(name, pref) {
  return `${name}__${pref}`;
}

function calculateRatings(rows) {
  const teams = new Map();
  const processed = [];

  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.date || '1900-01-01').getTime();
    const db = new Date(b.date || '1900-01-01').getTime();
    return da - db;
  });

  const getTeam = (name, pref) => {
    const key = teamKey(name, pref);
    if (!teams.has(key)) {
      teams.set(key, {
        key,
        name,
        pref,
        rating: state.config.initial_rating,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        history: [{ date: null, rating: state.config.initial_rating }],
        recent: [],
        lastDelta: 0,
      });
    }
    return teams.get(key);
  };

  for (const row of sorted) {
    const sa = Number(row.score_a);
    const sb = Number(row.score_b);
    if (!row.team_a || !row.team_b || !row.pref_a || !row.pref_b || !Number.isFinite(sa) || !Number.isFinite(sb)) continue;

    const a = getTeam(row.team_a, row.pref_a);
    const b = getTeam(row.team_b, row.pref_b);
    const beforeA = a.rating;
    const beforeB = b.rating;
    const ea = expected(beforeA, beforeB);
    const wa = sa > sb ? 1 : sa < sb ? 0 : 0.5;
    const wb = 1 - wa;
    const k = kForMatch(row);
    const deltaA = k * (wa - ea);
    const deltaB = -deltaA;

    a.rating += deltaA;
    b.rating += deltaB;
    a.lastDelta = deltaA;
    b.lastDelta = deltaB;
    a.matches++;
    b.matches++;

    if (wa === 1) { a.wins++; b.losses++; }
    else if (wa === 0) { a.losses++; b.wins++; }
    else { a.draws++; b.draws++; }

    a.history.push({ date: row.date, rating: a.rating });
    b.history.push({ date: row.date, rating: b.rating });

    const resultA = wa === 1 ? 'W' : wa === 0 ? 'L' : 'D';
    const resultB = wb === 1 ? 'W' : wb === 0 ? 'L' : 'D';
    const common = {
      date: row.date,
      tournament: row.tournament || '',
      stage: row.stage || '',
      score: `${sa}-${sb}`,
      k,
    };
    a.recent.push({ ...common, opponent: b.name, opponentPref: b.pref, result: resultA, delta: deltaA, before: beforeA, after: a.rating });
    b.recent.push({ ...common, opponent: a.name, opponentPref: a.pref, result: resultB, delta: deltaB, before: beforeB, after: b.rating, score: `${sb}-${sa}` });

    processed.push({
      ...row,
      k,
      expected_a: ea,
      rating_a_before: beforeA,
      rating_b_before: beforeB,
      delta_a: deltaA,
      delta_b: deltaB,
      rating_a_after: a.rating,
      rating_b_after: b.rating,
    });
  }

  const result = [...teams.values()].map(t => ({
    ...t,
    rating: Number(t.rating.toFixed(3)),
    lastDelta: Number(t.lastDelta.toFixed(3)),
    recent: [...t.recent].slice(-5).reverse(),
  })).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'ja'));

  result.forEach((t, i) => { t.rank = i + 1; });
  return { teams: result, processedMatches: processed };
}

function renderStatus(rows) {
  const el = document.querySelector('#dataStatus');
  if (!el) return;
  const latest = rows.map(r => r.date).filter(Boolean).sort().at(-1) || '—';
  el.innerHTML = `<strong>自動計算中</strong> 登録試合 <b>${rows.length}</b> 試合 / 掲載校 <b>${state.teams.length}</b> 校 / 最終試合日 <b>${latest}</b>`;
}

function renderRanking() {
  const q = document.querySelector('#searchInput').value.trim();
  const pref = document.querySelector('#prefFilter').value;
  const rows = state.teams.filter(t => (!q || t.name.includes(q) || t.pref.includes(q)) && (!pref || t.pref === pref));
  const tbody = document.querySelector('#rankingBody');
  tbody.innerHTML = '';
  rows.forEach(t => {
    const tr = document.createElement('tr');
    const form = t.recent.map(m => m.result).reverse().join('').slice(-5) || '—';
    tr.innerHTML = `<td class="rank-num">${t.rank}</td><td><span class="school-link" data-key="${t.key}">${t.name}</span></td><td>${t.pref}</td><td><strong>${t.rating.toFixed(1)}</strong></td><td class="delta ${t.lastDelta >= 0 ? 'pos' : 'neg'}">${fmtDelta(t.lastDelta, 2)}</td><td class="form">${form}</td>`;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.school-link').forEach(el => el.addEventListener('click', () => {
    document.querySelector('#schoolSelect').value = el.dataset.key;
    renderSchool(el.dataset.key);
    location.hash = '#schools';
  }));
}

function avg(vals) { return vals.reduce((a, b) => a + b, 0) / (vals.length || 1); }
function median(vals) {
  const s = [...vals].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function renderPrefectures() {
  const grouped = {};
  state.teams.forEach(t => (grouped[t.pref] ??= []).push(t.rating));
  const cards = Object.entries(grouped).map(([pref, vals]) => {
    const desc = [...vals].sort((a, b) => b - a);
    const n = Math.max(1, Math.ceil(desc.length * .25));
    return {
      pref,
      count: vals.length,
      avg: avg(vals),
      mid: median(vals),
      top5: avg(desc.slice(0, 5)),
      top25: avg(desc.slice(0, n)),
    };
  }).sort((a, b) => b.avg - a.avg || b.top5 - a.top5);

  document.querySelector('#prefCards').innerHTML = cards.map(x => `<article class="pref-card"><h3>${x.pref}</h3><div class="pref-metric"><span>掲載校数</span><strong>${x.count}</strong></div><div class="pref-metric"><span>平均</span><strong>${x.avg.toFixed(1)}</strong></div><div class="pref-metric"><span>中央値</span><strong>${x.mid.toFixed(1)}</strong></div><div class="pref-metric"><span>Top5平均</span><strong>${x.top5.toFixed(1)}</strong></div><div class="pref-metric"><span>Top25%平均</span><strong>${x.top25.toFixed(1)}</strong></div></article>`).join('');
}

function chart(svg, history) {
  const values = history.map(h => h.rating);
  const w = 720, h = 220, p = 34;
  const min = Math.min(...values) - 5, max = Math.max(...values) + 5;
  const x = i => values.length === 1 ? w / 2 : p + i * (w - 2 * p) / (values.length - 1);
  const y = v => h - p - (v - min) * (h - 2 * p) / (max - min || 1);
  let html = '';
  for (let i = 0; i < 4; i++) {
    const yy = p + i * (h - 2 * p) / 3;
    html += `<line class="chart-grid" x1="${p}" x2="${w - p}" y1="${yy}" y2="${yy}"/>`;
  }
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  html += `<polyline class="chart-line" points="${pts}"/>`;
  history.forEach((pt, i) => {
    html += `<circle class="chart-dot" cx="${x(i)}" cy="${y(pt.rating)}" r="4"><title>${pt.date || '開始'}: ${pt.rating.toFixed(1)}</title></circle>`;
  });
  svg.innerHTML = html;
}

function renderSchool(key) {
  const t = state.teams.find(x => x.key === key) || state.teams[0];
  if (!t) return;
  document.querySelector('#schoolName').textContent = t.name;
  document.querySelector('#schoolPref').textContent = t.pref;
  document.querySelector('#schoolLeague').textContent = `${t.matches}試合 / ${t.wins}勝 ${t.draws}分 ${t.losses}敗`;
  document.querySelector('#schoolRating').textContent = t.rating.toFixed(1);
  document.querySelector('#schoolRank').textContent = `${t.rank}位`;
  const d = document.querySelector('#schoolDelta');
  d.textContent = fmtDelta(t.lastDelta, 2);
  d.className = t.lastDelta >= 0 ? 'pos' : 'neg';
  document.querySelector('#schoolForm').textContent = t.recent.map(m => m.result).reverse().join('').slice(-5) || '—';
  chart(document.querySelector('#historyChart'), t.history);

  document.querySelector('#recentMatches').innerHTML = t.recent.length ? t.recent.map(m => {
    const cls = m.result === 'W' ? 'win' : m.result === 'L' ? 'loss' : 'draw';
    const label = m.result === 'W' ? '勝' : m.result === 'L' ? '負' : '分';
    return `<div class="match-row"><div class="match-title"><span>${m.opponent} <small>${m.score}</small></span><span class="match-points ${cls}">${label} ${fmtDelta(m.delta, 2)}</span></div><div class="match-meta">${m.date} ${m.tournament}${m.stage ? ` / ${m.stage}` : ''} · K=${m.k}</div></div>`;
  }).join('') : '<p class="muted">登録済みの試合がありません。</p>';
}

function renderSimulator() {
  const a = Number(document.querySelector('#ratingA').value);
  const b = Number(document.querySelector('#ratingB').value);
  const k = Number(document.querySelector('#kValue').value);
  const ea = expected(a, b);
  const win = k * (1 - ea);
  const draw = k * (.5 - ea);
  const loss = k * (0 - ea);
  document.querySelector('#simResult').innerHTML = `<div class="sim-box"><span>学校Aの期待値</span><strong>${(ea * 100).toFixed(1)}%</strong></div><div class="sim-box"><span>A勝利時</span><strong class="pos">${fmtDelta(win)}</strong></div><div class="sim-box"><span>引き分け時</span><strong class="${draw >= 0 ? 'pos' : 'neg'}">${fmtDelta(draw)}</strong></div><div class="sim-box"><span>A敗戦時</span><strong class="neg">${fmtDelta(loss)}</strong></div><div class="sim-box"><span>B勝利時</span><strong class="pos">${fmtDelta(-loss)}</strong></div><div class="sim-box"><span>B引分時</span><strong class="${-draw >= 0 ? 'pos' : 'neg'}">${fmtDelta(-draw)}</strong></div>`;
}

async function loadData() {
  try {
    const [configResp, matchesResp] = await Promise.all([
      fetch('config.json', { cache: 'no-store' }),
      fetch('matches.csv', { cache: 'no-store' }),
    ]);
    if (configResp.ok) state.config = { ...state.config, ...(await configResp.json()) };
    document.querySelector('#initialRatingLabel').textContent = state.config.initial_rating;
    document.querySelector('#defaultKLabel').textContent = state.config.default_k;
    document.querySelector('#kValue').value = state.config.default_k;
    if (!matchesResp.ok) throw new Error(`matches.csv: HTTP ${matchesResp.status}`);
    const rows = csvParse(await matchesResp.text());
    const result = calculateRatings(rows);
    state.teams = result.teams;
    state.processedMatches = result.processedMatches;
    state.loaded = true;
    return rows;
  } catch (err) {
    console.error(err);
    const notice = document.querySelector('#dataStatus');
    if (notice) notice.innerHTML = `<strong>データ読込エラー</strong> ${err.message}。GitHub Pages上では動作します。ローカル確認は README の手順で簡易サーバーを起動してください。`;
    return [];
  }
}

function populateControls() {
  const prefs = [...new Set(state.teams.map(t => t.pref))].sort((a, b) => a.localeCompare(b, 'ja'));
  const pf = document.querySelector('#prefFilter');
  pf.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  prefs.forEach(p => pf.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));

  const ss = document.querySelector('#schoolSelect');
  ss.innerHTML = '';
  state.teams.forEach(t => ss.insertAdjacentHTML('beforeend', `<option value="${t.key}">${t.name}（${t.pref}）</option>`));
}

async function init() {
  document.querySelector('#searchInput').addEventListener('input', renderRanking);
  document.querySelector('#prefFilter').addEventListener('change', renderRanking);
  document.querySelector('#schoolSelect').addEventListener('change', e => renderSchool(e.target.value));
  ['ratingA', 'ratingB', 'kValue'].forEach(id => document.querySelector('#' + id).addEventListener('input', renderSimulator));

  const rows = await loadData();
  if (state.teams.length) {
    populateControls();
    renderStatus(rows);
    renderRanking();
    renderPrefectures();
    renderSchool(state.teams[0].key);
  }
  renderSimulator();
}

init();
