// Creates a staged archive ONLY. Never overwrites the installed application.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {patchHtml} from '../src/compatibility.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node build-local-asar.mjs ORIGINAL_ASAR NEW_ASAR');
if (path.resolve(source) === path.resolve(destination)) throw new Error('Refusing to overwrite original');
const input = fs.openSync(source,'r');
let output;
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
try {
  const prefix = Buffer.alloc(16);
  fs.readSync(input,prefix,0,16,0);
  if (prefix.readUInt32LE(0)!==4) throw new Error('Unsupported archive format');
  const oldDataStart = 8 + prefix.readUInt32LE(4);
  const rawHeader = Buffer.alloc(prefix.readUInt32LE(12));
  fs.readSync(input,rawHeader,0,rawHeader.length,16);
  const header = JSON.parse(rawHeader.toString('utf8'));
  const entry = header.files?.webview?.files?.['index.html'];
  if (!entry || entry.unpacked) throw new Error('Expected packed webview/index.html');
  const original = Buffer.alloc(entry.size);
  fs.readSync(input,original,0,original.length,oldDataStart+Number(entry.offset));
  if(entry.integrity && (entry.integrity.algorithm!=='SHA256' || digest(original)!==entry.integrity.hash)) throw new Error('Source startup entry integrity mismatch');
  const script=fs.readFileSync(path.join(here,'..','dist','boot.js'),'utf8');
  const replacement=Buffer.from(patchHtml(original.toString('utf8'),script).html);
  const sourceSize = fs.fstatSync(input).size;
  const payloadSize = sourceSize-oldDataStart;
  const blockSize = entry.integrity?.blockSize || 4194304;
  const blocks = [];
  for(let i=0;i<replacement.length;i+=blockSize) blocks.push(digest(replacement.subarray(i,i+blockSize)));
  entry.offset=String(payloadSize); entry.size=replacement.length;
  entry.integrity={algorithm:'SHA256',hash:digest(replacement),blockSize,blocks};
  const newHeader=Buffer.from(JSON.stringify(header));
  const picklePayloadSize=Math.ceil((4+newHeader.length)/4)*4;
  const newPrefix=Buffer.alloc(16);
  newPrefix.writeUInt32LE(4,0);newPrefix.writeUInt32LE(4+picklePayloadSize,4);
  newPrefix.writeUInt32LE(picklePayloadSize,8);newPrefix.writeUInt32LE(newHeader.length,12);
  output=fs.openSync(destination,'wx');
  fs.writeSync(output,newPrefix);fs.writeSync(output,newHeader);
  fs.writeSync(output,Buffer.alloc(picklePayloadSize-4-newHeader.length));
  const buffer=Buffer.alloc(4194304);
  for(let pos=oldDataStart;pos<sourceSize;){
    const count=fs.readSync(input,buffer,0,Math.min(buffer.length,sourceSize-pos),pos);
    if(!count) throw new Error('Unexpected end of archive');
    fs.writeSync(output,buffer,0,count);pos+=count;
  }
  fs.writeSync(output,replacement);
  console.log(JSON.stringify({source,destination,originalHeaderHash:digest(rawHeader),stagedHeaderHash:digest(newHeader),replacementHash:digest(replacement),status:'NOT_INSTALLED',notice:'Signed executable contains archive header hash; replacing only app.asar is insufficient.'},null,2));
} finally { fs.closeSync(input);if(output!==undefined)fs.closeSync(output); }
