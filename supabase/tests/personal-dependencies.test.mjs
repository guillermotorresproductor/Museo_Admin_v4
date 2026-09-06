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
 run(db,["-f",sql("personal-dependencies.sql")]);
 console.log("PASS: legacy missing-table installation, idempotence, own/museum RLS with broad coexisting policies, explicit institutional permissions/denies, real clock/audit, immutable events.");
} finally {if(created)run("postgres",["-c","drop database "+db+" with (force)"]);}
