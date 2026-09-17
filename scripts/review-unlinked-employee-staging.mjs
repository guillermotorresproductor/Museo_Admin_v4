// Disposable local preview. Only accepts a synthetic Staging session created
// by the test runner; the service key is never served or written to disk.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function review(session) {
  if (!/^unlinked-\d+@example\.invalid$/.test(session.user?.email || '')) throw Error('Synthetic session required');
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
  if(claims.iss!=='https://lonpdmxdvbxuagqxztig.supabase.co/auth/v1') throw Error('Staging only');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const entry='/review-'+crypto.randomUUID();
  let consumed=false;
  const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname===entry&&!consumed){
      consumed=true;
      res.writeHead(200,{'Content-Type':'text/html'}).end(`<script>sessionStorage.setItem('museo-admin-environment','staging');localStorage.setItem('museo-admin-supabase-session-staging',${JSON.stringify(JSON.stringify(session))});location.replace('/recursos-humanos.html?environment=staging');</script>`);
      return;
    }
    const file=path.resolve(root,'.'+pathname);
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
    if(!file.startsWith(root)||pathname.split('/').some(p=>p.startsWith('.'))||!mime[path.extname(file)]){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]}).end(data);});
  });
  await new Promise(resolve=>server.listen(5189,'127.0.0.1',resolve));
  console.log(JSON.stringify({review_url:'http://127.0.0.1:5189'+entry,finish:'Press Enter in this test process after the browser review'}));
  await new Promise(resolve=>{process.stdin.resume();process.stdin.once('data',resolve);});
  process.stdin.pause();
  await new Promise(resolve=>server.close(resolve));
}
