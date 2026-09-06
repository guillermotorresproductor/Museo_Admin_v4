// Run explicitly: node supabase/tests/employee-access-postgres.test.mjs
// Requires local PostgreSQL/psql. Does not accept a remote URL or host.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const binary="psql";
if(spawnSync(binary,["--version"],{encoding:"utf8"}).status!==0){
 console.error("BLOCKED: psql is unavailable. Real PostgreSQL rollback/concurrency tests NOT EXECUTED.");process.exit(2);
}
const port=process.env.INSTITUVA_LOCAL_PG_PORT||"54322";
if(!/^\d+$/.test(port))throw Error("Invalid local port");
const args=["-X","-w","-h","127.0.0.1","-p",port,"-U",process.env.INSTITUVA_LOCAL_PG_USER||"postgres","-v","ON_ERROR_STOP=1"];
const db="instituva_access_test_"+Date.now().toString(16);
if(!/^instituva_access_test_[0-9a-f]+$/.test(db))throw Error("Unsafe test database name");
function run(database,extra){const r=spawnSync(binary,[...args,"-d",database,...extra],{encoding:"utf8",timeout:30000});if(r.status!==0)throw Error(r.error?.message||r.stderr||"Local PostgreSQL failed");return r.stdout;}
const sql=file=>fileURLToPath(new URL(file,import.meta.url));
const actor="select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);select set_config('request.jwt.claim.role','authenticated',false);set role authenticated;";
let created=false;
try {
 run("postgres",["-c","create database "+db]);created=true;
 run(db,["-f",sql("employee-access-transaction.fixture.sql")]);
 run(db,["-f",sql("employee-access-transaction.sql")]);
 // Independent connections: B must wait for A's lock, then reject its stale level.
 const first=spawn(binary,[...args,"-d",db,"-At"],{stdio:["pipe","pipe","pipe"]});
 let output="",errors="";
 const finished=new Promise((resolve,reject)=>{first.on("error",reject);first.stderr.on("data",d=>errors+=d);first.on("exit",code=>code===0?resolve():reject(Error(errors)));});
 const locked=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{first.kill();reject(Error("Lock marker timeout"));},15000);
  first.stdout.on("data",d=>{output+=d;if(output.includes("LOCK_HELD")){clearTimeout(timeout);resolve();}});
 });
 first.stdin.end(actor+"begin;select public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','ejecutivo','empleado');select 'LOCK_HELD';select pg_sleep(3);commit;");
 await locked;
 const start=Date.now();
 const second=spawnSync(binary,[...args,"-d",db,"-c",actor+"select public.replace_employee_access_level('40000000-0000-4000-8000-000000000001','administrador','empleado');"],{encoding:"utf8",timeout:15000});
 assert.notEqual(second.status,0);assert.match(second.stderr,/ACCESS_LEVEL_CHANGED_RELOAD/);
 assert.ok(Date.now()-start>=1000,"Second session must wait for the first transaction");await finished;
 assert.equal(run(db,["-Atc","select role||':'||status from profiles where id='20000000-0000-4000-8000-000000000001'"]).trim(),"ejecutivo:active");
 run(db,["-f",sql("personal-access-compatibility.sql")]);
 console.log("PASS: personal access compatibility plus real PostgreSQL rollback at profile/delete/insert/employee/audit; permissions preserved; authenticated authorization; two-session concurrency.");
} finally {
 if(created)run("postgres",["-c","drop database "+db+" with (force)"]);
}
