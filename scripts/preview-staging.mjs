// Local review only. Official Staging Supabase remains selected by URL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/login.html':pathname));
 if(!file.startsWith(root)||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});
}).listen(5188,'127.0.0.1',()=>console.log('Staging review: http://127.0.0.1:5188/login.html?environment=staging'));
