import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './build-animation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const port=Number(process.env.PORT||18766);
http.createServer((request,response)=>{if(request.url?.split('?')[0]!=='/'){response.writeHead(404);return response.end();}response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fs.readFileSync(path.join(root,'preview.html')));}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));
