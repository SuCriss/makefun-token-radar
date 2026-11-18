(function(){
'use strict';
var radar=(typeof RADAR_DATA!=='undefined'&&RADAR_DATA)?RADAR_DATA:null;
var mk=(typeof MAKEFUN_DATA!=='undefined'&&MAKEFUN_DATA)?MAKEFUN_DATA:null;
var params=new URLSearchParams(location.search);
var state={filter:'all',sort:'value',q:'',slug:''};
if(params.get('filter')==='pretoken'||params.get('filter')==='live')state.filter=params.get('filter');
if(params.get('sort')==='tvl'||params.get('sort')==='change')state.sort=params.get('sort');
state.q=params.get('q')||'';
if(params.get('view')==='detail')state.slug=params.get('slug')||'';
var preSet={},liveSet={};
if(mk&&Array.isArray(mk.preToken))mk.preToken.forEach(function(x){if(x&&x.slug)preSet[x.slug]=1;});
if(mk&&Array.isArray(mk.liveToken))mk.liveToken.forEach(function(x){if(x&&x.slug)liveSet[x.slug]=1;});
function text(v){return String(v==null?'':v);}
function statusOf(r){
  var s=text(r.status).toLowerCase();
  if(s==='live'||s==='live-token'||s==='live_token'||s==='token')return 'live';
  if(s==='pretoken'||s==='pre-token'||s==='pre_token')return 'pretoken';
  if(liveSet[r.slug])return 'live';
  if(preSet[r.slug])return 'pretoken';
  return (r.listed_at||r.token_symbol||r.has_token)?'live':'pretoken';
}
var rows=(function(){
  var list=[];
  if(radar&&Array.isArray(radar.rows))list=radar.rows.slice();
  else if(mk){
    var a=Array.isArray(mk.preToken)?mk.preToken:[];
    var b=Array.isArray(mk.liveToken)?mk.liveToken:[];
    list=a.map(function(x){return Object.assign({status:'pretoken'},x);}).concat(b.map(function(x){return Object.assign({status:'live'},x);}));
    list.sort(function(x,y){return (Number(y.tvl_usd)||0)-(Number(x.tvl_usd)||0);});
  }
  return list.map(function(r,i){
    return {
      slug:text(r.slug),
      name:text(r.name||r.slug||'protocol'),
      category:text(r.category||'—'),
      chains:r.chains,
      rank:Number(r.rank)||i+1,
      tvl_usd:Number(r.tvl_usd)||0,
      change_7d:Number(r.change_7d)||0,
      implied_value_usd:Number(r.implied_value_usd||r.tvl_usd)||0,
      listed_at:r.listed_at||null,
      token_symbol:text(r.token_symbol),
      status:statusOf(r),
      farm_steps:Array.isArray(r.farm_steps)?r.farm_steps.filter(function(s){return typeof s==='string';}):[]
    };
  });
})();
function money(n){
  n=Number(n)||0;
  if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';
  if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M';
  if(n>=1e3)return '$'+(n/1e3).toFixed(1)+'K';
  return '$'+Math.round(n).toLocaleString();
}
function pct(n){n=Number(n)||0;return (n>0?'+':'')+n.toFixed(2)+'%';}
function chainText(r){
  if(Array.isArray(r.chains))return r.chains.map(text).join(', ');
  return text(r.chains)||'listed chain';
}
function stepsFor(r){
  if(r.farm_steps.length)return r.farm_steps;
  return [
    'Open the '+r.category+' venue '+r.name+' and confirm the '+chainText(r)+' deployment before funding.',
    'Bridge a probe amount to '+chainText(r)+' and verify the '+(r.token_symbol||'native')+' receipt in the wallet.',
    'Size the position against '+money(r.tvl_usd)+' of TVL and the '+pct(r.change_7d)+' seven day move.',
    'Schedule staged entries, monitor reward claims, and archive the exit with its realised outcome.'
  ];
}
function byId(id){return document.getElementById(id);}
var tbody=byId('tbody'),detail=byId('detail'),foot=byId('foot'),stats=byId('stats');
function visible(){
  var list=rows;
  if(state.filter!=='all')list=list.filter(function(r){return r.status===state.filter;});
  var needle=state.q.toLowerCase();
  if(needle)list=list.filter(function(r){return (r.name+' '+r.slug+' '+r.category).toLowerCase().indexOf(needle)>=0;});
  var key=state.sort==='tvl'?'tvl_usd':state.sort==='change'?'change_7d':'implied_value_usd';
  return list.slice().sort(function(a,b){return (b[key]-a[key])||(a.rank-b.rank);});
}
function td(cls,value){
  var el=document.createElement('td');
  if(cls)el.className=cls;
  el.textContent=value;
  return el;
}
function renderTable(list){
  tbody.textContent='';
  if(!list.length){
    var tr0=document.createElement('tr'),td0=document.createElement('td');
    td0.colSpan=7;td0.className='empty';td0.textContent='No protocols match this view.';
    tr0.appendChild(td0);tbody.appendChild(tr0);return;
  }
  list.forEach(function(r){
    var tr=document.createElement('tr');
    if(r.slug===state.slug)tr.className='sel';
    tr.appendChild(td('rank','#'+r.rank));
    var p=td('proto',r.name),small=document.createElement('small');
    small.textContent=r.slug+' · '+r.category;p.appendChild(small);tr.appendChild(p);
    tr.appendChild(td('val',money(r.implied_value_usd)));
    tr.appendChild(td('tvl',money(r.tvl_usd)));
    tr.appendChild(td('tvl '+(r.change_7d>=0?'up':'down'),pct(r.change_7d)));
    var st=td('',''),pill=document.createElement('span');
    pill.className='pill '+(r.status==='live'?'live':'pre');
    pill.textContent=r.status==='live'?'Live token':'Pre-token';
    st.appendChild(pill);tr.appendChild(st);
    tr.appendChild(td('steps',r.farm_steps.length?r.farm_steps.length+' steps · '+r.farm_steps[0].slice(0,60):'—'));
    tr.addEventListener('click',function(){openDetail(r.slug);});
    tbody.appendChild(tr);
  });
}
function renderDetail(){
  var r=null;
  for(var i=0;i<rows.length;i++){if(rows[i].slug===state.slug){r=rows[i];break;}}
  if(!r){detail.hidden=true;document.body.classList.remove('has-detail');return;}
  detail.hidden=false;document.body.classList.add('has-detail');
  byId('dName').textContent=r.name;
  byId('dSlug').textContent=r.slug;
  byId('dRank').textContent='#'+r.rank;
  byId('dStatus').textContent=r.status==='live'?'Live token':'Pre-token';
  byId('dValue').textContent=money(r.implied_value_usd);
  byId('dTvl').textContent=money(r.tvl_usd);
  byId('dChange').textContent=pct(r.change_7d);
  byId('dCat').textContent=r.category;
  var ol=byId('dSteps');ol.textContent='';
  stepsFor(r).forEach(function(s){var li=document.createElement('li');li.textContent=s;ol.appendChild(li);});
}
function renderStats(list){
  var live=rows.filter(function(r){return r.status==='live';}).length;
  var top=list.length?money(list[0].implied_value_usd):'—';
  stats.textContent='';
  [['Rows',String(rows.length),''],['Live',String(live),''],['Pre-token',String(rows.length-live),'hot'],['Top value',top,'']].forEach(function(x){
    var d=document.createElement('div');d.className='stat '+x[2];
    var b=document.createElement('b');b.textContent=x[1];
    var s=document.createElement('span');s.textContent=x[0];
    d.appendChild(b);d.appendChild(s);stats.appendChild(d);
  });
  foot.textContent='';
  var left=document.createElement('span');left.textContent='Showing '+list.length+' of '+rows.length+' protocols';
  var right=document.createElement('span');right.textContent='Offline snapshot · sort: '+state.sort+' · filter: '+state.filter;
  foot.appendChild(left);foot.appendChild(right);
}
function render(){
  var list=visible();
  renderStats(list);renderTable(list);renderDetail();
  Array.prototype.forEach.call(document.querySelectorAll('#filters button'),function(b){
    b.className=b.getAttribute('data-filter')===state.filter?'on':'';
  });
  byId('sort').value=state.sort;
  if(byId('q').value!==state.q)byId('q').value=state.q;
  Array.prototype.forEach.call(document.querySelectorAll('thead th[data-key]'),function(th){
    th.setAttribute('aria-sort',th.getAttribute('data-key')===state.sort?'descending':'none');
  });
}
function syncUrl(){
  var p=new URLSearchParams();
  if(state.filter!=='all')p.set('filter',state.filter);
  if(state.sort!=='value')p.set('sort',state.sort);
  if(state.q)p.set('q',state.q);
  if(state.slug){p.set('view','detail');p.set('slug',state.slug);}
  var s=p.toString();
  try{history.replaceState(null,'',location.pathname+(s?'?'+s:''));}catch(e){}
}
function openDetail(slug){state.slug=slug;syncUrl();render();}
function closeDetail(){state.slug='';syncUrl();render();}
function readUrl(){
  params=new URLSearchParams(location.search);
  state.filter=(params.get('filter')==='pretoken'||params.get('filter')==='live')?params.get('filter'):'all';
  state.sort=(params.get('sort')==='tvl'||params.get('sort')==='change')?params.get('sort'):'value';
  state.q=params.get('q')||'';
  state.slug=params.get('view')==='detail'?(params.get('slug')||''):'';
  render();
}
Array.prototype.forEach.call(document.querySelectorAll('#filters button'),function(b){
  b.addEventListener('click',function(){state.filter=b.getAttribute('data-filter');syncUrl();render();});
});
byId('sort').addEventListener('change',function(e){state.sort=e.target.value;syncUrl();render();});
byId('q').addEventListener('input',function(e){state.q=e.target.value;syncUrl();render();});
byId('dClose').addEventListener('click',closeDetail);
Array.prototype.forEach.call(document.querySelectorAll('thead th[data-key]'),function(th){
  th.addEventListener('click',function(){state.sort=th.getAttribute('data-key');syncUrl();render();});
});
window.addEventListener('popstate',readUrl);
render();
})();
