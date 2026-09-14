/* league simulator rev42 - rating range / national rank / region presets */
(() => {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const PREFECTURES = [
    '北海道','青森','岩手','宮城','秋田','山形','福島',
    '茨城','栃木','群馬','埼玉','千葉','東京','神奈川',
    '新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重',
    '滋賀','京都','大阪','兵庫','奈良','和歌山',
    '鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知',
    '福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'
  ];
  const REGIONS = Object.freeze({
    '関東':['茨城','栃木','群馬','埼玉','千葉','東京','神奈川'],
    '九州沖縄':['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'],
    '中国':['鳥取','島根','岡山','広島','山口'],
    '四国':['徳島','香川','愛媛','高知'],
    '関西':['滋賀','京都','大阪','兵庫','奈良','和歌山','三重'],
    '中部':['新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重'],
    '東北北海道':['北海道','青森','岩手','宮城','秋田','山形','福島']
  });
  const KANTO = REGIONS['関東'];
  const DEFAULT_CONFIG = Object.freeze({
    name: '関東リーグ',
    prefectures: KANTO,
    division_sizes: [10,10,10],
    rating_min: 1500,
    rating_max: null
  });

  const state = {
    client: null,
    session: null,
    settings: {},
    config: cloneConfig(DEFAULT_CONFIG),
    schools: [],
    initialized: false,
    saving: false
  };

  function finiteOrNull(value){
    if(value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function cloneConfig(value){
    return {
      name: String(value?.name || DEFAULT_CONFIG.name),
      prefectures: Array.isArray(value?.prefectures) ? [...value.prefectures] : [...DEFAULT_CONFIG.prefectures],
      division_sizes: Array.isArray(value?.division_sizes) ? value.division_sizes.map(v=>Number(v)||10) : [...DEFAULT_CONFIG.division_sizes],
      rating_min: finiteOrNull(value?.rating_min ?? DEFAULT_CONFIG.rating_min),
      rating_max: finiteOrNull(value?.rating_max)
    };
  }
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function isAdmin(){ return Boolean(state.session?.user); }
  function isPublic(){ return state.settings?.public_league_simulator === true; }
  function currentConfig(){
    const raw = state.settings?.league_simulator_config;
    if(!raw) return cloneConfig(DEFAULT_CONFIG);
    if(typeof raw === 'string'){
      try { return normalizeConfig(JSON.parse(raw)); } catch(_) { return cloneConfig(DEFAULT_CONFIG); }
    }
    return normalizeConfig(raw);
  }
  function normalizeConfig(raw, allowEmptyPrefectures=false){
    const config = cloneConfig(raw || DEFAULT_CONFIG);
    config.name = String(config.name || 'リーグ編成').trim().slice(0,60) || 'リーグ編成';
    config.prefectures = [...new Set(config.prefectures.map(String).filter(p=>PREFECTURES.includes(p)))];
    if(!config.prefectures.length && !allowEmptyPrefectures) config.prefectures = [...KANTO];
    config.division_sizes = config.division_sizes.slice(0,12).map(v=>Math.min(40,Math.max(2,Math.trunc(Number(v)||10))));
    if(!config.division_sizes.length) config.division_sizes = [10];
    config.rating_min = finiteOrNull(config.rating_min);
    config.rating_max = finiteOrNull(config.rating_max);
    return config;
  }
  function sameSet(a,b){
    if(a.length!==b.length) return false;
    const bs=new Set(b); return a.every(x=>bs.has(x));
  }
  function regionNameForPrefectures(prefectures){
    if(prefectures.length===PREFECTURES.length && sameSet(prefectures,PREFECTURES)) return '全国';
    for(const [name,prefs] of Object.entries(REGIONS)) if(sameSet(prefectures,prefs)) return name;
    return 'カスタム地域';
  }
  function ratingRangeLabel(config=state.config){
    const min=config.rating_min, max=config.rating_max;
    if(min!==null&&max!==null)return `${min.toFixed(1)}〜${max.toFixed(1)}`;
    if(min!==null)return `${min.toFixed(1)}以上`;
    if(max!==null)return `${max.toFixed(1)}以下`;
    return '指定なし';
  }

  function injectStyles(){
    if(document.getElementById('leagueSimulatorStyles')) return;
    const style = document.createElement('style');
    style.id = 'leagueSimulatorStyles';
    style.textContent = `
      .league-simulator-card{background:var(--surface,#fff);border:1px solid var(--line,#d9e1dc);border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(20,50,35,.06)}
      .league-admin-box{margin-bottom:22px;padding:18px;border:1px solid var(--line,#d9e1dc);border-radius:14px;background:var(--surface-soft,#f7faf8)}
      .league-admin-head{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
      .league-admin-head h3{margin:0 0 5px}.league-admin-head p{margin:0}
      .league-public-toggle{display:inline-flex;align-items:center;gap:8px;font-weight:700;white-space:nowrap;max-width:100%;cursor:pointer;flex:0 0 auto}
      .league-public-toggle input[type="checkbox"],.league-pref-option input[type="checkbox"]{-webkit-appearance:checkbox !important;appearance:auto !important;width:18px !important;height:18px !important;min-width:18px !important;min-height:18px !important;max-width:18px !important;padding:0 !important;margin:0 !important;border-radius:3px !important;flex:0 0 18px !important;position:static !important;inset:auto !important;opacity:1 !important;pointer-events:auto !important;cursor:pointer}
      .league-public-toggle span,.league-pref-option span{min-width:0}
      .league-config-grid{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(105px,.55fr) minmax(120px,.65fr) minmax(120px,.65fr);gap:14px;margin-bottom:16px}
      .league-config-grid label,.league-division-size{display:grid;gap:6px;font-weight:700}
      .league-config-grid input,.league-division-size input{width:100%;min-height:42px;border:1px solid var(--line,#cbd7d0);border-radius:10px;padding:8px 10px;background:#fff;color:inherit}
      .league-region-presets{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 11px}
      .league-pref-head{display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin:14px 0 9px}
      .league-pref-actions{display:flex;gap:7px;flex-wrap:wrap}
      .league-pref-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;max-height:280px;overflow:auto;padding:10px;border:1px solid var(--line,#d9e1dc);border-radius:12px;background:#fff}
      .league-pref-option{display:flex;align-items:center;gap:7px;min-width:0;padding:5px 4px;font-weight:600;font-size:.92rem;cursor:pointer;user-select:none}.league-pref-option:hover{background:var(--surface-soft,#f7faf8);border-radius:7px}
      .league-division-controls{margin-top:16px}.league-division-size-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-top:8px}
      .league-admin-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.league-message{min-height:1.4em;margin:9px 0 0}
      .league-summary{display:flex;gap:10px 18px;flex-wrap:wrap;margin:0 0 16px;color:var(--muted,#5b6b62)}.league-summary strong{color:var(--text,#1d2b24)}
      .league-divisions{display:grid;grid-template-columns:repeat(3,minmax(300px,1fr));gap:16px}
      .league-division{border:1px solid var(--line,#d9e1dc);border-radius:14px;overflow:hidden;background:#fff}.league-division h3{margin:0;padding:13px 15px;background:var(--surface-soft,#f4f8f5);border-bottom:1px solid var(--line,#d9e1dc);font-size:1rem}
      .league-table-wrap{overflow:auto}.league-table{width:100%;border-collapse:collapse;min-width:470px}.league-table th,.league-table td{padding:9px 9px;border-bottom:1px solid #edf1ee;text-align:left;font-size:.89rem;white-space:nowrap}.league-table th{font-size:.78rem;color:var(--muted,#5b6b62);background:#fbfcfb}.league-table .num{text-align:center}.league-table .rating{text-align:right}.league-table tr:last-child td{border-bottom:0}
      .league-empty{padding:25px;text-align:center;color:var(--muted,#5b6b62);border:1px dashed var(--line,#d9e1dc);border-radius:12px}.league-unassigned{margin-top:15px;padding:11px 13px;border-radius:10px;background:var(--surface-soft,#f7faf8);color:var(--muted,#5b6b62);font-size:.9rem}
      @media(max-width:1180px){.league-config-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}.league-divisions{grid-template-columns:repeat(2,minmax(280px,1fr))}}
      @media(max-width:700px){.league-config-grid{grid-template-columns:1fr}.league-pref-grid{grid-template-columns:repeat(2,minmax(105px,1fr))}.league-division-size-grid{grid-template-columns:repeat(2,minmax(110px,1fr))}.league-divisions{grid-template-columns:1fr}.league-simulator-card{padding:15px}.league-admin-head{display:grid;grid-template-columns:1fr}.league-public-toggle{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function injectNav(){
    const nav = document.querySelector('.nav');
    if(!nav || document.querySelector('[data-league-nav]')) return;
    const link = document.createElement('a');
    link.href = '#league-simulator'; link.dataset.leagueNav = '1'; link.textContent = 'リーグ編成';
    const method = nav.querySelector('a[href="#method"]'); nav.insertBefore(link, method || null);
  }

  function injectSection(){
    if(document.getElementById('league-simulator')) return;
    const section = document.createElement('section');
    section.id = 'league-simulator'; section.className = 'section wrap';
    section.innerHTML = `
      <div class="section-head"><div><p class="eyebrow">LEAGUE BUILDER</p><h2 id="leagueTitle">リーグ編成シミュレーター</h2></div><p class="section-copy">参加地域とRating範囲を指定し、現在のRating順で各部へ自動編成します。全国順位も同時に表示します。</p></div>
      <div class="league-simulator-card">
        <div id="leagueAdminBox" class="league-admin-box hidden">
          <div class="league-admin-head"><div><h3>リーグ設定</h3><p class="muted">設定は一般公開する編成にも反映されます。</p></div><label class="league-public-toggle"><input id="leaguePublicToggle" type="checkbox"><span>一般公開</span></label></div>
          <div class="league-config-grid">
            <label>リーグ名<input id="leagueNameInput" type="text" maxlength="60" autocomplete="off"></label>
            <label>部数<input id="leagueDivisionCount" type="number" min="1" max="12" step="1"></label>
            <label>Rating下限<input id="leagueRatingMin" type="number" step="1" placeholder="例 1500"></label>
            <label>Rating上限<input id="leagueRatingMax" type="number" step="1" placeholder="指定なし"></label>
          </div>
          <div class="league-division-controls"><strong>各部の定員</strong><div id="leagueDivisionSizes" class="league-division-size-grid"></div></div>
          <div class="league-pref-head"><strong>参加地域（都道府県）</strong><div class="league-pref-actions"><button id="leaguePrefAll" class="btn secondary small" type="button">すべて選択</button><button id="leaguePrefClear" class="btn secondary small" type="button">すべて解除</button></div></div>
          <div id="leagueRegionPresets" class="league-region-presets" aria-label="地域プリセット">${Object.keys(REGIONS).map(name=>`<button class="btn secondary small js-league-region" type="button" data-region="${name}">${name}</button>`).join('')}</div>
          <div id="leaguePrefGrid" class="league-pref-grid" role="group" aria-label="リーグ参加都道府県"></div>
          <div class="league-admin-actions"><button id="leaguePreviewButton" class="btn secondary" type="button">この設定でプレビュー</button><button id="leagueSaveButton" class="btn primary" type="button">設定を保存</button></div>
          <p id="leagueAdminMessage" class="league-message muted" aria-live="polite"></p>
        </div>
        <div id="leagueSummary" class="league-summary"></div><div id="leagueDivisions" class="league-divisions"></div><div id="leagueUnassigned" class="league-unassigned hidden"></div>
      </div>`;
    const method = document.getElementById('method'), simulator = document.getElementById('simulator');
    if(method?.parentNode) method.parentNode.insertBefore(section,method); else if(simulator?.parentNode) simulator.parentNode.insertBefore(section,simulator.nextSibling); else document.querySelector('main')?.appendChild(section);
  }

  function els(){
    const ids=['league-simulator','leagueAdminBox','leaguePublicToggle','leagueNameInput','leagueDivisionCount','leagueRatingMin','leagueRatingMax','leagueDivisionSizes','leaguePrefGrid','leagueRegionPresets','leaguePrefAll','leaguePrefClear','leaguePreviewButton','leagueSaveButton','leagueAdminMessage','leagueSummary','leagueDivisions','leagueUnassigned','leagueTitle'];
    return Object.fromEntries(ids.map(id=>[id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),document.getElementById(id)]));
  }
  function renderPrefectures(){
    const e=els(); if(!e.leaguePrefGrid)return; const selected=new Set(state.config.prefectures);
    e.leaguePrefGrid.innerHTML=PREFECTURES.map(pref=>`<label class="league-pref-option"><input type="checkbox" value="${escapeHtml(pref)}" ${selected.has(pref)?'checked':''}><span>${escapeHtml(pref)}</span></label>`).join('');
  }
  function renderDivisionInputs(){
    const e=els(); if(!e.leagueDivisionSizes)return; const count=Math.min(12,Math.max(1,Number(e.leagueDivisionCount?.value||state.config.division_sizes.length)||1));
    while(state.config.division_sizes.length<count)state.config.division_sizes.push(10); state.config.division_sizes=state.config.division_sizes.slice(0,count);
    e.leagueDivisionSizes.innerHTML=state.config.division_sizes.map((size,i)=>`<label class="league-division-size">${i+1}部<input type="number" min="2" max="40" step="1" value="${Number(size)||10}" data-division-size="${i}"></label>`).join('');
  }
  function syncAdminForm(){
    const e=els(); if(!e.leagueAdminBox)return; e.leagueAdminBox.classList.toggle('hidden',!isAdmin()); if(!isAdmin())return;
    e.leaguePublicToggle.checked=isPublic(); e.leagueNameInput.value=state.config.name; e.leagueDivisionCount.value=state.config.division_sizes.length;
    e.leagueRatingMin.value=state.config.rating_min===null?'':String(state.config.rating_min); e.leagueRatingMax.value=state.config.rating_max===null?'':String(state.config.rating_max);
    renderDivisionInputs(); renderPrefectures();
  }
  function collectFormConfig(){
    const e=els(),selected=[...(e.leaguePrefGrid?.querySelectorAll('input[type="checkbox"]:checked')||[])].map(x=>x.value),sizes=[...(e.leagueDivisionSizes?.querySelectorAll('[data-division-size]')||[])].map(x=>Math.min(40,Math.max(2,Math.trunc(Number(x.value)||10))));
    return normalizeConfig({name:e.leagueNameInput?.value||'リーグ編成',prefectures:selected,division_sizes:sizes,rating_min:finiteOrNull(e.leagueRatingMin?.value),rating_max:finiteOrNull(e.leagueRatingMax?.value)},true);
  }
  function validateConfig(config){
    if(!config.prefectures.length)return '参加する都道府県を1つ以上選択してください。';
    if(!config.division_sizes.length)return '部数を1以上にしてください。';
    if(config.rating_min!==null&&config.rating_max!==null&&config.rating_min>config.rating_max)return 'Rating下限は上限以下にしてください。';
    return '';
  }
  function rankedSchools(){
    return state.schools.filter(s=>Number.isFinite(Number(s.rating))).sort((a,b)=>Number(b.rating)-Number(a.rating)||String(a.school_name||'').localeCompare(String(b.school_name||''),'ja'));
  }
  function eligibleSchools(){
    const selected=new Set(state.config.prefectures),min=state.config.rating_min,max=state.config.rating_max,allRanked=rankedSchools(),rankMap=new Map(allRanked.map((s,i)=>[String(s.school_key||`${s.prefecture}||${s.school_name}`),i+1]));
    return allRanked.filter(s=>!s.is_joint).filter(s=>s.active_last_year!==false).filter(s=>selected.has(String(s.prefecture||''))).filter(s=>min===null||Number(s.rating)>=min).filter(s=>max===null||Number(s.rating)<=max).map(s=>({...s,national_rank:rankMap.get(String(s.school_key||`${s.prefecture}||${s.school_name}`))}));
  }
  function renderLeague(){
    const e=els(),section=document.getElementById('league-simulator'),nav=document.querySelector('[data-league-nav]'),visible=isAdmin()||isPublic(); section?.classList.toggle('hidden',!visible); nav?.classList.toggle('hidden',!visible); if(!visible)return;
    const schools=eligibleSchools(),totalSlots=state.config.division_sizes.reduce((a,b)=>a+b,0),assigned=schools.slice(0,totalSlots),region=regionNameForPrefectures(state.config.prefectures),selectedText=state.config.prefectures.length===47?'全国47都道府県':state.config.prefectures.join('・');
    if(e.leagueTitle)e.leagueTitle.textContent=`${state.config.name} 編成シミュレーター`;
    if(e.leagueSummary)e.leagueSummary.innerHTML=`<span>地域 <strong>${escapeHtml(region)}</strong></span><span>参加都道府県 <strong>${escapeHtml(selectedText)}</strong></span><span>Rating範囲 <strong>${escapeHtml(ratingRangeLabel())}</strong></span><span>部数 <strong>${state.config.division_sizes.length}部</strong></span><span>定員 <strong>${totalSlots}校</strong></span><span>条件内 <strong>${schools.length}校</strong></span>`;
    if(!assigned.length){e.leagueDivisions.innerHTML='<div class="league-empty">指定した地域・Rating範囲に編成対象校がありません。</div>';e.leagueUnassigned.classList.add('hidden');return;}
    let cursor=0;
    e.leagueDivisions.innerHTML=state.config.division_sizes.map((size,idx)=>{const rows=assigned.slice(cursor,cursor+size);cursor+=size;return `<article class="league-division"><h3>${idx+1}部 <span class="muted">${rows.length}/${size}校</span></h3><div class="league-table-wrap"><table class="league-table"><thead><tr><th class="num">部内</th><th class="num">全国</th><th>学校</th><th>都道府県</th><th class="rating">Rating</th></tr></thead><tbody>${rows.length?rows.map((s,i)=>`<tr><td class="num">${i+1}</td><td class="num">${s.national_rank??'—'}</td><td><strong>${escapeHtml(s.school_name||'—')}</strong></td><td>${escapeHtml(s.prefecture||'—')}</td><td class="rating">${Number(s.rating).toFixed(1)}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">空き枠</td></tr>`}</tbody></table></div></article>`;}).join('');
    const remaining=Math.max(0,schools.length-totalSlots); if(remaining){e.leagueUnassigned.textContent=`Rating条件内の定員外：${remaining.toLocaleString('ja-JP')}校。条件内のRating上位${totalSlots}校までを編成しています。`;e.leagueUnassigned.classList.remove('hidden');}else e.leagueUnassigned.classList.add('hidden');
  }
  function setMessage(text,isError=false){const e=els();if(!e.leagueAdminMessage)return;e.leagueAdminMessage.textContent=text||'';e.leagueAdminMessage.style.color=isError?'#a12622':'';}
  async function loadSettings(){
    const {data,error}=await state.client.from('site_settings').select('*').eq('id',1).maybeSingle();
    if(error){console.warn('league settings unavailable',error);state.settings={public_league_simulator:false,league_simulator_config:cloneConfig(DEFAULT_CONFIG)};state.config=cloneConfig(DEFAULT_CONFIG);setMessage('リーグ設定を読み込めません。先に upgrade-rev40-league-simulator.sql を実行してください。',true);return;}
    state.settings=data||{};state.config=currentConfig();
  }
  async function loadSchools(){
    const fields='school_key,school_name,prefecture,rating,is_joint,active_last_year'; const {data,error}=await state.client.from('rating_current').select(fields).order('rating',{ascending:false});
    if(error){console.warn('rating_current unavailable',error);state.schools=[];setMessage(`Rating一覧を読み込めませんでした: ${error.message}`,true);return;} state.schools=data||[];
  }
  async function saveSettings(){
    if(!isAdmin()||state.saving)return; const e=els(),config=collectFormConfig(),validation=validateConfig(config); if(validation){setMessage(validation,true);return;}
    state.saving=true;e.leagueSaveButton.disabled=true;setMessage('保存中…'); const payload={public_league_simulator:Boolean(e.leaguePublicToggle.checked),league_simulator_config:config,updated_at:new Date().toISOString()};
    const {data,error}=await state.client.from('site_settings').update(payload).eq('id',1).select('*').single(); state.saving=false;e.leagueSaveButton.disabled=false;
    if(error){setMessage(`保存できませんでした: ${error.message}。upgrade-rev40-league-simulator.sql を実行済みか確認してください。`,true);return;}
    state.settings=data||{...state.settings,...payload};state.config=normalizeConfig(config);syncAdminForm();renderLeague();setMessage('リーグ設定と一般公開設定を保存しました。');
  }
  function bindEvents(){
    const e=els();
    e.leagueDivisionCount?.addEventListener('change',()=>{const count=Math.min(12,Math.max(1,Math.trunc(Number(e.leagueDivisionCount.value)||1)));e.leagueDivisionCount.value=count;while(state.config.division_sizes.length<count)state.config.division_sizes.push(10);state.config.division_sizes=state.config.division_sizes.slice(0,count);renderDivisionInputs();});
    e.leagueDivisionSizes?.addEventListener('input',ev=>{const input=ev.target.closest('[data-division-size]');if(!input)return;state.config.division_sizes[Number(input.dataset.divisionSize)]=Number(input.value)||10;});
    e.leagueRegionPresets?.addEventListener('click',ev=>{const b=ev.target.closest('[data-region]');if(!b)return;const prefs=REGIONS[b.dataset.region];if(!prefs)return;state.config.prefectures=[...prefs];renderPrefectures();setMessage(`${b.dataset.region}を選択しました。`);});
    e.leaguePrefAll?.addEventListener('click',()=>{state.config.prefectures=[...PREFECTURES];renderPrefectures();}); e.leaguePrefClear?.addEventListener('click',()=>{state.config.prefectures=[];renderPrefectures();});
    e.leaguePrefGrid?.addEventListener('change',()=>{state.config.prefectures=[...e.leaguePrefGrid.querySelectorAll('input:checked')].map(x=>x.value);});
    e.leaguePreviewButton?.addEventListener('click',()=>{const draft=collectFormConfig(),validation=validateConfig(draft);if(validation){setMessage(validation,true);return;}state.config=draft;renderDivisionInputs();renderLeague();setMessage('未保存の設定でプレビューしています。');}); e.leagueSaveButton?.addEventListener('click',saveSettings);
  }
  async function refreshAuth(){const {data}=await state.client.auth.getSession();state.session=data?.session||null;syncAdminForm();renderLeague();}
  async function init(){
    if(state.initialized)return;state.initialized=true;if(!window.supabase?.createClient||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
    injectStyles();injectNav();injectSection();state.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{detectSessionInUrl:false}});bindEvents();await Promise.all([loadSettings(),loadSchools(),refreshAuth()]);syncAdminForm();renderLeague();state.client.auth.onAuthStateChange((_event,session)=>{state.session=session;syncAdminForm();renderLeague();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
