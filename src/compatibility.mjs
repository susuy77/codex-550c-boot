import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const sha = data => crypto.createHash('sha256').update(data).digest('hex');
export function fileHash(file) {
  const fd=fs.openSync(file,'r'), hash=crypto.createHash('sha256'), buffer=Buffer.alloc(4194304);
  try { let count; while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0) hash.update(buffer.subarray(0,count)); return hash.digest('hex'); }
  finally { fs.closeSync(fd); }
}
export function readArchive(file) {
  const fd=fs.openSync(file,'r');
  try {
    const prefix=Buffer.alloc(16); fs.readSync(fd,prefix,0,16,0);
    const length=prefix.readUInt32LE(12), start=8+prefix.readUInt32LE(4);
    if(prefix.readUInt32LE(0)!==4 || length<2 || length>64*1024*1024 || start<16+length || start>fs.fstatSync(fd).size) throw Error('Unsupported ASAR header');
    const raw=Buffer.alloc(length); if(fs.readSync(fd,raw,0,length,16)!==length) throw Error('Truncated ASAR header');
    const header=JSON.parse(raw.toString('utf8'));
    return {header,raw,start,read(name) {
      let entry=header; for(const part of name.split('/')) entry=entry?.files?.[part];
      if(!entry || entry.unpacked || entry.link || !Number.isSafeInteger(entry.size) || entry.size>8*1024*1024) throw Error('Unsupported packed entry: '+name);
      const offset=Number(entry.offset); if(!Number.isSafeInteger(offset)||offset<0||start+offset+entry.size>fs.statSync(file).size) throw Error('Invalid ASAR entry bounds');
      const buffer=Buffer.alloc(entry.size), handle=fs.openSync(file,'r');
      try {if(fs.readSync(handle,buffer,0,buffer.length,start+offset)!==buffer.length) throw Error('Truncated entry');} finally {fs.closeSync(handle);}
      if(entry.integrity && (entry.integrity.algorithm!=='SHA256'||sha(buffer)!==entry.integrity.hash)) throw Error('Source entry integrity mismatch: '+name);
      return {entry,buffer};
    }};
  } finally {fs.closeSync(fd);}
}
export function embeddedRecord(buffer) {
  const text=buffer.toString('latin1'), results=[];
  for(const match of text.matchAll(/\[\s*\{[^\[\]\x00]{1,2048}\}\s*\]/g)) {
    let value; try {value=JSON.parse(match[0]);} catch {continue;}
    if(value.length!==1 || value[0].file?.replaceAll('\\','/')!=='resources/app.asar' || value[0].alg?.toUpperCase()!=='SHA256' || !/^[a-f0-9]{64}$/i.test(value[0].value)) continue;
    const hash=value[0].value; if(match[0].indexOf(hash)!==match[0].lastIndexOf(hash)) throw Error('Ambiguous embedded record');
    results.push({hash:hash.toLowerCase(),offset:match.index+match[0].indexOf(hash)});
  }
  if(results.length!==1) throw Error('Unsupported executable ASAR record: '+results.length+' matches');
  return results[0];
}
const decode = text => text.replace(/&#(?:39|x27);/gi,"'").replace(/&quot;|&#34;/gi,'"').replace(/&amp;/gi,'&');
export function patchHtml(html,script) {
  if(html.includes('codex-550c-boot')) throw Error('Source is already patched; use the original archive');
  if(/<\/script\b/i.test(script)) throw Error('Unexpected script closing tag');
  if((html.match(/<head\b/gi)||[]).length!==1 || (html.match(/<body\b/gi)||[]).length!==1 || !/<\/head\s*>/i.test(html) || !/<\/body\s*>/i.test(html)) throw Error('Unsupported startup document structure');
  const modules=[...html.matchAll(/<script\b[^>]*>/gi)].filter(m=>/\btype\s*=\s*['"]module['"]/i.test(m[0]) && /\bsrc\s*=/i.test(m[0]));
  if((html.match(/\bid\s*=\s*['"]root['"]/gi)||[]).length!==1 || modules.length<1) throw Error('Startup root or module entry changed; manual adaptation needed');
  const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].filter(m=>/\bhttp-equiv\s*=\s*['"]Content-Security-Policy['"]/i.test(m[0]));
  if(metas.length!==1) throw Error('Expected one startup CSP meta');
  const meta=metas[0], attr=/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i.exec(meta[0]);
  if(!attr) throw Error('CSP content attribute missing');
  let csp=decode(attr[2]);
  const directives=csp.split(';').map(s=>s.trim()).filter(Boolean), scripts=directives.filter(s=>/^script-src\s/i.test(s));
  if(scripts.length!==1 || !scripts[0].split(/\s+/).includes("'self'") || directives.some(s=>/^script-src-elem\s/i.test(s))) throw Error('Unsupported script CSP; refusing to weaken policy');
  const scriptHash=crypto.createHash('sha256').update(script).digest('base64');
  csp=csp.replace(/(^|;)\s*script-src\s+([^;]*)/i,(m,prefix,values)=>prefix+' script-src '+values.trim()+" 'sha256-"+scriptHash+"'");
  const encoded=csp.replaceAll('&','&amp;').replaceAll("'",'&#39;').replaceAll('"','&quot;');
  const newMeta=meta[0].replace(attr[0],()=> 'content='+attr[1]+encoded+attr[1]);
  html=html.slice(0,meta.index)+newMeta+html.slice(meta.index+meta[0].length);
  const style='<style id="codex-550c-style">#codex-550c-boot{position:fixed;inset:0;background:#000;z-index:2147483647;opacity:1;transition:opacity .35s ease;-webkit-app-region:no-drag;animation:codex-boot-failsafe 0s 30s forwards}@keyframes codex-boot-failsafe{to{visibility:hidden;pointer-events:none}}</style>';
  html=html.replace(/<\/head\s*>/i,()=>style+'\n</head>').replace(/<body\b[^>]*>/i,opening=>opening+'\n<div id="codex-550c-boot" aria-label="550C 启动动画，点击或按 Esc 跳过"></div>\n<script>'+script+'</script>');
  return {html,scriptHash};
}
export function inspectApp(appDirectory,script) {
  const archive=path.join(appDirectory,'resources','app.asar'), exe=path.join(appDirectory,'ChatGPT.exe');
  const parsed=readArchive(archive), pkg=JSON.parse(parsed.read('package.json').buffer);
  if(!/codex/i.test(pkg.name||'') || !pkg.version) throw Error('Unrecognized Codex package identity');
  const record=embeddedRecord(fs.readFileSync(exe)), headerHash=sha(parsed.raw);
  if(record.hash!==headerHash) throw Error('Original executable/archive pair mismatched');
  const original=parsed.read('webview/index.html').buffer.toString('utf8');
  patchHtml(original,script);
  return {compatible:true,internalVersion:pkg.version,packageName:pkg.name,originalHeaderHash:headerHash,originalHtmlHash:sha(Buffer.from(original)),entry:'webview/index.html',exe:'ChatGPT.exe'};
}
