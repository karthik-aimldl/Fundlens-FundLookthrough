/* FundScope local-only calculation engine. No network or persistent data storage. */
(function(g){
'use strict';
const clean = v => v == null ? '' : String(v).trim();
function number(v){
 const s=clean(v);if(!s)return null;
 const normalized=s.replace(/[£$€,%\s]/g,'').replace(/\((.+)\)/,'-$1');
 if(!normalized || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
 const n=Number(normalized);return Number.isFinite(n)?n:null;
}
function analyse(rows, cols){
 const edges=[],errors=[],amounts=new Map(),currencies=new Map();
 rows.forEach((r,i)=>{
  const p=clean(r[cols.parent]),c=clean(r[cols.child]),v=number(r[cols.allocation]);
  if(!p||!c){errors.push({row:i+2,issue:'Missing parent or child'});return}
  if(v===null||v<0||v>100){errors.push({row:i+2,issue:'Allocation must be between 0 and 100'});return}
  if(p===c){errors.push({row:i+2,issue:'Self-referencing relationship'});return}
  edges.push({parent:p,child:c,pct:v,row:i+2});
  if(cols.amount){
   const a=number(r[cols.amount]);if(a!==null){
    if(a<0)errors.push({row:i+2,issue:'Negative amount ignored'});
    else if(amounts.has(p)&&Math.abs(amounts.get(p)-a)>0.01)errors.push({row:i+2,issue:`Conflicting amount for ${p}; first value retained`});
    else amounts.set(p,a);
   }
  }
  if(cols.currency){const cur=clean(r[cols.currency]);if(cur)currencies.set(p,cur)}
 });
 const graph=new Map(),incoming=new Set(),nodes=new Set(),childTotals=new Map();
 for(const e of edges){
  if(!graph.has(e.parent))graph.set(e.parent,[]);
  graph.get(e.parent).push(e);
  incoming.add(e.child);nodes.add(e.parent);nodes.add(e.child);
  childTotals.set(e.parent,(childTotals.get(e.parent)||0)+e.pct);
 }
 const roots=[...nodes].filter(n=>!incoming.has(n)).sort((a,b)=>a.localeCompare(b));
 if(!roots.length&&nodes.size)errors.push({row:'All',issue:'No root identified; data may contain a cycle'});
 for(const [p,s] of childTotals)if(Math.abs(s-100)>0.01)errors.push({row:'—',issue:`${p}: child allocations total ${s.toFixed(4)}% (not 100%)`});
 const details=[],trees=[],links=[];let maxDepth=0;
 function walk(code,root,path,eff,level,ancestors,rootAmt,rootCurrency,direct){
  const isLeaf=!(graph.get(code)||[]).length;
  const item={root,parent:path.length>1?path[path.length-2]:'',child:code,level,direct_pct:direct,effective_pct:eff,
    amount:rootAmt!==null?Math.round(rootAmt*eff/100*1e6)/1e6:null,currency:rootCurrency,
    path:path.join(' → '),trace:ancestors.map(x=>`${Number(x.toPrecision(6))}%`).join(' × '),is_leaf:isLeaf};
  details.push(item);maxDepth=Math.max(level,maxDepth);
  const tree={name:code,effective_pct:eff,amount:item.amount,currency:rootCurrency,children:[]};
  for(const e of graph.get(code)||[]){
   if(path.includes(e.child)){errors.push({row:e.row,issue:`Cycle detected: ${[...path,e.child].join(' → ')}`});continue}
   const childEff=eff*e.pct/100;
   links.push({root,source:code,target:e.child,pct:e.pct,effective_pct:childEff,path:[...path,e.child].join(' → ')});
   tree.children.push(walk(e.child,root,[...path,e.child],childEff,level+1,[...ancestors,e.pct],rootAmt,rootCurrency,e.pct));
  }
  return tree;
 }
 for(const r of roots){const amt=amounts.has(r)?amounts.get(r):null;trees.push(walk(r,r,[r],100,0,[],amt,currencies.get(r)||'',100))}
 const reached=new Set(details.map(x=>x.child));for(const n of [...nodes].sort())if(!reached.has(n))errors.push({row:'—',issue:`${n} is not reachable from a root (cycle or disconnected component)`});
 const holdingMap=new Map();
 for(const d of details){if(!d.is_leaf)continue;const k=JSON.stringify([d.root,d.child]);
  if(!holdingMap.has(k))holdingMap.set(k,{root:d.root,holding:d.child,effective_pct:0,amount:0,amount_known:true,currency:d.currency,paths:0});
  const x=holdingMap.get(k);x.effective_pct+=d.effective_pct;x.paths++;
  if(d.amount===null)x.amount_known=false;else x.amount+=d.amount;
 }
 const holdings=[...holdingMap.values()].map(x=>({root:x.root,holding:x.holding,effective_pct:+x.effective_pct.toFixed(8),amount:x.amount_known?+x.amount.toFixed(6):null,currency:x.currency,paths:x.paths}));
 const summary=[];
 for(const r of roots){const subset=details.filter(d=>d.root===r),leaves=subset.filter(d=>d.is_leaf);
  summary.push({root:r,root_amount:amounts.has(r)?amounts.get(r):null,currency:currencies.get(r)||'',positions:subset.length-1,
   unique_holdings:new Set(leaves.map(x=>x.child)).size,max_depth:Math.max(0,...subset.map(x=>x.level)),
   leaf_coverage_pct:+leaves.reduce((s,x)=>s+x.effective_pct,0).toFixed(6)})}
 return {details,trees,links,holdings,summary,issues:errors,roots,metrics:{portfolios:roots.length,relationships:edges.length,max_depth:maxDepth,leaf_holdings:holdings.length,amount_available:summary.filter(x=>x.root_amount!==null).length}};
}
 g.FundScopeEngine={analyse,number,clean};
})(typeof window!=='undefined'?window:globalThis);
