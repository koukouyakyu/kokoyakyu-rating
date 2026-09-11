(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const ratingCfg = {
    initial: Number(cfg.rating?.initial ?? 1500),
    divisor: Number(cfg.rating?.divisor ?? 600),
    defaultK: Number(cfg.rating?.defaultK ?? 10),
    tournamentK: cfg.rating?.tournamentK || {},
    interPrefMultiplier: Number(cfg.rating?.interPrefMultiplier ?? 1.5),
    nationalMultiplier: Number(cfg.rating?.nationalMultiplier ?? 2.0)
  };

  const rankingLimit = Number(cfg.rankingLimit ?? 200);
  const state = {
    client: null,
    session: null,
    authMode: null,
    matches: [],
    schools: [],
    schoolMap: new Map(),
    ranking: [],
    prefs: [],
    ready: false
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    dataStatus: $("dataStatus"),
    setupNotice: $("setupNotice"),
    searchInput: $("searchInput"),
    prefFilter: $("prefFilter"),
    rankingBody: $("rankingBody"),
    rankingFootnote: $("rankingFootnote"),
    matchCount: $("matchCount"),
    schoolCount: $("schoolCount"),
    prefCount: $("prefCount"),
    latestMatchDate: $("latestMatchDate"),
    prefCards: $("prefCards"),
    prefSort: $("prefSort"),
    schoolSearch: $("schoolSearch"),
    schoolSearchResults: $("schoolSearchResults"),
    schoolSelect: $("schoolSelect"),
    schoolPref: $("schoolPref"),
    schoolName: $("schoolName"),
    schoolRecord: $("schoolRecord"),
    schoolRating: $("schoolRating"),
    schoolRank: $("schoolRank"),
    schoolDelta: $("schoolDelta"),
    schoolForm: $("schoolForm"),
    historyChart: $("historyChart"),
    recentMatches: $("recentMatches"),
    ratingA: $("ratingA"),
    ratingB: $("ratingB"),
    kValue: $("kValue"),
    simResult: $("simResult"),
    adminUnavailable: $("adminUnavailable"),
    loginPanel: $("loginPanel"),
    loginForm: $("loginForm"),
    loginEmail: $("loginEmail"),
    loginPassword: $("loginPassword"),
    loginMessage: $("loginMessage"),
    showResetButton: $("showResetButton"),
    resetRequestPanel: $("resetRequestPanel"),
    resetRequestForm: $("resetRequestForm"),
    resetEmail: $("resetEmail"),
    resetRequestMessage: $("resetRequestMessage"),
    backToLoginButton: $("backToLoginButton"),
    passwordSetupPanel: $("passwordSetupPanel"),
    passwordSetupTitle: $("passwordSetupTitle"),
    passwordSetupDescription: $("passwordSetupDescription"),
    passwordSetupForm: $("passwordSetupForm"),
    newPassword: $("newPassword"),
    newPasswordConfirm: $("newPasswordConfirm"),
    passwordSetupMessage: $("passwordSetupMessage"),
    adminPanel: $("adminPanel"),
    adminEmail: $("adminEmail"),
    logoutButton: $("logoutButton"),
    matchForm: $("matchForm"),
    matchFormTitle: $("matchFormTitle"),
    editingMatchId: $("editingMatchId"),
    matchDate: $("matchDate"),
    tournament: $("tournament"),
    stage: $("stage"),
    teamA: $("teamA"),
    prefA: $("prefA"),
    scoreA: $("scoreA"),
    teamB: $("teamB"),
    prefB: $("prefB"),
    scoreB: $("scoreB"),
    matchK: $("matchK"),
    sourceUrl: $("sourceUrl"),
    saveMatchButton: $("saveMatchButton"),
    cancelEditButton: $("cancelEditButton"),
    matchFormMessage: $("matchFormMessage"),
    adminMatchesBody: $("adminMatchesBody"),
    reloadButton: $("reloadButton"),
    heroInitial: $("heroInitial"),
    heroDivisor: $("heroDivisor"),
    heroK: $("heroK"),
    heroFormula: $("heroFormula")
  };

  function authRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function detectAuthModeFromUrl() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash
    );
    const type = hash.get("type") || query.get("type");
    if (type === "recovery") return "recovery";
    if (type === "invite") return "invite";
    return null;
  }

  function getAuthErrorFromUrl() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash
    );
    return (
      hash.get("error_description") ||
      query.get("error_description") ||
      hash.get("error") ||
      query.get("error") ||
      null
    );
  }

  function clearAuthUrl() {
    window.history.replaceState({}, document.title, authRedirectUrl());
  }

  function isConfigReady() {
    const url = String(cfg.supabaseUrl || "");
    const key = String(cfg.supabasePublishableKey || "");
    return (
      url.startsWith("https://") &&
      url.includes(".supabase.co") &&
      !url.includes("PASTE_") &&
      key.length > 20 &&
      !key.includes("PASTE_")
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function schoolKey(name, pref) {
    return `${String(pref).trim()}::${String(name).trim()}`;
  }

  function formatRating(value) {
    return Number(value).toFixed(1);
  }

  function formatDelta(value) {
    const n = Number(value || 0);
    if (Math.abs(n) < 0.05) return "±0.0";
    return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
  }

  function deltaClass(value) {
    if (value > 0.05) return "delta-positive";
    if (value < -0.05) return "delta-negative";
    return "";
  }

  function expectation(selfRating, opponentRating) {
    const d = selfRating - opponentRating;
    return 1 / (1 + Math.pow(10, -d / ratingCfg.divisor));
  }

  function isNationalTournament(match) {
    const name = `${match.tournament || ""} ${match.stage || ""}`.replace(/\s+/g, "");

    return (
      name.includes("明治神宮") ||
      name.includes("甲子園") ||
      name.includes("選抜高等学校野球大会") ||
      name.includes("全国高等学校野球選手権大会")
    );
  }

  function matchK(match) {
    // CSVや管理画面でKを明示した試合は、その値を最優先する。
    const direct = Number(match.k);
    if (Number.isFinite(direct) && direct > 0) return direct;

    // config.js で大会ごとのKを指定している場合も優先する。
    const tournamentSpecific = Number(ratingCfg.tournamentK?.[match.tournament]);
    if (Number.isFinite(tournamentSpecific) && tournamentSpecific > 0) {
      return tournamentSpecific;
    }

    // 全国大会: 基準Kの2倍
    if (isNationalTournament(match)) {
      return ratingCfg.defaultK * ratingCfg.nationalMultiplier;
    }

    // 異なる都道府県同士: 基準Kの1.5倍
    if (match.pref_a && match.pref_b && match.pref_a !== match.pref_b) {
      return ratingCfg.defaultK * ratingCfg.interPrefMultiplier;
    }

    // 同一都道府県内: 基準K
    return ratingCfg.defaultK;
  }

  function normalizeMatch(match) {
    return {
      ...match,
      team_a: String(match.team_a ?? "").trim(),
      pref_a: String(match.pref_a ?? "").trim(),
      team_b: String(match.team_b ?? "").trim(),
      pref_b: String(match.pref_b ?? "").trim(),
      tournament: String(match.tournament ?? "").trim(),
      stage: String(match.stage ?? "").trim(),
      score_a: Number(match.score_a),
      score_b: Number(match.score_b),
      k: match.k === null || match.k === "" ? null : Number(match.k)
    };
  }

  function compareMatches(a, b) {
    const dateCompare = String(a.date).localeCompare(String(b.date));
    if (dateCompare !== 0) return dateCompare;
    const createdCompare = String(a.created_at || "").localeCompare(String(b.created_at || ""));
    if (createdCompare !== 0) return createdCompare;
    return String(a.id || "").localeCompare(String(b.id || ""));
  }

  function getOrCreateSchool(map, name, pref) {
    const key = schoolKey(name, pref);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name,
        pref,
        rating: ratingCfg.initial,
        lastDelta: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        history: [{ date: null, rating: ratingCfg.initial, label: "初期値" }],
        games: []
      });
    }
    return map.get(key);
  }

  function buildRatings(rawMatches) {
    const map = new Map();
    const matches = rawMatches.map(normalizeMatch).sort(compareMatches);

    for (const match of matches) {
      if (
        !match.date ||
        !match.team_a ||
        !match.team_b ||
        !match.pref_a ||
        !match.pref_b ||
        !Number.isFinite(match.score_a) ||
        !Number.isFinite(match.score_b)
      ) {
        continue;
      }

      const a = getOrCreateSchool(map, match.team_a, match.pref_a);
      const b = getOrCreateSchool(map, match.team_b, match.pref_b);
      const beforeA = a.rating;
      const beforeB = b.rating;
      const expectedA = expectation(beforeA, beforeB);
      const expectedB = 1 - expectedA;

      let resultA = 0.5;
      let resultB = 0.5;
      let codeA = "D";
      let codeB = "D";

      if (match.score_a > match.score_b) {
        resultA = 1;
        resultB = 0;
        codeA = "W";
        codeB = "L";
        a.wins += 1;
        b.losses += 1;
      } else if (match.score_a < match.score_b) {
        resultA = 0;
        resultB = 1;
        codeA = "L";
        codeB = "W";
        a.losses += 1;
        b.wins += 1;
      } else {
        a.draws += 1;
        b.draws += 1;
      }

      const k = matchK(match);
      const deltaA = k * (resultA - expectedA);
      const deltaB = k * (resultB - expectedB);
      a.rating += deltaA;
      b.rating += deltaB;
      a.lastDelta = deltaA;
      b.lastDelta = deltaB;

      a.history.push({
        date: match.date,
        rating: a.rating,
        delta: deltaA,
        opponent: b.name,
        matchId: match.id
      });
      b.history.push({
        date: match.date,
        rating: b.rating,
        delta: deltaB,
        opponent: a.name,
        matchId: match.id
      });

      a.games.push({
        match,
        result: codeA,
        opponent: b.name,
        opponentPref: b.pref,
        scored: match.score_a,
        allowed: match.score_b,
        before: beforeA,
        after: a.rating,
        delta: deltaA,
        k
      });
      b.games.push({
        match,
        result: codeB,
        opponent: a.name,
        opponentPref: a.pref,
        scored: match.score_b,
        allowed: match.score_a,
        before: beforeB,
        after: b.rating,
        delta: deltaB,
        k
      });
    }

    const schools = [...map.values()].sort(
      (x, y) => y.rating - x.rating || x.name.localeCompare(y.name, "ja")
    );
    schools.forEach((school, index) => {
      school.rank = index + 1;
      school.form = school.games.slice(-5).map((g) => g.result).join("");
    });

    return { matches, map, schools };
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function average(values) {
    if (!values.length) return null;
    return values.reduce((sum, n) => sum + n, 0) / values.length;
  }

  function buildPrefStats(schools) {
    const groups = new Map();
    for (const school of schools) {
      if (!groups.has(school.pref)) groups.set(school.pref, []);
      groups.get(school.pref).push(school.rating);
    }
    return [...groups.entries()]
      .map(([pref, values]) => {
        const desc = [...values].sort((a, b) => b - a);
        const top5Count = Math.max(1, Math.ceil(desc.length * 0.05));
        const top25Count = Math.max(1, Math.ceil(desc.length * 0.25));
        const top5 = desc.slice(0, top5Count);
        const top25 = desc.slice(0, top25Count);
        return {
          pref,
          count: values.length,
          average: average(values),
          median: median(values),
          top5: average(top5),
          top25: average(top25)
        };
      });
  }

  // Supabase の1リクエスト1000行上限を回避し、全試合をページ分割で取得する。
  async function loadMatches() {
    if (!state.client) return;

    setDataStatus("読み込み中…");

    const pageSize = 1000;
    let from = 0;
    const allMatches = [];

    while (true) {
      const { data, error } = await state.client
        .from("matches")
        .select(
          "id,date,tournament,stage,team_a,pref_a,score_a,team_b,pref_b,score_b,k,source_url,created_at"
        )
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error(error);
        setDataStatus("読込エラー");
        showSetupNotice(
          `Supabaseから試合データを取得できませんでした。SQL設定とRLSを確認してください。<br><code>${escapeHtml(error.message)}</code>`
        );
        return;
      }

      const page = data || [];
      allMatches.push(...page);

      if (page.length < pageSize) break;
      from += pageSize;
    }

    state.matches = allMatches;

    const result = buildRatings(state.matches);
    state.schoolMap = result.map;
    state.schools = result.schools;
    state.ranking = result.schools;
    state.prefs = buildPrefStats(result.schools);
    state.ready = true;
    setDataStatus(`${state.matches.length}試合`);
    renderAll();
  }

  function setDataStatus(text) {
    els.dataStatus.textContent = text;
  }

  function showSetupNotice(html) {
    els.setupNotice.innerHTML = html;
    els.setupNotice.classList.remove("hidden");
  }

  function hideSetupNotice() {
    els.setupNotice.classList.add("hidden");
    els.setupNotice.innerHTML = "";
  }

  function renderAll() {
    hideSetupNotice();
    renderSummary();
    renderPrefFilter();
    renderRanking();
    renderPrefCards();
    renderSchoolSelect();
    renderSchoolProfile();
    renderAdminMatches();
  }

  function renderSummary() {
    els.matchCount.textContent = state.matches.length.toLocaleString("ja-JP");
    els.schoolCount.textContent = state.schools.length.toLocaleString("ja-JP");
    els.prefCount.textContent = state.prefs.length.toLocaleString("ja-JP");
    const latest = state.matches
      .map((m) => m.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    els.latestMatchDate.textContent = latest || "—";
  }

  function renderPrefFilter() {
    const selected = els.prefFilter.value;
    const prefs = [...new Set(state.schools.map((s) => s.pref))].sort((a, b) =>
      a.localeCompare(b, "ja")
    );
    els.prefFilter.innerHTML =
      `<option value="">すべて</option>` +
      prefs
        .map((pref) => `<option value="${escapeHtml(pref)}">${escapeHtml(pref)}</option>`)
        .join("");
    if (prefs.includes(selected)) els.prefFilter.value = selected;
  }

  function renderRanking() {
    const query = els.searchInput.value.trim().toLowerCase();
    const pref = els.prefFilter.value;
    let rows = state.ranking.filter((school) => {
      const matchesQuery =
        !query ||
        school.name.toLowerCase().includes(query) ||
        school.pref.toLowerCase().includes(query);
      const matchesPref = !pref || school.pref === pref;
      return matchesQuery && matchesPref;
    });

    const isFiltered = Boolean(query || pref);
    const totalFiltered = rows.length;
    if (!isFiltered) rows = rows.slice(0, rankingLimit);

    if (!rows.length) {
      els.rankingBody.innerHTML =
        `<tr><td colspan="6" class="empty">該当する学校がありません。</td></tr>`;
    } else {
      els.rankingBody.innerHTML = rows
        .map((school) => {
          const formHtml =
            school.form
              .split("")
              .map((r) => `<span class="match-result-${r}">${escapeHtml(r)}</span>`)
              .join(" ") || "—";
          return `
            <tr data-school-key="${escapeHtml(school.key)}">
              <td>${school.rank}</td>
              <td><strong>${escapeHtml(school.name)}</strong></td>
              <td>${escapeHtml(school.pref)}</td>
              <td class="rating-cell">${formatRating(school.rating)}</td>
              <td class="${deltaClass(school.lastDelta)}">${formatDelta(school.lastDelta)}</td>
              <td>${formHtml}</td>
            </tr>
          `;
        })
        .join("");
    }

    if (isFiltered) {
      els.rankingFootnote.textContent = `${totalFiltered}校を表示しています。`;
    } else {
      const shown = Math.min(totalFiltered, rankingLimit);
      els.rankingFootnote.textContent =
        totalFiltered > rankingLimit
          ? `上位${shown}校を表示しています。学校名検索では全校を対象に検索します。`
          : `${shown}校を表示しています。`;
    }

    els.rankingBody.querySelectorAll("tr[data-school-key]").forEach((row) => {
      row.addEventListener("click", () => {
        els.schoolSelect.value = row.dataset.schoolKey;
        renderSchoolProfile();
        document.querySelector("#schools").scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function renderPrefCards() {
    if (!state.prefs.length) {
      els.prefCards.innerHTML = `<div class="empty">データがありません。</div>`;
      return;
    }

    const metric = els.prefSort?.value || "top25";
    const metricLabels = {
      average: "平均",
      median: "中央値",
      top5: "上位5%",
      top25: "上位25%"
    };

    const sortedPrefs = [...state.prefs].sort((a, b) => {
      const primary = (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity);
      if (primary !== 0) return primary;
      return (b.average ?? -Infinity) - (a.average ?? -Infinity);
    });

    els.prefCards.innerHTML = sortedPrefs
      .map(
        (item, index) => `
          <article class="pref-card">
            <h3>
              ${index + 1}. ${escapeHtml(item.pref)}
              <span>${item.count}校</span>
            </h3>
            <div class="pref-metrics">
              <div class="${metric === "average" ? "metric-active" : ""}">
                <span>平均</span><strong>${formatRating(item.average)}</strong>
              </div>
              <div class="${metric === "median" ? "metric-active" : ""}">
                <span>中央値</span><strong>${formatRating(item.median)}</strong>
              </div>
              <div class="${metric === "top5" ? "metric-active" : ""}">
                <span>上位5%</span><strong>${formatRating(item.top5)}</strong>
              </div>
              <div class="${metric === "top25" ? "metric-active" : ""}">
                <span>上位25%</span><strong>${formatRating(item.top25)}</strong>
              </div>
            </div>
            <p class="pref-sort-note">${metricLabels[metric]}で順位付け</p>
          </article>
        `
      )
      .join("");
  }

  function renderSchoolSelect() {
    const previous = els.schoolSelect.value;
    els.schoolSelect.innerHTML = state.schools
      .map(
        (school) =>
          `<option value="${escapeHtml(school.key)}">${escapeHtml(school.name)}（${escapeHtml(school.pref)}）</option>`
      )
      .join("");
    if (state.schoolMap.has(previous)) els.schoolSelect.value = previous;
  }

  function renderSchoolSearchResults() {
    const query = String(els.schoolSearch?.value || "").trim().toLowerCase();

    if (!query) {
      els.schoolSearchResults.innerHTML = "";
      els.schoolSearchResults.classList.add("hidden");
      return;
    }

    const matches = state.schools
      .filter(
        (school) =>
          school.name.toLowerCase().includes(query) ||
          school.pref.toLowerCase().includes(query)
      )
      .slice(0, 30);

    if (!matches.length) {
      els.schoolSearchResults.innerHTML =
        `<div class="school-search-empty">該当する学校がありません。</div>`;
      els.schoolSearchResults.classList.remove("hidden");
      return;
    }

    els.schoolSearchResults.innerHTML = matches
      .map(
        (school) => `
          <button
            type="button"
            class="school-search-item"
            data-school-key="${escapeHtml(school.key)}"
          >
            <strong>${escapeHtml(school.name)}</strong>
            <span>${escapeHtml(school.pref)} · 全国${school.rank}位 · ${formatRating(school.rating)}</span>
          </button>
        `
      )
      .join("");

    els.schoolSearchResults.classList.remove("hidden");

    els.schoolSearchResults
      .querySelectorAll(".school-search-item[data-school-key]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.schoolKey;
          if (!state.schoolMap.has(key)) return;

          els.schoolSelect.value = key;
          els.schoolSearch.value = state.schoolMap.get(key).name;
          els.schoolSearchResults.classList.add("hidden");
          renderSchoolProfile();
        });
      });
  }

  function renderSchoolProfile() {
    const school = state.schoolMap.get(els.schoolSelect.value) || state.schools[0];
    if (!school) {
      els.schoolPref.textContent = "";
      els.schoolName.textContent = "試合データがありません";
      els.schoolRecord.textContent = "";
      els.schoolRating.textContent = "—";
      els.schoolRank.textContent = "—";
      els.schoolDelta.textContent = "—";
      els.schoolForm.textContent = "—";
      els.historyChart.innerHTML = "";
      els.recentMatches.innerHTML = `<div class="empty">試合データがありません。</div>`;
      return;
    }

    els.schoolSelect.value = school.key;
    els.schoolPref.textContent = school.pref;
    els.schoolName.textContent = school.name;
    els.schoolRecord.textContent =
      `${school.games.length}試合 ${school.wins}勝 ${school.losses}敗 ${school.draws}分`;
    els.schoolRating.textContent = formatRating(school.rating);
    els.schoolRank.textContent = `${school.rank}位`;
    els.schoolDelta.textContent = formatDelta(school.lastDelta);
    els.schoolDelta.className = deltaClass(school.lastDelta);
    els.schoolForm.innerHTML =
      school.form
        .split("")
        .map((r) => `<span class="match-result-${r}">${r}</span>`)
        .join(" ") || "—";
    renderHistoryChart(school.history);
    renderRecentMatches(school.games);
  }

  function renderRecentMatches(games) {
    const recent = [...games].reverse();
    if (!recent.length) {
      els.recentMatches.innerHTML = `<div class="empty">試合がありません。</div>`;
      return;
    }
    els.recentMatches.innerHTML = recent
      .map((game) => {
        const m = game.match;
        const source = m.source_url
          ? ` · <a href="${escapeHtml(m.source_url)}" target="_blank" rel="noopener noreferrer">出典</a>`
          : "";
        return `
          <div class="match-row">
            <div class="match-meta">
              ${escapeHtml(m.date)} · ${escapeHtml(m.tournament)} ${escapeHtml(m.stage || "")}${source}
            </div>
            <strong class="match-result-${game.result}">
              ${escapeHtml(game.result)}
              ${escapeHtml(game.opponent)}
              ${game.scored} - ${game.allowed}
            </strong>
            <div class="match-meta">
              ${formatRating(game.before)} → ${formatRating(game.after)}
              （${formatDelta(game.delta)}） · K=${Number(game.k).toFixed(1)}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderHistoryChart(history) {
    const values = history.map((h) => h.rating);
    if (!values.length) {
      els.historyChart.innerHTML = "";
      return;
    }

    const width = 720;
    const height = 220;
    const padX = 42;
    const padY = 26;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const spread = Math.max(20, maxVal - minVal);
    const yMin = minVal - spread * 0.15;
    const yMax = maxVal + spread * 0.15;
    const x = (index) => {
      if (values.length === 1) return width / 2;
      return padX + (index / (values.length - 1)) * (width - padX * 2);
    };
    const y = (value) =>
      height -
      padY -
      ((value - yMin) / (yMax - yMin)) * (height - padY * 2);

    const points = values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
    const gridLines = [0, 0.5, 1]
      .map((t) => {
        const value = yMax - (yMax - yMin) * t;
        const yy = y(value);
        return `
          <line class="chart-axis" x1="${padX}" y1="${yy}" x2="${width - padX}" y2="${yy}" />
          <text class="chart-label" x="2" y="${yy + 4}">${value.toFixed(0)}</text>
        `;
      })
      .join("");
    const dots = values
      .map(
        (value, i) =>
          `<circle class="chart-dot" cx="${x(i)}" cy="${y(value)}" r="${i === values.length - 1 ? 5 : 3}" />`
      )
      .join("");

    els.historyChart.innerHTML = `
      ${gridLines}
      <polyline class="chart-line" points="${points}" />
      ${dots}
    `;
  }

  function renderSimulator() {
    const a = Number(els.ratingA.value);
    const b = Number(els.ratingB.value);
    const k = Number(els.kValue.value);
    if (![a, b, k].every(Number.isFinite) || k <= 0) {
      els.simResult.innerHTML = "";
      return;
    }

    const e = expectation(a, b);
    const win = k * (1 - e);
    const draw = k * (0.5 - e);
    const loss = k * (0 - e);
    els.simResult.innerHTML = `
      <div>
        <span>A校の勝利期待値</span>
        <strong>${(e * 100).toFixed(1)}%</strong>
      </div>
      <div>
        <span>A校が勝った場合</span>
        <strong class="${deltaClass(win)}">${formatDelta(win)}</strong>
      </div>
      <div>
        <span>引分 / 敗戦</span>
        <strong>${formatDelta(draw)} / ${formatDelta(loss)}</strong>
      </div>
    `;
  }

  async function restoreSession() {
    if (!state.client) return;
    state.authMode = detectAuthModeFromUrl();

    const authError = getAuthErrorFromUrl();
    if (authError) {
      showSetupNotice(
        `<strong>認証リンクを処理できませんでした。</strong> ${escapeHtml(authError)}<br>` +
          `リンクの有効期限が切れている場合は、招待メールまたはパスワード再設定メールを送り直してください。`
      );
    }

    state.client.auth.onAuthStateChange((event, session) => {
      state.session = session;
      if (event === "PASSWORD_RECOVERY") {
        state.authMode = "recovery";
      } else if (event === "SIGNED_IN" && detectAuthModeFromUrl() === "invite") {
        state.authMode = "invite";
      }
      renderAuth();
    });

    const { data, error } = await state.client.auth.getSession();
    if (error) {
      console.error(error);
      return;
    }
    state.session = data.session;
    renderAuth();
  }

  function renderAuth() {
    const signedIn = Boolean(state.session?.user);
    const needsPasswordSetup =
      signedIn && (state.authMode === "invite" || state.authMode === "recovery");

    els.loginPanel.classList.toggle("hidden", signedIn || needsPasswordSetup);
    els.resetRequestPanel.classList.add("hidden");
    els.passwordSetupPanel.classList.toggle("hidden", !needsPasswordSetup);
    els.adminPanel.classList.toggle("hidden", !signedIn || needsPasswordSetup);

    if (needsPasswordSetup) {
      const isInvite = state.authMode === "invite";
      els.passwordSetupTitle.textContent = isInvite
        ? "初回パスワードを設定"
        : "新しいパスワードを設定";
      els.passwordSetupDescription.textContent = isInvite
        ? "招待が確認されました。今後の管理者ログインに使うパスワードを設定してください。"
        : "パスワード再設定リンクが確認されました。新しいパスワードを設定してください。";
      return;
    }

    if (signedIn) {
      els.adminEmail.textContent = state.session.user.email || state.session.user.id;
      renderAdminMatches();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage(els.loginMessage, "ログイン中…");
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;
    const { error } = await state.client.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(els.loginMessage, error.message, "error");
      return;
    }
    state.authMode = null;
    clearAuthUrl();
    els.loginPassword.value = "";
    setMessage(els.loginMessage, "");
  }

  function showResetRequest() {
    els.resetEmail.value = els.loginEmail.value.trim();
    els.loginPanel.classList.add("hidden");
    els.resetRequestPanel.classList.remove("hidden");
    setMessage(els.resetRequestMessage, "");
  }

  function backToLogin() {
    els.resetRequestPanel.classList.add("hidden");
    els.loginPanel.classList.remove("hidden");
    setMessage(els.resetRequestMessage, "");
  }

  async function handleResetRequest(event) {
    event.preventDefault();
    const email = els.resetEmail.value.trim();
    if (!email) {
      setMessage(els.resetRequestMessage, "メールアドレスを入力してください。", "error");
      return;
    }

    setMessage(els.resetRequestMessage, "送信中…");
    const { error } = await state.client.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl()
    });
    if (error) {
      setMessage(els.resetRequestMessage, error.message, "error");
      return;
    }
    setMessage(
      els.resetRequestMessage,
      "再設定メールを送信しました。メール内のリンクを開いてください。",
      "success"
    );
  }

  async function handlePasswordSetup(event) {
    event.preventDefault();
    const password = els.newPassword.value;
    const confirm = els.newPasswordConfirm.value;

    if (password.length < 8) {
      setMessage(els.passwordSetupMessage, "パスワードは8文字以上にしてください。", "error");
      return;
    }
    if (password !== confirm) {
      setMessage(els.passwordSetupMessage, "確認用パスワードが一致しません。", "error");
      return;
    }
    if (!state.session?.user) {
      setMessage(
        els.passwordSetupMessage,
        "認証セッションが見つかりません。メール内のリンクをもう一度開いてください。",
        "error"
      );
      return;
    }

    setMessage(els.passwordSetupMessage, "保存中…");
    const { error } = await state.client.auth.updateUser({ password });
    if (error) {
      setMessage(els.passwordSetupMessage, error.message, "error");
      return;
    }

    state.authMode = null;
    els.passwordSetupForm.reset();
    setMessage(els.passwordSetupMessage, "");
    clearAuthUrl();
    renderAuth();
    showSetupNotice(
      "<strong>パスワードを設定しました。</strong> このまま管理者として試合結果を登録できます。"
    );
  }

  async function handleLogout() {
    const { error } = await state.client.auth.signOut();
    if (error) {
      alert(`ログアウトに失敗しました: ${error.message}`);
      return;
    }
    state.authMode = null;
    clearAuthUrl();
  }

  function readMatchForm() {
    const kText = els.matchK.value.trim();
    const sourceText = els.sourceUrl.value.trim();
    return {
      date: els.matchDate.value,
      tournament: els.tournament.value.trim(),
      stage: els.stage.value.trim() || null,
      team_a: els.teamA.value.trim(),
      pref_a: els.prefA.value.trim(),
      score_a: Number(els.scoreA.value),
      team_b: els.teamB.value.trim(),
      pref_b: els.prefB.value.trim(),
      score_b: Number(els.scoreB.value),
      k: kText ? Number(kText) : null,
      source_url: sourceText || null
    };
  }

  function validateMatchPayload(payload) {
    if (!payload.date) return "試合日を入力してください。";
    if (!payload.tournament) return "大会名を入力してください。";
    if (!payload.team_a || !payload.team_b) return "両校の学校名を入力してください。";
    if (!payload.pref_a || !payload.pref_b) return "両校の都道府県を入力してください。";
    if (!Number.isInteger(payload.score_a) || payload.score_a < 0) return "A校の得点を確認してください。";
    if (!Number.isInteger(payload.score_b) || payload.score_b < 0) return "B校の得点を確認してください。";
    if (payload.team_a === payload.team_b && payload.pref_a === payload.pref_b) {
      return "同じ学校同士の試合は登録できません。";
    }
    if (payload.k !== null && (!Number.isFinite(payload.k) || payload.k <= 0)) {
      return "K値を確認してください。";
    }
    return null;
  }

  async function handleMatchSubmit(event) {
    event.preventDefault();
    if (!state.session?.user) {
      setMessage(els.matchFormMessage, "管理者ログインが必要です。", "error");
      return;
    }

    const payload = readMatchForm();
    const validationError = validateMatchPayload(payload);
    if (validationError) {
      setMessage(els.matchFormMessage, validationError, "error");
      return;
    }

    const editingId = els.editingMatchId.value;
    setMessage(els.matchFormMessage, editingId ? "更新中…" : "登録中…");

    let response;
    if (editingId) {
      response = await state.client.from("matches").update(payload).eq("id", editingId);
    } else {
      response = await state.client.from("matches").insert(payload);
    }

    if (response.error) {
      setMessage(els.matchFormMessage, response.error.message, "error");
      return;
    }

    const successText = editingId ? "試合を更新しました。" : "試合を登録しました。";
    resetMatchForm();
    setMessage(els.matchFormMessage, successText, "success");
    await loadMatches();
  }

  function resetMatchForm() {
    els.matchForm.reset();
    els.editingMatchId.value = "";
    els.matchFormTitle.textContent = "試合を登録";
    els.saveMatchButton.textContent = "試合を登録";
    els.cancelEditButton.classList.add("hidden");
    els.matchDate.value = new Date().toISOString().slice(0, 10);
  }

  function startEdit(id) {
    const match = state.matches.find((m) => m.id === id);
    if (!match) return;
    els.editingMatchId.value = match.id;
    els.matchDate.value = match.date || "";
    els.tournament.value = match.tournament || "";
    els.stage.value = match.stage || "";
    els.teamA.value = match.team_a || "";
    els.prefA.value = match.pref_a || "";
    els.scoreA.value = match.score_a ?? "";
    els.teamB.value = match.team_b || "";
    els.prefB.value = match.pref_b || "";
    els.scoreB.value = match.score_b ?? "";
    els.matchK.value = match.k ?? "";
    els.sourceUrl.value = match.source_url || "";
    els.matchFormTitle.textContent = "試合を編集";
    els.saveMatchButton.textContent = "変更を保存";
    els.cancelEditButton.classList.remove("hidden");
    setMessage(els.matchFormMessage, "");
    document.querySelector("#admin").scrollIntoView({ behavior: "smooth" });
    els.matchDate.focus();
  }

  async function deleteMatch(id) {
    const match = state.matches.find((m) => m.id === id);
    if (!match) return;
    const ok = confirm(
      `${match.date} ${match.team_a} ${match.score_a}-${match.score_b} ${match.team_b}\nこの試合を削除しますか？`
    );
    if (!ok) return;

    const { error } = await state.client.from("matches").delete().eq("id", id);
    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
      return;
    }

    if (els.editingMatchId.value === id) resetMatchForm();
    await loadMatches();
  }

  function renderAdminMatches() {
    if (!els.adminMatchesBody) return;
    if (!state.session?.user) {
      els.adminMatchesBody.innerHTML = "";
      return;
    }

    const recent = [...state.matches].sort(compareMatches).reverse().slice(0, 100);
    if (!recent.length) {
      els.adminMatchesBody.innerHTML =
        `<tr><td colspan="4" class="empty">まだ試合が登録されていません。</td></tr>`;
      return;
    }

    els.adminMatchesBody.innerHTML = recent
      .map(
        (m) => `
          <tr>
            <td>${escapeHtml(m.date)}</td>
            <td>
              ${escapeHtml(m.tournament)}
              ${m.stage ? `<br><span class="muted">${escapeHtml(m.stage)}</span>` : ""}
            </td>
            <td>
              ${escapeHtml(m.team_a)} ${m.score_a} - ${m.score_b} ${escapeHtml(m.team_b)}
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn secondary small js-edit" type="button" data-id="${escapeHtml(m.id)}">編集</button>
                <button class="btn danger small js-delete" type="button" data-id="${escapeHtml(m.id)}">削除</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    els.adminMatchesBody.querySelectorAll(".js-edit").forEach((button) => {
      button.addEventListener("click", () => startEdit(button.dataset.id));
    });
    els.adminMatchesBody.querySelectorAll(".js-delete").forEach((button) => {
      button.addEventListener("click", () => deleteMatch(button.dataset.id));
    });
  }

  function setMessage(element, text, type = "") {
    element.textContent = text;
    element.className = `form-message${type ? ` ${type}` : ""}`;
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", renderRanking);
    els.prefFilter.addEventListener("change", renderRanking);
    els.prefSort.addEventListener("change", renderPrefCards);
    els.schoolSearch.addEventListener("input", renderSchoolSearchResults);
    els.schoolSelect.addEventListener("change", () => {
      renderSchoolProfile();
      const school = state.schoolMap.get(els.schoolSelect.value);
      if (school) els.schoolSearch.value = school.name;
      els.schoolSearchResults.classList.add("hidden");
    });
    [els.ratingA, els.ratingB, els.kValue].forEach((input) => {
      input.addEventListener("input", renderSimulator);
    });
    els.loginForm.addEventListener("submit", handleLogin);
    els.showResetButton.addEventListener("click", showResetRequest);
    els.resetRequestForm.addEventListener("submit", handleResetRequest);
    els.backToLoginButton.addEventListener("click", backToLogin);
    els.passwordSetupForm.addEventListener("submit", handlePasswordSetup);
    els.logoutButton.addEventListener("click", handleLogout);
    els.matchForm.addEventListener("submit", handleMatchSubmit);
    els.cancelEditButton.addEventListener("click", () => {
      resetMatchForm();
      setMessage(els.matchFormMessage, "");
    });
    els.reloadButton.addEventListener("click", loadMatches);
  }

  function renderStaticConfig() {
    els.heroInitial.textContent = String(ratingCfg.initial);
    els.heroDivisor.textContent = String(ratingCfg.divisor);
    els.heroK.textContent = String(ratingCfg.defaultK);
    els.heroFormula.textContent = `R' = R + ${ratingCfg.defaultK} × (W − We)`;
    els.kValue.value = String(ratingCfg.defaultK);
  }

  async function init() {
    bindEvents();
    renderStaticConfig();
    renderSimulator();
    resetMatchForm();

    if (!isConfigReady()) {
      setDataStatus("要設定");
      showSetupNotice(
        `<strong>Supabaseの接続情報が未設定です。</strong> ` +
          `<code>config.js</code> の <code>supabaseUrl</code> と ` +
          `<code>supabasePublishableKey</code> をあなたのSupabaseの値に置き換えてください。`
      );
      els.loginPanel.classList.add("hidden");
      els.resetRequestPanel.classList.add("hidden");
      els.passwordSetupPanel.classList.add("hidden");
      els.adminUnavailable.textContent =
        "config.jsを設定すると管理者ログインと試合登録が利用できます。";
      els.adminUnavailable.classList.remove("hidden");
      state.schoolMap = new Map();
      state.schools = [];
      state.ranking = [];
      state.prefs = [];
      renderAll();
      showSetupNotice(
        `<strong>Supabaseの接続情報が未設定です。</strong> ` +
          `<code>config.js</code> の <code>supabaseUrl</code> と ` +
          `<code>supabasePublishableKey</code> をあなたのSupabaseの値に置き換えてください。`
      );
      return;
    }

    if (!window.supabase?.createClient) {
      setDataStatus("ライブラリエラー");
      showSetupNotice("Supabase JavaScriptライブラリを読み込めませんでした。ネットワーク接続を確認してください。");
      return;
    }

    state.client = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabasePublishableKey
    );

    els.adminUnavailable.classList.add("hidden");
    await Promise.all([restoreSession(), loadMatches()]);
  }

  init().catch((error) => {
    console.error(error);
    setDataStatus("エラー");
    showSetupNotice(
      `初期化中にエラーが発生しました。<br><code>${escapeHtml(error?.message || error)}</code>`
    );
  });
})();
