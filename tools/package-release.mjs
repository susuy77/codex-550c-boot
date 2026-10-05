import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import './build-animation.mjs';
import {audit} from './audit-release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))), result=audit();
const release=path.join(root,'release'), name=`${pkg.name}-v${pkg.version}-source`, staging=path.join(release,name), zip=path.join(release,name+'.zip');
if(fs.existsSync(staging)||fs.existsSync(zip))throw Error('Release exists. Preserve it or choose a new version before packaging again.');
fs.mkdirSync(staging,{recursive:true});
const manifest=[];
for(const file of result.files){const target=path.join(staging,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);manifest.push({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')});}
fs.writeFileSync(path.join(staging,'RELEASE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
if(process.platform!=='win32')throw Error('ZIP creation currently uses Windows .NET. Audited source staging is available in release/.');
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:BOOT_RELEASE_SOURCE,$env:BOOT_RELEASE_ZIP)'],{env:{...process.env,BOOT_RELEASE_SOURCE:staging,BOOT_RELEASE_ZIP:zip}});
const hash=crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');fs.writeFileSync(zip+'.sha256',hash+'  '+path.basename(zip)+'\n');console.log(zip);
