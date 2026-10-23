/* Browser-only CSV, XLSX, XLSM reader and XLSX writer using locally bundled JSZip 3.10.1.
   No fetch, XHR, beacons or outbound requests. */
(function(g){
'use strict';
const LIMIT_ROWS=30000,MAX_FILE_BYTES=20*1024*1024,MAX_UNCOMPRESSED=100*1024*1024;
const xmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function parseCSV(text){
 const out=[];let row=[],cell='',quoted=false; text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}
  else if(c==='"'&&!cell)quoted=true;
  else if(c===','){row.push(cell);cell=''}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))out.push(row);row=[];cell='';if(out.length>LIMIT_ROWS+1)throw Error('Limit is 30,000 input rows')}
  else cell+=c;
 }
 if(quoted)throw Error('CSV has an unclosed quoted field');
 row.push(cell);if(row.some(x=>x!==''))out.push(row);
 return out;
}
function columnIndex(ref){let n=0;for(const ch of ref.toUpperCase()){const c=ch.charCodeAt(0);if(c<65||c>90)break;n=n*26+c-64}return n-1}
function parseXML(text){const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw Error('Invalid Excel XML');return d}
const descendants=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
function getText(node){return node?.textContent||''}
function zipEntry(zip,path){return zip.file(path.replace(/^\/+/,''))}
function normalizePath(base,target){
 const stack=base.split('/').slice(0,-1);
 for(const seg of target.replace(/^\/+/, '').split('/')){if(seg==='..')stack.pop();else if(seg&&seg!=='.')stack.push(seg)}
 return stack.join('/');
}
async function readExcel(buffer){
 if(!g.JSZip)throw Error('Local ZIP reader missing');
 const zip=await g.JSZip.loadAsync(buffer,{checkCRC32:false});
 let total=0;for(const f of Object.values(zip.files))if(!f.dir){total+=f._data?.uncompressedSize||0;if(total>MAX_UNCOMPRESSED)throw Error('Workbook exceeds safe uncompressed size limit')}
 const wbFile=zipEntry(zip,'xl/workbook.xml');if(!wbFile)throw Error('Not a supported XLSX workbook');
 const wb=parseXML(await wbFile.async('string'));
 const sheet=descendants(wb,'sheet')[0];if(!sheet)throw Error('Workbook does not contain a worksheet');
 const relsFile=zipEntry(zip,'xl/_rels/workbook.xml.rels');let path='xl/worksheets/sheet1.xml';
 if(relsFile){const rels=parseXML(await relsFile.async('string'));const id=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const rel=descendants(rels,'Relationship').find(x=>x.getAttribute('Id')===id);
  if(rel){const target=rel.getAttribute('Target')||'';path=target.startsWith('/')?target.slice(1):normalizePath('xl/workbook.xml',target)}
 }
 const sheetFile=zipEntry(zip,path);if(!sheetFile)throw Error('Cannot read the first worksheet');
 const shared=[];const ssFile=zipEntry(zip,'xl/sharedStrings.xml');
 if(ssFile){const strings=parseXML(await ssFile.async('string'));for(const si of descendants(strings,'si'))shared.push(descendants(si,'t').map(getText).join(''))}
 let percentStyles=new Set();const stylesFile=zipEntry(zip,'xl/styles.xml');
 if(stylesFile){const styles=parseXML(await stylesFile.async('string'));const custom={};for(const n of descendants(styles,'numFmt'))custom[n.getAttribute('numFmtId')]=n.getAttribute('formatCode')||'';
  const xfs=descendants(styles,'cellXfs')[0];if(xfs){const all=Array.from(xfs.children).filter(x=>x.localName==='xf');all.forEach((xf,i)=>{const n=Number(xf.getAttribute('numFmtId'));if(n===9||n===10||(custom[n]||'').includes('%'))percentStyles.add(i)})}
 }
 const doc=parseXML(await sheetFile.async('string'));let matrix=[];
 for(const r of descendants(doc,'sheetData')[0]?.children||[]){if(r.localName!=='row')continue;
  const rn=Number(r.getAttribute('r'))||matrix.length+1;
  if(rn>LIMIT_ROWS+100)throw Error('Worksheet has too many rows');
  const values=[];let ci=0;
  for(const c of Array.from(r.children).filter(x=>x.localName==='c')){
   const ref=c.getAttribute('r');if(ref){ci=columnIndex(ref.match(/^[A-Z]+/i)?.[0]||'A')}
   if(ci>1000)throw Error('Workbook exceeds 1,000 columns');
   const t=c.getAttribute('t');let value='';const v=descendants(c,'v')[0];
   if(t==='inlineStr')value=descendants(c,'t').map(getText).join('');
   else if(t==='s')value=shared[Number(getText(v))]||'';
   else if(t==='b')value=getText(v)==='1'?'TRUE':'FALSE';
   else if(t==='e')value=getText(v);
   else if(v){value=getText(v);if(percentStyles.has(Number(c.getAttribute('s')||0))&&value.trim()!=='')value=String(Number(value)*100)}
   values[ci]=value;ci++;
  }
  if(values.some(v=>v!==undefined&&v!==''))matrix.push(values);
  if(matrix.length>LIMIT_ROWS+1)throw Error('Limit is 30,000 input rows');
 }
 return matrix;
}
function toRecords(matrix){
 if(!matrix.length)throw Error('The selected file contains no rows');
 const headers=(matrix.shift()||[]).map(x=>String(x??'').trim());
 const indices=[],seen=new Set();headers.forEach((name,i)=>{if(name&&!seen.has(name)){seen.add(name);indices.push(i)}});
 if(!indices.length)throw Error('No column headings found in the first row');
 const columns=indices.map(i=>headers[i]);
 if(matrix.length>LIMIT_ROWS)throw Error('Limit is 30,000 input rows');
 const rows=matrix.map(row=>Object.fromEntries(indices.map(i=>[headers[i],String(row[i]??'')])));
 return {rows,columns,count:rows.length,preview:rows.slice(0,5)};
}
async function read(file){
 if(!file)throw Error('Choose an Excel or CSV file');
 if(file.size>MAX_FILE_BYTES)throw Error('Maximum file size is 20 MB');
 const name=file.name.toLowerCase();let matrix;
 if(name.endsWith('.csv'))matrix=parseCSV(await file.text());
 else if(name.endsWith('.xlsx')||name.endsWith('.xlsm'))matrix=await readExcel(await file.arrayBuffer());
 else throw Error('Only CSV, XLSX and XLSM files are supported');
 return toRecords(matrix);
}
const colLetter=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
function sheetXML(records,expectedHeaders=[]){
 const headers=[...new Set([...expectedHeaders,...records.flatMap(x=>Object.keys(x))])];
 const rows=[headers,...records.map(r=>headers.map(k=>r[k]))];
 const xmlrows=rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{
  if(v===null||v===undefined)return '';
  const ref=colLetter(j)+(i+1);
  if(i!==0 && typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;
  if(i!==0 && typeof v==='boolean')return `<c r="${ref}" t="b"><v>${v?1:0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${i===0?' s="1"':''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
 }).join('')}</row>`).join('');
 const filter=headers.length&&rows.length>1?`<autoFilter ref="A1:${colLetter(headers.length-1)}${rows.length}"/>`:'';
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${xmlrows}</sheetData>${filter}</worksheet>`;
}
async function writeXLSX(sheets){
 const zip=new JSZip();zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xmlEsc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF24476B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
 sheets.forEach((s,i)=>zip.file(`xl/worksheets/sheet${i+1}.xml`,sheetXML(s.records,s.columns||[])));
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4},mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
 g.FundScopeSpreadsheet={read,writeXLSX,parseCSV};
})(typeof window!=='undefined'?window:globalThis);
