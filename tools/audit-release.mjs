import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function releaseFiles() {
  const allowedDirectories=['src','tools','scripts','vendor','dist','docs','test','.github'];
  const files=[];
  function walk(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,item.name);if(item.isSymbolicLink())throw Error('Symlink in release inputs');if(item.isDirectory())walk(full);else files.push(path.relative(root,full).replaceAll('\\','/'));}}
  for(const directory of allowedDirectories)if(fs.existsSync(path.join(root,directory)))walk(path.join(root,directory));
  for(const item of fs.readdirSync(root,{withFileTypes:true}))if(item.isFile()&&(/\.(md|cmd)$/.test(item.name)||['LICENSE','package.json','.gitignore'].includes(item.name)))files.push(item.name);
  return files.sort();
}
export function audit(){
  const files=releaseFiles();let bytes=0;
  for(const relative of files){
    if(/\.(exe|dll|asar|log|sqlite|db|tgz|zip)$/i.test(relative)||/(^|\/)(auth\.json|baseline\.json|metadata\.json|upgrade-state\.json|\.env[^/]*)$/i.test(relative))throw Error('Private or proprietary artifact: '+relative);
    const data=fs.readFileSync(path.join(root,relative));bytes+=data.length;
    if(!/\.png$/i.test(relative)){
      const text=data.toString('utf8');
      if(/[A-Za-z]:[\\/]+Users[\\/]+[A-Za-z0-9_-]+/i.test(text)||/gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(text))throw Error('Machine-specific path or credential pattern: '+relative);
    }
  }
  for(const name of ['LICENSE','NOTICE.md','vendor/dsh-550c-boot/LICENSE','vendor/dsh-550c-boot/UPSTREAM.json'])if(!files.includes(name))throw Error('Missing attribution '+name);
  return {files,bytes};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=audit();console.log(`Release audit passed: ${result.files.length} files, ${result.bytes} bytes; local app/data excluded.`);}
