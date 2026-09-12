(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const ratingCfg = {
    initial: Number(cfg.rating?.initial ?? 1500),
    divisor: Number(cfg.rating?.divisor ?? 600),
    defaultK: Number(cfg.rating?.defaultK ?? 10),
    tournamentK: cfg.rating?.tournamentK || {}
  };
  const PUBLIC_RATING_MIN = Number(cfg.publicRatingMin ?? 1500);
  const rankingLimit = 100;
  const PAGE_SIZE = 1000;

  const state = {
    client: null, session: null, authMode: null, matches: [], schools: [], schoolMap: new Map(),
    ranking: [], prefs: [], proposals: [], editHistory: [], ready: false, historyYears: '1', compareYears: '3', selectedSchoolKey: null, schoolSearchHits: [], recordSearchHits: [], compareSchoolKeys: [], rankCompareSearchHits: [], showDuplicatesOnly: false, duplicateGroups: []
  };
  const $ = (id) => document.getElementById(id);
  const els = {
    dataStatus:$('dataStatus'), setupNotice:$('setupNotice'), searchInput:$('searchInput'), prefFilter:$('prefFilter'),
    rankingBody:$('rankingBody'), rankingFootnote:$('rankingFootnote'), matchCount:$('matchCount'), schoolCount:$('schoolCount'),
    prefCount:$('prefCount'), latestMatchDate:$('latestMatchDate'), prefCards:$('prefCards'), prefSort:$('prefSort'),
    schoolSearch:$('schoolSearch'), schoolSearchResults:$('schoolSearchResults'), recordSchoolSearch:$('recordSchoolSearch'), recordSchoolSearchResults:$('recordSchoolSearchResults'), schoolSelect:$('schoolSelect'), schoolPref:$('schoolPref'),
    schoolName:$('schoolName'), schoolRecord:$('schoolRecord'), schoolRating:$('schoolRating'), schoolRank:$('schoolRank'), schoolPrefRank:$('schoolPrefRank'),
    schoolDelta:$('schoolDelta'), schoolForm:$('schoolForm'), historyChart:$('historyChart'), recentMatches:$('recentMatches'),
    historyRange:$('historyRange'), historyRangeStatus:$('historyRangeStatus'), matchYearFilter:$('matchYearFilter'),
    rankCompareSearch:$('rankCompareSearch'), rankCompareSearchResults:$('rankCompareSearchResults'), rankCompareSelected:$('rankCompareSelected'), rankCompareRange:$('rankCompareRange'), rankCompareStatus:$('rankCompareStatus'), rankCompareChart:$('rankCompareChart'), rankCompareLegend:$('rankCompareLegend'),
    ratingA:$('ratingA'), ratingB:$('ratingB'), kValue:$('kValue'), simResult:$('simResult'), adminUnavailable:$('adminUnavailable'),
    loginPanel:$('loginPanel'), loginForm:$('loginForm'), loginEmail:$('loginEmail'), loginPassword:$('loginPassword'), loginMessage:$('loginMessage'),
    showResetButton:$('showResetButton'), resetRequestPanel:$('resetRequestPanel'), resetRequestForm:$('resetRequestForm'), resetEmail:$('resetEmail'),
    resetRequestMessage:$('resetRequestMessage'), backToLoginButton:$('backToLoginButton'), passwordSetupPanel:$('passwordSetupPanel'),
    passwordSetupTitle:$('passwordSetupTitle'), passwordSetupDescription:$('passwordSetupDescription'), passwordSetupForm:$('passwordSetupForm'),
    newPassword:$('newPassword'), newPasswordConfirm:$('newPasswordConfirm'), passwordSetupMessage:$('passwordSetupMessage'),
    adminPanel:$('adminPanel'), adminEmail:$('adminEmail'), logoutButton:$('logoutButton'), matchForm:$('matchForm'), matchFormTitle:$('matchFormTitle'),
    editingMatchId:$('editingMatchId'), matchDate:$('matchDate'), tournament:$('tournament'), stage:$('stage'), teamA:$('teamA'), prefA:$('prefA'),
    scoreA:$('scoreA'), teamB:$('teamB'), prefB:$('prefB'), scoreB:$('scoreB'), matchK:$('matchK'), sourceUrl:$('sourceUrl'),
    saveMatchButton:$('saveMatchButton'), cancelEditButton:$('cancelEditButton'), matchFormMessage:$('matchFormMessage'), adminMatchesBody:$('adminMatchesBody'),
    adminMatchKeyword:$('adminMatchKeyword'), adminMatchDate:$('adminMatchDate'), adminMatchTournament:$('adminMatchTournament'), adminMatchSchool:$('adminMatchSchool'),
    adminMatchSearchStatus:$('adminMatchSearchStatus'), adminMatchClear:$('adminMatchClear'), duplicateStatus:$('duplicateStatus'), duplicateScanButton:$('duplicateScanButton'),
    reloadButton:$('reloadButton'), reloadProposalsButton:$('reloadProposalsButton'), proposalAdminList:$('proposalAdminList'), duplicateMergeList:$('duplicateMergeList'), duplicateMergeButton:$('duplicateMergeButton'), normalizeTournamentButton:$('normalizeTournamentButton'), normalizeTournamentStatus:$('normalizeTournamentStatus'), reloadHistoryButton:$('reloadHistoryButton'), editHistoryList:$('editHistoryList'), heroInitial:$('heroInitial'), heroDivisor:$('heroDivisor'), heroK:$('heroK'), heroFormula:$('heroFormula'), methodKText:$('methodKText')
  };

  function escapeHtml(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
  function authRedirectUrl(){return `${location.origin}${location.pathname}`;}
  function detectAuthModeFromUrl(){const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.replace(/^#/,''));const t=h.get('type')||q.get('type');return t==='recovery'?'recovery':t==='invite'?'invite':null;}
  function getAuthErrorFromUrl(){const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.replace(/^#/,''));return h.get('error_description')||q.get('error_description')||h.get('error')||q.get('error')||null;}
  function clearAuthUrl(){history.replaceState({},document.title,authRedirectUrl());}
  function isConfigReady(){const u=String(cfg.supabaseUrl||''),k=String(cfg.supabasePublishableKey||'');return u.startsWith('https://')&&u.includes('.supabase.co')&&!u.includes('PASTE_')&&k.length>20&&!k.includes('PASTE_');}

  function normalizeJointName(name){
    const raw=String(name??'').trim().replace(/[／]/g,'/').replace(/[･・]/g,'・').replace(/\s+/g,' ');
    const parts=raw.split(/\s*(?:・|\/|＆|&|、|,|\+|・)\s*/).filter(Boolean);
    if(parts.length<2) return {name:raw,isJoint:false,members:[raw]};
    const sorted=[...new Set(parts)].sort((a,b)=>a.localeCompare(b,'ja'));
    return {name:sorted.join('・'),isJoint:true,members:sorted};
  }
  function canonicalTeam(name){return normalizeJointName(name);}
  function canonicalPref(pref){const p=String(pref??'').trim();if(p==='東東京'||p==='西東京')return '東京';if(p==='北北海道'||p==='南北海道')return '北海道';return p;}
  const REGION_PREFS={
    '東北':['青森','岩手','宮城','秋田','山形','福島'],
    '関東':['茨城','栃木','群馬','埼玉','千葉','東京','神奈川'],
    '甲信越':['山梨','長野','新潟'],
    '北陸':['富山','石川','福井'],
    '東海':['岐阜','静岡','愛知','三重'],
    '中部':['新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重'],
    '関西':['滋賀','京都','大阪','兵庫','奈良','和歌山','三重'],
    '近畿':['滋賀','京都','大阪','兵庫','奈良','和歌山'],
    '中国':['鳥取','島根','岡山','広島','山口'],
    '四国':['徳島','香川','愛媛','高知'],
    '九州':['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'],
    '九州・沖縄':['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'],
    '九州沖縄':['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'],
    '中国四国':['鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知']
  };
  function canonicalTournament(name){
    const raw=String(name??'').normalize('NFKC').trim().replace(/\s+/g,' '),t=raw.replace(/\s+/g,'');
    if(!raw)return '';
    if(/明治神宮(?:野球)?大会/.test(t))return '明治神宮大会';
    if(/国民スポーツ大会|国スポ|国民体育大会|国体/.test(t))return '国民スポーツ大会';
    if(/選抜高等学校野球大会|選抜高校野球大会|センバツ|春の甲子園/.test(t))return '春の甲子園';
    if(/夏の甲子園/.test(t))return '夏の甲子園';
    if(/全国(?:高等学校|高校)野球選手権大会/.test(t)&&!/(?:都|道|府|県|地区|地方|支部)(?:大会|予選)/.test(t))return '夏の甲子園';
    return raw;
  }
  function regionNamesForSchool(school){return Object.entries(REGION_PREFS).filter(([,prefs])=>prefs.includes(school?.pref)).map(([name])=>name);}
  function schoolMatchesSearch(school,q){
    const n=normalizeSearchText(q);if(!n)return true;
    if(normalizeSearchText(school.name).includes(n)||normalizeSearchText(school.pref).includes(n)||[...(school.areas||[])].some(a=>normalizeSearchText(a).includes(n)))return true;
    return regionNamesForSchool(school).some(r=>normalizeSearchText(r).includes(n)||n.includes(normalizeSearchText(r)));
  }
  function schoolKey(name,pref){const c=canonicalTeam(name);return `${encodeURIComponent(canonicalPref(pref))}::${encodeURIComponent(c.name)}`;}
  function formatRating(v){return Number(v).toFixed(1);}
  function formatDelta(v){const n=Number(v||0);if(Math.abs(n)<.05)return '±0.0';return `${n>0?'+':''}${n.toFixed(1)}`;}
  function deltaClass(v){return v>.05?'delta-positive':v<-.05?'delta-negative':'';}
  function expectation(a,b){return 1/(1+Math.pow(10,-(a-b)/ratingCfg.divisor));}

  function inferK(match){
    const direct=Number(match.k); if(Number.isFinite(direct)&&direct>0) return direct;
    const specific=Number(ratingCfg.tournamentK?.[match.tournament]); if(Number.isFinite(specific)&&specific>0) return specific;
    const raw=`${match.tournament||''} ${match.stage||''}`;
    const t=raw.replace(/\s+/g,'');
    if(/明治神宮/.test(t)) return 20;
    if(/国民スポーツ|国スポ|国体/.test(t)) return 15;
    if(/甲子園/.test(t)&&/夏|全国高等学校野球選手権/.test(t)) return 25;
    if(/選抜|センバツ|春の甲子園/.test(t)) return 20;

    // 春季・秋季は「都道府県内の大会/予選 = 10」「その上の地区大会 = 15」を優先して判定する。
    const springAutumn=/春季|秋季/.test(t);
    if(springAutumn){
      const prefecturalQualifier=/(?:北海道|東京都|京都府|大阪府|.{2,3}県)(?:大会|予選)|都大会|道大会|府大会|県大会|都予選|道予選|府予選|県予選|支部予選|地方予選/.test(t);
      if(prefecturalQualifier) return 10;
      const regionalMain=/(?:北海道|東北|関東|北信越|東海|近畿|中国|四国|九州)(?:地区)?(?:高等学校野球)?大会|地区大会/.test(t);
      if(regionalMain) return 15;
    }
    if(/地区大会/.test(t)) return 15;
    return 10;
  }
  function normalizeMatch(m){
    const a=canonicalTeam(m.team_a), b=canonicalTeam(m.team_b), tournamentOriginal=String(m.tournament??'').trim();
    return {...m,team_a:a.name,team_b:b.name,team_a_display:String(m.team_a??'').trim(),team_b_display:String(m.team_b??'').trim(),joint_a:a.isJoint,joint_b:b.isJoint,pref_a:String(m.pref_a??'').trim(),pref_b:String(m.pref_b??'').trim(),tournament_original:tournamentOriginal,tournament:canonicalTournament(tournamentOriginal),stage:String(m.stage??'').trim(),score_a:Number(m.score_a),score_b:Number(m.score_b),k:m.k===null||m.k===''?null:Number(m.k)};
  }
  function compareMatches(a,b){return String(a.date).localeCompare(String(b.date))||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id||'').localeCompare(String(b.id||''));}
  function getOrCreateSchool(map,name,pref,isJoint=false){const key=schoolKey(name,pref);if(!map.has(key)){map.set(key,{key,name:canonicalTeam(name).name,pref:canonicalPref(pref),rating:ratingCfg.initial,lastDelta:0,wins:0,losses:0,draws:0,history:[],games:[],isJoint:Boolean(isJoint),areas:new Set([String(pref||'').trim()])});}else if(isJoint){map.get(key).isJoint=true;}return map.get(key);}
  function addSchoolArea(school,pref,tournament){
    if(!school)return;const p=String(pref||'').trim(),t=String(tournament||'').replace(/\s+/g,'');
    if(p)school.areas.add(p);
    if(/東京/.test(p)||/東京/.test(t)){school.areas.add('東京');if(/西東京/.test(p)||/西東京/.test(t))school.areas.add('西東京');if(/東東京/.test(p)||/東東京/.test(t))school.areas.add('東東京');}
    if(/北海道/.test(p)||/北海道/.test(t)){school.areas.add('北海道');if(/南北海道/.test(p)||/南北海道/.test(t))school.areas.add('南北海道');if(/北北海道/.test(p)||/北北海道/.test(t))school.areas.add('北北海道');}
  }
  function schoolMatchesArea(school,area){if(!area)return true;if(REGION_PREFS[area])return REGION_PREFS[area].includes(school?.pref);return Boolean(school?.areas?.has(area)||school?.pref===area);}

  function buildRatings(raw){
    const map=new Map(), matches=raw.map(normalizeMatch).sort(compareMatches);
    for(const m of matches){
      if(!m.date||!m.team_a||!m.team_b||!m.pref_a||!m.pref_b||!Number.isFinite(m.score_a)||!Number.isFinite(m.score_b))continue;
      const a=getOrCreateSchool(map,m.team_a,m.pref_a,m.joint_a),b=getOrCreateSchool(map,m.team_b,m.pref_b,m.joint_b);
      addSchoolArea(a,m.pref_a,m.tournament);addSchoolArea(b,m.pref_b,m.tournament);
      const beforeA=a.rating,beforeB=b.rating,eA=expectation(beforeA,beforeB); let rA=.5,rB=.5,cA='D',cB='D';
      if(m.score_a>m.score_b){rA=1;rB=0;cA='W';cB='L';a.wins++;b.losses++;}else if(m.score_a<m.score_b){rA=0;rB=1;cA='L';cB='W';a.losses++;b.wins++;}else{a.draws++;b.draws++;}
      const k=inferK(m),dA=k*(rA-eA),dB=k*(rB-(1-eA)); a.rating+=dA;b.rating+=dB;a.lastDelta=dA;b.lastDelta=dB;
      a.history.push({date:m.date,rating:a.rating,delta:dA,opponent:b.name,matchId:m.id}); b.history.push({date:m.date,rating:b.rating,delta:dB,opponent:a.name,matchId:m.id});
      a.games.push({match:m,result:cA,opponent:b.name,opponentPref:b.pref,opponentKey:b.key,scored:m.score_a,allowed:m.score_b,before:beforeA,after:a.rating,delta:dA});
      b.games.push({match:m,result:cB,opponent:a.name,opponentPref:a.pref,opponentKey:a.key,scored:m.score_b,allowed:m.score_a,before:beforeB,after:b.rating,delta:dB});
    }
    const schools=[...map.values()].sort((x,y)=>y.rating-x.rating||x.name.localeCompare(y.name,'ja'));
    schools.forEach((s,i)=>{s.allRank=i+1;s.form=s.games.slice(-5).map(g=>g.result).join('');s.firstGameDate=s.history[0]?.date||null;});
    const byPref=new Map();for(const school of schools){if(school.isJoint)continue;if(!byPref.has(school.pref))byPref.set(school.pref,[]);byPref.get(school.pref).push(school);}
    for(const group of byPref.values())group.sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name,'ja')).forEach((school,i)=>school.prefRank=i+1);
    const publicSchools=schools.filter(s=>s.rating>=PUBLIC_RATING_MIN);
    publicSchools.forEach((s,i)=>s.publicRank=i+1);
    schools.forEach(s=>{s.rank=s.publicRank??null;});
    return {matches,map,schools,publicSchools};
  }
  function median(v){if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
  function average(v){return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
  function buildPrefStats(schools){const g=new Map();for(const s of schools){if(s.isJoint)continue;if(!g.has(s.pref))g.set(s.pref,[]);g.get(s.pref).push(s);}return [...g].map(([pref,items])=>{const d=[...items].sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name,'ja')),values=d.map(x=>x.rating),n=Math.max(1,Math.ceil(d.length*.25));return{pref,count:items.length,topSchool:d[0]?.name||'—',topRating:d[0]?.rating??null,median:median(values),top5:average(values.slice(0,5)),top25:average(values.slice(0,n))};});}

  async function fetchAllMatches(){let from=0,all=[];while(true){const {data,error}=await state.client.from('matches').select('id,date,tournament,stage,team_a,pref_a,score_a,team_b,pref_b,score_b,k,source_url,created_at').order('date',{ascending:true}).order('created_at',{ascending:true}).range(from,from+PAGE_SIZE-1);if(error)throw error;all.push(...(data||[]));if(!data||data.length<PAGE_SIZE)break;from+=PAGE_SIZE;}return all;}
  async function loadMatches(){if(!state.client)return;setDataStatus('読み込み中…');try{state.matches=await fetchAllMatches();const r=buildRatings(state.matches);state.schoolMap=r.map;state.schools=r.schools;state.ranking=r.publicSchools;state.prefs=buildPrefStats(r.schools);state.ready=true;setDataStatus(`${state.matches.length}試合`);renderAll();}catch(e){console.error(e);setDataStatus('読込エラー');showSetupNotice(`Supabaseから試合データを取得できませんでした。<br><code>${escapeHtml(e.message)}</code>`);}}
  function setDataStatus(t){els.dataStatus.textContent=t;}
  function showSetupNotice(h){els.setupNotice.innerHTML=h;els.setupNotice.classList.remove('hidden');}
  function hideSetupNotice(){els.setupNotice.classList.add('hidden');els.setupNotice.innerHTML='';}
  function isAdmin(){return Boolean(state.session?.user);}
  function ratingVisibleSchools(){return isAdmin()?state.schools:state.ranking;}
  function canViewSchoolRating(school){return Boolean(school)&&(isAdmin()||school.rating>=PUBLIC_RATING_MIN);}
  function renderAll(){hideSetupNotice();renderSummary();renderPrefFilter();renderRanking();renderPrefCards();renderSchoolSelect();renderSchoolProfile();renderRankCompareSelected();renderRankCompareChart();renderAdminMatches();}
  function renderSummary(){els.matchCount.textContent=state.matches.length.toLocaleString('ja-JP');els.schoolCount.textContent=state.schools.filter(s=>!s.isJoint).length.toLocaleString('ja-JP');els.prefCount.textContent=state.prefs.length.toLocaleString('ja-JP');els.latestMatchDate.textContent=state.matches.map(m=>m.date).filter(Boolean).sort().at(-1)||'—';}
  function renderPrefFilter(){
    const old=els.prefFilter.value,source=ratingVisibleSchools(),special=['東北','関東','中部','関西','中国','四国','九州・沖縄','東京','東東京','西東京','北海道','南北海道','北北海道'];
    const prefs=[...new Set(source.map(s=>s.pref).filter(Boolean))].filter(p=>!special.includes(p)).sort((a,b)=>a.localeCompare(b,'ja'));
    const options=[...special,...prefs];
    els.prefFilter.innerHTML='<option value="">すべて</option>'+options.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if(options.includes(old))els.prefFilter.value=old;
  }
  function renderRanking(){const q=normalizeSearchText(els.searchInput.value),p=els.prefFilter.value,source=ratingVisibleSchools();let rows=source.filter(s=>schoolMatchesSearch(s,q)&&schoolMatchesArea(s,p));const filtered=Boolean(q||p),total=rows.length;if(!filtered)rows=rows.slice(0,rankingLimit);els.rankingBody.innerHTML=rows.length?rows.map(s=>`<tr class="js-ranking-school"><td>${isAdmin()?s.allRank:s.publicRank}</td><td><strong>${escapeHtml(s.name)}</strong>${s.isJoint?' <span class="joint-badge">合同</span>':''}</td><td>${escapeHtml(s.pref)}</td><td class="rating-cell">${formatRating(s.rating)}</td><td class="${deltaClass(s.lastDelta)}">${formatDelta(s.lastDelta)}</td><td>${s.form.split('').map(r=>`<span class="match-result-${r}">${r}</span>`).join(' ')||'—'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">該当する学校がありません。</td></tr>';els.rankingFootnote.textContent=isAdmin()?(filtered?`管理者表示：該当 ${total}チーム。1500未満も表示しています。`:`管理者表示：全校を対象に上位${Math.min(total,rankingLimit)}チームを表示しています。`):(filtered?`${total}チームを表示しています。Rating ${PUBLIC_RATING_MIN}以上のみRating検索対象です。`:`Rating ${PUBLIC_RATING_MIN}以上の上位${Math.min(total,rankingLimit)}チームを表示しています。`);els.rankingBody.querySelectorAll('.js-ranking-school').forEach((r,i)=>r.onclick=()=>openSchool(rows[i].key,true));}
  function renderPrefCards(){const mode=els.prefSort?.value||'top25';const data=[...state.prefs].sort((a,b)=>(b[mode]??-Infinity)-(a[mode]??-Infinity)||(b.topRating??0)-(a.topRating??0));els.prefCards.innerHTML=data.length?data.map((x,i)=>`<article class="pref-card"><h3>${i+1}. ${escapeHtml(x.pref)} <span>${x.count}校</span></h3><div class="pref-metrics"><div class="${mode==='topRating'?'metric-active':''}"><span>県内1位 ${escapeHtml(x.topSchool)}</span><strong>${formatRating(x.topRating)}</strong></div><div class="${mode==='median'?'metric-active':''}"><span>中央値</span><strong>${formatRating(x.median)}</strong></div><div class="${mode==='top5'?'metric-active':''}"><span>上位5校平均</span><strong>${formatRating(x.top5)}</strong></div><div class="${mode==='top25'?'metric-active':''}"><span>上位25%平均</span><strong>${formatRating(x.top25)}</strong></div></div></article>`).join(''):'<div class="empty">データがありません。</div>';}

  function renderSchoolSelect(){const previous=state.selectedSchoolKey||els.schoolSelect.value,source=ratingVisibleSchools();els.schoolSelect.innerHTML=`<option value="">${isAdmin()?'全校から選択（管理者）':'Rating 1500以上から選択'}</option>`+source.map(s=>`<option value="${escapeHtml(s.key)}">${escapeHtml(s.name)}（${escapeHtml(s.pref)}）${isAdmin()&&s.rating<PUBLIC_RATING_MIN?' · '+formatRating(s.rating):''}</option>`).join('');if(source.some(s=>s.key===previous))els.schoolSelect.value=previous;}
  function renderSchoolSearch(){const q=normalizeSearchText(els.schoolSearch.value);if(!q){state.schoolSearchHits=[];els.schoolSearchResults.classList.add('hidden');els.schoolSearchResults.innerHTML='';return;}const source=ratingVisibleSchools(),hits=source.filter(s=>schoolMatchesSearch(s,q)).slice(0,20);state.schoolSearchHits=hits;els.schoolSearchResults.innerHTML=hits.length?hits.map(s=>`<button class="school-search-item" type="button"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · Rating ${formatRating(s.rating)}${isAdmin()&&s.rating<PUBLIC_RATING_MIN?' · 管理者表示':''}</span></button>`).join(''):`<div class="school-search-empty">${isAdmin()?'該当する学校がありません。':`Rating ${PUBLIC_RATING_MIN}以上のRating検索対象に該当しません。下の戦績検索では全校を検索できます。`}</div>`;els.schoolSearchResults.classList.remove('hidden');els.schoolSearchResults.querySelectorAll('.school-search-item').forEach((b,i)=>b.onclick=()=>selectSchoolSearchHit(i));}
  function renderRecordSchoolSearch(){const q=normalizeSearchText(els.recordSchoolSearch?.value);if(!els.recordSchoolSearchResults)return;if(!q){state.recordSearchHits=[];els.recordSchoolSearchResults.classList.add('hidden');els.recordSchoolSearchResults.innerHTML='';return;}const hits=state.schools.filter(s=>schoolMatchesSearch(s,q)).slice(0,30);state.recordSearchHits=hits;els.recordSchoolSearchResults.innerHTML=hits.length?hits.map(s=>`<button class="school-search-item" type="button"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · ${s.games.length}試合${canViewSchoolRating(s)?` · Rating ${formatRating(s.rating)}`:' · Rating非公開'}</span></button>`).join(''):'<div class="school-search-empty">該当する学校がありません。</div>';els.recordSchoolSearchResults.classList.remove('hidden');els.recordSchoolSearchResults.querySelectorAll('.school-search-item').forEach((b,i)=>b.onclick=()=>selectRecordSearchHit(i));}
  function selectRecordSearchHit(index){const school=state.recordSearchHits[index];if(!school)return;openSchool(school.key,true);els.recordSchoolSearch.value='';state.recordSearchHits=[];els.recordSchoolSearchResults.classList.add('hidden');}
  function selectSchoolSearchHit(index){const school=state.schoolSearchHits[index];if(!school)return;openSchool(school.key,true);els.schoolSearch.value='';state.schoolSearchHits=[];els.schoolSearchResults.classList.add('hidden');}
  function resolveSchool(key){if(!key)return null;if(state.schoolMap.has(key))return state.schoolMap.get(key);const raw=String(key);try{const parts=raw.split('::');if(parts.length===2){const normalized=schoolKey(decodeURIComponent(parts[1]),decodeURIComponent(parts[0]));if(state.schoolMap.has(normalized))return state.schoolMap.get(normalized);}}catch(_e){}return state.schools.find(s=>s.key===raw)||null;}
  function openSchool(key,scroll=false){const school=resolveSchool(key);if(!school)return;state.selectedSchoolKey=school.key;if(state.ranking.some(s=>s.key===school.key))els.schoolSelect.value=school.key;else els.schoolSelect.value='';renderSchoolProfile();if(scroll){const target=document.querySelector('#schools');if(target)requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'start'}));}}
  function renderSchoolProfile(){const school=state.schoolMap.get(state.selectedSchoolKey)||state.schoolMap.get(els.schoolSelect.value)||ratingVisibleSchools()[0]||state.schools[0];if(!school){els.schoolName.textContent='試合データがありません';els.historyChart.innerHTML='';els.recentMatches.innerHTML='<div class="empty">試合データがありません。</div>';return;}state.selectedSchoolKey=school.key;els.schoolPref.textContent=school.pref;els.schoolName.textContent=school.name;els.schoolRecord.textContent=`${school.games.length}試合 ${school.wins}勝 ${school.losses}敗 ${school.draws}分${school.isJoint?' · 合同チーム':''}`;const ratingVisible=canViewSchoolRating(school);els.schoolRating.textContent=ratingVisible?formatRating(school.rating):'非公開';els.schoolRank.textContent=ratingVisible?`${isAdmin()?school.allRank:school.publicRank}位`:'—';if(els.schoolPrefRank)els.schoolPrefRank.textContent=ratingVisible&&school.prefRank?`${school.prefRank}位`:'—';els.schoolDelta.textContent=ratingVisible?formatDelta(school.lastDelta):'—';els.schoolDelta.className=ratingVisible?deltaClass(school.lastDelta):'';els.schoolForm.innerHTML=school.form.split('').map(r=>`<span class="match-result-${r}">${r}</span>`).join(' ')||'—';renderHistoryChart(school.history,ratingVisible);renderMatchFilters(school.games);renderRecentMatches(school.games,ratingVisible);}
  function renderMatchFilters(games){if(!els.matchYearFilter)return;const old=els.matchYearFilter.value,years=[...new Set(games.map(g=>String(g.match.date||'').slice(0,4)).filter(Boolean))].sort().reverse();els.matchYearFilter.innerHTML='<option value="">全期間</option>'+years.map(y=>`<option value="${y}">${y}年</option>`).join('');if(years.includes(old))els.matchYearFilter.value=old;}
  function renderRecentMatches(games,publicRating=true){
    const year=els.matchYearFilter?.value||'';const list=[...games].filter(g=>!year||String(g.match.date).startsWith(year)).reverse();
    if(!list.length){els.recentMatches.innerHTML='<div class="empty">試合がありません。</div>';return;}
    els.recentMatches.innerHTML=list.map(game=>{const m=game.match,source=m.source_url?` · <a href="${escapeHtml(m.source_url)}" target="_blank" rel="noopener noreferrer">出典</a>`:'';return `<div class="match-row"><div class="match-meta">${escapeHtml(m.date)} · ${escapeHtml(m.tournament)} ${escapeHtml(m.stage||'')}${source} · K=${inferK(m)}</div><strong class="match-result-${game.result}">${escapeHtml(game.result)}　<button class="school-link js-open-opponent" type="button">${escapeHtml(game.opponent)}</button>　${game.scored} - ${game.allowed}</strong>${publicRating?`<div class="match-meta">${formatRating(game.before)} → ${formatRating(game.after)}（${formatDelta(game.delta)}）</div>`:''}<div class="match-actions">${state.session?.user?`<button class="btn secondary small js-edit-record" data-id="${escapeHtml(m.id)}" type="button">この戦績を編集</button>`:''}<button class="btn secondary small js-propose" data-id="${escapeHtml(m.id)}" type="button">修正を提案</button></div><div class="proposal-slot" data-proposal-slot="${escapeHtml(m.id)}"></div></div>`;}).join('');
    els.recentMatches.scrollTop=0;
    els.recentMatches.querySelectorAll('.js-open-opponent').forEach((b,i)=>b.onclick=()=>openSchool(list[i].opponentKey,false));
    els.recentMatches.querySelectorAll('.js-edit-record').forEach(b=>b.onclick=()=>startEdit(b.dataset.id));
    els.recentMatches.querySelectorAll('.js-propose').forEach(b=>b.onclick=()=>toggleProposalForm(b.dataset.id));
  }

  function parseLocalDate(date){const [y,m,d]=String(date||'').split('-').map(Number);return new Date(y,m-1,d);}
  function toDateString(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
  function latestDatasetDate(){const dates=state.matches.map(m=>m.date).filter(Boolean).sort();return dates.length?parseLocalDate(dates.at(-1)):new Date();}
  function historyWindow(history){
    const actual=[...history].filter(h=>h.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(!actual.length)return {points:[],actualCount:0,start:null,end:null};
    const end=latestDatasetDate();
    if(state.historyYears==='all'){
      const start=parseLocalDate(actual[0].date),points=actual.map(p=>({...p,synthetic:false}));
      const last=points.at(-1);
      if(parseLocalDate(last.date)<end)points.push({...last,date:toDateString(end),synthetic:true,opponent:null});
      return {points,actualCount:actual.length,start,end};
    }
    const years=Math.max(1,Number(state.historyYears)||1),start=new Date(end);start.setFullYear(start.getFullYear()-years);
    const inRange=actual.filter(p=>{const d=parseLocalDate(p.date);return d>=start&&d<=end;}).map(p=>({...p,synthetic:false}));
    const prior=[...actual].reverse().find(p=>parseLocalDate(p.date)<start);
    const points=[];
    if(prior)points.push({...prior,date:toDateString(start),synthetic:true,opponent:null});
    points.push(...inRange);
    if(points.length){const last=points.at(-1);if(parseLocalDate(last.date)<end)points.push({...last,date:toDateString(end),synthetic:true,opponent:null});}
    return {points,actualCount:inRange.length,start,end};
  }
  function renderHistoryChart(history,ratingVisible=true){
    if(!ratingVisible){els.historyChart.innerHTML='<text x="360" y="110" text-anchor="middle" class="chart-private">Rating 1500未満のため推移は非公開です</text>';if(els.historyRangeStatus)els.historyRangeStatus.textContent='戦績は下で閲覧できます。';return;}
    const windowData=historyWindow(history),h=windowData.points;
    if(els.historyRangeStatus){const label=state.historyYears==='all'?'全期間':`過去${state.historyYears}年`;els.historyRangeStatus.textContent=windowData.start&&windowData.end?`${label}：${toDateString(windowData.start)} ～ ${toDateString(windowData.end)}（期間内 ${windowData.actualCount}試合） · 横軸は試合間隔を均等化`:label;}
    if(!h.length){els.historyChart.innerHTML='<text x="360" y="110" text-anchor="middle" class="chart-private">この期間のRating履歴はありません</text>';return;}
    const width=720,height=240,padL=48,padR=18,padT=20,padB=42,vals=h.map(x=>x.rating),minV=Math.min(...vals),maxV=Math.max(...vals),spread=Math.max(20,maxV-minV),yMin=minV-spread*.18,yMax=maxV+spread*.18;
    const x=i=>h.length===1?(padL+width-padR)/2:padL+i/(h.length-1)*(width-padL-padR),y=v=>height-padB-(v-yMin)/(yMax-yMin)*(height-padT-padB);
    const grid=[0,.25,.5,.75,1].map(t=>{const v=yMax-(yMax-yMin)*t,yy=y(v);return `<line class="chart-axis" x1="${padL}" y1="${yy}" x2="${width-padR}" y2="${yy}"/><text class="chart-label" x="2" y="${yy+4}">${v.toFixed(0)}</text>`}).join('');
    const coords=h.map((p,i)=>[x(i),y(p.rating)]),pts=coords.map(c=>c.join(',')).join(' ');
    const baseline=height-padB,area=`${coords[0][0]},${baseline} ${pts} ${coords.at(-1)[0]},${baseline}`;
    const dots=h.map((p,i)=>p.synthetic?'':`<circle class="chart-dot" cx="${coords[i][0]}" cy="${coords[i][1]}" r="2.8"><title>${p.date} Rating ${formatRating(p.rating)}${p.opponent?` vs ${escapeHtml(p.opponent)}`:''}</title></circle>`).join('');
    const actualIndexes=h.map((p,i)=>p.synthetic?null:i).filter(i=>i!==null),labelIndexes=[0,Math.floor((h.length-1)/2),h.length-1].filter((v,i,a)=>a.indexOf(v)===i);
    const labels=labelIndexes.map((idx,i)=>`<text class="chart-date-label" x="${x(idx)}" y="${height-10}" text-anchor="${i===0?'start':i===labelIndexes.length-1?'end':'middle'}">${escapeHtml(h[idx].date)}</text>`).join('');
    els.historyChart.innerHTML=`${grid}<polygon class="chart-area" points="${area}" fill="var(--accent)"/><polyline class="chart-line" points="${pts}"/>${dots}${labels}`;
  }

  function ratingAtDate(school,dateString){
    const h=school?.history||[]; if(!h.length)return null; let lo=0,hi=h.length-1,ans=-1;
    while(lo<=hi){const mid=(lo+hi)>>1;if(String(h[mid].date)<=dateString){ans=mid;lo=mid+1;}else hi=mid-1;}
    return ans>=0?h[ans].rating:null;
  }
  function monthSnapshots(){
    const end=latestDatasetDate();let start;
    if(state.compareYears==='all'){const first=state.matches.map(m=>m.date).filter(Boolean).sort()[0];if(!first)return[];start=parseLocalDate(first);}
    else{start=new Date(end);start.setFullYear(start.getFullYear()-Math.max(1,Number(state.compareYears)||3));}
    const out=[],cursor=new Date(start.getFullYear(),start.getMonth(),1);
    while(cursor<=end){const monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,0),d=monthEnd>end?end:monthEnd;out.push(toDateString(d));cursor.setMonth(cursor.getMonth()+1);}
    if(out.at(-1)!==toDateString(end))out.push(toDateString(end));
    return [...new Set(out)];
  }
  function historicalRank(school,dateString){
    const target=ratingAtDate(school,dateString);if(target===null)return null;
    if(!isAdmin()&&target<PUBLIC_RATING_MIN)return null;
    let rank=1;
    for(const other of state.schools){const r=ratingAtDate(other,dateString);if(r===null)continue;if(!isAdmin()&&r<PUBLIC_RATING_MIN)continue;if(r>target+1e-9)rank++;else if(Math.abs(r-target)<=1e-9&&other.key<school.key)rank++;}
    return rank;
  }
  function renderRankCompareSearch(){
    if(!els.rankCompareSearch||!els.rankCompareSearchResults)return;const q=normalizeSearchText(els.rankCompareSearch.value);
    if(!q){state.rankCompareSearchHits=[];els.rankCompareSearchResults.innerHTML='';els.rankCompareSearchResults.classList.add('hidden');return;}
    const selected=new Set(state.compareSchoolKeys),source=ratingVisibleSchools();
    const hits=source.filter(s=>!selected.has(s.key)&&(schoolMatchesSearch(s,q))).slice(0,20);
    state.rankCompareSearchHits=hits;els.rankCompareSearchResults.innerHTML=hits.length?hits.map(s=>`<button class="school-search-item" type="button"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · ${isAdmin()&&s.rating<PUBLIC_RATING_MIN?`Rating ${formatRating(s.rating)} · 管理者表示`:`Rating ${formatRating(s.rating)}`}</span></button>`).join(''):'<div class="school-search-empty">該当する学校がありません。</div>';
    els.rankCompareSearchResults.classList.remove('hidden');els.rankCompareSearchResults.querySelectorAll('.school-search-item').forEach((b,i)=>b.onclick=()=>addRankCompareSchool(i));
  }
  function addRankCompareSchool(index){
    const s=state.rankCompareSearchHits[index];if(!s||state.compareSchoolKeys.includes(s.key))return;if(state.compareSchoolKeys.length>=4){if(els.rankCompareStatus)els.rankCompareStatus.textContent='比較できるのは最大4校です。';return;}
    state.compareSchoolKeys.push(s.key);els.rankCompareSearch.value='';state.rankCompareSearchHits=[];els.rankCompareSearchResults.innerHTML='';els.rankCompareSearchResults.classList.add('hidden');renderRankCompareSelected();renderRankCompareChart();
  }
  function removeRankCompareSchool(key){state.compareSchoolKeys=state.compareSchoolKeys.filter(k=>k!==key);renderRankCompareSelected();renderRankCompareChart();}
  function renderRankCompareSelected(){
    if(!els.rankCompareSelected)return;const allowed=new Set(ratingVisibleSchools().map(s=>s.key));state.compareSchoolKeys=state.compareSchoolKeys.filter(k=>allowed.has(k)).slice(0,4);
    const chosen=state.compareSchoolKeys.map(resolveSchool).filter(Boolean);
    els.rankCompareSelected.innerHTML=chosen.length?chosen.map((s,i)=>`<span class="rank-school-chip rank-chip-${i+1}"><span>${escapeHtml(s.name)}（${escapeHtml(s.pref)}）</span><button type="button" class="js-remove-rank-school" data-key="${escapeHtml(s.key)}" aria-label="${escapeHtml(s.name)}を比較から外す">×</button></span>`).join(''):'<span class="muted">学校名を検索して比較対象に追加してください。</span>';
    els.rankCompareSelected.querySelectorAll('.js-remove-rank-school').forEach(b=>b.onclick=()=>removeRankCompareSchool(b.dataset.key));
  }
  function renderRankCompareChart(){
    if(!els.rankCompareChart)return;const chosen=state.compareSchoolKeys.map(resolveSchool).filter(Boolean).filter((s,i,a)=>a.findIndex(x=>x.key===s.key)===i).slice(0,4);
    if(!chosen.length){els.rankCompareChart.innerHTML='<text x="450" y="170" text-anchor="middle" class="chart-private">学校名を検索して比較対象に追加してください</text>';els.rankCompareLegend.innerHTML='';if(els.rankCompareStatus)els.rankCompareStatus.textContent='';return;}
    const dates=monthSnapshots();if(!dates.length)return;const series=chosen.map(s=>({school:s,values:dates.map(d=>({date:d,rank:historicalRank(s,d)}))}));
    const ranks=series.flatMap(x=>x.values.map(v=>v.rank).filter(Number.isFinite));if(!ranks.length){els.rankCompareChart.innerHTML='<text x="450" y="170" text-anchor="middle" class="chart-private">この期間の公開順位データがありません</text>';els.rankCompareLegend.innerHTML='';return;}
    const width=900,height=360,padL=58,padR=24,padT=24,padB=48,maxRank=Math.max(5,Math.ceil(Math.max(...ranks)/5)*5),x=i=>dates.length===1?(padL+width-padR)/2:padL+i/(dates.length-1)*(width-padL-padR),y=r=>padT+(r-1)/(Math.max(1,maxRank-1))*(height-padT-padB);
    const yTicks=[1,Math.max(2,Math.round(maxRank*.25)),Math.max(3,Math.round(maxRank*.5)),Math.max(4,Math.round(maxRank*.75)),maxRank].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
    const grid=yTicks.map(r=>`<line class="rank-chart-grid" x1="${padL}" y1="${y(r)}" x2="${width-padR}" y2="${y(r)}"/><text class="rank-chart-label" x="${padL-8}" y="${y(r)+4}" text-anchor="end">${r}位</text>`).join('');
    const tickIdx=[0,Math.floor((dates.length-1)/4),Math.floor((dates.length-1)/2),Math.floor((dates.length-1)*3/4),dates.length-1].filter((v,i,a)=>a.indexOf(v)===i),xLabels=tickIdx.map(i=>`<text class="rank-chart-label" x="${x(i)}" y="${height-14}" text-anchor="middle">${dates[i].slice(0,7)}</text>`).join('');
    const lines=series.map((ser,si)=>{let chunks=[],cur=[];ser.values.forEach((v,i)=>{if(Number.isFinite(v.rank))cur.push([x(i),y(v.rank),v]);else if(cur.length){chunks.push(cur);cur=[];}});if(cur.length)chunks.push(cur);return chunks.map(chunk=>{const pts=chunk.map(c=>`${c[0]},${c[1]}`).join(' '),dots=chunk.map(c=>`<circle class="rank-dot-${si+1}" cx="${c[0]}" cy="${c[1]}" r="2.6"><title>${c[2].date} ${escapeHtml(ser.school.name)} ${c[2].rank}位</title></circle>`).join('');return `<polyline class="rank-line rank-line-${si+1}" points="${pts}"/>${dots}`;}).join('');}).join('');
    els.rankCompareChart.innerHTML=`${grid}${lines}${xLabels}<text class="rank-chart-label" x="14" y="18">上位</text>`;
    els.rankCompareLegend.innerHTML=series.map((ser,i)=>`<span class="rank-legend-item"><span class="rank-legend-swatch rank-legend-${i+1}"></span>${escapeHtml(ser.school.name)}（${escapeHtml(ser.school.pref)}）</span>`).join('');
    if(els.rankCompareStatus){const label=state.compareYears==='all'?'全期間':`過去${state.compareYears}年`;els.rankCompareStatus.textContent=`${label} · 月末時点の順位${isAdmin()?'（管理者：全校対象）':'（Rating 1500以上を対象）'}`;}
  }

  function toggleProposalForm(matchId){const slot=els.recentMatches.querySelector(`[data-proposal-slot="${CSS.escape(matchId)}"]`);if(!slot)return;if(slot.innerHTML){slot.innerHTML='';return;}slot.innerHTML=`<form class="proposal-form"><label>修正内容<select name="field"><option value="date">日付</option><option value="tournament">大会名</option><option value="stage">ラウンド</option><option value="team">学校名</option><option value="score">スコア</option><option value="other">その他</option></select></label><label>提案内容<textarea name="proposal" rows="3" required placeholder="正しい内容を具体的に入力してください"></textarea></label><label>出典URL（推奨）<input name="source" type="url" placeholder="https://..."></label><label>補足<textarea name="comment" rows="2"></textarea></label><div class="form-actions"><button class="btn primary small" type="submit">提案を送信</button><button class="btn secondary small js-cancel-proposal" type="button">閉じる</button></div><p class="form-message"></p></form>`;const form=slot.querySelector('form');slot.querySelector('.js-cancel-proposal').onclick=()=>slot.innerHTML='';form.onsubmit=async e=>{e.preventDefault();const msg=form.querySelector('.form-message'),fd=new FormData(form);msg.textContent='送信中…';const {error}=await state.client.from('correction_proposals').insert({match_id:matchId,field_name:fd.get('field'),proposed_value:String(fd.get('proposal')||'').trim(),source_url:String(fd.get('source')||'').trim()||null,comment:String(fd.get('comment')||'').trim()||null});if(error){msg.textContent=`送信できませんでした: ${error.message}`;msg.className='form-message error';}else{msg.textContent='修正提案を送信しました。ありがとうございます。';msg.className='form-message success';form.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);}};}

  async function loadProposals(){
    if(!state.client||!state.session?.user||!els.proposalAdminList)return;
    const {data,error}=await state.client.from('correction_proposals').select('id,match_id,field_name,proposed_value,source_url,comment,status,created_at').order('created_at',{ascending:false}).limit(100);
    if(error){els.proposalAdminList.innerHTML=`<div class="empty">提案を読み込めません: ${escapeHtml(error.message)}</div>`;return;}
    state.proposals=data||[]; renderAdminProposals();
  }
  function renderAdminProposals(){
    if(!els.proposalAdminList)return;
    if(!state.proposals.length){els.proposalAdminList.innerHTML='<div class="empty">提案はありません。</div>';return;}
    els.proposalAdminList.innerHTML=state.proposals.map(p=>{const m=state.matches.find(x=>x.id===p.match_id);const matchText=m?`${m.date} ${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b}`:`試合ID: ${p.match_id}`;return `<div class="proposal-admin-item"><div class="match-meta">${escapeHtml(matchText)} · ${escapeHtml(p.created_at||'')} · 状態: ${escapeHtml(p.status||'pending')}</div><strong>${escapeHtml(p.field_name)}: ${escapeHtml(p.proposed_value)}</strong>${p.comment?`<p>${escapeHtml(p.comment)}</p>`:''}${p.source_url?`<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener noreferrer">出典を開く</a>`:''}<div class="match-actions"><button class="btn secondary small js-proposal-edit" type="button" data-match="${escapeHtml(p.match_id)}">元試合を編集</button><button class="btn primary small js-proposal-resolve" type="button" data-id="${escapeHtml(p.id)}">対応済み</button><button class="btn secondary small js-proposal-dismiss" type="button" data-id="${escapeHtml(p.id)}">却下</button></div></div>`;}).join('');
    els.proposalAdminList.querySelectorAll('.js-proposal-edit').forEach(b=>b.onclick=()=>startEdit(b.dataset.match));
    els.proposalAdminList.querySelectorAll('.js-proposal-resolve').forEach(b=>b.onclick=()=>updateProposalStatus(b.dataset.id,'resolved'));
    els.proposalAdminList.querySelectorAll('.js-proposal-dismiss').forEach(b=>b.onclick=()=>updateProposalStatus(b.dataset.id,'dismissed'));
  }
  async function updateProposalStatus(id,status){const {error}=await state.client.from('correction_proposals').update({status}).eq('id',id);if(error)return alert(error.message);await loadProposals();}

  function renderSimulator(){const a=Number(els.ratingA.value),b=Number(els.ratingB.value),k=Number(els.kValue.value);if(![a,b,k].every(Number.isFinite)||k<=0){els.simResult.innerHTML='';return;}const e=expectation(a,b),w=k*(1-e),d=k*(.5-e),l=k*(0-e);els.simResult.innerHTML=`<div><span>A校の勝利期待値</span><strong>${(e*100).toFixed(1)}%</strong></div><div><span>A校が勝った場合</span><strong class="${deltaClass(w)}">${formatDelta(w)}</strong></div><div><span>引分 / 敗戦</span><strong>${formatDelta(d)} / ${formatDelta(l)}</strong></div>`;}

  async function restoreSession(){state.authMode=detectAuthModeFromUrl();const ae=getAuthErrorFromUrl();if(ae)showSetupNotice(`<strong>認証リンクを処理できませんでした。</strong> ${escapeHtml(ae)}`);state.client.auth.onAuthStateChange((event,session)=>{state.session=session;if(event==='PASSWORD_RECOVERY')state.authMode='recovery';else if(event==='SIGNED_IN'&&detectAuthModeFromUrl()==='invite')state.authMode='invite';renderAuth();if(state.ready)renderAll();});const {data,error}=await state.client.auth.getSession();if(!error){state.session=data.session;renderAuth();if(state.ready)renderAll();}}
  function renderAuth(){const signed=Boolean(state.session?.user),needs=signed&&(state.authMode==='invite'||state.authMode==='recovery');els.loginPanel.classList.toggle('hidden',signed||needs);els.resetRequestPanel.classList.add('hidden');els.passwordSetupPanel.classList.toggle('hidden',!needs);els.adminPanel.classList.toggle('hidden',!signed||needs);if(needs){const inv=state.authMode==='invite';els.passwordSetupTitle.textContent=inv?'初回パスワードを設定':'新しいパスワードを設定';els.passwordSetupDescription.textContent=inv?'招待が確認されました。今後の管理者ログインに使うパスワードを設定してください。':'新しいパスワードを設定してください。';return;}if(signed){els.adminEmail.textContent=state.session.user.email||state.session.user.id;renderAdminMatches();loadProposals();loadEditHistory();}}
  function setMessage(el,t,type=''){if(!el)return;el.textContent=t;el.className=`form-message${type?` ${type}`:''}`;}
  async function handleLogin(e){e.preventDefault();setMessage(els.loginMessage,'ログイン中…');const {error}=await state.client.auth.signInWithPassword({email:els.loginEmail.value.trim(),password:els.loginPassword.value});if(error)return setMessage(els.loginMessage,error.message,'error');state.authMode=null;clearAuthUrl();els.loginPassword.value='';setMessage(els.loginMessage,'');}
  function showResetRequest(){els.resetEmail.value=els.loginEmail.value.trim();els.loginPanel.classList.add('hidden');els.resetRequestPanel.classList.remove('hidden');}
  function backToLogin(){els.resetRequestPanel.classList.add('hidden');els.loginPanel.classList.remove('hidden');}
  async function handleResetRequest(e){e.preventDefault();setMessage(els.resetRequestMessage,'送信中…');const {error}=await state.client.auth.resetPasswordForEmail(els.resetEmail.value.trim(),{redirectTo:authRedirectUrl()});setMessage(els.resetRequestMessage,error?error.message:'再設定メールを送信しました。',error?'error':'success');}
  async function handlePasswordSetup(e){e.preventDefault();const p=els.newPassword.value,c=els.newPasswordConfirm.value;if(p.length<8)return setMessage(els.passwordSetupMessage,'パスワードは8文字以上にしてください。','error');if(p!==c)return setMessage(els.passwordSetupMessage,'確認用パスワードが一致しません。','error');const {error}=await state.client.auth.updateUser({password:p});if(error)return setMessage(els.passwordSetupMessage,error.message,'error');state.authMode=null;clearAuthUrl();renderAuth();}
  async function handleLogout(){const {error}=await state.client.auth.signOut();if(error)alert(error.message);state.authMode=null;}

  function duplicateSignature(match){
    const m=normalizeMatch(match),a=schoolKey(m.team_a,m.pref_a),b=schoolKey(m.team_b,m.pref_b);
    const left={key:a,score:Number(m.score_a)},right={key:b,score:Number(m.score_b)};const sides=a<=b?[left,right]:[right,left];
    return [String(m.date||''),sides[0].key,sides[0].score,sides[1].key,sides[1].score].join('|');
  }
  function findDuplicateGroups(matches=state.matches){
    const groups=new Map();for(const m of matches){const sig=duplicateSignature(m);if(!groups.has(sig))groups.set(sig,[]);groups.get(sig).push(m);}
    return [...groups.values()].filter(g=>g.length>1).sort((a,b)=>String(b[0]?.date||'').localeCompare(String(a[0]?.date||'')));
  }
  function findDuplicateForPayload(payload,excludeId=''){const sig=duplicateSignature(payload);return state.matches.find(m=>String(m.id)!==String(excludeId||'')&&duplicateSignature(m)===sig)||null;}
  function duplicateQuality(m){return (m.source_url?8:0)+(m.stage?3:0)+(m.k!==null&&m.k!==''?2:0)+(m.tournament_original&&m.tournament_original!==canonicalTournament(m.tournament_original)?0:1);}
  function duplicateKeeper(group){return [...group].sort((a,b)=>duplicateQuality(b)-duplicateQuality(a)||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)))[0];}
  function renderDuplicateMergeList(){
    if(!els.duplicateMergeList)return;
    if(!state.duplicateGroups.length){els.duplicateMergeList.innerHTML='<div class="empty">重複候補はありません。</div>';if(els.duplicateMergeButton)els.duplicateMergeButton.disabled=true;return;}
    els.duplicateMergeList.innerHTML=state.duplicateGroups.map((group,i)=>{const keep=duplicateKeeper(group);return `<label class="duplicate-group"><input class="js-merge-duplicate" type="checkbox" data-index="${i}"><span><strong>${escapeHtml(group[0].date)} ${escapeHtml(group[0].team_a_display||group[0].team_a)} ${group[0].score_a}-${group[0].score_b} ${escapeHtml(group[0].team_b_display||group[0].team_b)}</strong><small>${group.length}件重複 · 残す候補: ${escapeHtml(keep.tournament)}${keep.source_url?' · 出典あり':''}</small>${group.map(m=>`<code>${escapeHtml(m.tournament)} / ${escapeHtml(m.stage||'—')} / ${escapeHtml(String(m.id))}</code>`).join('')}</span></label>`;}).join('');
    if(els.duplicateMergeButton)els.duplicateMergeButton.disabled=false;
  }
  function updateDuplicateStatus(){
    state.duplicateGroups=findDuplicateGroups();const ids=new Set(state.duplicateGroups.flat().map(m=>String(m.id)));
    if(state.showDuplicatesOnly&&!ids.size)state.showDuplicatesOnly=false;
    if(els.duplicateStatus)els.duplicateStatus.textContent=state.duplicateGroups.length?`重複候補 ${state.duplicateGroups.length}組 / ${ids.size}件`:'重複候補なし';
    if(els.duplicateScanButton)els.duplicateScanButton.textContent=state.showDuplicatesOnly?'通常表示に戻す':'重複試合を検知';
    renderDuplicateMergeList();return ids;
  }
  function toggleDuplicateView(){state.showDuplicatesOnly=!state.showDuplicatesOnly;renderAdminMatches();}
  async function mergeCheckedDuplicates(){
    const checked=[...(els.duplicateMergeList?.querySelectorAll('.js-merge-duplicate:checked')||[])].map(x=>Number(x.dataset.index)).filter(Number.isInteger);
    if(!checked.length)return alert('統合する重複候補にチェックを入れてください。');
    if(!confirm(`${checked.length}組の重複を統合します。各組で情報が多い1件を残し、他を削除します。よろしいですか？`))return;
    els.duplicateMergeButton.disabled=true;els.duplicateMergeButton.textContent='統合中…';
    try{
      for(const idx of checked){const group=state.duplicateGroups[idx];if(!group?.length)continue;const keep=duplicateKeeper(group),others=group.filter(m=>String(m.id)!==String(keep.id));const merged={tournament:canonicalTournament(keep.tournament_original||keep.tournament),stage:keep.stage||others.find(x=>x.stage)?.stage||null,k:keep.k??others.find(x=>x.k!==null&&x.k!=='')?.k??null,source_url:keep.source_url||others.find(x=>x.source_url)?.source_url||null};const up=await state.client.from('matches').update(merged).eq('id',keep.id);if(up.error)throw up.error;const ids=others.map(x=>x.id);if(ids.length){const del=await state.client.from('matches').delete().in('id',ids);if(del.error)throw del.error;}}
      await loadMatches();await loadEditHistory();
    }catch(e){alert(`重複統合に失敗しました: ${e.message||e}`);}finally{els.duplicateMergeButton.disabled=false;els.duplicateMergeButton.textContent='チェックした重複を統合';}
  }

  function readMatchForm(){const kt=els.matchK.value.trim(),su=els.sourceUrl.value.trim();return{date:els.matchDate.value,tournament:canonicalTournament(els.tournament.value),stage:els.stage.value.trim()||null,team_a:els.teamA.value.trim(),pref_a:els.prefA.value.trim(),score_a:Number(els.scoreA.value),team_b:els.teamB.value.trim(),pref_b:els.prefB.value.trim(),score_b:Number(els.scoreB.value),k:kt?Number(kt):null,source_url:su||null};}
  function validateMatchPayload(p){if(!p.date)return'試合日を入力してください。';if(!p.tournament)return'大会名を入力してください。';if(!p.team_a||!p.team_b)return'両校の学校名を入力してください。';if(!p.pref_a||!p.pref_b)return'両校の都道府県を入力してください。';if(!Number.isInteger(p.score_a)||p.score_a<0||!Number.isInteger(p.score_b)||p.score_b<0)return'得点を確認してください。';if(schoolKey(p.team_a,p.pref_a)===schoolKey(p.team_b,p.pref_b))return'同じチーム同士の試合は登録できません。';return null;}
  async function handleMatchSubmit(e){e.preventDefault();if(!state.session?.user)return setMessage(els.matchFormMessage,'管理者ログインが必要です。','error');const p=readMatchForm(),ve=validateMatchPayload(p);if(ve)return setMessage(els.matchFormMessage,ve,'error');const id=els.editingMatchId.value;const dup=findDuplicateForPayload(p,id);if(dup)return setMessage(els.matchFormMessage,`重複の可能性が高い試合が既に登録されています：${dup.date} ${dup.team_a_display||dup.team_a} ${dup.score_a}-${dup.score_b} ${dup.team_b_display||dup.team_b}（${dup.tournament}）`,'error');setMessage(els.matchFormMessage,id?'更新中…':'登録中…');const r=id?await state.client.from('matches').update(p).eq('id',id):await state.client.from('matches').insert(p);if(r.error)return setMessage(els.matchFormMessage,r.error.message,'error');resetMatchForm();setMessage(els.matchFormMessage,id?'試合を更新しました。':'試合を登録しました。','success');await loadMatches();await loadEditHistory();}
  function resetMatchForm(){els.matchForm.reset();els.editingMatchId.value='';els.matchFormTitle.textContent='試合を登録';els.saveMatchButton.textContent='試合を登録';els.cancelEditButton.classList.add('hidden');els.matchDate.value=new Date().toISOString().slice(0,10);}
  function startEdit(id){const m=state.matches.find(x=>x.id===id);if(!m)return;els.editingMatchId.value=m.id;els.matchDate.value=m.date||'';els.tournament.value=m.tournament_original||m.tournament||'';els.stage.value=m.stage||'';els.teamA.value=m.team_a_display||m.team_a||'';els.prefA.value=m.pref_a||'';els.scoreA.value=m.score_a??'';els.teamB.value=m.team_b_display||m.team_b||'';els.prefB.value=m.pref_b||'';els.scoreB.value=m.score_b??'';els.matchK.value=m.k??'';els.sourceUrl.value=m.source_url||'';els.matchFormTitle.textContent='試合を編集';els.saveMatchButton.textContent='変更を保存';els.cancelEditButton.classList.remove('hidden');document.querySelector('#admin').scrollIntoView({behavior:'smooth'});}
  async function deleteMatch(id){const m=state.matches.find(x=>x.id===id);if(!m||!confirm(`${m.date} ${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b}\nこの試合を削除しますか？`))return;const {error}=await state.client.from('matches').delete().eq('id',id);if(error)return alert(error.message);await loadMatches();await loadEditHistory();}
  function normalizeSearchText(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
  function renderAdminMatches(){
    if(!els.adminMatchesBody||!state.session?.user){if(els.adminMatchesBody)els.adminMatchesBody.innerHTML='';if(els.adminMatchSearchStatus)els.adminMatchSearchStatus.textContent='';return;}
    const keyword=normalizeSearchText(els.adminMatchKeyword?.value);
    const date=String(els.adminMatchDate?.value||'').trim();
    const tournament=normalizeSearchText(els.adminMatchTournament?.value);
    const school=normalizeSearchText(els.adminMatchSchool?.value);
    const duplicateIds=updateDuplicateStatus();
    const active=Boolean(keyword||date||tournament||school||state.showDuplicatesOnly);
    let rows=[...state.matches].sort(compareMatches).reverse();
    if(state.showDuplicatesOnly)rows=rows.filter(m=>duplicateIds.has(String(m.id)));
    if(active){
      rows=rows.filter(m=>{
        const teamA=normalizeSearchText(m.team_a_display||m.team_a), teamB=normalizeSearchText(m.team_b_display||m.team_b);
        const prefA=normalizeSearchText(m.pref_a), prefB=normalizeSearchText(m.pref_b);
        const tour=normalizeSearchText(m.tournament), stage=normalizeSearchText(m.stage);
        const haystack=normalizeSearchText([m.date,m.tournament,m.stage,m.team_a_display||m.team_a,m.pref_a,m.score_a,m.team_b_display||m.team_b,m.pref_b,m.score_b,m.source_url].join(' '));
        return (!date||m.date===date)
          &&(!tournament||tour.includes(tournament)||stage.includes(tournament))
          &&(!school||teamA.includes(school)||teamB.includes(school)||prefA.includes(school)||prefB.includes(school))
          &&(!keyword||haystack.includes(keyword));
      });
    }
    const total=rows.length, limit=active?200:100, shown=rows.slice(0,limit);
    if(els.adminMatchSearchStatus)els.adminMatchSearchStatus.textContent=state.showDuplicatesOnly?`重複候補 ${total.toLocaleString('ja-JP')}件を表示中`:active?`該当 ${total.toLocaleString('ja-JP')}試合${total>limit?`（先頭${limit}件を表示）`:''}`:`最新${Math.min(total,limit).toLocaleString('ja-JP')}試合を表示`;
    els.adminMatchesBody.innerHTML=shown.length?shown.map(m=>`<tr><td>${escapeHtml(m.date)}${duplicateIds.has(String(m.id))?' <span class="duplicate-badge">重複候補</span>':''}</td><td>${escapeHtml(m.tournament)}${m.stage?`<br><span class="muted">${escapeHtml(m.stage)}</span>`:''}</td><td>${escapeHtml(m.team_a_display||m.team_a)} ${m.score_a} - ${m.score_b} ${escapeHtml(m.team_b_display||m.team_b)}</td><td><div class="action-buttons"><button class="btn secondary small js-edit" data-id="${escapeHtml(m.id)}" type="button">編集</button><button class="btn danger small js-delete" data-id="${escapeHtml(m.id)}" type="button">削除</button></div></td></tr>`).join(''):'<tr><td colspan="4" class="empty">該当する試合がありません。</td></tr>';
    els.adminMatchesBody.querySelectorAll('.js-edit').forEach(b=>b.onclick=()=>startEdit(b.dataset.id));
    els.adminMatchesBody.querySelectorAll('.js-delete').forEach(b=>b.onclick=()=>deleteMatch(b.dataset.id));
  }
  function clearAdminMatchSearch(){
    [els.adminMatchKeyword,els.adminMatchTournament,els.adminMatchSchool].forEach(x=>{if(x)x.value='';});
    if(els.adminMatchDate)els.adminMatchDate.value='';state.showDuplicatesOnly=false;
    renderAdminMatches();
  }

  async function normalizeTournamentNames(){
    if(!state.session?.user)return;const changes=state.matches.map(m=>({id:m.id,from:m.tournament_original||m.tournament,to:canonicalTournament(m.tournament_original||m.tournament)})).filter(x=>x.from&&x.to&&x.from!==x.to);
    if(!changes.length){if(els.normalizeTournamentStatus)els.normalizeTournamentStatus.textContent='表記揺れは見つかりませんでした。';return;}
    if(!confirm(`${changes.length}試合の大会名を標準表記へ変更します。編集履歴に記録されます。よろしいですか？`))return;
    els.normalizeTournamentButton.disabled=true;if(els.normalizeTournamentStatus)els.normalizeTournamentStatus.textContent='修正中…';
    try{for(const c of changes){const {error}=await state.client.from('matches').update({tournament:c.to}).eq('id',c.id);if(error)throw error;}if(els.normalizeTournamentStatus)els.normalizeTournamentStatus.textContent=`${changes.length}試合を標準表記へ修正しました。`;await loadMatches();await loadEditHistory();}catch(e){if(els.normalizeTournamentStatus)els.normalizeTournamentStatus.textContent=`失敗: ${e.message||e}`;}finally{els.normalizeTournamentButton.disabled=false;}
  }
  async function loadEditHistory(){
    if(!state.client||!state.session?.user||!els.editHistoryList)return;const {data,error}=await state.client.from('match_edit_history').select('id,match_id,action,old_data,new_data,changed_by,changed_at').order('changed_at',{ascending:false}).limit(100);if(error){els.editHistoryList.innerHTML=`<div class="empty">編集履歴を読み込めません: ${escapeHtml(error.message)}</div>`;return;}state.editHistory=data||[];renderEditHistory();
  }
  function historyMatchLabel(row){const d=row.new_data||row.old_data||{};return `${d.date||'—'} ${d.team_a||'—'} ${d.score_a??'—'}-${d.score_b??'—'} ${d.team_b||'—'}`;}
  function renderEditHistory(){if(!els.editHistoryList)return;if(!state.editHistory.length){els.editHistoryList.innerHTML='<div class="empty">編集履歴はありません。</div>';return;}els.editHistoryList.innerHTML=state.editHistory.map(h=>{const old=h.old_data||{},nw=h.new_data||{},fields=['date','tournament','stage','team_a','pref_a','score_a','team_b','pref_b','score_b','k','source_url'];const changed=h.action==='UPDATE'?fields.filter(f=>JSON.stringify(old[f]??null)!==JSON.stringify(nw[f]??null)).map(f=>`${f}: ${old[f]??'—'} → ${nw[f]??'—'}`).join(' / '):h.action==='DELETE'?'削除':'新規登録';return `<div class="edit-history-item"><div class="match-meta">${escapeHtml(h.changed_at||'')} · ${escapeHtml(h.action)}</div><strong>${escapeHtml(historyMatchLabel(h))}</strong><p>${escapeHtml(changed||'変更内容なし')}</p></div>`;}).join('');}

  function bindEvents(){els.searchInput.addEventListener('input',renderRanking);els.prefFilter.addEventListener('change',renderRanking);els.prefSort?.addEventListener('change',renderPrefCards);els.schoolSearch?.addEventListener('input',renderSchoolSearch);els.schoolSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.schoolSearchHits.length){e.preventDefault();selectSchoolSearchHit(0);}});els.recordSchoolSearch?.addEventListener('input',renderRecordSchoolSearch);els.recordSchoolSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.recordSearchHits.length){e.preventDefault();selectRecordSearchHit(0);}});els.schoolSelect.addEventListener('change',()=>{state.selectedSchoolKey=els.schoolSelect.value;renderSchoolProfile();});els.historyRange?.addEventListener('click',e=>{const b=e.target.closest('[data-years]');if(!b)return;state.historyYears=b.dataset.years;els.historyRange.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderSchoolProfile();});els.matchYearFilter?.addEventListener('change',()=>renderSchoolProfile());els.rankCompareSearch?.addEventListener('input',renderRankCompareSearch);els.rankCompareSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.rankCompareSearchHits.length){e.preventDefault();addRankCompareSchool(0);}});els.rankCompareRange?.addEventListener('click',e=>{const b=e.target.closest('[data-years]');if(!b)return;state.compareYears=b.dataset.years;els.rankCompareRange.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderRankCompareChart();});[els.ratingA,els.ratingB,els.kValue].forEach(i=>i.addEventListener('input',renderSimulator));els.loginForm.addEventListener('submit',handleLogin);els.showResetButton.addEventListener('click',showResetRequest);els.resetRequestForm.addEventListener('submit',handleResetRequest);els.backToLoginButton.addEventListener('click',backToLogin);els.passwordSetupForm.addEventListener('submit',handlePasswordSetup);els.logoutButton.addEventListener('click',handleLogout);els.matchForm.addEventListener('submit',handleMatchSubmit);els.cancelEditButton.addEventListener('click',resetMatchForm);els.reloadButton.addEventListener('click',loadMatches);[els.adminMatchKeyword,els.adminMatchTournament,els.adminMatchSchool].forEach(x=>x?.addEventListener('input',renderAdminMatches));els.adminMatchDate?.addEventListener('change',renderAdminMatches);els.adminMatchClear?.addEventListener('click',clearAdminMatchSearch);els.duplicateScanButton?.addEventListener('click',toggleDuplicateView);els.duplicateMergeButton?.addEventListener('click',mergeCheckedDuplicates);els.normalizeTournamentButton?.addEventListener('click',normalizeTournamentNames);els.reloadProposalsButton?.addEventListener('click',loadProposals);els.reloadHistoryButton?.addEventListener('click',loadEditHistory);document.addEventListener('click',e=>{if(els.schoolSearchResults&&!e.target.closest('.school-search-wrap'))els.schoolSearchResults.classList.add('hidden');if(els.recordSchoolSearchResults&&!e.target.closest('.record-school-search-wrap'))els.recordSchoolSearchResults.classList.add('hidden');if(els.rankCompareSearchResults&&!e.target.closest('.rank-compare-search-wrap'))els.rankCompareSearchResults.classList.add('hidden');});}

  function renderStaticConfig(){els.heroInitial.textContent=ratingCfg.initial;els.heroDivisor.textContent=ratingCfg.divisor;els.heroK.textContent='10 / 15 / 20 / 25';els.heroFormula.textContent="R' = R + K × (W − We)";els.kValue.value=ratingCfg.defaultK;if(els.methodKText)els.methodKText.textContent='K値：夏の甲子園25、春の甲子園・明治神宮大会20、春季・秋季の地区大会と国民スポーツ大会15、春季・秋季の都道府県大会・県予選など地方予選10。';}
  async function init(){bindEvents();renderStaticConfig();renderSimulator();resetMatchForm();if(!isConfigReady()){setDataStatus('要設定');showSetupNotice('<strong>Supabaseの接続情報が未設定です。</strong> config.js を設定してください。');els.loginPanel.classList.add('hidden');els.adminUnavailable.textContent='config.jsを設定すると利用できます。';els.adminUnavailable.classList.remove('hidden');return;}state.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);els.adminUnavailable.classList.add('hidden');await Promise.all([restoreSession(),loadMatches()]);}
  init().catch(e=>{console.error(e);setDataStatus('エラー');showSetupNotice(`<code>${escapeHtml(e.message||e)}</code>`);});
})();
