import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectApp} from '../src/compatibility.mjs';
try {
  const script=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist','boot.js'),'utf8');
  console.log(JSON.stringify(inspectApp(process.argv[2],script)));
} catch(error) { console.error(error.message);process.exitCode=1; }
