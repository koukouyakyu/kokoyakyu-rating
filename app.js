const teams = [
  {name:'横浜',pref:'神奈川',league:'神奈川上位グループ',rating:1842,delta:+7.4,form:'WWWWL',history:[1760,1778,1794,1810,1834,1842]},
  {name:'大阪桐蔭',pref:'大阪',league:'大阪上位グループ',rating:1828,delta:+2.1,form:'WWWLW',history:[1790,1802,1816,1833,1824,1828]},
  {name:'智辯和歌山',pref:'和歌山',league:'関西上位グループ',rating:1819,delta:+14.2,form:'WWWWW',history:[1715,1730,1759,1778,1805,1819]},
  {name:'履正社',pref:'大阪',league:'大阪上位グループ',rating:1787,delta:-3.2,form:'WWWLL',history:[1745,1758,1772,1790,1790,1787]},
  {name:'健大高崎',pref:'群馬',league:'関東上位グループ',rating:1781,delta:-6.0,form:'WWWWL',history:[1722,1740,1751,1768,1787,1781]},
  {name:'中京大中京',pref:'愛知',league:'愛知上位グループ',rating:1769,delta:+4.8,form:'WWLWW',history:[1702,1721,1744,1758,1764,1769]},
  {name:'関東第一',pref:'東京',league:'東京上位グループ',rating:1758,delta:+1.6,form:'WLWWW',history:[1709,1728,1739,1750,1756,1758]},
  {name:'九州国際大付',pref:'福岡',league:'九州上位グループ',rating:1751,delta:-1.3,form:'WWLWL',history:[1698,1720,1740,1755,1752,1751]},
  {name:'山梨学院',pref:'山梨',league:'関東上位グループ',rating:1745,delta:+0.7,form:'WLWWL',history:[1688,1704,1727,1739,1744,1745]},
  {name:'帝京',pref:'東京',league:'東京上位グループ',rating:1732,delta:-2.4,form:'WWLLW',history:[1695,1711,1726,1737,1734,1732]},
  {name:'東海大相模',pref:'神奈川',league:'神奈川上位グループ',rating:1728,delta:+3.5,form:'LWWWW',history:[1684,1698,1709,1718,1725,1728]},
  {name:'享栄',pref:'愛知',league:'愛知上位グループ',rating:1722,delta:-4.1,form:'WWWLL',history:[1672,1692,1710,1729,1726,1722]},
  {name:'日大三',pref:'東京',league:'東京上位グループ',rating:1716,delta:+2.9,form:'LWWLW',history:[1660,1686,1694,1708,1713,1716]},
  {name:'桐光学園',pref:'神奈川',league:'神奈川上位グループ',rating:1708,delta:-1.9,form:'WWLWL',history:[1668,1681,1696,1706,1710,1708]},
  {name:'愛工大名電',pref:'愛知',league:'愛知上位グループ',rating:1698,delta:+0.8,form:'WLWLW',history:[1669,1675,1688,1691,1697,1698]},
  {name:'金光大阪',pref:'大阪',league:'大阪上位グループ',rating:1689,delta:+1.1,form:'LWWLW',history:[1648,1659,1670,1684,1688,1689]},
  {name:'仙台育英',pref:'宮城',league:'東北上位グループ',rating:1683,delta:-2.8,form:'WWWLL',history:[1640,1652,1671,1689,1686,1683]},
  {name:'東邦',pref:'愛知',league:'愛知上位グループ',rating:1676,delta:+0.5,form:'WLWWL',history:[1642,1657,1661,1672,1675,1676]},
  {name:'慶應',pref:'神奈川',league:'神奈川上位グループ',rating:1668,delta:-0.9,form:'LWWLL',history:[1638,1649,1655,1666,1669,1668]},
  {name:'東海大大阪仰星',pref:'大阪',league:'大阪上位グループ',rating:1659,delta:+2.2,form:'WWLWW',history:[1619,1631,1640,1652,1657,1659]}
];

const matches = {
  '横浜':[
    ['智辯和歌山','1-7','負',-6.4,'2026 夏 全国大会'],
    ['花巻東','6-0','勝',+4.8,'2026 夏 全国大会'],
    ['霞ケ浦','5-2','勝',+4.5,'2026 夏 全国大会'],
    ['日南学園','8-3','勝',+4.2,'2026 夏 全国大会'],
    ['沖縄尚学','4-2','勝',+3.9,'2026 夏 全国大会']
  ],
  '大阪桐蔭':[
    ['関大北陽','1-2','負',-5.7,'2026 春 大阪'],
    ['智辯学園','7-3','勝',+4.9,'2026 春 全国大会'],
    ['専大松戸','6-2','勝',+4.7,'2026 春 全国大会'],
    ['英明','5-1','勝',+4.3,'2026 春 全国大会'],
    ['三重','4-2','勝',+4.0,'2026 春 全国大会']
  ],
  '智辯和歌山':[
    ['健大高崎','4-3','勝',+6.0,'2026 夏 全国大会'],
    ['横浜','7-1','勝',+6.4,'2026 夏 全国大会'],
    ['仙台育英','11-3','勝',+5.9,'2026 夏 全国大会'],
    ['敦賀気比','5-2','勝',+5.6,'2026 夏 全国大会'],
    ['社','8-1','勝',+5.1,'2026 夏 全国大会']
  ]
};

function expected(a,b){return 1/(1+Math.pow(10,-(a-b)/600));}
function change(a,b,w,k=10){return k*(w-expected(a,b));}
function fmtDelta(v){const n=Number(v);return `${n>=0?'+':''}${n.toFixed(1)}`;}

function renderRanking(){
  const q=document.querySelector('#searchInput').value.trim();
  const pref=document.querySelector('#prefFilter').value;
  const rows=[...teams].sort((a,b)=>b.rating-a.rating).filter(t=>(!q || t.name.includes(q)||t.pref.includes(q))&&(!pref||t.pref===pref));
  const tbody=document.querySelector('#rankingBody'); tbody.innerHTML='';
  rows.forEach((t,i)=>{
    const overall=[...teams].sort((a,b)=>b.rating-a.rating).findIndex(x=>x.name===t.name)+1;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="rank-num">${overall}</td><td><span class="school-link" data-school="${t.name}">${t.name}</span></td><td>${t.pref}</td><td><strong>${t.rating}</strong></td><td class="delta ${t.delta>=0?'pos':'neg'}">${fmtDelta(t.delta)}</td><td class="form">${t.form}</td>`;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.school-link').forEach(el=>el.addEventListener('click',()=>{document.querySelector('#schoolSelect').value=el.dataset.school;renderSchool(el.dataset.school);location.hash='#schools';}));
}

function renderPrefectures(){
  const grouped={}; teams.forEach(t=>(grouped[t.pref]??=[]).push(t.rating));
  const cards=Object.entries(grouped).map(([pref,vals])=>{
    vals.sort((a,b)=>b-a); const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const mid=vals.length%2?vals[(vals.length-1)/2]:(vals[vals.length/2-1]+vals[vals.length/2])/2;
    const top5=vals.slice(0,5).reduce((a,b)=>a+b,0)/Math.min(5,vals.length);
    const n=Math.max(1,Math.ceil(vals.length*.25)); const top25=vals.slice(0,n).reduce((a,b)=>a+b,0)/n;
    return {pref,avg,mid,top5,top25,count:vals.length};
  }).sort((a,b)=>b.avg-a.avg).slice(0,8);
  document.querySelector('#prefCards').innerHTML=cards.map(x=>`<article class="pref-card"><h3>${x.pref}</h3><div class="pref-metric"><span>掲載校数</span><strong>${x.count}</strong></div><div class="pref-metric"><span>平均</span><strong>${x.avg.toFixed(0)}</strong></div><div class="pref-metric"><span>中央値</span><strong>${x.mid.toFixed(0)}</strong></div><div class="pref-metric"><span>Top5平均</span><strong>${x.top5.toFixed(0)}</strong></div><div class="pref-metric"><span>Top25%平均</span><strong>${x.top25.toFixed(0)}</strong></div></article>`).join('');
}

function chart(svg,values){
  const w=720,h=220,p=34; const min=Math.min(...values)-10,max=Math.max(...values)+10;
  const x=i=>p+i*(w-2*p)/(values.length-1); const y=v=>h-p-(v-min)*(h-2*p)/(max-min||1);
  let html='';
  for(let i=0;i<4;i++){const yy=p+i*(h-2*p)/3;html+=`<line class="chart-grid" x1="${p}" x2="${w-p}" y1="${yy}" y2="${yy}"/>`;}
  const pts=values.map((v,i)=>`${x(i)},${y(v)}`).join(' '); html+=`<polyline class="chart-line" points="${pts}"/>`;
  values.forEach((v,i)=>{html+=`<circle class="chart-dot" cx="${x(i)}" cy="${y(v)}" r="4"/><text class="chart-label" x="${x(i)}" y="${y(v)-10}" text-anchor="middle">${v}</text>`;});
  svg.innerHTML=html;
}

function renderSchool(name){
  const sorted=[...teams].sort((a,b)=>b.rating-a.rating); const t=teams.find(x=>x.name===name)||sorted[0];
  document.querySelector('#schoolName').textContent=t.name; document.querySelector('#schoolPref').textContent=t.pref; document.querySelector('#schoolLeague').textContent=t.league;
  document.querySelector('#schoolRating').textContent=t.rating; document.querySelector('#schoolRank').textContent=`${sorted.findIndex(x=>x.name===t.name)+1}位`;
  const d=document.querySelector('#schoolDelta');d.textContent=fmtDelta(t.delta);d.className=t.delta>=0?'pos':'neg';document.querySelector('#schoolForm').textContent=t.form;
  chart(document.querySelector('#historyChart'),t.history);
  const ms=matches[t.name]||[
    ['サンプル校A','4-2','勝',+4.7,'公式戦'],['サンプル校B','2-3','負',-5.1,'公式戦'],['サンプル校C','1-1','分',+0.3,'リーグ戦']
  ];
  document.querySelector('#recentMatches').innerHTML=ms.map(m=>`<div class="match-row"><div class="match-title"><span>${m[0]} <small>${m[1]}</small></span><span class="match-points ${m[2]==='勝'?'win':m[2]==='負'?'loss':'draw'}">${m[2]} ${fmtDelta(m[3])}</span></div><div class="match-meta">${m[4]}</div></div>`).join('');
}

function renderSimulator(){
  const a=+document.querySelector('#ratingA').value,b=+document.querySelector('#ratingB').value,k=+document.querySelector('#kValue').value; const ea=expected(a,b);
  const win=change(a,b,1,k),draw=change(a,b,.5,k),loss=change(a,b,0,k);
  document.querySelector('#simResult').innerHTML=`<div class="sim-box"><span>学校Aの期待値</span><strong>${(ea*100).toFixed(1)}%</strong></div><div class="sim-box"><span>A勝利時</span><strong class="pos">${fmtDelta(win)}</strong></div><div class="sim-box"><span>引き分け時</span><strong class="${draw>=0?'pos':'neg'}">${fmtDelta(draw)}</strong></div><div class="sim-box"><span>A敗戦時</span><strong class="neg">${fmtDelta(loss)}</strong></div><div class="sim-box"><span>B勝利時</span><strong class="pos">${fmtDelta(-loss)}</strong></div><div class="sim-box"><span>B引分時</span><strong class="${-draw>=0?'pos':'neg'}">${fmtDelta(-draw)}</strong></div>`;
}

function init(){
  const prefs=[...new Set(teams.map(t=>t.pref))].sort(); const pf=document.querySelector('#prefFilter'); prefs.forEach(p=>pf.insertAdjacentHTML('beforeend',`<option>${p}</option>`));
  const ss=document.querySelector('#schoolSelect'); [...teams].sort((a,b)=>b.rating-a.rating).forEach(t=>ss.insertAdjacentHTML('beforeend',`<option value="${t.name}">${t.name}</option>`));
  document.querySelector('#searchInput').addEventListener('input',renderRanking);pf.addEventListener('change',renderRanking);ss.addEventListener('change',e=>renderSchool(e.target.value));
  ['ratingA','ratingB','kValue'].forEach(id=>document.querySelector('#'+id).addEventListener('input',renderSimulator));
  renderRanking();renderPrefectures();renderSchool([...teams].sort((a,b)=>b.rating-a.rating)[0].name);renderSimulator();
}
init();
