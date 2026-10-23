/* FundScope Browser-Only edition. No network APIs are used for portfolio data. */
'use strict';
const byId=id=>document.getElementById(id);
const file=byId('file'),status=byId('status'),mapping=byId('mapping'),selectors=byId('selectors'),dashboard=byId('page-dashboard'),root=byId('root'),metrics=byId('metrics'),detailtable=byId('detailtable');
let uploadId=null,sourceRows=[],sourceColumns=[],data=null,focusedFundPath='';
const fmt=n=>n==null?'N/A':Number(n).toLocaleString('en-GB',{maximumFractionDigits:5});
const money=(n,c)=>n==null?'N/A':(c?c+' ':'')+fmt(n);
const chartPalettes={slate:['#24476B','#376681','#5B788D','#678780','#8B8D83','#6C7191','#879AAB','#A4B0B7'],midnight:['#5688B0','#6D9DAE','#789D9A','#9B9B89','#828CAA','#7B93A3','#A4B1BD','#667C97'],emerald:['#276E67','#4B8178','#688D88','#758D7E','#728B9B','#8E9489','#587A85','#A1ACA3'],sand:['#6F7883','#8C8C84','#7A9291','#9A9184','#7F8999','#A29D90','#72878C','#B0ACA1']};
const palette=()=>chartPalettes[document.documentElement.dataset.theme||'slate']||chartPalettes.slate;
const chartColor=i=>palette()[Math.abs(i)%palette().length];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tip=byId('tooltip');
function showTip(ev,html){tip.innerHTML=html;tip.classList.remove('hidden');tip.style.left=Math.max(8,Math.min(ev.clientX+14,innerWidth-330))+'px';tip.style.top=Math.max(8,ev.clientY-15)+'px'}
function hideTip(){tip.classList.add('hidden')}
const NS='http://www.w3.org/2000/svg';
function svgNode(tag,attrs={},content){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(content!==undefined)n.textContent=String(content);return n}
function svgRoot(target,viewBox,extra={}){const container=byId(target);container.replaceChildren();const s=svgNode('svg',{viewBox,width:'100%',role:'img',...extra});container.appendChild(s);return s}
function add(parent,tag,attrs={},text){const x=svgNode(tag,attrs,text);parent.appendChild(x);return x}
function tooltipOn(node,html){node.addEventListener('mousemove',ev=>showTip(ev,typeof html==='function'?html():html));node.addEventListener('mouseleave',hideTip)}
function paletteText(bg){const hex=bg.replace('#','');if(hex.length!==6)return '#fff';const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);return (.2126*r+.7152*g+.0722*b)>150?'#15243a':'#fff'}
function hexMix(light,dark,t){const a=[1,3,5].map(i=>parseInt(light.slice(i,i+2),16)),b=[1,3,5].map(i=>parseInt(dark.slice(i,i+2),16));return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('')}
const DEMO_CSV=`Parent Fund,Child Fund,Allocation %,Parent Amount,Currency\nGlobal Investment Portfolio,Global Equity Fund,55,15000000,GBP\nGlobal Investment Portfolio,Fixed Income Fund,30,15000000,GBP\nGlobal Investment Portfolio,Alternatives Fund,15,15000000,GBP\nGlobal Equity Fund,US Equity Fund,60,,GBP\nGlobal Equity Fund,European Equity Fund,40,,GBP\nUS Equity Fund,Apple,35,,GBP\nUS Equity Fund,Microsoft,35,,GBP\nUS Equity Fund,Nvidia,30,,GBP\nEuropean Equity Fund,Nestle,50,,GBP\nEuropean Equity Fund,ASML,50,,GBP\nFixed Income Fund,UK Government Bonds,55,,GBP\nFixed Income Fund,Corporate Bond Fund,45,,GBP\nCorporate Bond Fund,Investment Grade Bonds,70,,GBP\nCorporate Bond Fund,High Yield Bonds,30,,GBP\nAlternatives Fund,Infrastructure,60,,GBP\nAlternatives Fund,Property Fund,40,,GBP`;
async function loadFile(f){if(!f)return;status.textContent='Reading file inside your browser…';
 try{const j=await FundScopeSpreadsheet.read(f);sourceRows=j.rows;sourceColumns=j.columns;uploadId='browser-session';data=null;focusedFundPath='';
 const fields=[['parent','Parent fund *'],['child','Child fund *'],['allocation','Allocation % *'],['amount','Parent investment amount (optional)'],['currency','Currency (optional)']];
 selectors.innerHTML=fields.map(([k,t])=>`<div><label for="map_${k}">${t}</label><select id="map_${k}"><option value="">${k==='amount'||k==='currency'?'Not provided':'Select column'}</option>${j.columns.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>`).join('');
 for(const [k] of fields){const match=j.columns.find(c=>{const n=c.toLowerCase().replace(/[_-]/g,' ');return k==='parent'?/parent|from fund|source/.test(n):k==='child'?/child|to fund|holding/.test(n):k==='allocation'?/alloc|percentage|weight|pct/.test(n):k==='amount'?/amount|value|investment/.test(n):/currency|ccy/.test(n)});if(match)byId('map_'+k).value=match}
 mapping.classList.remove('hidden');navigate('mapping');status.textContent=`${j.count} rows read locally. No data sent to a server. Verify column mapping.`;
 }catch(e){status.textContent='File error: '+e.message;console.error('Local workbook error:',e)}
}
file.addEventListener('change',()=>loadFile(file.files[0]));
async function loadDemo(){await loadFile(new File([DEMO_CSV],'fundscope_synthetic_demo.csv',{type:'text/csv'}))}
function clearData(){sourceRows=[];sourceColumns=[];uploadId=null;data=null;focusedFundPath='';file.value='';root.replaceChildren();byId('fundSearch').value='';byId('fundList').replaceChildren();byId('fundFocus').replaceChildren();selectors.replaceChildren();status.textContent='Session data cleared from the application. Files already exported to your device are not deleted.';navigate('home')}
function calculate(){const columns={};for(const k of ['parent','child','allocation','amount','currency']){const v=byId('map_'+k)?.value;if(v)columns[k]=v}
 if(!uploadId){status.textContent='Choose a file first';return}
 if(!['parent','child','allocation'].every(k=>columns[k])){status.textContent='Please map the three required columns: parent, child and allocation.';return}
 if(Object.values(columns).some(c=>!sourceColumns.includes(c))){status.textContent='Invalid column mapping';return}
 try{status.textContent='Calculating hierarchy locally…';data=FundScopeEngine.analyse(sourceRows,columns);
 root.innerHTML='<option value="">All portfolios</option>'+data.roots.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 focusedFundPath='';byId('fundSearch').value='';dashboard.classList.remove('hidden');navigate('dashboard');
 status.textContent=`Calculated ${data.details.length} positions across ${data.roots.length} root portfolios — entirely in your browser.`;render();
 }catch(e){status.textContent='Calculation error: '+e.message;console.error(e)}
}
async function download(filtered){if(!data)return;const r=filtered?root.value:'';
 const only=(items)=>items.filter(x=>!r||x.root===r);
 const sheets=[{name:'Look-Through Details',records:only(data.details)},{name:'Portfolio Summary',records:only(data.summary)},{name:'Consolidated Holdings',records:only(data.holdings)},{name:'Data Quality',records:data.issues,columns:['row','issue']}];
 try{const blob=await FundScopeSpreadsheet.writeXLSX(sheets);saveBlob(`fund_lookthrough_${filtered?'filtered':'complete'}.xlsx`,blob,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
 catch(e){alert('Local Excel export failed: '+e.message);console.error(e)}
}
function render(){if(!data)return;const selected=root.value,sums=data.summary.filter(x=>!selected||x.root===selected),det=data.details.filter(x=>!selected||x.root===selected),holdings=data.holdings.filter(x=>!selected||x.root===selected),trees=data.trees.filter(x=>!selected||x.name===selected);
 const maxdepth=Math.max(0,...det.map(x=>x.level)),valueKnown=sums.filter(x=>x.root_amount!=null),cur=[...new Set(valueKnown.map(x=>x.currency||'unspecified'))];
 const total=valueKnown.length===sums.length&&cur.length===1&&sums.length?money(sums.reduce((s,x)=>s+x.root_amount,0),cur[0]):'N/A';
 const k=[['Top-parent portfolios',sums.length],['Investment relationships',det.length-sums.length],['Max hierarchy depth',maxdepth],['Ultimate holdings',holdings.length],['Investment value',total],['Amount coverage',valueKnown.length+' / '+sums.length],['Highest leaf exposure',holdings.length?fmt(Math.max(...holdings.map(x=>x.effective_pct)))+'%':'N/A'],['Reconciliation issues',data.issues.length]];
 metrics.innerHTML=k.map(([t,v])=>`<div class="metric"><span>${esc(t)}</span><b>${esc(v)}</b></div>`).join('');
 byId('summarytable').innerHTML='<table><thead><tr><th>Portfolio</th><th>Positions</th><th>Depth</th><th>Leaf coverage</th><th>Value</th></tr></thead><tbody>'+sums.map(x=>`<tr><td>${esc(x.root)}</td><td>${x.positions}</td><td>${x.max_depth}</td><td>${fmt(x.leaf_coverage_pct)}%</td><td>${esc(money(x.root_amount,x.currency))}</td></tr>`).join('')+'</tbody></table>';
 const issues=data.issues;byId('issues').innerHTML=issues.length?issues.slice(0,150).map(x=>`<div>Row ${esc(x.row)}: ${esc(x.issue)}</div>`).join(''):'No issues identified.';
 const cols=['root','parent','child','level','direct_pct','effective_pct','amount','currency','path','trace'];detailtable.innerHTML='<table><thead><tr>'+cols.map(c=>`<th>${esc(c.replaceAll('_',' '))}</th>`).join('')+'</tr></thead><tbody>'+det.slice(0,3000).map(d=>'<tr>'+cols.map(c=>`<td>${esc(d[c]==null?'N/A':d[c])}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
 drawHeatmap(holdings);drawSunburst(trees);drawTreemap(holdings);drawFlow(trees);renderFundList();renderFundFocus();byId('reportDate').textContent=new Date().toLocaleString();
}
function fundEntries(){if(!data)return[];const r=root.value;return data.details.filter(x=>!r||x.root===r)}
function clearFundFocus(){focusedFundPath='';renderFundList();renderFundFocus()}
function selectFundPath(path){focusedFundPath=path;renderFundList();renderFundFocus();byId('fundFocus').scrollIntoView({behavior:'smooth',block:'nearest'})}
function renderFundList(){const entries=fundEntries(),q=(byId('fundSearch').value||'').trim().toLowerCase(),filtered=entries.filter(x=>!q||x.child.toLowerCase().includes(q)||x.path.toLowerCase().includes(q));
 byId('fundCount').textContent=`${filtered.length} of ${entries.length} investment positions · repeated funds shown by path`;
 byId('fundList').innerHTML=filtered.slice(0,500).map(x=>`<button class="fund-option ${x.path===focusedFundPath?'selected':''}" data-fund-path="${esc(x.path)}"><b>${esc(x.child)}</b><small>Level ${x.level} · ${fmt(x.effective_pct)}% · ${esc(x.path)}</small></button>`).join('')+(filtered.length>500?'<div class="muted" style="padding:12px">Showing first 500 matches. Refine your search.</div>':'');
 byId('fundList').querySelectorAll('[data-fund-path]').forEach(b=>b.addEventListener('click',()=>selectFundPath(b.dataset.fundPath)));
}
function findTreePath(path){const parts=path.split(' → ');let tree=data.trees.find(t=>t.name===parts[0]);if(!tree)return null;for(const name of parts.slice(1)){tree=(tree.children||[]).find(t=>t.name===name);if(!tree)return null}return tree}
function renderFundFocus(){const el=byId('fundFocus'),chart=byId('fundFlow');const item=fundEntries().find(x=>x.path===focusedFundPath);
 if(!item){if(focusedFundPath)focusedFundPath='';el.innerHTML='<p>Select any fund or stock from the list. The full investment path and its downstream hierarchy will appear here.</p>';chart.innerHTML='<div class="chart-empty">Choose a fund to view its hierarchy</div>';return}
 const parts=item.path.split(' → ');
 el.innerHTML=`<h3>${esc(item.child)}</h3><div class="fund-breadcrumb">${esc(item.path)}</div><div class="fund-ancestors">${parts.map((part,i)=>`<span>${i?'↳ ':''}${esc(part)}</span>`).join('')}</div><div class="fund-metrics"><div><small>Hierarchy level</small><b>${item.level}</b></div><div><small>Direct allocation</small><b>${fmt(item.direct_pct)}%</b></div><div><small>Effective from root</small><b>${fmt(item.effective_pct)}%</b></div><div><small>Allocated value</small><b>${esc(money(item.amount,item.currency))}</b></div></div>`;
 const node=findTreePath(item.path);if(node)drawFlow([node],'fundFlow');else chart.innerHTML='<div class="chart-empty">Hierarchy not found for this investment path</div>';
}
function drawHeatmap(holdings){const sorted=[...holdings].filter(d=>Number(d.effective_pct)>0).sort((a,b)=>b.effective_pct-a.effective_pct).slice(0,60),el=byId('heatmap');if(!sorted.length){el.innerHTML='<div class="chart-empty">No positive holdings to display</div>';return}
 const cols=4,stepX=168,stepY=78,s=svgRoot('heatmap',`0 0 ${cols*stepX+12} ${Math.ceil(sorted.length/cols)*stepY+12}`),max=Math.max(...sorted.map(d=>d.effective_pct),1);
 sorted.forEach((d,i)=>{const x=(i%cols)*stepX+8,y=Math.floor(i/cols)*stepY+8,fill=hexMix('#e8eff4',chartColor(0),.12+.88*d.effective_pct/max),txt=paletteText(fill);
 const g=add(s,'g',{transform:`translate(${x},${y})`});add(g,'rect',{width:158,height:66,rx:7,fill});add(g,'text',{x:9,y:24,'font-size':12,fill:txt},d.holding.length>19?d.holding.slice(0,17)+'…':d.holding);add(g,'text',{x:9,y:46,'font-size':13,'font-weight':700,fill:txt},fmt(d.effective_pct)+'%');tooltipOn(g,()=>`<b>${esc(d.root)} → ${esc(d.holding)}</b><br>${fmt(d.effective_pct)}%<br>${esc(money(d.amount,d.currency))}`)})
}
function pieArc(x0,x1,r0,r1){const polar=(a,r)=>[Math.cos(a-Math.PI/2)*r,Math.sin(a-Math.PI/2)*r];
 if(x1-x0>=Math.PI*2-.000001)x1=x0+Math.PI*2-.000001;
 const a=polar(x0,r1),b=polar(x1,r1),c=polar(x1,r0),d=polar(x0,r0),large=(x1-x0)>Math.PI?1:0;
 return `M${a.join(' ')} A${r1} ${r1} 0 ${large} 1 ${b.join(' ')} L${c.join(' ')} A${r0} ${r0} 0 ${large} 0 ${d.join(' ')} Z`;
}
function drawSunburst(trees){const el=byId('sunburst');if(!trees.length){el.innerHTML='<div class="chart-empty">No hierarchy available</div>';return}
 const s=svgRoot('sunburst','-300 -300 600 600'),weights=new WeakMap();let maxLevel=0;
 function weight(node,depth){maxLevel=Math.max(maxLevel,depth);const w=(node.children||[]).length?node.children.reduce((t,c)=>t+weight(c,depth+1),0):Math.max(0,node.effective_pct||0);weights.set(node,w);return w}
 const w=trees.reduce((sum,t)=>sum+weight(t,0),0);if(w<=0){el.innerHTML='<div class="chart-empty">No positive allocations</div>';return}
 const step=Math.min(72,244/(maxLevel+1));let cursor=0;
 function paint(node,start,end,depth,colour){const r0=40+depth*step,r1=Math.min(285,r0+step-2),fill=depth===0?chartColor(colour):hexMix('#e2e9ee',chartColor(colour),Math.max(.52,1-depth*.09));
 if(end-start>.00001){const p=add(s,'path',{d:pieArc(start,end,r0,r1),fill,stroke:'var(--surface)','stroke-width':1.3});tooltipOn(p,()=>`<b>${esc(node.name)}</b><br>Effective allocation: ${fmt(node.effective_pct)}%<br>Amount: ${esc(money(node.amount,node.currency))}`)}
 let at=start;for(const c of node.children||[]){const span=(end-start)*weights.get(c)/Math.max(1e-12,weights.get(node));paint(c,at,at+span,depth+1,colour);at+=span}}
 trees.forEach((t,i)=>{const span=2*Math.PI*weights.get(t)/w;paint(t,cursor,cursor+span,0,i);cursor+=span});add(s,'circle',{r:39,fill:'var(--surface)'});add(s,'text',{'text-anchor':'middle',fill:'var(--text)','font-size':15,'font-weight':700,y:5},'Exposure');
}
function drawTreemap(holdings){const el=byId('treemap'),positive=[...holdings].filter(d=>Number.isFinite(+d.effective_pct)&&d.effective_pct>0).sort((a,b)=>b.effective_pct-a.effective_pct);if(!positive.length){el.innerHTML='<div class="chart-empty">No positive holdings to display</div>';return}
 const maxTiles=32,visible=positive.slice(0,maxTiles),remaining=positive.slice(maxTiles).reduce((s,d)=>s+d.effective_pct,0);if(remaining>0)visible.push({holding:'Other holdings',root:'Aggregated',effective_pct:remaining,amount:null,currency:''});
 const width=760,height=440,s=svgRoot('treemap',`0 0 ${width} ${height}`,{'aria-label':'Holdings treemap sized by effective allocation'});
 // Balanced binary subdivision: keeps tile area proportional to holding exposure.
 const boxes=[];
 function layout(items,x,y,w,h){if(!items.length)return;if(items.length===1){boxes.push({item:items[0],x,y,w,h});return}
  const total=items.reduce((a,b)=>a+b.effective_pct,0),half=total/2;let index=1,sum=items[0].effective_pct;
  while(index<items.length-1&&sum+items[index].effective_pct<=half){sum+=items[index++].effective_pct}
  const ratio=sum/total;if(w>=h){layout(items.slice(0,index),x,y,w*ratio,h);layout(items.slice(index),x+w*ratio,y,w*(1-ratio),h)}
  else{layout(items.slice(0,index),x,y,w,h*ratio);layout(items.slice(index),x,y+h*ratio,w,h*(1-ratio))}
 }
 layout(visible,3,3,width-6,height-6);
 boxes.forEach((b,i)=>{const x=b.x+2.5,y=b.y+2.5,w=Math.max(0,b.w-5),h=Math.max(0,b.h-5),fill=chartColor(i),g=add(s,'g');add(g,'rect',{x,y,width:w,height:h,rx:5,fill,stroke:'var(--surface)','stroke-width':1});
 if(w>=52&&h>=32){const maxChars=Math.max(4,Math.floor((w-14)/7)),title=b.item.holding.length>maxChars?b.item.holding.slice(0,maxChars-1)+'…':b.item.holding;
 add(g,'text',{x:x+8,y:y+Math.min(21,h/2),'font-size':w<90?10:12,'font-weight':650,fill:paletteText(fill)},title);
 if(h>50&&w>70)add(g,'text',{x:x+8,y:y+Math.min(41,h-8),'font-size':12,'font-weight':700,fill:paletteText(fill)},fmt(b.item.effective_pct)+'%')}
 tooltipOn(g,()=>`<b>${esc(b.item.root)} → ${esc(b.item.holding)}</b><br>${fmt(b.item.effective_pct)}%<br>${esc(money(b.item.amount,b.item.currency))}`)});
 if(positive.length>maxTiles){const n=document.createElement('div');n.className='legend';n.textContent=`Showing ${maxTiles} largest holdings; ${positive.length-maxTiles} smaller holdings combined as Other. Hover for full names.`;el.appendChild(n)}
}
function flowLabel(n){const mode=byId('flowLabels')?.value||'both',pct=n.pct==null?'N/A':fmt(n.pct)+'%',val=money(n.amount,n.currency);if(mode==='names')return '';if(mode==='percent')return pct;if(mode==='amount')return val;return pct+(n.amount==null?'':' · '+val)}
function renderFlowViews(){if(!data)return;const chosen=root.value,trees=data.trees.filter(t=>!chosen||t.name===chosen);drawFlow(trees,'sankey');if(focusedFundPath)renderFundFocus()}
function drawFlow(trees,target='sankey'){const el=byId(target);if(!trees.length){el.innerHTML='<div class="chart-empty">No hierarchy available</div>';return}
 const nodes=[];function visit(x,depth,parent){const id=nodes.length;nodes.push({id,depth,name:x.name,pct:x.effective_pct,amount:x.amount,currency:x.currency,parent});(x.children||[]).forEach(c=>visit(c,depth+1,id))}trees.forEach(t=>visit(t,0,null));
 const levels=new Map();for(const n of nodes){if(!levels.has(n.depth))levels.set(n.depth,[]);levels.get(n.depth).push(n)}
 const maxDepth=Math.max(...levels.keys()),width=Math.max(860,(maxDepth+1)*215),height=Math.max(350,Math.max(...[...levels.values()].map(v=>v.length))*49+70);
 const s=svgRoot(target,`0 0 ${width} ${height}`,{'aria-label':'Investment hierarchy flow'});
 for(const [depth,group] of levels)group.forEach((n,i)=>{n.x=22+depth*215;n.y=42+(i+.5)*(height-84)/group.length});
 for(const n of nodes.filter(n=>n.parent!==null)){const p=nodes[n.parent];add(s,'path',{d:`M${p.x+165},${p.y} C${p.x+191},${p.y} ${n.x-27},${n.y} ${n.x},${n.y}`,fill:'none',stroke:chartColor(n.depth),'stroke-opacity':.45,'stroke-width':Math.max(1.5,Math.min(9,(n.pct||0)/9))})}
 for(const n of nodes){const g=add(s,'g',{transform:`translate(${n.x},${n.y})`});add(g,'rect',{x:0,y:-17,width:170,height:36,rx:6,fill:'var(--surface2)',stroke:'var(--border)'});add(g,'rect',{x:0,y:-17,width:4,height:36,rx:2,fill:chartColor(n.depth)});
 add(g,'text',{x:10,y:-3,'font-size':11,'font-weight':650,fill:'var(--text)'},n.name.length>24?n.name.slice(0,23)+'…':n.name);
 const label=flowLabel(n);add(g,'text',{x:10,y:12,'font-size':10,fill:'var(--muted)'},label.length>29?label.slice(0,28)+'…':label);
 tooltipOn(g,()=>`<b>${esc(n.name)}</b><br>Effective: ${fmt(n.pct)}%<br>Amount: ${esc(money(n.amount,n.currency))}`)}
}
const THEME_KEY='fundscope-theme';
function setTheme(t){document.documentElement.dataset.theme=t;byId('theme').value=t;try{localStorage.setItem(THEME_KEY,t)}catch(e){}if(data)render()}
function navigate(page){if(page==='dashboard'&&!data)return;if(page==='mapping'&&!uploadId)return;['home','mapping','dashboard'].forEach(p=>byId('page-'+p).classList.toggle('hidden',p!==page));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));window.scrollTo({top:0,behavior:'smooth'})}
function saveBlob(name,content,type){const b=content instanceof Blob?content:new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function visibleData(){if(!data)return null;const r=root.value;return {generated_at:new Date().toISOString(),portfolio_filter:r||'All',summary:data.summary.filter(x=>!r||x.root===r),details:data.details.filter(x=>!r||x.root===r),holdings:data.holdings.filter(x=>!r||x.root===r),links:data.links.filter(x=>!r||x.root===r),issues:data.issues,metrics:data.metrics}}
function exportJSON(){if(!data)return;saveBlob('fundscope_analysis.json',JSON.stringify(visibleData(),null,2),'application/json')}
function exportHTML(){if(!data)return;const copy=byId('page-dashboard').cloneNode(true);copy.querySelectorAll('button,select,.no-export').forEach(n=>n.remove());const style=byId('original-styles').textContent;
 // Static snapshot only; no scripts or external content. SVG charts and tables are already rendered.
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FundScope | Investment Analysis</title><style>'+style+' body{padding:30px} .chart{overflow:visible} .chart svg{max-width:100%;height:auto} .grid2{display:grid;grid-template-columns:1fr 1fr} </style></head><body data-theme="'+esc(document.documentElement.dataset.theme)+'"><header><strong>◈ FundScope <small>Investment Intelligence Report</small></strong></header><main>'+copy.innerHTML+'</main><footer>Generated '+new Date().toLocaleString()+' · FundScope</footer></body></html>';
 saveBlob('fundscope_dashboard.html',html,'text/html');
}
function exportPDF(){if(data)window.print()}
try{setTheme(localStorage.getItem(THEME_KEY)||'slate')}catch(e){setTheme('slate')}

// All controls use local event handlers; no inline scripts are needed.
document.addEventListener('click', e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 switch(b.dataset.action){
  case 'home':navigate('home');break;
  case 'mapping':navigate('mapping');break;
  case 'dashboard':navigate('dashboard');break;
  case 'choose-file':file.click();break;
  case 'calculate':calculate();break;
  case 'complete-excel':download(false);break;
  case 'filtered-excel':download(true);break;
  case 'export-html':exportHTML();break;
  case 'export-json':exportJSON();break;
  case 'export-pdf':exportPDF();break;
  case 'clear-fund':clearFundFocus();break;
  case 'demo':loadDemo();break;
  case 'clear-data':clearData();break;
 }
});
byId('theme').addEventListener('change',e=>setTheme(e.target.value));
root.addEventListener('change',render);
byId('flowLabels').addEventListener('change',renderFlowViews);
byId('fundSearch').addEventListener('input',renderFundList);
