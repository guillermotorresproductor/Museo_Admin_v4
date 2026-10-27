// Node 22: node --test tests/horarios_publicacion_contract.test.cjs
// Contract tests only; NOT a substitute for PostgreSQL integration tests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../docs/sql/horarios_publish_atomic_REVIEW_ONLY.sql'),'utf8');
const save=fs.readFileSync(path.join(__dirname,'../docs/sql/horarios_save_draft_REVIEW_ONLY.sql'),'utf8');
test('RPC publish is one PostgreSQL function',()=>assert.match(sql,/CREATE OR REPLACE FUNCTION public\.publish_schedule_week\(/));
test('authorization checked on server',()=>{assert.match(sql,/auth\.uid\(\)/);assert.match(sql,/has_permission\('schedules\.manage'\)/);assert.match(sql,/museum_id=v_museum/);});
test('draft row locked',()=>assert.match(sql,/FOR UPDATE/));
test('revision checked',()=>assert.match(sql,/p_expected_revision/));
test('draft cannot publish twice',()=>assert.match(sql,/v_draft\.state<>'draft'/));
test('existing RPCs called inside same SQL call',()=>{assert.match(sql,/PERFORM public\.schedule_employee_shift\(/);assert.match(sql,/PERFORM public\.set_employee_day_off\(/);});
test('final state only written after all calls',()=>assert.ok(sql.lastIndexOf("state='published'")>sql.lastIndexOf('PERFORM public.schedule_employee_shift(')));
test('draft-save captures official version',()=>assert.match(save,/SELECT updated_at FROM public\.employee_shifts/));
test('batch fails closed for missing baseline',()=>assert.match(sql,/MISSING_BASELINE_SNAPSHOT/));
test('no implicit grant to anonymous',()=>assert.match(sql,/REVOKE ALL ON FUNCTION public\.publish_schedule_week\(uuid,integer\) FROM PUBLIC,anon/));
