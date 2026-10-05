import fs from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchHtml, readArchive, sha, embeddedRecord, inspectApp} from '../src/compatibility.mjs';
test('future-version preservation, refusal, exact rollback and interrupted recovery', () => {
const root=fs.mkdtempSync(path.join(os.tmpdir(),'codex-550c-test-'));
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolRoot=path.join(projectRoot,'tools');
const script=fs.readFileSync(path.join(projectRoot,'dist','boot.js'),'utf8');
const html=`<!DOCTYPE html><html><head><meta content="default-src 'none'; script-src 'self' 'sha256-existing'; style-src 'self' 'unsafe-inline'; connect-src https://new-version.example;" http-equiv="Content-Security-Policy"><title>Future version</title><script src="./assets/new-hash.js" type="module"></script><link rel="stylesheet" href="new-style.css"></head><body data-new-version="yes"><div id='root'></div></body></html>`;
const patched=patchHtml(html,script);
assert.match(patched.html,/assets\/new-hash.js/);assert.match(patched.html,/connect-src https:\/\/new-version.example/);assert.match(patched.html,/sha256-existing/);assert.match(patched.html,/data-new-version="yes"/);
assert.equal((patched.html.match(/id="codex-550c-boot"/g)||[]).length,1);
assert.throws(()=>patchHtml(patched.html,script),/already patched/);
assert.throws(()=>patchHtml(html.replace("id='root'","id='changed-root'"),script),/root/);
assert.throws(()=>patchHtml(html.replace("script-src 'self' 'sha256-existing'","script-src 'none'"),script),/CSP/);
assert.throws(()=>patchHtml(html.replace("connect-src", "script-src-elem 'self'; connect-src"),script),/CSP/);
const contents={'package.json':Buffer.from(JSON.stringify({name:'openai-codex-electron',version:'99.1.0'})), 'webview/index.html':Buffer.from(html),'webview/assets/new-hash.js':Buffer.from('/* future module: must remain unchanged */')};
const header={files:{}};let offset=0;const payload=[];
for(const [name,data] of Object.entries(contents)){let entry=header;const parts=name.split('/');for(const part of parts.slice(0,-1)){entry.files[part]??={files:{}};entry=entry.files[part];}entry.files[parts.at(-1)]={size:data.length,offset:String(offset),integrity:{algorithm:'SHA256',hash:sha(data),blockSize:4194304,blocks:[sha(data)]}};payload.push(data);offset+=data.length;}
const raw=Buffer.from(JSON.stringify(header)),n=Math.ceil((4+raw.length)/4)*4,prefix=Buffer.alloc(16);prefix.writeUInt32LE(4,0);prefix.writeUInt32LE(4+n,4);prefix.writeUInt32LE(n,8);prefix.writeUInt32LE(raw.length,12);
const runtime=path.join(root,'runtime'),archive=path.join(runtime,'resources','app.asar');fs.mkdirSync(path.dirname(archive),{recursive:true});
fs.writeFileSync(archive,Buffer.concat([prefix,raw,Buffer.alloc(n-4-raw.length),...payload]));
const executable=Buffer.from('PE-fixture\0'+JSON.stringify([{alg:'SHA256',value:sha(raw),file:'resources\\app.asar'}]));fs.writeFileSync(path.join(runtime,'ChatGPT.exe'),executable);
assert.equal(inspectApp(runtime,script).internalVersion,'99.1.0');
const staged=path.join(root,'staged.asar');execFileSync(process.execPath,[path.join(toolRoot,'build-local-asar.mjs'),archive,staged]);
const rebuilt=readArchive(staged);
assert.equal(rebuilt.read('webview/index.html').buffer.toString(),patched.html);
assert.equal(rebuilt.read('webview/assets/new-hash.js').buffer.toString(),contents['webview/assets/new-hash.js'].toString());
assert.equal(rebuilt.read('package.json').buffer.toString(),contents['package.json'].toString());
execFileSync(process.execPath,[path.join(toolRoot,'manage-patch.mjs'),'apply',staged],{env:{...process.env,CODEX_550C_TARGET_ROOT:root,CODEX_550C_SOURCE_PACKAGE:'fixture-future'}});
assert.equal(embeddedRecord(fs.readFileSync(path.join(runtime,'ChatGPT.exe'))).hash,sha(readArchive(archive).raw));
execFileSync(process.execPath,[path.join(toolRoot,'manage-patch.mjs'),'rollback'],{env:{...process.env,CODEX_550C_TARGET_ROOT:root}});
assert.deepEqual(fs.readFileSync(path.join(runtime,'ChatGPT.exe')),executable);
assert.equal(readArchive(archive).read('webview/index.html').buffer.toString(),html);
fs.writeFileSync(path.join(runtime,'ChatGPT.exe'),Buffer.from('broken exe'));
assert.throws(()=>inspectApp(runtime,script),/record/);
fs.writeFileSync(path.join(runtime,'ChatGPT.exe'),executable);
execFileSync(process.execPath,[path.join(toolRoot,'manage-patch.mjs'),'apply',staged],{env:{...process.env,CODEX_550C_TARGET_ROOT:root}});
const previous=path.join(root,'history','interrupted-fixture');fs.mkdirSync(path.join(previous,'runtime','resources'),{recursive:true});
fs.copyFileSync(path.join(root,'backup','ChatGPT.exe.original'),path.join(previous,'runtime','ChatGPT.exe'));
fs.copyFileSync(path.join(root,'backup','app.asar.original'),path.join(previous,'runtime','resources','app.asar'));
fs.writeFileSync(path.join(previous,'metadata.json'),JSON.stringify({fixture:'previous'}));
fs.writeFileSync(path.join(root,'metadata.json'),JSON.stringify({fixture:'candidate'}));
fs.writeFileSync(path.join(root,'upgrade-state.json'),JSON.stringify({status:'prepared',previousPackage:'fixture-previous',previousSnapshot:previous}));
if(process.platform==='win32'){
execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(projectRoot,'scripts','windows','Recover-Upgrade.ps1')],{env:{...process.env,CODEX_550C_DATA_DIR:root}});
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'metadata.json'))).fixture,'previous');
assert.deepEqual(fs.readFileSync(path.join(runtime,'ChatGPT.exe')),executable);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'upgrade-state.json'))).status,'failed-restored');
}
console.log('PASS: changed-version HTML, module/CSP preservation, incompatible structure refusal, ASAR rebuild, flexible executable record, apply/rollback, mismatched executable rejection, interrupted mid-switch recovery.');

});
