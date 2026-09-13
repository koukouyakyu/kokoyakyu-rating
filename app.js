(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const ratingCfg = {
    initial: Number(cfg.rating?.initial ?? 1500),
    divisor: Number(cfg.rating?.divisor ?? 600),
    defaultK: Number(cfg.rating?.defaultK ?? 20) === 10 ? 20 : Number(cfg.rating?.defaultK ?? 20),
    tournamentK: cfg.rating?.tournamentK || {}
  };
  const PUBLIC_RATING_MIN = Number(cfg.publicRatingMin ?? 1500);
  const PAGE_SIZE = 1000;
  const DEFAULT_SITE_SETTINGS = Object.freeze({
    id: 1,
    public_k_values: true, public_ranking: true, public_prefectures: true, public_school_details: true,
    public_record_search: true, public_rating_history: true, public_rank_compare: true, public_simulator: true,
    public_correction_proposals: true, public_methodology: true,
    new_team_retention_rate: 0.85
  });
  const TOURNAMENT_TYPES = Object.freeze({
    autumn_qualifier: {label:'秋季大会予選', k:20},
    autumn_regional: {label:'秋季大会地区大会', k:30},
    meiji_jingu: {label:'明治神宮大会', k:40},
    spring_koshien_early: {label:'春の甲子園 1回戦〜準々決勝', k:40},
    spring_koshien_final: {label:'春の甲子園 準決勝・決勝', k:40},
    spring_qualifier: {label:'春季大会予選', k:20},
    spring_regional: {label:'春季大会地区大会', k:30},
    summer_qualifier: {label:'夏の甲子園予選', k:20},
    summer_main_early: {label:'夏の甲子園本戦 1回戦〜準々決勝', k:50},
    summer_main_final: {label:'夏の甲子園本戦 準決勝・決勝', k:50},
    kokuspo: {label:'国民スポーツ大会', k:30}
  });
  const DEFAULT_K_SETTINGS = Object.freeze(Object.fromEntries(
    Object.entries(TOURNAMENT_TYPES).map(([type,meta])=>[type,meta.k])
  ));

  const state = {
    client: null, session: null, authMode: null, matches: [], schools: [], schoolMap: new Map(),
    ranking: [], prefs: [], proposals: [], editHistory: [], schoolAliases: [], schoolAliasMap: new Map(), schoolMasters: [], schoolMasterById: new Map(), schoolNameMap: new Map(), aliasSuggestions: [], aliasesAvailable: true, schoolMasterAvailable: true, schoolVariantAvailable: true, ready: false, historyYears: '1', compareStartDate: '', compareEndDate: '', rankingDate: '', rankingDateIsLatest: true, selectedSchoolKey: null, schoolSearchHits: [], recordSearchHits: [], compareSchoolKeys: [], rankCompareSearchHits: [], showDuplicatesOnly: false, duplicateGroups: [], prefExpanded: false, rankingPage: 1, rankingPageSize: 20, rankSnapshotCache: new Map(), historicalRankingCache: new Map(), deferredRenderHandle: null, duplicateCacheDirty: true, matchSortCache: null,
    settings: {...DEFAULT_SITE_SETTINGS}, settingsAvailable: true,
    kSettings: {...DEFAULT_K_SETTINGS}, kSettingsAvailable: true, missingTournamentTypeCount: 0,
    mergeProposalAKey: null, mergeProposalBKey: null, mergeProposalAHits: [], mergeProposalBHits: [], mergeProposalAvailable: true, correctionProposalAvailable: true, resultProposalMatchId: null, resultProposalHits: [],
    selectedRankingPrefs: new Set(), editingSchoolAliasId: null, tournamentAliases: [], tournamentAliasesAvailable: true, tournamentAliasMap: new Map(), editingTournamentAliasId: null
  };
  const $ = (id) => document.getElementById(id);
  const els = {
    dataStatus:$('dataStatus'), setupNotice:$('setupNotice'), searchInput:$('searchInput'), rankingPrefChooser:$('rankingPrefChooser'), rankingPrefSummary:$('rankingPrefSummary'), rankingPrefOptions:$('rankingPrefOptions'), rankingPrefClear:$('rankingPrefClear'), ratingMinFilter:$('ratingMinFilter'), ratingMaxFilter:$('ratingMaxFilter'), rankingDate:$('rankingDate'), rankingDateLatest:$('rankingDateLatest'), rankingPageSize:$('rankingPageSize'), rankingPrev:$('rankingPrev'), rankingNext:$('rankingNext'), rankingPageNumbers:$('rankingPageNumbers'), rankingPageStatus:$('rankingPageStatus'),
    rankingBody:$('rankingBody'), rankingFootnote:$('rankingFootnote'), matchCount:$('matchCount'), schoolCount:$('schoolCount'),
    prefCount:$('prefCount'), latestMatchDate:$('latestMatchDate'), prefCards:$('prefCards'), prefSort:$('prefSort'), prefShowMoreButton:$('prefShowMoreButton'),
    schoolSearch:$('schoolSearch'), schoolSearchResults:$('schoolSearchResults'), recordSchoolSearch:$('recordSchoolSearch'), recordSchoolSearchResults:$('recordSchoolSearchResults'), schoolSelect:$('schoolSelect'), schoolPref:$('schoolPref'),
    schoolName:$('schoolName'), schoolRecord:$('schoolRecord'), schoolRating:$('schoolRating'), schoolRank:$('schoolRank'), schoolPrefRank:$('schoolPrefRank'),
    schoolDelta:$('schoolDelta'), schoolForm:$('schoolForm'), historyChart:$('historyChart'), recentMatches:$('recentMatches'),
    historyRange:$('historyRange'), historyRangeStatus:$('historyRangeStatus'), matchYearFilter:$('matchYearFilter'),
    publicCorrectionProposal:$('publicCorrectionProposal'), schoolMergeProposalForm:$('schoolMergeProposalForm'), schoolMergeProposalType:$('schoolMergeProposalType'),
    mergeProposalSchoolA:$('mergeProposalSchoolA'), mergeProposalSchoolAResults:$('mergeProposalSchoolAResults'), mergeProposalSchoolASelected:$('mergeProposalSchoolASelected'),
    mergeProposalSchoolB:$('mergeProposalSchoolB'), mergeProposalSchoolBResults:$('mergeProposalSchoolBResults'), mergeProposalSchoolBSelected:$('mergeProposalSchoolBSelected'),
    schoolMergeProposalSubmit:$('schoolMergeProposalSubmit'), schoolMergeProposalClear:$('schoolMergeProposalClear'), schoolMergeProposalMessage:$('schoolMergeProposalMessage'), schoolMergeProposalFields:$('schoolMergeProposalFields'), matchResultProposalFields:$('matchResultProposalFields'), resultProposalMatchSearch:$('resultProposalMatchSearch'), resultProposalMatchResults:$('resultProposalMatchResults'), resultProposalMatchSelected:$('resultProposalMatchSelected'), resultProposalScoreA:$('resultProposalScoreA'), resultProposalScoreB:$('resultProposalScoreB'), resultProposalSourceUrl:$('resultProposalSourceUrl'), resultProposalComment:$('resultProposalComment'),
    rankCompareSearch:$('rankCompareSearch'), rankCompareSearchResults:$('rankCompareSearchResults'), rankCompareSelected:$('rankCompareSelected'), rankCompareStartDate:$('rankCompareStartDate'), rankCompareEndDate:$('rankCompareEndDate'), rankCompareAllRange:$('rankCompareAllRange'), rankCompareStatus:$('rankCompareStatus'), rankCompareChart:$('rankCompareChart'), rankCompareTooltip:$('rankCompareTooltip'), rankCompareLegend:$('rankCompareLegend'),
    ratingA:$('ratingA'), ratingB:$('ratingB'), kValue:$('kValue'), simResult:$('simResult'), adminUnavailable:$('adminUnavailable'),
    loginPanel:$('loginPanel'), loginForm:$('loginForm'), loginEmail:$('loginEmail'), loginPassword:$('loginPassword'), loginMessage:$('loginMessage'),
    showResetButton:$('showResetButton'), resetRequestPanel:$('resetRequestPanel'), resetRequestForm:$('resetRequestForm'), resetEmail:$('resetEmail'),
    resetRequestMessage:$('resetRequestMessage'), backToLoginButton:$('backToLoginButton'), passwordSetupPanel:$('passwordSetupPanel'),
    passwordSetupTitle:$('passwordSetupTitle'), passwordSetupDescription:$('passwordSetupDescription'), passwordSetupForm:$('passwordSetupForm'),
    newPassword:$('newPassword'), newPasswordConfirm:$('newPasswordConfirm'), passwordSetupMessage:$('passwordSetupMessage'),
    adminPanel:$('adminPanel'), adminEmail:$('adminEmail'), logoutButton:$('logoutButton'), matchForm:$('matchForm'), matchFormTitle:$('matchFormTitle'),
    editingMatchId:$('editingMatchId'), matchDate:$('matchDate'), tournament:$('tournament'), tournamentType:$('tournamentType'), stage:$('stage'), teamA:$('teamA'), prefA:$('prefA'),
    scoreA:$('scoreA'), teamB:$('teamB'), prefB:$('prefB'), scoreB:$('scoreB'), matchK:$('matchK'), sourceUrl:$('sourceUrl'),
    saveMatchButton:$('saveMatchButton'), cancelEditButton:$('cancelEditButton'), matchFormMessage:$('matchFormMessage'), adminMatchesBody:$('adminMatchesBody'),
    adminMatchKeyword:$('adminMatchKeyword'), adminMatchDate:$('adminMatchDate'), adminMatchTournament:$('adminMatchTournament'), adminMatchSchool:$('adminMatchSchool'),
    adminMatchSearchStatus:$('adminMatchSearchStatus'), adminMatchClear:$('adminMatchClear'), duplicateStatus:$('duplicateStatus'), duplicateScanButton:$('duplicateScanButton'),
    reloadButton:$('reloadButton'), reloadProposalsButton:$('reloadProposalsButton'), proposalAdminList:$('proposalAdminList'), duplicateMergeList:$('duplicateMergeList'), duplicateSelectAll:$('duplicateSelectAll'), duplicateMergeButton:$('duplicateMergeButton'), normalizeTournamentButton:$('normalizeTournamentButton'), normalizeTournamentStatus:$('normalizeTournamentStatus'), aliasPref:$('aliasPref'), aliasNamesContainer:$('aliasNamesContainer'), aliasAddNameButton:$('aliasAddNameButton'), aliasCanonical:$('aliasCanonical'), aliasAddButton:$('aliasAddButton'), aliasCancelEditButton:$('aliasCancelEditButton'), aliasRefreshButton:$('aliasRefreshButton'), aliasMessage:$('aliasMessage'), aliasList:$('aliasList'), aliasListPrefFilter:$('aliasListPrefFilter'), aliasSuggestionList:$('aliasSuggestionList'), tournamentAliasYear:$('tournamentAliasYear'), tournamentAliasName1:$('tournamentAliasName1'), tournamentAliasName2:$('tournamentAliasName2'), tournamentAliasName3:$('tournamentAliasName3'), tournamentAliasName4:$('tournamentAliasName4'), tournamentAliasName5:$('tournamentAliasName5'), tournamentAliasName6:$('tournamentAliasName6'), tournamentAliasCanonical:$('tournamentAliasCanonical'), tournamentAliasSaveButton:$('tournamentAliasSaveButton'), tournamentAliasCancelEditButton:$('tournamentAliasCancelEditButton'), tournamentAliasRefreshButton:$('tournamentAliasRefreshButton'), tournamentAliasMessage:$('tournamentAliasMessage'), tournamentAliasYearFilter:$('tournamentAliasYearFilter'), tournamentAliasList:$('tournamentAliasList'), schoolReplaceFrom:$('schoolReplaceFrom'), schoolReplaceTo:$('schoolReplaceTo'), schoolReplaceMode:$('schoolReplaceMode'), schoolReplacePreviewButton:$('schoolReplacePreviewButton'), schoolReplaceApplyButton:$('schoolReplaceApplyButton'), schoolReplaceStatus:$('schoolReplaceStatus'), schoolReplacePreview:$('schoolReplacePreview'), reloadHistoryButton:$('reloadHistoryButton'), editHistoryList:$('editHistoryList'), heroInitial:$('heroInitial'), heroDivisor:$('heroDivisor'), heroK:$('heroK'), heroFormula:$('heroFormula'), methodKText:$('methodKText'),
    siteSettingsForm:$('siteSettingsForm'), siteNewTeamRetention:$('siteNewTeamRetention'), siteAutumnQualifierK:$('siteAutumnQualifierK'), siteAutumnRegionalK:$('siteAutumnRegionalK'), siteMeijiJinguK:$('siteMeijiJinguK'), siteSpringKoshienEarlyK:$('siteSpringKoshienEarlyK'), siteSpringKoshienFinalK:$('siteSpringKoshienFinalK'), siteSpringQualifierK:$('siteSpringQualifierK'), siteSpringRegionalK:$('siteSpringRegionalK'), siteSummerQualifierK:$('siteSummerQualifierK'), siteSummerMainEarlyK:$('siteSummerMainEarlyK'), siteSummerMainFinalK:$('siteSummerMainFinalK'), siteKokuspoK:$('siteKokuspoK'), siteSettingsMessage:$('siteSettingsMessage'), matchKValues:$('matchKValues'), recordSearchBlock:$('recordSearchBlock'), ratingHistoryBlock:$('ratingHistoryBlock'), heroRetention:$('heroRetention'), methodRetentionText:$('methodRetentionText')
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
    const summerNational=t.replace(/^第\d+回/,'');
    if(/^全国(?:高等学校|高校)野球選手権大会$/.test(summerNational))return '夏の甲子園';
    return raw;
  }
  function tournamentAliasNameKey(name){return String(name??'').normalize('NFKC').trim().replace(/\s+/g,' ');}
  function rebuildTournamentAliasMap(){
    state.tournamentAliasMap=new Map();
    for(const row of state.tournamentAliases){
      const year=String(row.year??'').trim();
      const canonical=String(row.canonical_name??'').trim();
      if(!year||!canonical)continue;
      for(let i=1;i<=6;i++){
        const name=String(row[`name_${i}`]??'').trim();
        if(name)state.tournamentAliasMap.set(`${year}||${tournamentAliasNameKey(name)}`,canonical);
      }
      state.tournamentAliasMap.set(`${year}||${tournamentAliasNameKey(canonical)}`,canonical);
    }
  }
  function canonicalTournamentForYear(name,year){
    const key=`${String(year??'').trim()}||${tournamentAliasNameKey(name)}`;
    return state.tournamentAliasMap.get(key)||canonicalTournament(name);
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

  function tournamentTypeLabel(type){return TOURNAMENT_TYPES[type]?.label||type||'未設定';}
  function isKoshienFinalStage(stage){const s=String(stage||'').normalize('NFKC').replace(/\s+/g,'');return /準決勝/.test(s)||(/決勝/.test(s)&&!/準々決勝/.test(s));}
  function inferTournamentTypeLegacy(match){
    const raw=`${match.tournament_original||match.tournament||''} ${match.stage||''}`;
    const t=raw.normalize('NFKC').replace(/\s+/g,'');
    if(/国民スポーツ|国スポ|国体|国民体育/.test(t)) return 'kokuspo';
    if(/明治神宮/.test(t)) return 'meiji_jingu';
    if(/春の甲子園|選抜|センバツ/.test(t)) return isKoshienFinalStage(match.stage)?'spring_koshien_final':'spring_koshien_early';
    if(/(?:^|年)夏甲子園|夏の甲子園/.test(t) && !/予選|地方大会|支部大会|県大会|府大会|都大会/.test(t)) return isKoshienFinalStage(match.stage)?'summer_main_final':'summer_main_early';
    const summerNational=t.replace(/^第\d+回/,'');
    if(/^全国(?:高等学校|高校)野球選手権大会$/.test(summerNational)) return isKoshienFinalStage(match.stage)?'summer_main_final':'summer_main_early';
    const regionalPattern=/(?:東北|関東|北信越|東海|近畿|中国|四国|九州)(?:地区)?(?:高等学校野球)?大会|地区大会/;
    const explicitQualifier=/予選|地方大会|支部大会|県大会|府大会|都大会/;
    if(/秋季|秋/.test(t)){
      if(explicitQualifier.test(t)) return 'autumn_qualifier';
      if(regionalPattern.test(t)) return 'autumn_regional';
      if(/北海道(?:高等学校野球)?大会/.test(t)&&!/(?:北北海道|南北海道|支部|予選)/.test(t)) return 'autumn_regional';
      return 'autumn_qualifier';
    }
    if(/春季/.test(t)){
      if(explicitQualifier.test(t)) return 'spring_qualifier';
      if(regionalPattern.test(t)) return 'spring_regional';
      if(/北海道(?:高等学校野球)?大会/.test(t)&&!/(?:北北海道|南北海道|支部|予選)/.test(t)) return 'spring_regional';
      return 'spring_qualifier';
    }
    if(/全国(?:高等学校|高校)野球選手権|選手権大会|東東京大会|西東京大会|北北海道大会|南北海道大会|(?:^|年)夏/.test(t)) return 'summer_qualifier';
    return null;
  }
  function kForType(type){
    const n=Number(state.kSettings?.[type]);
    return Number.isFinite(n)&&n>0?n:Number(TOURNAMENT_TYPES[type]?.k??ratingCfg.defaultK);
  }
  function inferK(match){
    const direct=Number(match.k); if(Number.isFinite(direct)&&direct>0) return direct;
    const type=TOURNAMENT_TYPES[match.tournament_type]?match.tournament_type:inferTournamentTypeLegacy(match);
    return type?kForType(type):ratingCfg.defaultK;
  }
  function effectiveTournamentType(match){
    return TOURNAMENT_TYPES[match?.tournament_type]?match.tournament_type:inferTournamentTypeLegacy(match||{});
  }
  function newTeamRetentionRate(){
    const n=Number(setting('new_team_retention_rate'));
    return Number.isFinite(n)&&n>=0&&n<=1?n:0.85;
  }
  function newTeamTransitionYear(match){
    const type=effectiveTournamentType(match);
    if(!['autumn_qualifier','autumn_regional','meiji_jingu'].includes(type))return null;
    const year=Number(String(match?.date||'').slice(0,4));
    return Number.isInteger(year)&&year>=1900&&year<=2100?year:null;
  }
  function applyNewTeamTransition(school,year){
    if(!school||!year||school.newTeamTransitionYears.has(year))return;
    school.newTeamTransitionYears.add(year);
    const rate=newTeamRetentionRate();
    school.rating=ratingCfg.initial+(school.rating-ratingCfg.initial)*rate;
  }
  function normalizeMatch(m){
    const prefA=canonicalPref(String(m.pref_a??'').trim()),prefB=canonicalPref(String(m.pref_b??'').trim());
    const rawA=String(m.team_a??'').trim(),rawB=String(m.team_b??'').trim();
    const a=resolveTeamIdentity(rawA,prefA),b=resolveTeamIdentity(rawB,prefB),tournamentOriginal=String(m.tournament??'').trim();
    const tournamentType=String(m.tournament_type??'').trim();
    return {...m,team_a:a.name,team_b:b.name,team_a_display:rawA,team_b_display:rawB,team_a_official:a.officialName||null,team_b_official:b.officialName||null,joint_a:a.isJoint,joint_b:b.isJoint,pref_a:prefA,pref_b:prefB,tournament_original:tournamentOriginal,tournament:canonicalTournament(tournamentOriginal),tournament_type:TOURNAMENT_TYPES[tournamentType]?tournamentType:null,stage:String(m.stage??'').trim(),score_a:Number(m.score_a),score_b:Number(m.score_b),k:m.k===null||m.k===''?null:Number(m.k)};
  }
  function compareMatches(a,b){return String(a.date).localeCompare(String(b.date))||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id||'').localeCompare(String(b.id||''));}
  function getOrCreateSchool(map,name,pref,isJoint=false){const key=schoolKey(name,pref);if(!map.has(key)){map.set(key,{key,name:canonicalTeam(name).name,pref:canonicalPref(pref),rating:ratingCfg.initial,lastDelta:0,wins:0,losses:0,draws:0,history:[],games:[],isJoint:Boolean(isJoint),areas:new Set([String(pref||'').trim()]),newTeamTransitionYears:new Set()});}else if(isJoint){map.get(key).isJoint=true;}return map.get(key);}
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
      const transitionYear=newTeamTransitionYear(m);
      if(transitionYear){applyNewTeamTransition(a,transitionYear);applyNewTeamTransition(b,transitionYear);}
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

  async function fetchAllMatches(){
    const columnsFor=(useTags)=>useTags
      ?'id,date,tournament,tournament_type,stage,team_a,pref_a,score_a,team_b,pref_b,score_b,k,source_url,created_at'
      :'id,date,tournament,stage,team_a,pref_a,score_a,team_b,pref_b,score_b,k,source_url,created_at';

    async function fetchMode(useTags){
      const columns=columnsFor(useTags);
      const first=await state.client.from('matches').select(columns,{count:'exact'}).order('date',{ascending:true}).order('created_at',{ascending:true}).range(0,PAGE_SIZE-1);
      if(first.error)throw first.error;
      const firstRows=first.data||[];
      const total=Number(first.count);
      if(Number.isFinite(total)&&total>firstRows.length){
        const ranges=[];
        for(let from=PAGE_SIZE;from<total;from+=PAGE_SIZE)ranges.push([from,Math.min(from+PAGE_SIZE-1,total-1)]);
        const pages=[];
        const CONCURRENCY=4;
        for(let i=0;i<ranges.length;i+=CONCURRENCY){
          const batch=ranges.slice(i,i+CONCURRENCY);
          const responses=await Promise.all(batch.map(([from,to])=>state.client.from('matches').select(columns).order('date',{ascending:true}).order('created_at',{ascending:true}).range(from,to)));
          for(const response of responses){if(response.error)throw response.error;pages.push(...(response.data||[]));}
        }
        return [...firstRows,...pages];
      }
      if(firstRows.length<PAGE_SIZE)return firstRows;
      let all=[...firstRows],from=PAGE_SIZE;
      while(true){
        const response=await state.client.from('matches').select(columns).order('date',{ascending:true}).order('created_at',{ascending:true}).range(from,from+PAGE_SIZE-1);
        if(response.error)throw response.error;
        const rows=response.data||[];all.push(...rows);if(rows.length<PAGE_SIZE)break;from+=PAGE_SIZE;
      }
      return all;
    }

    try{return await fetchMode(true);}
    catch(error){
      if(/tournament_type/i.test(error?.message||''))return fetchMode(false);
      throw error;
    }
  }
  function markMatchDataChanged(){state.rankSnapshotCache.clear();state.historicalRankingCache.clear();state.duplicateCacheDirty=true;state.matchSortCache=null;}
  function rebuildFromLocalMatches(deferSecondary=true){const r=buildRatings(state.matches);state.schoolMap=r.map;state.schools=r.schools;state.ranking=r.publicSchools;state.prefs=buildPrefStats(r.schools);state.missingTournamentTypeCount=state.matches.filter(m=>!m.tournament_type).length;markMatchDataChanged();setDataStatus(`${state.matches.length}試合`);renderAll(deferSecondary);}
  async function loadMatches(){if(!state.client)return;setDataStatus('読み込み中…');try{state.matches=await fetchAllMatches();state.missingTournamentTypeCount=state.matches.filter(m=>!m.tournament_type).length;const r=buildRatings(state.matches);state.schoolMap=r.map;state.schools=r.schools;state.ranking=r.publicSchools;state.prefs=buildPrefStats(r.schools);markMatchDataChanged();state.ready=true;setDataStatus(`${state.matches.length}試合`);if(state.missingTournamentTypeCount)console.warn(`大会タグ未設定: ${state.missingTournamentTypeCount}試合。upgrade-tournament-tags.sql を実行してください。`);renderAll(true);}catch(e){console.error(e);setDataStatus('読込エラー');showSetupNotice(`Supabaseから試合データを取得できませんでした。<br><code>${escapeHtml(e.message)}</code>`);}}
  function setDataStatus(t){els.dataStatus.textContent=t;}
  function showSetupNotice(h){els.setupNotice.innerHTML=h;els.setupNotice.classList.remove('hidden');}
  function hideSetupNotice(){els.setupNotice.classList.add('hidden');els.setupNotice.innerHTML='';}
  function isAdmin(){return Boolean(state.session?.user);}
  function setting(key){return state.settings?.[key] ?? DEFAULT_SITE_SETTINGS[key];}
  function featureVisible(name){return isAdmin() || setting(`public_${name}`)!==false;}
  function autumnQualifierK(){return kForType('autumn_qualifier');}
  function autumnRegionalK(){return kForType('autumn_regional');}
  function meijiJinguK(){return kForType('meiji_jingu');}
  function springKoshienEarlyK(){return kForType('spring_koshien_early');}
  function springKoshienFinalK(){return kForType('spring_koshien_final');}
  function springQualifierK(){return kForType('spring_qualifier');}
  function springRegionalK(){return kForType('spring_regional');}
  function summerQualifierK(){return kForType('summer_qualifier');}
  function summerMainEarlyK(){return kForType('summer_main_early');}
  function summerMainFinalK(){return kForType('summer_main_final');}
  function kokuspoK(){return kForType('kokuspo');}
  function configuredKValues(){return Object.keys(TOURNAMENT_TYPES).map(kForType);}
  function ratingVisibleSchools(){return isAdmin()?state.schools:state.ranking;}
  function canViewSchoolRating(school){return Boolean(school)&&(isAdmin()||school.rating>=PUBLIC_RATING_MIN);}
  function syncPublicSettingToggles(){
    document.querySelectorAll('.admin-public-toggle').forEach(label=>{
      const input=label.querySelector('[data-setting]');
      label.classList.toggle('hidden',!isAdmin());
      if(input){input.checked=setting(input.dataset.setting)!==false;input.disabled=!isAdmin();}
    });
  }
  function applyPublicVisibility(){
    document.querySelectorAll('[data-public-feature]').forEach(el=>el.classList.toggle('hidden',!featureVisible(el.dataset.publicFeature)));
    document.querySelectorAll('[data-public-subfeature]').forEach(el=>el.classList.toggle('hidden',!featureVisible(el.dataset.publicSubfeature)));
    document.querySelectorAll('[data-public-feature-nav]').forEach(el=>el.classList.toggle('hidden',!featureVisible(el.dataset.publicFeatureNav)));
    syncPublicSettingToggles();
  }
  function renderSecondaryViews(){renderPrefCards();renderSchoolSelect();renderSchoolProfile();renderRankCompareSelected();renderRankCompareChart();renderAdminMatches();renderAliasSuggestions();syncSiteSettingsForm();}
  function scheduleSecondaryViews(){
    if(state.deferredRenderHandle!==null){if('cancelIdleCallback' in window)cancelIdleCallback(state.deferredRenderHandle);else clearTimeout(state.deferredRenderHandle);}
    const run=()=>{state.deferredRenderHandle=null;renderSecondaryViews();};
    state.deferredRenderHandle='requestIdleCallback' in window?requestIdleCallback(run,{timeout:180}):setTimeout(run,0);
  }
  function renderAll(deferSecondary=false){hideSetupNotice();applyPublicVisibility();renderSummary();renderPrefFilter();renderRanking();if(deferSecondary)scheduleSecondaryViews();else renderSecondaryViews();}
  function hasOfficialGameInPastYear(school){
    if(!school||!Array.isArray(school.games)||!school.games.length)return false;
    const now=new Date();
    const cutoff=new Date(now);
    cutoff.setFullYear(cutoff.getFullYear()-1);
    cutoff.setHours(0,0,0,0);
    return school.games.some(g=>{
      const dateText=g?.match?.date;
      if(!dateText)return false;
      const d=new Date(`${dateText}T00:00:00`);
      return Number.isFinite(d.getTime())&&d>=cutoff&&d<=now;
    });
  }
  function renderSummary(){els.matchCount.textContent=state.matches.length.toLocaleString('ja-JP');els.schoolCount.textContent=state.schools.filter(s=>!s.isJoint&&hasOfficialGameInPastYear(s)).length.toLocaleString('ja-JP');els.prefCount.textContent=state.prefs.length.toLocaleString('ja-JP');els.latestMatchDate.textContent=state.matches.map(m=>m.date).filter(Boolean).sort().at(-1)||'—';}
  function renderPrefFilter(){
    if(!els.rankingPrefOptions)return;
    const source=ratingVisibleSchools();
    const prefs=[...new Set(source.map(s=>canonicalPref(s.pref)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    state.selectedRankingPrefs=new Set([...state.selectedRankingPrefs].filter(p=>prefs.includes(p)));
    els.rankingPrefOptions.innerHTML=prefs.map(p=>`<label class="ranking-pref-option"><input type="checkbox" value="${escapeHtml(p)}" ${state.selectedRankingPrefs.has(p)?'checked':''}><span>${escapeHtml(p)}</span></label>`).join('');
    updateRankingPrefSummary();
  }
  function updateRankingPrefSummary(){
    if(!els.rankingPrefSummary)return;
    const selected=[...state.selectedRankingPrefs];
    els.rankingPrefSummary.textContent=!selected.length?'全国':selected.length<=3?selected.join('・'):`${selected.length}都道府県`;
    if(els.rankingPrefClear)els.rankingPrefClear.disabled=!selected.length;
  }
  function syncRankingDateInput(forceLatest=false){
    if(!els.rankingDate)return;
    const {first,last}=compareDatasetBounds();
    if(!first||!last){els.rankingDate.value='';return;}
    els.rankingDate.min=first;els.rankingDate.max=last;
    if(forceLatest||state.rankingDateIsLatest||!state.rankingDate)state.rankingDate=last;
    if(state.rankingDate<first)state.rankingDate=first;
    if(state.rankingDate>last)state.rankingDate=last;
    state.rankingDateIsLatest=state.rankingDate===last;
    els.rankingDate.value=state.rankingDate;
    if(els.rankingDateLatest)els.rankingDateLatest.disabled=state.rankingDateIsLatest;
  }
  function historicalSchoolState(school,dateString){
    const h=school?.history||[];if(!h.length)return null;
    let lo=0,hi=h.length-1,idx=-1;
    while(lo<=hi){const mid=(lo+hi)>>1;if(String(h[mid].date)<=dateString){idx=mid;lo=mid+1;}else hi=mid-1;}
    if(idx<0)return null;
    const games=(school.games||[]).slice(0,idx+1),last=h[idx];
    return {...school,rating:last.rating,lastDelta:last.delta,form:games.slice(-5).map(g=>g.result).join(''),snapshotDate:dateString};
  }
  function rankingRowsAtDate(dateString){
    const key=`${isAdmin()?'admin':'public'}|ranking|${dateString}`;
    if(state.historicalRankingCache.has(key))return state.historicalRankingCache.get(key);
    const rows=[];
    for(const school of state.schools){
      const snap=historicalSchoolState(school,dateString);if(!snap)continue;
      if(!isAdmin()&&snap.rating<PUBLIC_RATING_MIN)continue;
      rows.push(snap);
    }
    rows.sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name,'ja')||a.pref.localeCompare(b.pref,'ja'));
    rows.forEach((row,i)=>row.snapshotRank=i+1);
    state.historicalRankingCache.set(key,rows);
    return rows;
  }

  function renderRanking(){
    syncRankingDateInput(false);
    const q=normalizeSearchText(els.searchInput.value);
    const date=state.rankingDate||compareDatasetBounds().last||'';
    const source=date?rankingRowsAtDate(date):ratingVisibleSchools();
    const minText=String(els.ratingMinFilter?.value??'').trim(),maxText=String(els.ratingMaxFilter?.value??'').trim();
    const minRating=minText===''?null:Number(minText),maxRating=maxText===''?null:Number(maxText);
    const selectedPrefs=state.selectedRankingPrefs;
    const rankScope=source.filter(s=>!selectedPrefs.size||selectedPrefs.has(canonicalPref(s.pref))).map((s,i)=>({...s,displayRank:selectedPrefs.size?i+1:(s.snapshotRank??(isAdmin()?s.allRank:s.publicRank))}));
    const allRows=rankScope.filter(s=>schoolMatchesSearch(s,q)&&(minRating===null||!Number.isFinite(minRating)||s.rating>=minRating)&&(maxRating===null||!Number.isFinite(maxRating)||s.rating<=maxRating));
    const total=allRows.length,pageSize=[20,50,100].includes(Number(state.rankingPageSize))?Number(state.rankingPageSize):20;
    const totalPages=Math.max(1,Math.ceil(total/pageSize));
    state.rankingPage=Math.min(Math.max(1,Number(state.rankingPage)||1),totalPages);
    const start=(state.rankingPage-1)*pageSize,rows=allRows.slice(start,start+pageSize);
    els.rankingBody.innerHTML=rows.length?rows.map(s=>`<tr class="js-ranking-school"><td>${s.displayRank}</td><td><strong>${escapeHtml(s.name)}</strong>${s.isJoint?' <span class="joint-badge">合同</span>':''}</td><td>${escapeHtml(s.pref)}</td><td class="rating-cell">${formatRating(s.rating)}</td><td class="${deltaClass(s.lastDelta)}">${formatDelta(s.lastDelta)}</td><td>${s.form.split('').map(r=>`<span class="match-result-${r}">${r}</span>`).join(' ')||'—'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">該当する学校がありません。</td></tr>';
    if(els.rankingPageSize)els.rankingPageSize.value=String(pageSize);
    if(els.rankingPrev)els.rankingPrev.disabled=state.rankingPage<=1;
    if(els.rankingNext)els.rankingNext.disabled=state.rankingPage>=totalPages||total===0;
    renderRankingPageNumbers(totalPages,total);
    if(els.rankingPageStatus)els.rankingPageStatus.textContent=total?`${state.rankingPage} / ${totalPages}ページ（${start+1}〜${Math.min(start+pageSize,total)}件目）`:'0件';
    const rangeLabel=`${minRating!==null&&Number.isFinite(minRating)?formatRating(minRating):'下限なし'}〜${maxRating!==null&&Number.isFinite(maxRating)?formatRating(maxRating):'上限なし'}`;
    const dateLabel=date?`${date} 全試合終了時点`:'最新';
    const prefLabel=selectedPrefs.size?[...selectedPrefs].join('・'):'全国';
    els.rankingFootnote.textContent=isAdmin()?`${dateLabel}の管理者ランキング（${prefLabel}）：該当 ${total}チーム。Rating範囲 ${rangeLabel}。`:`${dateLabel}のランキング（${prefLabel}）：該当 ${total}チーム。Rating範囲 ${rangeLabel}（その時点でRating ${PUBLIC_RATING_MIN}以上を公開）。`;
    els.rankingBody.querySelectorAll('.js-ranking-school').forEach((r,i)=>r.onclick=()=>openSchool(rows[i].key,true));
  }
  function renderRankingPageNumbers(totalPages,total){
    if(!els.rankingPageNumbers)return;
    if(!total){els.rankingPageNumbers.innerHTML='';return;}
    const current=state.rankingPage;
    let start=Math.max(1,current-2),end=Math.min(totalPages,start+4);
    start=Math.max(1,end-4);
    const parts=[];
    if(start>1){parts.push(`<button class="ranking-page-number" type="button" data-page="1">1</button>`);if(start>2)parts.push('<span class="ranking-page-ellipsis">…</span>');}
    for(let page=start;page<=end;page++)parts.push(`<button class="ranking-page-number ${page===current?'active':''}" type="button" data-page="${page}" ${page===current?'aria-current="page"':''}>${page}</button>`);
    if(end<totalPages){if(end<totalPages-1)parts.push('<span class="ranking-page-ellipsis">…</span>');parts.push(`<button class="ranking-page-number" type="button" data-page="${totalPages}">${totalPages}</button>`);}
    els.rankingPageNumbers.innerHTML=parts.join('');
  }
  function goToRankingPage(page){
    const n=Number(page);if(!Number.isFinite(n)||n<1)return;state.rankingPage=n;renderRanking();document.getElementById('ranking')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderPrefCards(){
    const mode=els.prefSort?.value||'top25';
    const data=[...state.prefs].sort((a,b)=>(b[mode]??-Infinity)-(a[mode]??-Infinity)||(b.topRating??0)-(a.topRating??0));
    const visible=state.prefExpanded?data:data.slice(0,6);
    els.prefCards.innerHTML=visible.length?visible.map((x,i)=>`<article class="pref-card"><h3>${i+1}. ${escapeHtml(x.pref)} <span>${x.count}校</span></h3><div class="pref-metrics"><div class="${mode==='topRating'?'metric-active':''}"><span>県内1位 ${escapeHtml(x.topSchool)}</span><strong>${formatRating(x.topRating)}</strong></div><div class="${mode==='median'?'metric-active':''}"><span>中央値</span><strong>${formatRating(x.median)}</strong></div><div class="${mode==='top5'?'metric-active':''}"><span>上位5校平均</span><strong>${formatRating(x.top5)}</strong></div><div class="${mode==='top25'?'metric-active':''}"><span>上位25%平均</span><strong>${formatRating(x.top25)}</strong></div></div></article>`).join(''):'<div class="empty">データがありません。</div>';
    if(els.prefShowMoreButton){
      const hasMore=data.length>6;
      els.prefShowMoreButton.classList.toggle('hidden',!hasMore);
      els.prefShowMoreButton.textContent=state.prefExpanded?'6都道府県だけ表示':`もっと見る（残り${Math.max(0,data.length-6)}）`;
    }
  }

  function renderSchoolSelect(){const previous=state.selectedSchoolKey||els.schoolSelect.value,source=ratingVisibleSchools();els.schoolSelect.innerHTML=`<option value="">${isAdmin()?'全校から選択（管理者）':'Rating 1500以上から選択'}</option>`+source.map(s=>`<option value="${escapeHtml(s.key)}">${escapeHtml(s.name)}（${escapeHtml(s.pref)}）${isAdmin()&&s.rating<PUBLIC_RATING_MIN?' · '+formatRating(s.rating):''}</option>`).join('');if(source.some(s=>s.key===previous))els.schoolSelect.value=previous;}
  function renderSchoolSearch(){const q=normalizeSearchText(els.schoolSearch.value);if(!q){state.schoolSearchHits=[];els.schoolSearchResults.classList.add('hidden');els.schoolSearchResults.innerHTML='';return;}const source=ratingVisibleSchools(),hits=source.filter(s=>schoolMatchesSearch(s,q)).slice(0,20);state.schoolSearchHits=hits;els.schoolSearchResults.innerHTML=hits.length?hits.map(s=>`<button class="school-search-item" type="button"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · Rating ${formatRating(s.rating)}${isAdmin()&&s.rating<PUBLIC_RATING_MIN?' · 管理者表示':''}</span></button>`).join(''):`<div class="school-search-empty">${isAdmin()?'該当する学校がありません。':`Rating ${PUBLIC_RATING_MIN}以上のRating検索対象に該当しません。下の戦績検索では全校を検索できます。`}</div>`;els.schoolSearchResults.classList.remove('hidden');els.schoolSearchResults.querySelectorAll('.school-search-item').forEach((b,i)=>b.onclick=()=>selectSchoolSearchHit(i));}
  function renderRecordSchoolSearch(){const q=normalizeSearchText(els.recordSchoolSearch?.value);if(!els.recordSchoolSearchResults)return;if(!q){state.recordSearchHits=[];els.recordSchoolSearchResults.classList.add('hidden');els.recordSchoolSearchResults.innerHTML='';return;}const hits=state.schools.filter(s=>schoolMatchesSearch(s,q)).slice(0,30);state.recordSearchHits=hits;els.recordSchoolSearchResults.innerHTML=hits.length?hits.map(s=>`<button class="school-search-item" type="button"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · ${s.games.length}試合${canViewSchoolRating(s)?` · Rating ${formatRating(s.rating)}`:' · Rating非公開'}</span></button>`).join(''):'<div class="school-search-empty">該当する学校がありません。</div>';els.recordSchoolSearchResults.classList.remove('hidden');els.recordSchoolSearchResults.querySelectorAll('.school-search-item').forEach((b,i)=>b.onclick=()=>selectRecordSearchHit(i));}
  function selectRecordSearchHit(index){const school=state.recordSearchHits[index];if(!school)return;openSchool(school.key,true);els.recordSchoolSearch.value='';state.recordSearchHits=[];els.recordSchoolSearchResults.classList.add('hidden');}
  function selectSchoolSearchHit(index){const school=state.schoolSearchHits[index];if(!school)return;openSchool(school.key,true);els.schoolSearch.value='';state.schoolSearchHits=[];els.schoolSearchResults.classList.add('hidden');}
  function resolveSchool(key){if(!key)return null;if(state.schoolMap.has(key))return state.schoolMap.get(key);const raw=String(key);try{const parts=raw.split('::');if(parts.length===2){const normalized=schoolKey(decodeURIComponent(parts[1]),decodeURIComponent(parts[0]));if(state.schoolMap.has(normalized))return state.schoolMap.get(normalized);}}catch(_e){}return state.schools.find(s=>s.key===raw)||null;}
  function openSchool(key,scroll=false){if(!featureVisible('school_details'))return;const school=resolveSchool(key);if(!school)return;state.selectedSchoolKey=school.key;if(state.ranking.some(s=>s.key===school.key))els.schoolSelect.value=school.key;else els.schoolSelect.value='';renderSchoolProfile();if(scroll){const target=document.querySelector('#schools');if(target)requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'start'}));}}
  function renderSchoolProfile(){const school=state.schoolMap.get(state.selectedSchoolKey)||state.schoolMap.get(els.schoolSelect.value)||ratingVisibleSchools()[0]||state.schools[0];if(!school){els.schoolName.textContent='試合データがありません';els.historyChart.innerHTML='';els.recentMatches.innerHTML='<div class="empty">試合データがありません。</div>';return;}state.selectedSchoolKey=school.key;els.schoolPref.textContent=school.pref;els.schoolName.textContent=school.name;els.schoolRecord.textContent=`${school.games.length}試合 ${school.wins}勝 ${school.losses}敗 ${school.draws}分${school.isJoint?' · 合同チーム':''}`;const ratingVisible=canViewSchoolRating(school);els.schoolRating.textContent=ratingVisible?formatRating(school.rating):'非公開';els.schoolRank.textContent=ratingVisible?`${isAdmin()?school.allRank:school.publicRank}位`:'—';if(els.schoolPrefRank)els.schoolPrefRank.textContent=ratingVisible&&school.prefRank?`${school.prefRank}位`:'—';els.schoolDelta.textContent=ratingVisible?formatDelta(school.lastDelta):'—';els.schoolDelta.className=ratingVisible?deltaClass(school.lastDelta):'';els.schoolForm.innerHTML=school.form.split('').map(r=>`<span class="match-result-${r}">${r}</span>`).join(' ')||'—';renderHistoryChart(school.history,ratingVisible);renderMatchFilters(school.games);renderRecentMatches(school.games,ratingVisible);}
  function renderMatchFilters(games){if(!els.matchYearFilter)return;const old=els.matchYearFilter.value,years=[...new Set(games.map(g=>String(g.match.date||'').slice(0,4)).filter(Boolean))].sort().reverse();els.matchYearFilter.innerHTML='<option value="">全期間</option>'+years.map(y=>`<option value="${y}">${y}年</option>`).join('');if(years.includes(old))els.matchYearFilter.value=old;}
  function renderRecentMatches(games,publicRating=true){
    const year=els.matchYearFilter?.value||'';const list=[...games].filter(g=>!year||String(g.match.date).startsWith(year)).reverse();
    if(!list.length){els.recentMatches.innerHTML='<div class="empty">試合がありません。</div>';return;}
    const showK=featureVisible('k_values');
    els.recentMatches.innerHTML=list.map(game=>{const m=game.match,source=m.source_url?` · <a href="${escapeHtml(m.source_url)}" target="_blank" rel="noopener noreferrer">出典</a>`:'',kText=showK?` · K=${inferK(m)}`:'';return `<div class="match-row"><div class="match-meta">${escapeHtml(m.date)} · ${escapeHtml(m.tournament)} ${escapeHtml(m.stage||'')}${source}${kText}</div><strong class="match-result-${game.result}">${escapeHtml(game.result)}　<button class="school-link js-open-opponent" type="button">${escapeHtml(game.opponent)}</button>　${game.scored} - ${game.allowed}</strong>${publicRating?`<div class="match-meta">${formatRating(game.before)} → ${formatRating(game.after)}（${formatDelta(game.delta)}）</div>`:''}<div class="match-actions">${state.session?.user?`<button class="btn secondary small js-edit-record" data-id="${escapeHtml(m.id)}" type="button">この戦績を編集</button>`:''}</div></div>`;}).join('');
    els.recentMatches.scrollTop=0;
    els.recentMatches.querySelectorAll('.js-open-opponent').forEach((b,i)=>b.onclick=()=>openSchool(list[i].opponentKey,false));
    els.recentMatches.querySelectorAll('.js-edit-record').forEach(b=>b.onclick=()=>startEdit(b.dataset.id));
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
  function compareDatasetBounds(){
    const dates=state.matches.map(m=>m.date).filter(Boolean).sort();
    if(!dates.length)return {first:null,last:null};
    return {first:dates[0],last:dates.at(-1)};
  }
  function syncRankCompareDateInputs(forceFull=false){
    if(!els.rankCompareStartDate||!els.rankCompareEndDate)return;
    const {first,last}=compareDatasetBounds();
    if(!first||!last)return;
    els.rankCompareStartDate.min=first;els.rankCompareStartDate.max=last;
    els.rankCompareEndDate.min=first;els.rankCompareEndDate.max=last;
    if(forceFull||!state.compareStartDate)state.compareStartDate=first;
    if(forceFull||!state.compareEndDate)state.compareEndDate=last;
    els.rankCompareStartDate.value=state.compareStartDate;
    els.rankCompareEndDate.value=state.compareEndDate;
  }
  function monthSnapshots(){
    const {first,last}=compareDatasetBounds();if(!first||!last)return[];
    const startText=state.compareStartDate||first,endText=state.compareEndDate||last;
    if(startText>endText)return[];
    const start=parseLocalDate(startText),end=parseLocalDate(endText);
    const out=[startText],cursor=new Date(start.getFullYear(),start.getMonth()+1,1);
    while(cursor<=end){const monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,0),d=monthEnd>end?end:monthEnd;out.push(toDateString(d));cursor.setMonth(cursor.getMonth()+1);}
    if(out.at(-1)!==endText)out.push(endText);
    return [...new Set(out)];
  }
  function rankSnapshot(dateString){
    const cacheKey=`${isAdmin()?'admin':'public'}|${dateString}`;
    if(state.rankSnapshotCache.has(cacheKey))return state.rankSnapshotCache.get(cacheKey);
    const rows=[];
    for(const school of state.schools){const rating=ratingAtDate(school,dateString);if(rating===null)continue;if(!isAdmin()&&rating<PUBLIC_RATING_MIN)continue;rows.push({key:school.key,rating});}
    rows.sort((a,b)=>b.rating-a.rating||(a.key<b.key?-1:a.key>b.key?1:0));
    const ranks=new Map();rows.forEach((row,i)=>ranks.set(row.key,i+1));
    state.rankSnapshotCache.set(cacheKey,ranks);
    return ranks;
  }
  function historicalRank(school,dateString){return rankSnapshot(dateString).get(school?.key)??null;}
  function renderRankCompareSearch(){
    if(!els.rankCompareSearch||!els.rankCompareSearchResults)return;const q=normalizeSearchText(els.rankCompareSearch.value);
    if(!q){state.rankCompareSearchHits=[];els.rankCompareSearchResults.innerHTML='';els.rankCompareSearchResults.classList.add('hidden');return;}
    const selected=new Set(state.compareSchoolKeys),source=ratingVisibleSchools();
    const hits=source.filter(s=>!selected.has(s.key)&&(schoolMatchesSearch(s,q))).slice(0,20);
    state.rankCompareSearchHits=hits;els.rankCompareSearchResults.innerHTML=hits.length?hits.map(s=>`<button class="school-search-item" type="button"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · ${isAdmin()&&s.rating<PUBLIC_RATING_MIN?`Rating ${formatRating(s.rating)} · 管理者表示`:`Rating ${formatRating(s.rating)}`}</span></button>`).join(''):'<div class="school-search-empty">該当する学校がありません。</div>';
    els.rankCompareSearchResults.classList.remove('hidden');els.rankCompareSearchResults.querySelectorAll('.school-search-item').forEach((b,i)=>b.onclick=()=>addRankCompareSchool(i));
  }
  function addRankCompareSchool(index){
    const s=state.rankCompareSearchHits[index];if(!s||state.compareSchoolKeys.includes(s.key))return;if(state.compareSchoolKeys.length>=10){if(els.rankCompareStatus)els.rankCompareStatus.textContent='比較できるのは最大10校です。';return;}
    state.compareSchoolKeys.push(s.key);els.rankCompareSearch.value='';state.rankCompareSearchHits=[];els.rankCompareSearchResults.innerHTML='';els.rankCompareSearchResults.classList.add('hidden');renderRankCompareSelected();renderRankCompareChart();
  }
  function removeRankCompareSchool(key){state.compareSchoolKeys=state.compareSchoolKeys.filter(k=>k!==key);renderRankCompareSelected();renderRankCompareChart();}
  function renderRankCompareSelected(){
    if(!els.rankCompareSelected)return;const allowed=new Set(ratingVisibleSchools().map(s=>s.key));state.compareSchoolKeys=state.compareSchoolKeys.filter(k=>allowed.has(k)).slice(0,10);
    const chosen=state.compareSchoolKeys.map(resolveSchool).filter(Boolean);
    els.rankCompareSelected.innerHTML=chosen.length?chosen.map((s,i)=>`<span class="rank-school-chip rank-chip-${i+1}"><span class="rank-chip-swatch rank-legend-${i+1}"></span><span>${escapeHtml(s.name)}（${escapeHtml(s.pref)}）</span><button type="button" class="js-remove-rank-school" data-key="${escapeHtml(s.key)}" aria-label="${escapeHtml(s.name)}を比較から外す">×</button></span>`).join(''):'<span class="muted">学校名を検索して比較対象に追加してください。</span>';
    els.rankCompareSelected.querySelectorAll('.js-remove-rank-school').forEach(b=>b.onclick=()=>removeRankCompareSchool(b.dataset.key));
  }
  function hideRankCompareTooltip(){if(els.rankCompareTooltip)els.rankCompareTooltip.classList.add('hidden');}
  function showRankCompareTooltip(event,point){
    if(!els.rankCompareTooltip)return;
    els.rankCompareTooltip.innerHTML=`<strong>${escapeHtml(point.school)}</strong><span>${escapeHtml(point.date)}</span><span>全国順位 <b>${point.rank}位</b></span><span>Rating <b>${formatRating(point.rating)}</b></span>`;
    els.rankCompareTooltip.classList.remove('hidden');
    const gap=14,boxW=190,boxH=110;
    let left=event.clientX+gap,top=event.clientY+gap;
    if(left+boxW>window.innerWidth-8)left=event.clientX-boxW-gap;
    if(top+boxH>window.innerHeight-8)top=event.clientY-boxH-gap;
    els.rankCompareTooltip.style.left=`${Math.max(8,left)}px`;els.rankCompareTooltip.style.top=`${Math.max(8,top)}px`;
  }
  function bindRankCompareTooltips(){
    if(!els.rankCompareChart)return;
    els.rankCompareChart.querySelectorAll('.js-rank-point').forEach(point=>{
      const data={school:point.dataset.school,date:point.dataset.date,rank:Number(point.dataset.rank),rating:Number(point.dataset.rating)};
      point.addEventListener('mouseenter',e=>showRankCompareTooltip(e,data));
      point.addEventListener('mousemove',e=>showRankCompareTooltip(e,data));
      point.addEventListener('mouseleave',hideRankCompareTooltip);
      point.addEventListener('focus',e=>showRankCompareTooltip(e,data));
      point.addEventListener('blur',hideRankCompareTooltip);
    });
  }
  function renderRankCompareChart(){
    if(!els.rankCompareChart)return;syncRankCompareDateInputs(false);hideRankCompareTooltip();
    const chosen=state.compareSchoolKeys.map(resolveSchool).filter(Boolean).filter((s,i,a)=>a.findIndex(x=>x.key===s.key)===i).slice(0,10);
    if(!chosen.length){els.rankCompareChart.innerHTML='<text x="450" y="170" text-anchor="middle" class="chart-private">学校名を検索して比較対象に追加してください</text>';els.rankCompareLegend.innerHTML='';if(els.rankCompareStatus)els.rankCompareStatus.textContent='';return;}
    if(state.compareStartDate&&state.compareEndDate&&state.compareStartDate>state.compareEndDate){els.rankCompareChart.innerHTML='<text x="450" y="170" text-anchor="middle" class="chart-private">開始日は終了日以前にしてください</text>';els.rankCompareLegend.innerHTML='';if(els.rankCompareStatus)els.rankCompareStatus.textContent='期間指定を確認してください。';return;}
    const dates=monthSnapshots();if(!dates.length)return;
    const series=chosen.map(s=>({school:s,values:dates.map(d=>({date:d,rank:historicalRank(s,d),rating:ratingAtDate(s,d)}))}));
    const ranks=series.flatMap(x=>x.values.map(v=>v.rank).filter(Number.isFinite));if(!ranks.length){els.rankCompareChart.innerHTML='<text x="450" y="170" text-anchor="middle" class="chart-private">この期間の公開順位データがありません</text>';els.rankCompareLegend.innerHTML='';return;}
    const width=900,height=360,padL=58,padR=24,padT=24,padB=48,maxRank=Math.max(5,Math.ceil(Math.max(...ranks)/5)*5),x=i=>dates.length===1?(padL+width-padR)/2:padL+i/(dates.length-1)*(width-padL-padR),y=r=>padT+(r-1)/(Math.max(1,maxRank-1))*(height-padT-padB);
    const yTicks=[1,Math.max(2,Math.round(maxRank*.25)),Math.max(3,Math.round(maxRank*.5)),Math.max(4,Math.round(maxRank*.75)),maxRank].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
    const grid=yTicks.map(r=>`<line class="rank-chart-grid" x1="${padL}" y1="${y(r)}" x2="${width-padR}" y2="${y(r)}"/><text class="rank-chart-label" x="${padL-8}" y="${y(r)+4}" text-anchor="end">${r}位</text>`).join('');
    const tickIdx=[0,Math.floor((dates.length-1)/4),Math.floor((dates.length-1)/2),Math.floor((dates.length-1)*3/4),dates.length-1].filter((v,i,a)=>a.indexOf(v)===i),xLabels=tickIdx.map(i=>`<text class="rank-chart-label" x="${x(i)}" y="${height-14}" text-anchor="middle">${dates[i].slice(0,7)}</text>`).join('');
    const lines=series.map((ser,si)=>{let chunks=[],cur=[];ser.values.forEach((v,i)=>{if(Number.isFinite(v.rank)&&Number.isFinite(v.rating))cur.push([x(i),y(v.rank),v]);else if(cur.length){chunks.push(cur);cur=[];}});if(cur.length)chunks.push(cur);return chunks.map(chunk=>{const pts=chunk.map(c=>`${c[0]},${c[1]}`).join(' '),dots=chunk.map(c=>`<g><circle class="rank-dot-${si+1}" cx="${c[0]}" cy="${c[1]}" r="2.8"/><circle class="rank-point-hit js-rank-point" cx="${c[0]}" cy="${c[1]}" r="10" tabindex="0" data-school="${escapeHtml(ser.school.name)}" data-date="${escapeHtml(c[2].date)}" data-rank="${c[2].rank}" data-rating="${c[2].rating}"><title>${escapeHtml(ser.school.name)} ${c[2].date} ${c[2].rank}位 / Rating ${formatRating(c[2].rating)}</title></circle></g>`).join('');return `<polyline class="rank-line rank-line-${si+1}" points="${pts}"/>${dots}`;}).join('');}).join('');
    els.rankCompareChart.innerHTML=`${grid}${lines}${xLabels}<text class="rank-chart-label" x="14" y="18">上位</text>`;
    bindRankCompareTooltips();
    els.rankCompareLegend.innerHTML=series.map((ser,i)=>`<span class="rank-legend-item"><span class="rank-legend-swatch rank-legend-${i+1}"></span>${escapeHtml(ser.school.name)}（${escapeHtml(ser.school.pref)}）</span>`).join('');
    if(els.rankCompareStatus){els.rankCompareStatus.textContent=`${state.compareStartDate} ～ ${state.compareEndDate} · 月末時点の順位${isAdmin()?'（管理者：全校対象）':'（Rating 1500以上を対象）'} · 点にカーソルを合わせると順位とRatingを表示`;}
  }

  function proposalSchoolLabel(school){return school?`${school.name}（${school.pref}）`:'';}
  function proposalSideEls(side){return side==='A'?{input:els.mergeProposalSchoolA,results:els.mergeProposalSchoolAResults,selected:els.mergeProposalSchoolASelected,hitsKey:'mergeProposalAHits',keyKey:'mergeProposalAKey'}:{input:els.mergeProposalSchoolB,results:els.mergeProposalSchoolBResults,selected:els.mergeProposalSchoolBSelected,hitsKey:'mergeProposalBHits',keyKey:'mergeProposalBKey'};}
  function currentProposalType(){return String(els.schoolMergeProposalType?.value||'same_school_different_names');}
  function selectedResultProposalMatch(){return state.matches.find(m=>String(m.id)===String(state.resultProposalMatchId))||null;}
  function resultProposalMatchLabel(m){if(!m)return '';const v=normalizeMatch(m);return `${v.date} ${v.team_a} ${v.score_a}-${v.score_b} ${v.team_b}（${v.tournament}）`;}
  function updateProposalMode(){
    const resultMode=currentProposalType()==='match_result';
    els.schoolMergeProposalFields?.classList.toggle('hidden',resultMode);
    els.matchResultProposalFields?.classList.toggle('hidden',!resultMode);
    updateMergeProposalSelection();updateResultProposalSelection();
  }
  function updateMergeProposalSelection(){
    const a=resolveSchool(state.mergeProposalAKey),b=resolveSchool(state.mergeProposalBKey),active=currentProposalType()==='same_school_different_names';
    if(els.mergeProposalSchoolASelected){els.mergeProposalSchoolASelected.textContent=a?proposalSchoolLabel(a):'未選択';els.mergeProposalSchoolASelected.classList.toggle('muted',!a);}
    if(els.mergeProposalSchoolBSelected){els.mergeProposalSchoolBSelected.textContent=b?proposalSchoolLabel(b):'未選択';els.mergeProposalSchoolBSelected.classList.toggle('muted',!b);}
    if(els.schoolMergeProposalSubmit&&active){els.schoolMergeProposalSubmit.textContent='この2校を同一校として提案';els.schoolMergeProposalSubmit.disabled=!a||!b||a.key===b.key||a.pref!==b.pref;}
  }
  function updateResultProposalSelection(){
    const m=selectedResultProposalMatch(),active=currentProposalType()==='match_result';
    if(els.resultProposalMatchSelected){els.resultProposalMatchSelected.textContent=m?resultProposalMatchLabel(m):'未選択';els.resultProposalMatchSelected.classList.toggle('muted',!m);}
    if(els.schoolMergeProposalSubmit&&active){const sa=Number(els.resultProposalScoreA?.value),sb=Number(els.resultProposalScoreB?.value);els.schoolMergeProposalSubmit.textContent='試合結果の修正を提案';els.schoolMergeProposalSubmit.disabled=!m||!Number.isInteger(sa)||sa<0||!Number.isInteger(sb)||sb<0;}
  }
  function renderMergeProposalSearch(side){
    const refs=proposalSideEls(side),q=normalizeSearchText(refs.input?.value||'');if(!refs.results)return;
    if(!q){state[refs.hitsKey]=[];refs.results.innerHTML='';refs.results.classList.add('hidden');return;}
    const other=resolveSchool(side==='A'?state.mergeProposalBKey:state.mergeProposalAKey);const hits=state.schools.filter(s=>schoolMatchesSearch(s,q)&&(!other||s.pref===other.pref)&&(!other||s.key!==other.key)).slice(0,30);state[refs.hitsKey]=hits;
    refs.results.innerHTML=hits.length?hits.map((s,i)=>`<button class="school-search-item js-merge-proposal-school" type="button" data-index="${i}"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.pref)} · ${s.games.length}試合</span></button>`).join(''):'<div class="school-search-empty">該当する学校がありません。</div>';
    refs.results.classList.remove('hidden');refs.results.querySelectorAll('.js-merge-proposal-school').forEach(b=>b.onclick=()=>selectMergeProposalSchool(side,Number(b.dataset.index)));
  }
  function selectMergeProposalSchool(side,index){
    const refs=proposalSideEls(side),school=state[refs.hitsKey]?.[index];if(!school)return;
    state[refs.keyKey]=school.key;refs.input.value='';refs.results.innerHTML='';refs.results.classList.add('hidden');state[refs.hitsKey]=[];setMessage(els.schoolMergeProposalMessage,'');updateMergeProposalSelection();
  }
  function renderResultProposalSearch(){
    const q=normalizeSearchText(els.resultProposalMatchSearch?.value||'');if(!els.resultProposalMatchResults)return;
    if(!q){state.resultProposalHits=[];els.resultProposalMatchResults.innerHTML='';els.resultProposalMatchResults.classList.add('hidden');return;}
    const hits=matchesNewestFirst().filter(m=>{const v=normalizeMatch(m);return normalizeSearchText([m.date,m.tournament,m.stage,m.team_a,m.team_b,v.tournament,v.team_a,v.team_b,m.score_a,m.score_b].join(' ')).includes(q);}).slice(0,30);state.resultProposalHits=hits;
    els.resultProposalMatchResults.innerHTML=hits.length?hits.map((m,i)=>{const v=normalizeMatch(m);return `<button class="school-search-item js-result-proposal-match" type="button" data-index="${i}"><strong>${escapeHtml(v.date)} ${escapeHtml(v.team_a)} ${v.score_a}-${v.score_b} ${escapeHtml(v.team_b)}</strong><span>${escapeHtml(v.tournament)}${v.stage?` · ${escapeHtml(v.stage)}`:''}</span></button>`;}).join(''):'<div class="school-search-empty">該当する試合がありません。</div>';
    els.resultProposalMatchResults.classList.remove('hidden');els.resultProposalMatchResults.querySelectorAll('.js-result-proposal-match').forEach(b=>b.onclick=()=>selectResultProposalMatch(Number(b.dataset.index)));
  }
  function selectResultProposalMatch(index){
    const m=state.resultProposalHits?.[index];if(!m)return;state.resultProposalMatchId=m.id;state.resultProposalHits=[];if(els.resultProposalMatchSearch)els.resultProposalMatchSearch.value='';if(els.resultProposalMatchResults){els.resultProposalMatchResults.innerHTML='';els.resultProposalMatchResults.classList.add('hidden');}if(els.resultProposalScoreA)els.resultProposalScoreA.value=String(m.score_a);if(els.resultProposalScoreB)els.resultProposalScoreB.value=String(m.score_b);setMessage(els.schoolMergeProposalMessage,'');updateResultProposalSelection();
  }
  function clearMergeProposalForm(keepMessage=false){
    state.mergeProposalAKey=null;state.mergeProposalBKey=null;state.mergeProposalAHits=[];state.mergeProposalBHits=[];state.resultProposalMatchId=null;state.resultProposalHits=[];
    [els.mergeProposalSchoolA,els.mergeProposalSchoolB,els.resultProposalMatchSearch,els.resultProposalScoreA,els.resultProposalScoreB,els.resultProposalSourceUrl,els.resultProposalComment].forEach(x=>{if(x)x.value='';});[els.mergeProposalSchoolAResults,els.mergeProposalSchoolBResults,els.resultProposalMatchResults].forEach(x=>{if(x){x.innerHTML='';x.classList.add('hidden');}});if(!keepMessage)setMessage(els.schoolMergeProposalMessage,'');updateMergeProposalSelection();updateResultProposalSelection();
  }
  async function submitSchoolMergeProposal(e){
    e.preventDefault();if(!state.client)return;
    if(currentProposalType()==='match_result'){
      const m=selectedResultProposalMatch(),scoreA=Number(els.resultProposalScoreA?.value),scoreB=Number(els.resultProposalScoreB?.value);if(!m)return setMessage(els.schoolMergeProposalMessage,'対象試合を検索して選択してください。','error');if(!Number.isInteger(scoreA)||scoreA<0||!Number.isInteger(scoreB)||scoreB<0)return setMessage(els.schoolMergeProposalMessage,'正しい得点を0以上の整数で入力してください。','error');if(scoreA===m.score_a&&scoreB===m.score_b)return setMessage(els.schoolMergeProposalMessage,'現在登録されている得点と同じです。','error');
      setMessage(els.schoolMergeProposalMessage,'送信中…');if(els.schoolMergeProposalSubmit)els.schoolMergeProposalSubmit.disabled=true;
      const {error}=await state.client.from('match_result_proposals').insert({match_id:m.id,proposed_score_a:scoreA,proposed_score_b:scoreB,source_url:String(els.resultProposalSourceUrl?.value||'').trim()||null,comment:String(els.resultProposalComment?.value||'').trim()||null,status:'pending'});
      if(error){state.correctionProposalAvailable=false;const duplicate=error.code==='23505';setMessage(els.schoolMergeProposalMessage,duplicate?'同じ試合・同じ得点の修正提案はすでに送信されています。':`送信できませんでした: ${error.message}。管理者は match_result_proposals テーブルを確認してください。`,'error');updateResultProposalSelection();return;}
      state.correctionProposalAvailable=true;clearMergeProposalForm(true);setMessage(els.schoolMergeProposalMessage,'試合結果の修正提案を送信しました。ありがとうございます。','success');return;
    }
    const a=resolveSchool(state.mergeProposalAKey),b=resolveSchool(state.mergeProposalBKey);if(!a||!b)return setMessage(els.schoolMergeProposalMessage,'2つの学校を検索して選択してください。','error');if(a.key===b.key)return setMessage(els.schoolMergeProposalMessage,'同じ学校は選択できません。','error');if(a.pref!==b.pref)return setMessage(els.schoolMergeProposalMessage,'同一校の別名提案は同じ都道府県の学校同士で選択してください。','error');
    const pair=[`${a.pref}||${a.name}`,`${b.pref}||${b.name}`].sort((x,y)=>x.localeCompare(y,'ja'));setMessage(els.schoolMergeProposalMessage,'送信中…');if(els.schoolMergeProposalSubmit)els.schoolMergeProposalSubmit.disabled=true;
    const {error}=await state.client.from('school_merge_proposals').insert({proposal_type:'same_school_different_names',school_a_name:a.name,school_a_pref:a.pref,school_b_name:b.name,school_b_pref:b.pref,pair_key:`${pair[0]}<>${pair[1]}`});
    if(error){state.mergeProposalAvailable=false;const duplicate=error.code==='23505';setMessage(els.schoolMergeProposalMessage,duplicate?'同じ組み合わせの提案はすでに送信されています。':`送信できませんでした: ${error.message}。管理者は upgrade-school-merge-proposals.sql を実行してください。`,'error');updateMergeProposalSelection();return;}
    state.mergeProposalAvailable=true;clearMergeProposalForm(true);setMessage(els.schoolMergeProposalMessage,'提案を送信しました。ありがとうございます。','success');
  }

  async function loadProposals(){
    if(!state.client||!state.session?.user||!els.proposalAdminList)return;
    const [legacyRes,mergeRes,resultRes]=await Promise.all([
      state.client.from('correction_proposals').select('id,match_id,field_name,proposed_value,source_url,comment,status,created_at').order('created_at',{ascending:false}).limit(100),
      state.client.from('school_merge_proposals').select('id,proposal_type,school_a_name,school_a_pref,school_b_name,school_b_pref,status,created_at').order('created_at',{ascending:false}).limit(100),
      state.client.from('match_result_proposals').select('id,match_id,proposed_score_a,proposed_score_b,source_url,comment,status,created_at').order('created_at',{ascending:false}).limit(100)
    ]);
    const items=[];
    if(!mergeRes.error){items.push(...(mergeRes.data||[]).map(x=>({...x,_kind:'school_merge'})));state.mergeProposalAvailable=true;}else{state.mergeProposalAvailable=false;console.warn('school_merge_proposals unavailable:',mergeRes.error.message);}
    if(!legacyRes.error)items.push(...(legacyRes.data||[]).map(x=>({...x,_kind:'match'})));else console.warn('correction_proposals unavailable:',legacyRes.error.message);
    if(!resultRes.error){items.push(...(resultRes.data||[]).map(x=>({...x,_kind:'match_result'})));state.correctionProposalAvailable=true;}else{state.correctionProposalAvailable=false;console.warn('match_result_proposals unavailable:',resultRes.error.message);}
    state.proposals=items.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,100);renderAdminProposals();
    if(!state.proposals.length&&mergeRes.error&&legacyRes.error&&resultRes.error)els.proposalAdminList.innerHTML='<div class="empty">提案テーブルを読み込めません。必要なアップグレードSQLを確認してください。</div>';
  }
  function renderAdminProposals(){
    if(!els.proposalAdminList)return;if(!state.proposals.length){els.proposalAdminList.innerHTML='<div class="empty">提案はありません。</div>';return;}
    els.proposalAdminList.innerHTML=state.proposals.map(p=>{
      if(p._kind==='school_merge')return `<div class="proposal-admin-item"><div class="match-meta">学校名重複提案 · ${escapeHtml(p.created_at||'')} · 状態: ${escapeHtml(p.status||'pending')}</div><strong>${escapeHtml(p.school_a_name)}（${escapeHtml(p.school_a_pref)}） ⇔ ${escapeHtml(p.school_b_name)}（${escapeHtml(p.school_b_pref)}）</strong><p>同じ高校が別の名前で登録されている、という提案です。</p><div class="match-actions"><button class="btn primary small js-proposal-resolve" type="button" data-kind="school_merge" data-id="${escapeHtml(p.id)}">対応済み</button><button class="btn secondary small js-proposal-dismiss" type="button" data-kind="school_merge" data-id="${escapeHtml(p.id)}">却下</button></div></div>`;
      const m=state.matches.find(x=>x.id===p.match_id),mv=m?normalizeMatch(m):null,matchText=mv?`${mv.date} ${mv.team_a} ${mv.score_a}-${mv.score_b} ${mv.team_b}`:`試合ID: ${p.match_id}`;
      if(p._kind==='match_result')return `<div class="proposal-admin-item"><div class="match-meta">試合結果の修正 · ${escapeHtml(matchText)} · ${escapeHtml(p.created_at||'')} · 状態: ${escapeHtml(p.status||'pending')}</div><strong>提案スコア: ${escapeHtml(p.proposed_score_a)}-${escapeHtml(p.proposed_score_b)}</strong>${p.comment?`<p>${escapeHtml(p.comment)}</p>`:''}${p.source_url?`<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener noreferrer">出典を開く</a>`:''}<div class="match-actions"><button class="btn secondary small js-proposal-edit" type="button" data-match="${escapeHtml(p.match_id)}">元試合を編集</button><button class="btn primary small js-proposal-resolve" type="button" data-kind="match_result" data-id="${escapeHtml(p.id)}">対応済み</button><button class="btn secondary small js-proposal-dismiss" type="button" data-kind="match_result" data-id="${escapeHtml(p.id)}">却下</button></div></div>`;
      return `<div class="proposal-admin-item"><div class="match-meta">${escapeHtml(matchText)} · ${escapeHtml(p.created_at||'')} · 状態: ${escapeHtml(p.status||'pending')}</div><strong>${escapeHtml(p.field_name)}: ${escapeHtml(p.proposed_value)}</strong>${p.comment?`<p>${escapeHtml(p.comment)}</p>`:''}${p.source_url?`<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener noreferrer">出典を開く</a>`:''}<div class="match-actions"><button class="btn secondary small js-proposal-edit" type="button" data-match="${escapeHtml(p.match_id)}">元試合を編集</button><button class="btn primary small js-proposal-resolve" type="button" data-kind="match" data-id="${escapeHtml(p.id)}">対応済み</button><button class="btn secondary small js-proposal-dismiss" type="button" data-kind="match" data-id="${escapeHtml(p.id)}">却下</button></div></div>`;
    }).join('');
    els.proposalAdminList.querySelectorAll('.js-proposal-edit').forEach(b=>b.onclick=()=>startEdit(b.dataset.match));els.proposalAdminList.querySelectorAll('.js-proposal-resolve').forEach(b=>b.onclick=()=>updateProposalStatus(b.dataset.id,'resolved',b.dataset.kind));els.proposalAdminList.querySelectorAll('.js-proposal-dismiss').forEach(b=>b.onclick=()=>updateProposalStatus(b.dataset.id,'dismissed',b.dataset.kind));
  }
  async function updateProposalStatus(id,status,kind='match'){const table=kind==='school_merge'?'school_merge_proposals':kind==='match_result'?'match_result_proposals':'correction_proposals';const {error}=await state.client.from(table).update({status}).eq('id',id);if(error)return alert(error.message);await loadProposals();}

  function renderSimulator(){const a=Number(els.ratingA.value),b=Number(els.ratingB.value),pk=parseOptionalK(els.kValue.value),k=pk.value;if(![a,b].every(Number.isFinite)||k===null){els.simResult.innerHTML='';return;}const e=expectation(a,b),w=k*(1-e),d=k*(.5-e),l=k*(0-e);els.simResult.innerHTML=`<div><span>A校の勝利期待値</span><strong>${(e*100).toFixed(1)}%</strong></div><div><span>A校が勝った場合</span><strong class="${deltaClass(w)}">${formatDelta(w)}</strong></div><div><span>引分 / 敗戦</span><strong>${formatDelta(d)} / ${formatDelta(l)}</strong></div>`;}

  async function loadSiteSettings(){
    if(!state.client)return;
    const {data,error}=await state.client.from('site_settings').select('*').eq('id',1).maybeSingle();
    if(error){
      console.warn('site_settings unavailable:',error.message);
      state.settings={...DEFAULT_SITE_SETTINGS};state.settingsAvailable=false;renderStaticConfig();applyPublicVisibility();return;
    }
    state.settings={...DEFAULT_SITE_SETTINGS,...(data||{})};state.settingsAvailable=true;renderStaticConfig();applyPublicVisibility();
  }
  async function loadTournamentKSettings(){
    if(!state.client)return;
    const {data,error}=await state.client.from('tournament_k_settings').select('type,label,k');
    if(error){
      console.warn('tournament_k_settings unavailable:',error.message);
      state.kSettings={...DEFAULT_K_SETTINGS};state.kSettingsAvailable=false;renderStaticConfig();return;
    }
    const next={...DEFAULT_K_SETTINGS};
    for(const row of (data||[])){
      if(TOURNAMENT_TYPES[row.type]){
        const n=Number(row.k);
        if(Number.isFinite(n)&&n>0)next[row.type]=n;
      }
    }
    state.kSettings=next;state.kSettingsAvailable=true;renderStaticConfig();
  }
  function syncSiteSettingsForm(){
    if(!els.siteSettingsForm)return;
    const pairs=[
      [els.siteAutumnQualifierK,autumnQualifierK()],[els.siteAutumnRegionalK,autumnRegionalK()],[els.siteMeijiJinguK,meijiJinguK()],[els.siteSpringKoshienEarlyK,springKoshienEarlyK()],[els.siteSpringKoshienFinalK,springKoshienFinalK()],
      [els.siteSpringQualifierK,springQualifierK()],[els.siteSpringRegionalK,springRegionalK()],[els.siteSummerQualifierK,summerQualifierK()],[els.siteSummerMainEarlyK,summerMainEarlyK()],[els.siteSummerMainFinalK,summerMainFinalK()],[els.siteKokuspoK,kokuspoK()]
    ];
    pairs.forEach(([el,value])=>{if(el)el.value=value;});
    if(els.siteNewTeamRetention)els.siteNewTeamRetention.value=(newTeamRetentionRate()*100).toFixed(0);
    syncPublicSettingToggles();
    if(els.siteSettingsMessage&&!state.kSettingsAvailable)els.siteSettingsMessage.textContent='大会タグ設定テーブルがまだありません。upgrade-tournament-tags.sql を一度実行してください。';
  }
  async function handleSiteSettingsSave(e){
    e.preventDefault();if(!state.session?.user)return;
    const fields={
      autumn_qualifier:els.siteAutumnQualifierK,autumn_regional:els.siteAutumnRegionalK,meiji_jingu:els.siteMeijiJinguK,spring_koshien_early:els.siteSpringKoshienEarlyK,spring_koshien_final:els.siteSpringKoshienFinalK,
      spring_qualifier:els.siteSpringQualifierK,spring_regional:els.siteSpringRegionalK,summer_qualifier:els.siteSummerQualifierK,summer_main_early:els.siteSummerMainEarlyK,summer_main_final:els.siteSummerMainFinalK,kokuspo:els.siteKokuspoK
    };
    const values={};
    for(const [type,el] of Object.entries(fields)){
      const parsed=parseOptionalK(el?.value);
      if(parsed.error||parsed.value===null||parsed.value>200){
        el?.focus();
        return setMessage(els.siteSettingsMessage,'K値は0より大きく200以下の数値を入力してください（例：20、30、40、50）。','error');
      }
      values[type]=parsed.value;
    }
    const retentionPercent=Number(els.siteNewTeamRetention?.value);
    if(!Number.isFinite(retentionPercent)||retentionPercent<0||retentionPercent>100){
      els.siteNewTeamRetention?.focus();
      return setMessage(els.siteSettingsMessage,'新チーム移行時のレーティング継承率は0〜100%で入力してください。','error');
    }
    const now=new Date().toISOString();
    const rows=Object.entries(values).map(([type,k])=>({type,label:TOURNAMENT_TYPES[type].label,k,updated_at:now}));
    setMessage(els.siteSettingsMessage,'保存中…');
    const {data:siteData,error:siteError}=await state.client.from('site_settings').update({new_team_retention_rate:retentionPercent/100,updated_at:now}).eq('id',1).select().single();
    if(siteError)return setMessage(els.siteSettingsMessage,`継承率を保存できませんでした: ${siteError.message}。upgrade-rev31-new-team-retention.sql を実行してください。`,'error');
    const {data,error}=await state.client.from('tournament_k_settings').upsert(rows,{onConflict:'type'}).select('type,k');
    if(error)return setMessage(els.siteSettingsMessage,`K係数を保存できませんでした: ${error.message}。upgrade-tournament-tags.sql を実行済みか確認してください。`,'error');
    state.settings={...DEFAULT_SITE_SETTINGS,...state.settings,...siteData};
    const next={...state.kSettings};for(const row of (data||[]))next[row.type]=Number(row.k);
    state.kSettings=next;state.kSettingsAvailable=true;
    const r=buildRatings(state.matches);state.schoolMap=r.map;state.schools=r.schools;state.ranking=r.publicSchools;state.prefs=buildPrefStats(r.schools);markMatchDataChanged();
    renderStaticConfig();renderAll();setMessage(els.siteSettingsMessage,'K係数と新チーム継承率を保存しました。Ratingを再計算しました。','success');
  }

  async function handlePublicSettingChange(input){
    if(!state.session?.user||!input?.dataset?.setting)return;
    const key=input.dataset.setting,desired=Boolean(input.checked);
    input.disabled=true;
    const {data,error}=await state.client.from('site_settings').update({[key]:desired,updated_at:new Date().toISOString()}).eq('id',1).select().single();
    if(error){
      input.checked=!desired;
      input.disabled=false;
      alert(`公開設定を保存できませんでした: ${error.message}`);
      return;
    }
    state.settings={...DEFAULT_SITE_SETTINGS,...data};
    input.disabled=false;
    renderStaticConfig();
    applyPublicVisibility();
    renderSchoolProfile();
  }

  async function restoreSession(){state.authMode=detectAuthModeFromUrl();const ae=getAuthErrorFromUrl();if(ae)showSetupNotice(`<strong>認証リンクを処理できませんでした。</strong> ${escapeHtml(ae)}`);state.client.auth.onAuthStateChange((event,session)=>{state.session=session;if(event==='PASSWORD_RECOVERY')state.authMode='recovery';else if(event==='SIGNED_IN'&&detectAuthModeFromUrl()==='invite')state.authMode='invite';renderAuth();if(state.ready)renderAll();});const {data,error}=await state.client.auth.getSession();if(!error){state.session=data.session;renderAuth();if(state.ready)renderAll();}}
  function renderAuth(){const signed=Boolean(state.session?.user),needs=signed&&(state.authMode==='invite'||state.authMode==='recovery');els.loginPanel.classList.toggle('hidden',signed||needs);els.resetRequestPanel.classList.add('hidden');els.passwordSetupPanel.classList.toggle('hidden',!needs);els.adminPanel.classList.toggle('hidden',!signed||needs);if(needs){const inv=state.authMode==='invite';els.passwordSetupTitle.textContent=inv?'初回パスワードを設定':'新しいパスワードを設定';els.passwordSetupDescription.textContent=inv?'招待が確認されました。今後の管理者ログインに使うパスワードを設定してください。':'新しいパスワードを設定してください。';return;}if(signed){els.adminEmail.textContent=state.session.user.email||state.session.user.id;syncSiteSettingsForm();applyPublicVisibility();renderAdminMatches();loadProposals();loadEditHistory();loadSchoolAliases();loadTournamentAliases();}else{state.tournamentAliases=[];state.tournamentAliasMap=new Map();resetSchoolAliasEditor(false);resetTournamentAliasEditor(false);applyPublicVisibility();}}
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
  function duplicateQuality(m){return (m.source_url?8:0)+(m.stage?3:0)+(m.tournament_type?3:0)+(m.k!==null&&m.k!==''?2:0)+(m.tournament_original&&m.tournament_original!==canonicalTournament(m.tournament_original)?0:1);}
  function duplicateKeeper(group){return [...group].sort((a,b)=>duplicateQuality(b)-duplicateQuality(a)||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)))[0];}
  function syncDuplicateSelectionState(){
    const boxes=[...(els.duplicateMergeList?.querySelectorAll('.js-merge-duplicate')||[])],checked=boxes.filter(b=>b.checked).length;
    if(els.duplicateSelectAll){els.duplicateSelectAll.disabled=!boxes.length;els.duplicateSelectAll.checked=Boolean(boxes.length)&&checked===boxes.length;els.duplicateSelectAll.indeterminate=checked>0&&checked<boxes.length;}
    if(els.duplicateMergeButton){els.duplicateMergeButton.disabled=checked===0;els.duplicateMergeButton.textContent=checked?`選択した${checked}組を一括統合`:'選択した重複を一括統合';}
  }
  function setAllDuplicateChecks(checked){els.duplicateMergeList?.querySelectorAll('.js-merge-duplicate').forEach(b=>{b.checked=checked;});syncDuplicateSelectionState();}
  function renderDuplicateMergeList(){
    if(!els.duplicateMergeList)return;
    if(!state.duplicateGroups.length){els.duplicateMergeList.innerHTML='<div class="empty">重複候補はありません。</div>';if(els.duplicateSelectAll){els.duplicateSelectAll.checked=false;els.duplicateSelectAll.indeterminate=false;els.duplicateSelectAll.disabled=true;}if(els.duplicateMergeButton)els.duplicateMergeButton.disabled=true;return;}
    els.duplicateMergeList.innerHTML=state.duplicateGroups.map((group,i)=>{const keep=duplicateKeeper(group);return `<label class="duplicate-group"><input class="js-merge-duplicate" type="checkbox" data-index="${i}"><span><strong>${escapeHtml(group[0].date)} ${escapeHtml(group[0].team_a_display||group[0].team_a)} ${group[0].score_a}-${group[0].score_b} ${escapeHtml(group[0].team_b_display||group[0].team_b)}</strong><small>${group.length}件重複 · 残す候補: ${escapeHtml(keep.tournament)}${keep.source_url?' · 出典あり':''}</small>${group.map(m=>`<code>${escapeHtml(m.tournament)} / ${escapeHtml(m.stage||'—')} / ${escapeHtml(String(m.id))}</code>`).join('')}</span></label>`;}).join('');
    syncDuplicateSelectionState();
  }
  function updateDuplicateStatus(){
    if(state.duplicateCacheDirty){state.duplicateGroups=findDuplicateGroups();state.duplicateCacheDirty=false;}const ids=new Set(state.duplicateGroups.flat().map(m=>String(m.id)));
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
      for(const idx of checked){const group=state.duplicateGroups[idx];if(!group?.length)continue;const keep=duplicateKeeper(group),others=group.filter(m=>String(m.id)!==String(keep.id));const merged={tournament:canonicalTournament(keep.tournament_original||keep.tournament),tournament_type:keep.tournament_type||others.find(x=>x.tournament_type)?.tournament_type||inferTournamentTypeLegacy(keep),stage:keep.stage||others.find(x=>x.stage)?.stage||null,k:keep.k??others.find(x=>x.k!==null&&x.k!=='')?.k??null,source_url:keep.source_url||others.find(x=>x.source_url)?.source_url||null};const up=await state.client.from('matches').update(merged).eq('id',keep.id);if(up.error)throw up.error;const ids=others.map(x=>x.id);if(ids.length){const del=await state.client.from('matches').delete().in('id',ids);if(del.error)throw del.error;}}
      await loadMatches();await loadEditHistory();
    }catch(e){alert(`重複統合に失敗しました: ${e.message||e}`);}finally{syncDuplicateSelectionState();}
  }

  function parseOptionalK(value){
    const raw=String(value??'').normalize('NFKC').replace(/,/g,'').trim();
    if(!raw)return {value:null,error:null};
    const n=Number(raw);
    if(!Number.isFinite(n)||n<=0)return {value:null,error:'K値は正の数で入力してください。空欄なら大会レベルから自動判定します。'};
    return {value:n,error:null};
  }
  function readMatchForm(){
    const parsedK=parseOptionalK(els.matchK.value),su=els.sourceUrl.value.trim();
    const formYear=String(els.matchDate.value||'').slice(0,4);return{date:els.matchDate.value,tournament:canonicalTournamentForYear(els.tournament.value,formYear),tournament_type:String(els.tournamentType?.value||'').trim(),stage:els.stage.value.trim()||null,team_a:els.teamA.value.trim(),pref_a:els.prefA.value.trim(),score_a:Number(els.scoreA.value),team_b:els.teamB.value.trim(),pref_b:els.prefB.value.trim(),score_b:Number(els.scoreB.value),k:parsedK.value,_kError:parsedK.error,source_url:su||null};
  }
  function validateMatchPayload(p){if(!p.date)return'試合日を入力してください。';if(!p.tournament)return'大会名を入力してください。';if(!TOURNAMENT_TYPES[p.tournament_type])return'大会区分（11種類のタグ）を選択してください。';if(!p.team_a||!p.team_b)return'両校の学校名を入力してください。';if(!p.pref_a||!p.pref_b)return'両校の都道府県を入力してください。';if(!Number.isInteger(p.score_a)||p.score_a<0||!Number.isInteger(p.score_b)||p.score_b<0)return'得点を確認してください。';if(p._kError)return p._kError;if(schoolKey(p.team_a,p.pref_a)===schoolKey(p.team_b,p.pref_b))return'同じチーム同士の試合は登録できません。';return null;}
  async function handleMatchSubmit(e){
    e.preventDefault();if(!state.session?.user)return setMessage(els.matchFormMessage,'管理者ログインが必要です。','error');
    let p=readMatchForm(),ve=validateMatchPayload(p);if(ve)return setMessage(els.matchFormMessage,ve,'error');delete p._kError;
    const aliasCheck=applyKnownAliasesToPayload(p);
    if(aliasCheck.changes.length&&confirm(`学校名の別名辞書に一致しました。\n\n${aliasCheck.changes.join('\n')}\n\n統一名に変更して登録しますか？`))p=aliasCheck.payload;
    const id=els.editingMatchId.value,dup=findDuplicateForPayload(p,id);if(dup)return setMessage(els.matchFormMessage,`重複の可能性が高い試合が既に登録されています：${dup.date} ${dup.team_a_display||dup.team_a} ${dup.score_a}-${dup.score_b} ${dup.team_b_display||dup.team_b}（${dup.tournament}）`,'error');
    setMessage(els.matchFormMessage,id?'更新中…':'登録中…');const columns='id,date,tournament,tournament_type,stage,team_a,pref_a,score_a,team_b,pref_b,score_b,k,source_url,created_at';const q=id?state.client.from('matches').update(p).eq('id',id).select(columns).single():state.client.from('matches').insert(p).select(columns).single();const r=await q;if(r.error)return setMessage(els.matchFormMessage,r.error.message,'error');if(id){const at=state.matches.findIndex(m=>String(m.id)===String(id));if(at>=0)state.matches[at]=r.data;else state.matches.push(r.data);}else state.matches.push(r.data);rebuildFromLocalMatches(true);resetMatchForm();setMessage(els.matchFormMessage,id?'試合を更新しました。':'試合を登録しました。','success');renderAliasSuggestions();await loadEditHistory();
  }
  function resetMatchForm(){els.matchForm.reset();els.editingMatchId.value='';els.matchFormTitle.textContent='試合を登録';els.saveMatchButton.textContent='試合を登録';els.cancelEditButton.classList.add('hidden');els.matchDate.value=new Date().toISOString().slice(0,10);if(els.tournamentType)els.tournamentType.value='';}
  function startEdit(id){const m=state.matches.find(x=>x.id===id);if(!m)return;els.editingMatchId.value=m.id;els.matchDate.value=m.date||'';els.tournament.value=m.tournament_original||m.tournament||'';if(els.tournamentType)els.tournamentType.value=m.tournament_type||inferTournamentTypeLegacy(m)||'';els.stage.value=m.stage||'';els.teamA.value=m.team_a_display||m.team_a||'';els.prefA.value=m.pref_a||'';els.scoreA.value=m.score_a??'';els.teamB.value=m.team_b_display||m.team_b||'';els.prefB.value=m.pref_b||'';els.scoreB.value=m.score_b??'';els.matchK.value=m.k??'';els.sourceUrl.value=m.source_url||'';els.matchFormTitle.textContent='試合を編集';els.saveMatchButton.textContent='変更を保存';els.cancelEditButton.classList.remove('hidden');document.querySelector('#admin').scrollIntoView({behavior:'smooth'});}
  async function deleteMatch(id){const m=state.matches.find(x=>String(x.id)===String(id));if(!m||!confirm(`${m.date} ${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b}\nこの試合を削除しますか？`))return;const {error}=await state.client.from('matches').delete().eq('id',id);if(error)return alert(error.message);state.matches=state.matches.filter(x=>String(x.id)!==String(id));rebuildFromLocalMatches(true);await loadEditHistory();}
  function normalizeSearchText(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
  function matchesNewestFirst(){if(!state.matchSortCache)state.matchSortCache=[...state.matches].sort(compareMatches).reverse();return state.matchSortCache;}
  function renderAdminMatches(){
    if(!els.adminMatchesBody||!state.session?.user){if(els.adminMatchesBody)els.adminMatchesBody.innerHTML='';if(els.adminMatchSearchStatus)els.adminMatchSearchStatus.textContent='';return;}
    const keyword=normalizeSearchText(els.adminMatchKeyword?.value);
    const date=String(els.adminMatchDate?.value||'').trim();
    const tournament=normalizeSearchText(els.adminMatchTournament?.value);
    const school=normalizeSearchText(els.adminMatchSchool?.value);
    const duplicateIds=updateDuplicateStatus();
    const active=Boolean(keyword||date||tournament||school||state.showDuplicatesOnly);
    let rows=matchesNewestFirst();
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
    els.adminMatchesBody.innerHTML=shown.length?shown.map(m=>`<tr><td>${escapeHtml(m.date)}${duplicateIds.has(String(m.id))?' <span class="duplicate-badge">重複候補</span>':''}</td><td>${escapeHtml(m.tournament)}<br><span class="tournament-type-badge">${escapeHtml(tournamentTypeLabel(m.tournament_type||inferTournamentTypeLegacy(m)))}</span>${m.stage?`<br><span class="muted">${escapeHtml(m.stage)}</span>`:''}</td><td>${escapeHtml(m.team_a_display||m.team_a)} ${m.score_a} - ${m.score_b} ${escapeHtml(m.team_b_display||m.team_b)}</td><td><div class="action-buttons"><button class="btn secondary small js-edit" data-id="${escapeHtml(m.id)}" type="button">編集</button><button class="btn danger small js-delete" data-id="${escapeHtml(m.id)}" type="button">削除</button></div></td></tr>`).join(''):'<tr><td colspan="4" class="empty">該当する試合がありません。</td></tr>';
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
  function rawPrefVariants(pref){const p=canonicalPref(pref);if(p==='東京')return ['東京','東東京','西東京'];if(p==='北海道')return ['北海道','北北海道','南北海道'];return [p];}
  function aliasPrefKey(pref){return canonicalPref(String(pref??'').trim());}
  function aliasNameKey(name){return normalizeSearchText(name);}
  function schoolAliasLookupKey(pref,name){return `${aliasPrefKey(pref)}||${aliasNameKey(name)}`;}
  function schoolTargetFromMaster(master){
    return master?{master_id:String(master.id),prefecture:aliasPrefKey(master.prefecture),primary_name:String(master.display_name||master.official_name||'').trim(),display_name:String(master.display_name||master.official_name||'').trim()}:null;
  }
  function rebuildSchoolAliasMap(){
    state.schoolAliasMap=new Map();state.schoolMasterById=new Map();state.schoolNameMap=new Map();
    for(const master of state.schoolMasters){
      state.schoolMasterById.set(String(master.id),master);
      const target=schoolTargetFromMaster(master);if(!target)continue;
      for(const name of [master.display_name,master.official_name]){
        const key=schoolAliasLookupKey(master.prefecture,name);if(name&&key&&!key.endsWith('||')&&!state.schoolNameMap.has(key))state.schoolNameMap.set(key,target);
      }
    }
    for(const a of state.schoolAliases){
      const master=state.schoolMasterById.get(String(a.school_id||''));
      const target=schoolTargetFromMaster(master)||{master_id:null,prefecture:aliasPrefKey(a.prefecture),primary_name:String(a.canonical_name||'').trim(),display_name:String(a.canonical_name||'').trim()};
      const alias=String(a.alias_name||a.name||'').trim();if(!alias)continue;
      a.alias_name=alias;a.canonical_name=target.display_name;
      const key=schoolAliasLookupKey(a.prefecture,alias);if(!key||key.endsWith('||'))continue;
      if(aliasNameKey(alias)!==aliasNameKey(target.display_name))state.schoolAliasMap.set(key,a);
      if(!state.schoolNameMap.has(key))state.schoolNameMap.set(key,target);
    }
  }
  function resolveSingleSchoolIdentity(name,pref){
    const raw=String(name??'').trim(),target=state.schoolNameMap.get(schoolAliasLookupKey(pref,raw));
    return target?{name:target.display_name||raw,officialName:target.primary_name||null,masterId:target.master_id||null,matched:true}:{name:raw,officialName:null,masterId:null,matched:false};
  }
  function resolveTeamIdentity(name,pref){
    const raw=String(name??'').trim(),direct=resolveSingleSchoolIdentity(raw,pref);if(direct.matched)return {...direct,isJoint:false};
    const joint=normalizeJointName(raw);if(!joint.isJoint)return {name:joint.name,officialName:null,masterId:null,matched:false,isJoint:false};
    const parts=joint.members.map(part=>resolveSingleSchoolIdentity(part,pref).name),sorted=[...new Set(parts)].sort((a,b)=>a.localeCompare(b,'ja'));
    return {name:sorted.join('・'),officialName:null,masterId:null,matched:parts.some((x,i)=>x!==joint.members[i]),isJoint:true};
  }
  function findKnownAlias(name,pref){const key=schoolAliasLookupKey(pref,name);if(!key||key.endsWith('||'))return null;return state.schoolAliasMap.get(key)||null;}
  async function loadSchoolAliases(){
    if(!state.client)return;
    const masterRes=await state.client.from('school_name_master').select('id,prefecture,official_name,display_name,created_at,updated_at').order('prefecture',{ascending:true}).order('display_name',{ascending:true});
    const variantRes=await state.client.from('school_name_variants').select('id,school_id,prefecture,name,created_at,updated_at').order('prefecture',{ascending:true}).order('id',{ascending:true});
    state.schoolMasterAvailable=!masterRes.error;state.schoolVariantAvailable=!variantRes.error;
    if(state.schoolMasterAvailable&&state.schoolVariantAvailable){
      state.schoolMasters=masterRes.data||[];
      state.schoolAliases=(variantRes.data||[]).map(v=>({...v,alias_name:String(v.name||'').trim(),canonical_name:''}));
      state.aliasesAvailable=true;
    }else{
      const legacy=await state.client.from('school_aliases').select('id,prefecture,alias_name,canonical_name,school_id,created_at,updated_at').order('prefecture',{ascending:true}).order('alias_name',{ascending:true});
      state.aliasesAvailable=!legacy.error;state.schoolAliases=legacy.error?[]:(legacy.data||[]);state.schoolMasters=[];
      if(!legacy.error){
        const grouped=new Map();
        for(const a of state.schoolAliases){const k=`${aliasPrefKey(a.prefecture)}||${String(a.canonical_name||'').trim()}`;if(!grouped.has(k))grouped.set(k,{id:k,prefecture:aliasPrefKey(a.prefecture),official_name:a.canonical_name,display_name:a.canonical_name});}
        state.schoolMasters=[...grouped.values()];
      }
    }
    rebuildSchoolAliasMap();renderAliasPrefFilter();renderAliasList();renderAliasSuggestions();
    if(els.aliasMessage){
      if(state.schoolMasterAvailable&&state.schoolVariantAvailable)els.aliasMessage.textContent='';
      else if(state.aliasesAvailable)els.aliasMessage.textContent='旧辞書を互換表示しています。school_name_master / school_name_variants を有効にすると無制限の名称編集が使えます。';
      else els.aliasMessage.textContent='学校名辞書を読み込めません。upgrade-rev27.sql の実行状況を確認してください。';
    }
    if(state.ready)rebuildFromLocalMatches(true);
  }
  function schoolAliasGroupKey(master){return String(master?.id??'');}
  function namesForSchoolMaster(master){
    if(!master)return [];
    let rows=[];
    if(state.schoolMasterAvailable&&state.schoolVariantAvailable)rows=state.schoolAliases.filter(a=>String(a.school_id||'')===String(master.id));
    else rows=state.schoolAliases.filter(a=>aliasPrefKey(a.prefecture)===aliasPrefKey(master.prefecture)&&aliasNameKey(a.canonical_name)===aliasNameKey(master.display_name));
    const seen=new Set(),out=[];
    for(const row of rows){const n=String(row.alias_name||row.name||'').trim(),k=aliasNameKey(n);if(!n||!k||seen.has(k)||k===aliasNameKey(master.display_name))continue;seen.add(k);out.push(n);}
    return out;
  }
  function schoolAliasGroups(){
    return state.schoolMasters.map(master=>({key:schoolAliasGroupKey(master),masterId:String(master.id),master,prefecture:aliasPrefKey(master.prefecture),canonical_name:String(master.display_name||master.official_name||'').trim(),rows:state.schoolAliases.filter(a=>String(a.school_id||'')===String(master.id)),aliases:namesForSchoolMaster(master)})).sort((a,b)=>a.prefecture.localeCompare(b.prefecture,'ja')||a.canonical_name.localeCompare(b.canonical_name,'ja'));
  }
  function schoolAliasGroupByKey(key){return schoolAliasGroups().find(g=>String(g.key)===String(key))||null;}
  function schoolAliasGroupStats(group){
    const aliasSet=new Set(group.aliases.map(x=>String(x||'').trim()).filter(Boolean)),perName=new Map([...aliasSet].map(n=>[n,0])),matchIds=new Set();let appearances=0;
    for(const m of state.matches){for(const [teamField,prefField] of [['team_a','pref_a'],['team_b','pref_b']]){if(canonicalPref(m[prefField])!==group.prefecture)continue;const team=String(m[teamField]||'').trim();if(!aliasSet.has(team))continue;appearances++;perName.set(team,(perName.get(team)||0)+1);matchIds.add(String(m.id));}}
    return {matches:matchIds.size,appearances,perName};
  }
  function renderAliasPrefFilter(){
    if(!els.aliasListPrefFilter)return;const previous=els.aliasListPrefFilter.value,prefs=[...new Set(schoolAliasGroups().map(g=>g.prefecture).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));els.aliasListPrefFilter.innerHTML='<option value="">すべて</option>'+prefs.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');if(prefs.includes(previous))els.aliasListPrefFilter.value=previous;
  }
  function renderAliasList(){
    if(!els.aliasList)return;if(!state.aliasesAvailable){els.aliasList.innerHTML='<div class="empty">学校名辞書を読み込めません。</div>';return;}
    const pref=els.aliasListPrefFilter?.value||'',groups=schoolAliasGroups().filter(g=>!pref||g.prefecture===pref);
    if(!groups.length){els.aliasList.innerHTML=`<div class="empty">${pref?'この都道府県の名称辞書はありません。':'登録済み名称辞書はありません。'}</div>`;return;}
    els.aliasList.innerHTML=groups.map(g=>{const stats=schoolAliasGroupStats(g),counts=g.aliases.map(n=>`${escapeHtml(n)} ${Number(stats.perName.get(n)||0).toLocaleString('ja-JP')}箇所`).join(' / '),status=g.aliases.length?(stats.appearances?`候補 ${stats.matches.toLocaleString('ja-JP')}試合・${stats.appearances.toLocaleString('ja-JP')}箇所（${counts}）`:'候補 0件（現在の試合データに未統合の一致なし）'):'別名はまだ登録されていません。';return `<div class="school-alias-item"><div class="school-alias-item-main"><strong>${escapeHtml(g.prefecture)}：${g.aliases.length?g.aliases.map(escapeHtml).join(' / '):'（名称なし）'} <span class="school-alias-arrow">→</span> ${escapeHtml(g.canonical_name)}</strong><small>${status}</small></div><div class="dictionary-row-actions"><button class="btn secondary small js-alias-edit" type="button" data-key="${escapeHtml(g.key)}">編集</button><button class="btn primary small js-alias-integrate" type="button" data-key="${escapeHtml(g.key)}" ${stats.appearances?'':'disabled'}>DB統合</button><button class="btn danger small js-alias-delete" type="button" data-key="${escapeHtml(g.key)}">削除</button></div></div>`;}).join('');
    els.aliasList.querySelectorAll('.js-alias-edit').forEach(b=>b.onclick=()=>beginEditSchoolAlias(b.dataset.key));els.aliasList.querySelectorAll('.js-alias-integrate').forEach(b=>b.onclick=()=>integrateSchoolAlias(b.dataset.key));els.aliasList.querySelectorAll('.js-alias-delete').forEach(b=>b.onclick=()=>deleteSchoolAlias(b.dataset.key));
  }
  function renderAliasSuggestions(){renderAliasList();}
  function renderSchoolAliasNameInputs(names=['','','']){
    if(!els.aliasNamesContainer)return;const values=(names&&names.length?names:['','','']).map(x=>String(x||''));while(values.length<3)values.push('');
    els.aliasNamesContainer.innerHTML=values.map((value,i)=>`<div class="alias-name-row"><label><span>名称${i+1}</span><input class="alias-name-input" type="text" value="${escapeHtml(value)}" placeholder="${i===0?'例：専修大松戸':'任意'}" autocomplete="off" /></label><button class="btn secondary small alias-name-remove ${values.length<=1?'hidden':''}" type="button" aria-label="名称${i+1}を削除">削除</button></div>`).join('');
  }
  function resetSchoolAliasEditor(clear=true){state.editingSchoolAliasId=null;if(clear){if(els.aliasPref)els.aliasPref.value='';if(els.aliasCanonical)els.aliasCanonical.value='';}renderSchoolAliasNameInputs(['','','']);if(els.aliasAddButton)els.aliasAddButton.textContent='名称辞書に登録';els.aliasCancelEditButton?.classList.add('hidden');}
  function beginEditSchoolAlias(key){const g=schoolAliasGroupByKey(key);if(!g)return;state.editingSchoolAliasId=g.key;if(els.aliasPref)els.aliasPref.value=g.prefecture||'';if(els.aliasCanonical)els.aliasCanonical.value=g.canonical_name||'';renderSchoolAliasNameInputs(g.aliases.length?g.aliases:['']);if(els.aliasAddButton)els.aliasAddButton.textContent='変更を保存';els.aliasCancelEditButton?.classList.remove('hidden');els.aliasPref?.focus();setMessage(els.aliasMessage,`${g.aliases.length}件の登録済み名称をすべて読み込みました。`,'success');}
  function schoolAliasEditorNames(){const seen=new Set(),out=[];for(const input of els.aliasNamesContainer?.querySelectorAll('.alias-name-input')||[]){const n=String(input.value||'').trim(),k=aliasNameKey(n);if(!n||!k||seen.has(k))continue;seen.add(k);out.push(n);}return out;}
  async function addSchoolAlias(){
    if(!state.session?.user||!state.schoolMasterAvailable||!state.schoolVariantAvailable)return setMessage(els.aliasMessage,'school_name_master / school_name_variants が必要です。','error');
    const prefecture=aliasPrefKey(els.aliasPref?.value),names=schoolAliasEditorNames(),canonical_name=String(els.aliasCanonical?.value||'').trim();if(!prefecture||!names.length||!canonical_name)return setMessage(els.aliasMessage,'都道府県・名称1以上・統一名を入力してください。','error');if(names.some(n=>aliasNameKey(n)===aliasNameKey(canonical_name)))return setMessage(els.aliasMessage,'名称には統一名と同じ文字列を入れないでください。','error');
    const oldGroup=state.editingSchoolAliasId?schoolAliasGroupByKey(state.editingSchoolAliasId):null,oldMasterId=oldGroup?.masterId||null;
    for(const name of names){const conflict=state.schoolAliases.find(a=>aliasPrefKey(a.prefecture)===prefecture&&aliasNameKey(a.alias_name)===aliasNameKey(name)&&String(a.school_id||'')!==String(oldMasterId||''));if(conflict){const other=state.schoolMasterById.get(String(conflict.school_id||''));return setMessage(els.aliasMessage,`${prefecture}の「${name}」はすでに「${other?.display_name||'別の学校'}」に登録されています。`,'error');}}
    const displayConflict=state.schoolMasters.find(m=>aliasPrefKey(m.prefecture)===prefecture&&aliasNameKey(m.display_name)===aliasNameKey(canonical_name)&&String(m.id)!==String(oldMasterId||''));if(displayConflict)return setMessage(els.aliasMessage,`${prefecture}の統一名「${canonical_name}」は別の学校で使用されています。`,'error');
    setMessage(els.aliasMessage,oldGroup?'更新中…':'登録中…');let master;
    if(oldGroup){const r=await state.client.from('school_name_master').update({prefecture,official_name:canonical_name,display_name:canonical_name,updated_at:new Date().toISOString()}).eq('id',oldGroup.masterId).select('id,prefecture,official_name,display_name').single();if(r.error)return setMessage(els.aliasMessage,`統一名を更新できませんでした: ${r.error.message}`,'error');master=r.data;}else{const r=await state.client.from('school_name_master').insert({prefecture,official_name:canonical_name,display_name:canonical_name,updated_at:new Date().toISOString()}).select('id,prefecture,official_name,display_name').single();if(r.error)return setMessage(els.aliasMessage,`名称グループを作成できませんでした: ${r.error.message}`,'error');master=r.data;}
    const keep=new Set();for(const name of names){const r=await state.client.from('school_name_variants').upsert({school_id:master.id,prefecture,name,updated_at:new Date().toISOString()},{onConflict:'prefecture,name'});if(r.error)return setMessage(els.aliasMessage,`「${name}」を保存できませんでした: ${r.error.message}`,'error');keep.add(aliasNameKey(name));}
    if(oldGroup){const obsolete=oldGroup.rows.filter(r=>!keep.has(aliasNameKey(r.alias_name))).map(r=>r.id);if(obsolete.length){const d=await state.client.from('school_name_variants').delete().in('id',obsolete);if(d.error)return setMessage(els.aliasMessage,`削除した名称の反映に失敗しました: ${d.error.message}`,'error');}}
    resetSchoolAliasEditor(true);await loadSchoolAliases();rebuildFromLocalMatches(true);setMessage(els.aliasMessage,oldGroup?'学校名辞書を更新しました。登録済み名称はすべて保持・反映されています。':'学校名辞書に登録しました。','success');
  }
  async function integrateSchoolAlias(key){const g=schoolAliasGroupByKey(key);if(!g)return;const stats=schoolAliasGroupStats(g);if(!stats.appearances)return setMessage(els.aliasMessage,'現在の試合データに未統合の候補はありません。');if(!confirm(`${g.prefecture}の ${g.aliases.join(' / ')} を「${g.canonical_name}」へDB統合します。\n対象：${stats.matches}試合・${stats.appearances}箇所\nRatingは統合後に再計算します。よろしいですか？`))return;setMessage(els.aliasMessage,'DB統合中…');const prefVariants=rawPrefVariants(g.prefecture),names=g.aliases;const a=await state.client.from('matches').update({team_a:g.canonical_name}).in('pref_a',prefVariants).in('team_a',names);if(a.error)return setMessage(els.aliasMessage,`統合に失敗しました: ${a.error.message}`,'error');const b=await state.client.from('matches').update({team_b:g.canonical_name}).in('pref_b',prefVariants).in('team_b',names);if(b.error)return setMessage(els.aliasMessage,`統合に失敗しました: ${b.error.message}`,'error');await loadMatches();await loadEditHistory();await loadSchoolAliases();setMessage(els.aliasMessage,`${stats.matches.toLocaleString('ja-JP')}試合・${stats.appearances.toLocaleString('ja-JP')}箇所を「${g.canonical_name}」へ統合しました。`,'success');}
  async function deleteSchoolAlias(key){const g=schoolAliasGroupByKey(key);if(!g)return;if(!confirm(`${g.prefecture}：${g.aliases.join(' / ')} → ${g.canonical_name}\nこの名称グループを削除しますか？\n試合データ自体は削除されません。`))return;if(g.masterId&&!String(g.masterId).includes('||')){await state.client.from('school_aliases').delete().eq('school_id',g.masterId);const d=await state.client.from('school_name_master').delete().eq('id',g.masterId);if(d.error)return alert(d.error.message);}else{const ids=g.rows.map(r=>r.id);const d=await state.client.from('school_aliases').delete().in('id',ids);if(d.error)return alert(d.error.message);}if(String(state.editingSchoolAliasId)===String(key))resetSchoolAliasEditor(true);await loadSchoolAliases();rebuildFromLocalMatches(true);}
  function applyKnownAliasesToPayload(payload){const p={...payload},changes=[];for(const side of ['a','b']){const teamField=`team_${side}`,prefField=`pref_${side}`,resolved=resolveTeamIdentity(p[teamField],p[prefField]);if(!resolved.matched||resolved.name===p[teamField])continue;const raw=p[teamField];changes.push(`${aliasPrefKey(p[prefField])}：${raw} → ${resolved.name}`);p[teamField]=resolved.name;}return {payload:p,changes};}

  function tournamentAliasNames(row){return [1,2,3,4,5,6].map(i=>String(row?.[`name_${i}`]||'').trim()).filter(Boolean);}
  function resetTournamentAliasEditor(clear=true){
    state.editingTournamentAliasId=null;
    if(clear){[els.tournamentAliasYear,els.tournamentAliasName1,els.tournamentAliasName2,els.tournamentAliasName3,els.tournamentAliasName4,els.tournamentAliasName5,els.tournamentAliasName6,els.tournamentAliasCanonical].forEach(x=>{if(x)x.value='';});}
    if(els.tournamentAliasSaveButton)els.tournamentAliasSaveButton.textContent='大会名辞書に登録';
    els.tournamentAliasCancelEditButton?.classList.add('hidden');
  }
  async function loadTournamentAliases(){
    if(!state.client||!state.session?.user||!els.tournamentAliasList)return;
    const {data,error}=await state.client.from('tournament_aliases').select('id,year,name_1,name_2,name_3,name_4,name_5,name_6,canonical_name,created_at,updated_at').order('year',{ascending:false}).order('canonical_name',{ascending:true});
    if(error){state.tournamentAliases=[];state.tournamentAliasMap=new Map();state.tournamentAliasesAvailable=false;renderTournamentAliasYearFilter();renderTournamentAliasList();if(els.tournamentAliasMessage)els.tournamentAliasMessage.textContent='大会名辞書テーブルがありません。upgrade-tournament-aliases.sql を一度実行してください。';return;}
    state.tournamentAliases=data||[];state.tournamentAliasesAvailable=true;rebuildTournamentAliasMap();renderTournamentAliasYearFilter();renderTournamentAliasList();if(els.tournamentAliasMessage)els.tournamentAliasMessage.textContent='';
  }
  function renderTournamentAliasYearFilter(){
    if(!els.tournamentAliasYearFilter)return;const old=els.tournamentAliasYearFilter.value,years=[...new Set(state.tournamentAliases.map(r=>String(r.year)).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));els.tournamentAliasYearFilter.innerHTML='<option value="">すべて</option>'+years.map(y=>`<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');if(years.includes(old))els.tournamentAliasYearFilter.value=old;
  }
  function tournamentAliasStats(row){
    const allNames=tournamentAliasNames(row),names=allNames.filter(n=>n!==String(row.canonical_name||'').trim()),perName=new Map(allNames.map(n=>[n,0]));
    const start=`${row.year}-01-01`,end=`${Number(row.year)+1}-01-01`;let candidateMatches=0,canonicalMatches=0;
    for(const m of state.matches){const date=String(m.date||'');if(date<start||date>=end)continue;const t=String(m.tournament||m.tournament_original||'').trim();if(t===String(row.canonical_name||'').trim())canonicalMatches++;if(names.includes(t)){candidateMatches++;perName.set(t,(perName.get(t)||0)+1);}else if(perName.has(t)){perName.set(t,(perName.get(t)||0)+1);}}
    return {candidateMatches,canonicalMatches,perName,names};
  }
  function renderTournamentAliasList(){
    if(!els.tournamentAliasList)return;if(!state.tournamentAliasesAvailable){els.tournamentAliasList.innerHTML='<div class="empty">upgrade-tournament-aliases.sql の実行後に利用できます。</div>';return;}
    const year=els.tournamentAliasYearFilter?.value||'',rows=state.tournamentAliases.filter(r=>!year||String(r.year)===year);
    if(!rows.length){els.tournamentAliasList.innerHTML='<div class="empty">登録済み大会名はありません。</div>';return;}
    els.tournamentAliasList.innerHTML=rows.map(r=>{const names=tournamentAliasNames(r),stats=tournamentAliasStats(r),detail=names.map((n,i)=>`大会名${i+1}「${escapeHtml(n)}」 ${Number(stats.perName.get(n)||0).toLocaleString('ja-JP')}試合`).join(' / ');return `<div class="school-alias-item tournament-alias-item"><div class="school-alias-item-main"><strong>${escapeHtml(r.year)}年度：${escapeHtml(names.join(' / ')||'—')} <span class="school-alias-arrow">→</span> ${escapeHtml(r.canonical_name)}</strong><small><b>候補 ${stats.candidateMatches.toLocaleString('ja-JP')}試合</b> ／ 統一済み ${stats.canonicalMatches.toLocaleString('ja-JP')}試合</small><small class="dictionary-match-breakdown">${detail||'登録名称なし'}</small></div><div class="dictionary-row-actions"><button class="btn secondary small js-tournament-alias-edit" type="button" data-id="${escapeHtml(r.id)}">編集</button><button class="btn primary small js-tournament-alias-integrate" type="button" data-id="${escapeHtml(r.id)}" ${stats.candidateMatches?'':'disabled'}>DB統合</button><button class="btn danger small js-tournament-alias-delete" type="button" data-id="${escapeHtml(r.id)}">削除</button></div></div>`;}).join('');
    els.tournamentAliasList.querySelectorAll('.js-tournament-alias-edit').forEach(b=>b.onclick=()=>beginEditTournamentAlias(b.dataset.id));
    els.tournamentAliasList.querySelectorAll('.js-tournament-alias-integrate').forEach(b=>b.onclick=()=>integrateTournamentAlias(b.dataset.id));
    els.tournamentAliasList.querySelectorAll('.js-tournament-alias-delete').forEach(b=>b.onclick=()=>deleteTournamentAlias(b.dataset.id));
  }
  function beginEditTournamentAlias(id){
    const r=state.tournamentAliases.find(x=>String(x.id)===String(id));if(!r)return;state.editingTournamentAliasId=String(r.id);if(els.tournamentAliasYear)els.tournamentAliasYear.value=r.year||'';for(let i=1;i<=6;i++){const el=els[`tournamentAliasName${i}`];if(el)el.value=r[`name_${i}`]||'';}if(els.tournamentAliasCanonical)els.tournamentAliasCanonical.value=r.canonical_name||'';if(els.tournamentAliasSaveButton)els.tournamentAliasSaveButton.textContent='変更を保存';els.tournamentAliasCancelEditButton?.classList.remove('hidden');els.tournamentAliasYear?.focus();
  }
  async function saveTournamentAlias(){
    if(!state.session?.user||!state.tournamentAliasesAvailable)return;const year=Number(els.tournamentAliasYear?.value),canonical_name=String(els.tournamentAliasCanonical?.value||'').trim();const payload={year,canonical_name,updated_at:new Date().toISOString()};for(let i=1;i<=6;i++)payload[`name_${i}`]=String(els[`tournamentAliasName${i}`]?.value||'').trim()||null;
    const names=tournamentAliasNames(payload);if(!Number.isInteger(year)||year<1900||year>2100)return setMessage(els.tournamentAliasMessage,'年度を正しく入力してください。','error');if(!canonical_name)return setMessage(els.tournamentAliasMessage,'統一名を入力してください。','error');if(!names.length)return setMessage(els.tournamentAliasMessage,'大会名を1つ以上入力してください。','error');
    setMessage(els.tournamentAliasMessage,state.editingTournamentAliasId?'更新中…':'登録中…');const result=state.editingTournamentAliasId?await state.client.from('tournament_aliases').update(payload).eq('id',state.editingTournamentAliasId):await state.client.from('tournament_aliases').insert(payload);if(result.error)return setMessage(els.tournamentAliasMessage,`保存できませんでした: ${result.error.message}`,'error');const edited=Boolean(state.editingTournamentAliasId);resetTournamentAliasEditor(true);await loadTournamentAliases();setMessage(els.tournamentAliasMessage,edited?'大会名辞書を更新しました。':'大会名辞書に登録しました。','success');
  }
  async function integrateTournamentAlias(id){
    const r=state.tournamentAliases.find(x=>String(x.id)===String(id));if(!r)return;const stats=tournamentAliasStats(r),names=stats.names;
    if(!names.length)return setMessage(els.tournamentAliasMessage,'統合対象の別名がありません。','success');if(!stats.candidateMatches)return setMessage(els.tournamentAliasMessage,'この年度に一致する未統合の大会名はありません。','success');
    const start=`${r.year}-01-01`,end=`${Number(r.year)+1}-01-01`;if(!confirm(`${r.year}年度の大会名 ${names.length}種類を「${r.canonical_name}」へ統合します。\n対象 ${stats.candidateMatches.toLocaleString('ja-JP')}試合。\nよろしいですか？`))return;
    setMessage(els.tournamentAliasMessage,'データベース統合中…');const {error}=await state.client.from('matches').update({tournament:r.canonical_name}).gte('date',start).lt('date',end).in('tournament',names);if(error)return setMessage(els.tournamentAliasMessage,`統合に失敗しました: ${error.message}`,'error');await loadMatches();await loadEditHistory();renderTournamentAliasList();setMessage(els.tournamentAliasMessage,`${stats.candidateMatches.toLocaleString('ja-JP')}試合の大会名を「${r.canonical_name}」へ統合しました。候補数も更新しました。`,'success');
  }
  async function deleteTournamentAlias(id){const r=state.tournamentAliases.find(x=>String(x.id)===String(id));if(!r)return;if(!confirm(`${r.year}年度「${r.canonical_name}」の名称辞書を削除しますか？`))return;const {error}=await state.client.from('tournament_aliases').delete().eq('id',id);if(error)return alert(error.message);if(String(state.editingTournamentAliasId)===String(id))resetTournamentAliasEditor(true);await loadTournamentAliases();}

  function schoolReplacementSpec(){
    return {
      from:String(els.schoolReplaceFrom?.value||'').trim(),
      to:String(els.schoolReplaceTo?.value||'').trim(),
      mode:String(els.schoolReplaceMode?.value||'contains')
    };
  }
  function replaceSchoolNameValue(value,from,to,mode){
    const raw=String(value??'').trim();
    if(!raw||!from)return raw;
    if(mode==='exact')return raw===from?to:raw;
    return raw.includes(from)?raw.split(from).join(to):raw;
  }
  function collectSchoolNameChanges(){
    const {from,to,mode}=schoolReplacementSpec();
    if(!from||!to||from===to)return [];
    const changes=[];
    for(const m of state.matches){
      const oldA=String(m.team_a??'').trim(), oldB=String(m.team_b??'').trim();
      const newA=replaceSchoolNameValue(oldA,from,to,mode), newB=replaceSchoolNameValue(oldB,from,to,mode);
      if(newA===oldA&&newB===oldB)continue;
      const payload={};
      if(newA!==oldA)payload.team_a=newA;
      if(newB!==oldB)payload.team_b=newB;
      changes.push({id:m.id,date:m.date,tournament:m.tournament,oldA,oldB,newA,newB,payload});
    }
    return changes;
  }
  function renderSchoolNameReplacementPreview(){
    if(!els.schoolReplaceStatus||!els.schoolReplacePreview||!els.schoolReplaceApplyButton)return;
    const {from,to,mode}=schoolReplacementSpec();
    if(!from||!to){
      els.schoolReplaceStatus.textContent='変更前と変更後を入力してください。';
      els.schoolReplacePreview.innerHTML='';
      els.schoolReplacePreview.classList.add('hidden');
      els.schoolReplaceApplyButton.disabled=true;
      return;
    }
    if(from===to){
      els.schoolReplaceStatus.textContent='変更前と変更後が同じです。';
      els.schoolReplacePreview.innerHTML='';
      els.schoolReplacePreview.classList.add('hidden');
      els.schoolReplaceApplyButton.disabled=true;
      return;
    }
    const changes=collectSchoolNameChanges();
    const appearances=changes.reduce((n,c)=>n+(c.oldA!==c.newA?1:0)+(c.oldB!==c.newB?1:0),0);
    if(!changes.length){
      els.schoolReplaceStatus.textContent=`「${from}」に該当する学校名は見つかりませんでした。`;
      els.schoolReplacePreview.innerHTML='';
      els.schoolReplacePreview.classList.add('hidden');
      els.schoolReplaceApplyButton.disabled=true;
      return;
    }
    els.schoolReplaceStatus.textContent=`${changes.length.toLocaleString('ja-JP')}試合・${appearances.toLocaleString('ja-JP')}校名が変更対象です。${mode==='contains'?'文字列置換':'完全一致'}で確認しています。`;
    const examples=[];
    for(const c of changes){
      if(c.oldA!==c.newA)examples.push([c.oldA,c.newA,c.date,c.tournament]);
      if(c.oldB!==c.newB)examples.push([c.oldB,c.newB,c.date,c.tournament]);
      if(examples.length>=10)break;
    }
    els.schoolReplacePreview.innerHTML=examples.map(([a,b,date,tournament])=>`<div class="school-normalize-preview-row"><span>${escapeHtml(a)}<br><small class="muted">${escapeHtml(date||'')} ${escapeHtml(tournament||'')}</small></span><span class="arrow">→</span><strong>${escapeHtml(b)}</strong></div>`).join('')+(appearances>examples.length?`<div class="school-normalize-preview-more">ほか ${(appearances-examples.length).toLocaleString('ja-JP')}件</div>`:'');
    els.schoolReplacePreview.classList.remove('hidden');
    els.schoolReplaceApplyButton.disabled=false;
  }
  function resetSchoolNameReplacementPreview(){
    if(els.schoolReplaceStatus)els.schoolReplaceStatus.textContent='';
    if(els.schoolReplacePreview){els.schoolReplacePreview.innerHTML='';els.schoolReplacePreview.classList.add('hidden');}
    if(els.schoolReplaceApplyButton)els.schoolReplaceApplyButton.disabled=true;
  }
  async function applySchoolNameReplacement(){
    if(!state.session?.user)return;
    const {from,to,mode}=schoolReplacementSpec();
    const changes=collectSchoolNameChanges();
    if(!changes.length){renderSchoolNameReplacementPreview();return;}
    const appearances=changes.reduce((n,c)=>n+(c.oldA!==c.newA?1:0)+(c.oldB!==c.newB?1:0),0);
    if(!confirm(`${changes.length.toLocaleString('ja-JP')}試合・${appearances.toLocaleString('ja-JP')}校名を一括修正します。\n\n${mode==='contains'?`「${from}」を「${to}」へ文字列置換`:`「${from}」と完全一致する学校名を「${to}」へ変更`}\n\nRatingは修正後の学校名で全試合を再計算します。よろしいですか？`))return;
    els.schoolReplaceApplyButton.disabled=true;
    if(els.schoolReplacePreviewButton)els.schoolReplacePreviewButton.disabled=true;
    if(els.schoolReplaceStatus)els.schoolReplaceStatus.textContent='一括修正中…';
    let completed=false;
    try{
      let done=0;
      for(const c of changes){
        const {error}=await state.client.from('matches').update(c.payload).eq('id',c.id);
        if(error)throw error;
        done++;
        if(els.schoolReplaceStatus&&(done===changes.length||done%25===0))els.schoolReplaceStatus.textContent=`一括修正中… ${done.toLocaleString('ja-JP')} / ${changes.length.toLocaleString('ja-JP')}試合`;
      }
      completed=true;
      if(els.schoolReplaceStatus)els.schoolReplaceStatus.textContent=`完了：${changes.length.toLocaleString('ja-JP')}試合・${appearances.toLocaleString('ja-JP')}校名を修正しました。`;
      if(els.schoolReplacePreview){els.schoolReplacePreview.innerHTML='';els.schoolReplacePreview.classList.add('hidden');}
      await loadMatches();
      await loadEditHistory();
    }catch(e){
      if(els.schoolReplaceStatus)els.schoolReplaceStatus.textContent=`失敗: ${e.message||e}`;
    }finally{
      if(els.schoolReplacePreviewButton)els.schoolReplacePreviewButton.disabled=false;
      if(els.schoolReplaceApplyButton)els.schoolReplaceApplyButton.disabled=true;
      if(!completed)renderSchoolNameReplacementPreview();
    }
  }

  async function loadEditHistory(){
    if(!state.client||!state.session?.user||!els.editHistoryList)return;const {data,error}=await state.client.from('match_edit_history').select('id,match_id,action,old_data,new_data,changed_by,changed_at').order('changed_at',{ascending:false}).limit(100);if(error){els.editHistoryList.innerHTML=`<div class="empty">編集履歴を読み込めません: ${escapeHtml(error.message)}</div>`;return;}state.editHistory=data||[];renderEditHistory();
  }
  function historyMatchLabel(row){const d=row.new_data||row.old_data||{};return `${d.date||'—'} ${d.team_a||'—'} ${d.score_a??'—'}-${d.score_b??'—'} ${d.team_b||'—'}`;}
  function renderEditHistory(){if(!els.editHistoryList)return;if(!state.editHistory.length){els.editHistoryList.innerHTML='<div class="empty">編集履歴はありません。</div>';return;}els.editHistoryList.innerHTML=state.editHistory.map(h=>{const old=h.old_data||{},nw=h.new_data||{},fields=['date','tournament','tournament_type','stage','team_a','pref_a','score_a','team_b','pref_b','score_b','k','source_url'];const changed=h.action==='UPDATE'?fields.filter(f=>JSON.stringify(old[f]??null)!==JSON.stringify(nw[f]??null)).map(f=>`${f}: ${old[f]??'—'} → ${nw[f]??'—'}`).join(' / '):h.action==='DELETE'?'削除':'新規登録';return `<div class="edit-history-item"><div class="match-meta">${escapeHtml(h.changed_at||'')} · ${escapeHtml(h.action)}</div><strong>${escapeHtml(historyMatchLabel(h))}</strong><p>${escapeHtml(changed||'変更内容なし')}</p></div>`;}).join('');}

  function bindEvents(){els.siteSettingsForm?.addEventListener('submit',handleSiteSettingsSave);document.querySelectorAll('.admin-public-toggle [data-setting]').forEach(input=>input.addEventListener('change',()=>handlePublicSettingChange(input)));els.searchInput.addEventListener('input',()=>{state.rankingPage=1;renderRanking();});els.rankingPrefOptions?.addEventListener('change',e=>{const input=e.target.closest('input[type=\"checkbox\"]');if(!input)return;if(input.checked)state.selectedRankingPrefs.add(input.value);else state.selectedRankingPrefs.delete(input.value);updateRankingPrefSummary();state.rankingPage=1;renderRanking();});els.rankingPrefClear?.addEventListener('click',()=>{state.selectedRankingPrefs.clear();renderPrefFilter();state.rankingPage=1;renderRanking();});[els.ratingMinFilter,els.ratingMaxFilter].forEach(x=>x?.addEventListener('input',()=>{state.rankingPage=1;renderRanking();}));els.rankingDate?.addEventListener('change',()=>{state.rankingDate=els.rankingDate.value;state.rankingDateIsLatest=state.rankingDate===compareDatasetBounds().last;state.rankingPage=1;renderRanking();});els.rankingDateLatest?.addEventListener('click',()=>{state.rankingDateIsLatest=true;syncRankingDateInput(true);state.rankingPage=1;renderRanking();});els.rankingPageSize?.addEventListener('change',()=>{state.rankingPageSize=Number(els.rankingPageSize.value)||20;state.rankingPage=1;renderRanking();});els.rankingPrev?.addEventListener('click',()=>{if(state.rankingPage>1){state.rankingPage--;renderRanking();document.getElementById('ranking')?.scrollIntoView({behavior:'smooth',block:'start'});}});els.rankingNext?.addEventListener('click',()=>{state.rankingPage++;renderRanking();document.getElementById('ranking')?.scrollIntoView({behavior:'smooth',block:'start'});});els.rankingPageNumbers?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)goToRankingPage(b.dataset.page);});els.prefSort?.addEventListener('change',()=>{state.prefExpanded=false;renderPrefCards();});els.prefShowMoreButton?.addEventListener('click',()=>{state.prefExpanded=!state.prefExpanded;renderPrefCards();});els.schoolSearch?.addEventListener('input',renderSchoolSearch);els.schoolSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.schoolSearchHits.length){e.preventDefault();selectSchoolSearchHit(0);}});els.recordSchoolSearch?.addEventListener('input',renderRecordSchoolSearch);els.recordSchoolSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.recordSearchHits.length){e.preventDefault();selectRecordSearchHit(0);}});els.schoolSelect.addEventListener('change',()=>{state.selectedSchoolKey=els.schoolSelect.value;renderSchoolProfile();});els.historyRange?.addEventListener('click',e=>{const b=e.target.closest('[data-years]');if(!b)return;state.historyYears=b.dataset.years;els.historyRange.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderSchoolProfile();});els.matchYearFilter?.addEventListener('change',()=>renderSchoolProfile());els.rankCompareSearch?.addEventListener('input',renderRankCompareSearch);els.rankCompareSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.rankCompareSearchHits.length){e.preventDefault();addRankCompareSchool(0);}});els.rankCompareStartDate?.addEventListener('change',()=>{state.compareStartDate=els.rankCompareStartDate.value;renderRankCompareChart();});els.rankCompareEndDate?.addEventListener('change',()=>{state.compareEndDate=els.rankCompareEndDate.value;renderRankCompareChart();});els.rankCompareAllRange?.addEventListener('click',()=>{syncRankCompareDateInputs(true);renderRankCompareChart();});[els.ratingA,els.ratingB,els.kValue].forEach(i=>i.addEventListener('input',renderSimulator));els.kValue?.addEventListener('input',()=>{els.kValue.dataset.userEdited='1';});els.loginForm.addEventListener('submit',handleLogin);els.showResetButton.addEventListener('click',showResetRequest);els.resetRequestForm.addEventListener('submit',handleResetRequest);els.backToLoginButton.addEventListener('click',backToLogin);els.passwordSetupForm.addEventListener('submit',handlePasswordSetup);els.logoutButton.addEventListener('click',handleLogout);els.matchForm.addEventListener('submit',handleMatchSubmit);els.cancelEditButton.addEventListener('click',resetMatchForm);els.reloadButton.addEventListener('click',loadMatches);[els.adminMatchKeyword,els.adminMatchTournament,els.adminMatchSchool].forEach(x=>x?.addEventListener('input',renderAdminMatches));els.adminMatchDate?.addEventListener('change',renderAdminMatches);els.adminMatchClear?.addEventListener('click',clearAdminMatchSearch);els.duplicateScanButton?.addEventListener('click',toggleDuplicateView);els.duplicateSelectAll?.addEventListener('change',()=>setAllDuplicateChecks(els.duplicateSelectAll.checked));els.duplicateMergeList?.addEventListener('change',e=>{if(e.target.closest('.js-merge-duplicate'))syncDuplicateSelectionState();});els.duplicateMergeButton?.addEventListener('click',mergeCheckedDuplicates);els.normalizeTournamentButton?.addEventListener('click',normalizeTournamentNames);els.aliasAddButton?.addEventListener('click',addSchoolAlias);els.aliasAddNameButton?.addEventListener('click',()=>{const names=[...(els.aliasNamesContainer?.querySelectorAll('.alias-name-input')||[])].map(x=>x.value);names.push('');renderSchoolAliasNameInputs(names);const inputs=els.aliasNamesContainer?.querySelectorAll('.alias-name-input');inputs?.[inputs.length-1]?.focus();});els.aliasNamesContainer?.addEventListener('click',e=>{const b=e.target.closest('.alias-name-remove');if(!b)return;const row=b.closest('.alias-name-row');row?.remove();const names=[...(els.aliasNamesContainer?.querySelectorAll('.alias-name-input')||[])].map(x=>x.value);renderSchoolAliasNameInputs(names.length?names:['']);});els.aliasCancelEditButton?.addEventListener('click',()=>resetSchoolAliasEditor(true));els.aliasRefreshButton?.addEventListener('click',()=>{renderAliasSuggestions();if(els.aliasMessage)setMessage(els.aliasMessage,'登録済み試合を再検出しました。','success');});els.aliasListPrefFilter?.addEventListener('change',renderAliasList);els.tournamentAliasSaveButton?.addEventListener('click',saveTournamentAlias);els.tournamentAliasCancelEditButton?.addEventListener('click',()=>resetTournamentAliasEditor(true));els.tournamentAliasRefreshButton?.addEventListener('click',loadTournamentAliases);els.tournamentAliasYearFilter?.addEventListener('change',renderTournamentAliasList);els.schoolMergeProposalForm?.addEventListener('submit',submitSchoolMergeProposal);els.schoolMergeProposalType?.addEventListener('change',()=>{clearMergeProposalForm(false);updateProposalMode();});els.mergeProposalSchoolA?.addEventListener('input',()=>renderMergeProposalSearch('A'));els.mergeProposalSchoolB?.addEventListener('input',()=>renderMergeProposalSearch('B'));els.mergeProposalSchoolA?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.mergeProposalAHits.length){e.preventDefault();selectMergeProposalSchool('A',0);}});els.mergeProposalSchoolB?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.mergeProposalBHits.length){e.preventDefault();selectMergeProposalSchool('B',0);}});els.resultProposalMatchSearch?.addEventListener('input',renderResultProposalSearch);els.resultProposalMatchSearch?.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.resultProposalHits.length){e.preventDefault();selectResultProposalMatch(0);}});[els.resultProposalScoreA,els.resultProposalScoreB].forEach(x=>x?.addEventListener('input',updateResultProposalSelection));els.schoolMergeProposalClear?.addEventListener('click',()=>clearMergeProposalForm(false));els.schoolReplacePreviewButton?.addEventListener('click',renderSchoolNameReplacementPreview);els.schoolReplaceApplyButton?.addEventListener('click',applySchoolNameReplacement);[els.schoolReplaceFrom,els.schoolReplaceTo].forEach(x=>x?.addEventListener('input',resetSchoolNameReplacementPreview));els.schoolReplaceMode?.addEventListener('change',resetSchoolNameReplacementPreview);els.reloadProposalsButton?.addEventListener('click',loadProposals);els.reloadHistoryButton?.addEventListener('click',loadEditHistory);document.addEventListener('click',e=>{if(els.schoolSearchResults&&!e.target.closest('.school-search-wrap'))els.schoolSearchResults.classList.add('hidden');if(els.recordSchoolSearchResults&&!e.target.closest('.record-school-search-wrap'))els.recordSchoolSearchResults.classList.add('hidden');if(els.rankCompareSearchResults&&!e.target.closest('.rank-compare-search-wrap'))els.rankCompareSearchResults.classList.add('hidden');if(!e.target.closest('.proposal-school-search-wrap')&&!e.target.closest('.proposal-match-search-wrap')){els.mergeProposalSchoolAResults?.classList.add('hidden');els.mergeProposalSchoolBResults?.classList.add('hidden');els.resultProposalMatchResults?.classList.add('hidden');}});}

  function renderStaticConfig(){const showK=featureVisible('k_values'),vals=configuredKValues(),lo=Math.min(...vals),hi=Math.max(...vals),retentionPct=(newTeamRetentionRate()*100).toFixed(0);els.heroInitial.textContent=ratingCfg.initial;els.heroDivisor.textContent=ratingCfg.divisor;els.heroK.textContent=showK?`大会別 ${lo}〜${hi}`:'非公開';if(els.heroRetention)els.heroRetention.textContent=`${retentionPct}%`;els.heroFormula.textContent="R' = R + K × (W − We)";if(!els.kValue.dataset.userEdited)els.kValue.value=showK?summerQualifierK():ratingCfg.defaultK;if(els.matchK)els.matchK.placeholder='大会タグから自動決定（空欄でOK）';if(els.matchKValues)els.matchKValues.innerHTML=[...new Set(vals)].sort((a,b)=>a-b).map(v=>`<option value="${v}"></option>`).join('');if(els.methodKText)els.methodKText.textContent=showK?`K値：秋季予選${autumnQualifierK()} / 秋季地区${autumnRegionalK()} / 神宮${meijiJinguK()} / 春甲子園1回戦〜準々決勝${springKoshienEarlyK()} / 春甲子園準決勝・決勝${springKoshienFinalK()} / 春季予選${springQualifierK()} / 春季地区${springRegionalK()} / 夏予選${summerQualifierK()} / 夏甲子園1回戦〜準々決勝${summerMainEarlyK()} / 夏甲子園準決勝・決勝${summerMainFinalK()} / 国スポ${kokuspoK()}。大会名ではなく各試合の大会タグで決定し、手動Kがある場合だけ手動値を優先します。`:'K値は各試合の大会タグに基づいて自動決定します。';if(els.methodRetentionText)els.methodRetentionText.textContent=`3年生引退後の新チームでは、各校がその年度の秋季大会に初めて出場する直前に、1500からの差の${retentionPct}%を引き継ぎます。同じ年度には1回だけ適用します。`;syncSiteSettingsForm();}
  async function init(){bindEvents();updateProposalMode();renderStaticConfig();renderSimulator();resetMatchForm();if(!isConfigReady()){setDataStatus('要設定');showSetupNotice('<strong>Supabaseの接続情報が未設定です。</strong> config.js を設定してください。');els.loginPanel.classList.add('hidden');els.adminUnavailable.textContent='config.jsを設定すると利用できます。';els.adminUnavailable.classList.remove('hidden');return;}state.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);els.adminUnavailable.classList.add('hidden');await Promise.all([loadSiteSettings(),loadTournamentKSettings()]);await loadSchoolAliases();await Promise.all([restoreSession(),loadMatches()]);}
  init().catch(e=>{console.error(e);setDataStatus('エラー');showSetupNotice(`<code>${escapeHtml(e.message||e)}</code>`);});
})();
