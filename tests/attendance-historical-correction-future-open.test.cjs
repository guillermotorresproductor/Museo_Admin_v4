const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sql = fs.readFileSync("supabase/migrations/20261124163000_attendance_historical_correction_future_open_guard.sql","utf8");

test("correction patch preserves deployed function and checks exact single legacy guard",()=>{
  assert.match(sql,/pg_get_functiondef\(/);
  assert.match(sql,/correct_shift_attendance_punches\(uuid,text,text,uuid,jsonb\)/);
  assert.match(sql,/original_predicate/);
  assert.match(sql,/length\(original_definition\) - length\(replace\(original_definition,original_predicate,''\)\)/);
  assert.match(sql,/execute amended_definition/);
  assert.doesNotMatch(sql,/delete from public\.|truncate |drop table/i);
});
test("only real overlaps block historical corrections; later open entry allowed",()=>{
 const original="t.excluded_at is null and (t.clock_out is null or t.clock_in = new_in)";
 assert.ok(sql.includes(original));
 assert.match(sql,/t\.clock_in = new_in/);
 assert.match(sql,/t\.clock_out > new_in/);
 assert.match(sql,/t\.clock_in < new_out/);
 assert.match(sql,/t\.clock_out is null/);
 const conflict=(entryStart,entryEnd,correctedStart,correctedEnd)=>(
 entryStart===correctedStart ||
 (entryEnd!==null && entryEnd>correctedStart && (correctedEnd===null || entryStart<correctedEnd)) ||
 (entryEnd===null && (correctedEnd===null || entryStart<correctedEnd))
 );
 const in11=Date.parse("2026-11-11T12:00:00Z");
 const out11=Date.parse("2026-11-11T21:00:00Z");
 assert.equal(conflict(Date.parse("2026-11-23T16:13:39Z"),null,in11,out11),false);
 assert.equal(conflict(Date.parse("2026-11-11T13:00:00Z"),null,in11,out11),true);
 assert.equal(conflict(in11,out11,in11,out11),true);
 assert.equal(conflict(Date.parse("2026-11-11T20:00:00Z"),Date.parse("2026-11-12T01:00:00Z"),in11,out11),true);
 assert.equal(conflict(Date.parse("2026-11-12T12:00:00Z"),Date.parse("2026-11-12T21:00:00Z"),in11,out11),false);
});
