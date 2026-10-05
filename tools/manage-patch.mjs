import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {embeddedRecord, readArchive} from '../src/compatibility.mjs';
const root=process.env.CODEX_550C_TARGET_ROOT ? path.resolve(process.env.CODEX_550C_TARGET_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','.local');
const runtime=path.join(root,'runtime');
const backup=path.join(root,'backup');
const exe=path.join(runtime,'ChatGPT.exe');
const archive=path.join(runtime,'resources','app.asar');
const mode=process.argv[2];
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function fileHash(file){const fd=fs.openSync(file,'r'),hash=crypto.createHash('sha256'),buffer=Buffer.alloc(4194304);try{let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count));return hash.digest('hex');}finally{fs.closeSync(fd);}}
function headerHash(file){ return sha(readArchive(file).raw); }
function record(buffer){
  return embeddedRecord(buffer);
}
function verify(){const archiveHash=headerHash(archive);const exeHash=record(fs.readFileSync(exe)).hash;if(archiveHash!==exeHash)throw Error('Executable and archive hash mismatch');return archiveHash;}
if(mode==='apply'){
  const staged=process.argv[3];if(!staged)throw Error('Missing staged archive');
  fs.mkdirSync(backup,{recursive:true});
  const baselinePath=path.join(backup,'baseline.json');
  if(!fs.existsSync(baselinePath)){
    const originalHeaderHash=verify();
    fs.copyFileSync(exe,path.join(backup,'ChatGPT.exe.original'),fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(archive,path.join(backup,'app.asar.original'),fs.constants.COPYFILE_EXCL);
    const internalVersion=JSON.parse(readArchive(archive).read('package.json').buffer).version;
    fs.writeFileSync(baselinePath,JSON.stringify({originalHeaderHash,originalExeHash:sha(fs.readFileSync(exe)),originalArchiveHash:fileHash(archive),internalVersion,sourcePackage:process.env.CODEX_550C_SOURCE_PACKAGE||null},null,2));
  }
  const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8').replace(/^\uFEFF/,''));
  const exeBytes=fs.readFileSync(path.join(backup,'ChatGPT.exe.original'));
  if(sha(exeBytes)!==baseline.originalExeHash)throw Error('Executable backup corrupted');
  if(baseline.originalArchiveHash && fileHash(path.join(backup,'app.asar.original'))!==baseline.originalArchiveHash)throw Error('Archive backup corrupted');
  const replacementHeaderHash=headerHash(staged);
  const embedded=record(exeBytes);
  if(embedded.hash!==baseline.originalHeaderHash)throw Error('Original hash mismatch');
  exeBytes.write(replacementHeaderHash,embedded.offset,64,'ascii');
  const tempArchive=archive+'.new';const tempExe=exe+'.new';
  fs.copyFileSync(staged,tempArchive);fs.writeFileSync(tempExe,exeBytes);
  fs.renameSync(tempArchive,archive);fs.renameSync(tempExe,exe);
  console.log(JSON.stringify({state:'patched',verifiedHeaderHash:verify(),backup},null,2));
}else if(mode==='rollback'){
  const baseline=JSON.parse(fs.readFileSync(path.join(backup,'baseline.json'),'utf8').replace(/^\uFEFF/,''));
  const backupExe=path.join(backup,'ChatGPT.exe.original'),backupArchive=path.join(backup,'app.asar.original');
  if(sha(fs.readFileSync(backupExe))!==baseline.originalExeHash||headerHash(backupArchive)!==baseline.originalHeaderHash)throw Error('Backup check failed');
  if(baseline.originalArchiveHash && fileHash(backupArchive)!==baseline.originalArchiveHash)throw Error('Full archive backup check failed');
  fs.copyFileSync(backupExe,exe);fs.copyFileSync(backupArchive,archive);
  if(baseline.originalArchiveHash && fileHash(archive)!==baseline.originalArchiveHash)throw Error('Restored archive check failed');
  console.log(JSON.stringify({state:'original',verifiedHeaderHash:verify()},null,2));
}else if(mode==='verify'){
  console.log(JSON.stringify({verifiedHeaderHash:verify()},null,2));
}else throw Error('Usage: node manage-patch.mjs apply STAGED_ASAR | rollback | verify');
