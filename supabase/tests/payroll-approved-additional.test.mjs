import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202610260002_legal_overtime_and_week_guard.sql", "utf8");
const decision = fs.readFileSync("supabase/migrations/202609240003_overtime_decision.sql", "utf8");
const overtimeProfiles = fs.readFileSync("supabase/migrations/202610260003_overtime_decide_profiles.sql", "utf8");
const decisionTest = fs.readFileSync("supabase/tests/overtime-decision.sql", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const financePage = fs.readFileSync("finanzas.html", "utf8");

function classifyApprovedAdditional(dayRegularBefore, shiftRegular, weekOrdinaryBefore, approved) {
  const dayBefore = Math.max(0, dayRegularBefore || 0);
  const shift = Math.max(0, shiftRegular || 0);
  const weekBefore = Math.max(0, weekOrdinaryBefore || 0);
  const extra = Math.max(0, approved || 0);
  const dayTotal = dayBefore + shift;
  const shiftDailyOrdinary = Math.min(shift, Math.max(0, 480 - dayBefore));
  const regularOrdinary = Math.min(shiftDailyOrdinary, Math.max(0, 2400 - weekBefore));
  const weekAfterRegular = weekBefore + regularOrdinary;
  const ordinary = Math.min(extra, Math.max(0, 480 - dayTotal), Math.max(0, 2400 - weekAfterRegular));
  return {
    ordinary,
    extraordinary: extra - ordinary,
    regularOrdinary,
    regularExtraordinary: shift - regularOrdinary,
    weekOrdinaryAfter: weekBefore + regularOrdinary + ordinary,
    dayRegularAfter: dayTotal
  };
}

function classifyDays(days) {
  let week = 0;
  let dayRegular = 0;
  let currentDay = null;
  return days.map((day) => {
    if (day.weekReset) {
      week = 0;
      dayRegular = 0;
      currentDay = null;
    }
    if (currentDay !== day.date) {
      dayRegular = 0;
      currentDay = day.date;
    }
    const split = classifyApprovedAdditional(dayRegular, day.regular, week, day.approved);
    week = split.weekOrdinaryAfter;
    dayRegular = split.dayRegularAfter;
    return split;
  });
}

const roberto = [
  { date: "2026-10-13", regular: 480, approved: 18 },
  { date: "2026-10-14", regular: 480, approved: 35 },
  { date: "2026-10-15", regular: 480, approved: 90 },
  { date: "2026-10-19", regular: 480, approved: 3, weekReset: true },
  { date: "2026-10-23", regular: 480, approved: 1 }
];

test("Roberto Díaz: 147 approved minutes on completed 8-hour days are all extraordinary", () => {
  const splits = classifyDays(roberto);
  assert.deepEqual(splits.map((item) => item.ordinary), [0, 0, 0, 0, 0]);
  assert.deepEqual(splits.map((item) => item.extraordinary), [18, 35, 90, 3, 1]);
  assert.equal(splits.reduce((sum, item) => sum + item.extraordinary, 0), 147);
  assert.equal(splits.reduce((sum, item) => sum + item.ordinary, 0), 0);
});

test("a week under 40 hours does not erase daily overtime", () => {
  const split = classifyApprovedAdditional(0, 480, 0, 90);
  assert.equal(split.ordinary, 0);
  assert.equal(split.extraordinary, 90);
  assert.equal(split.weekOrdinaryAfter, 480);
});

test("approved minutes fill the rest of an 8-hour day before they become overtime", () => {
  const split = classifyApprovedAdditional(0, 360, 0, 180);
  assert.equal(split.ordinary, 120);
  assert.equal(split.extraordinary, 60);
});

test("minutes already over 40 ordinary hours are weekly overtime even under 8 hours that day", () => {
  const split = classifyApprovedAdditional(0, 200, 2300, 80);
  assert.equal(split.ordinary, 0);
  assert.equal(split.extraordinary, 80);
});

test("only the weekly room left is ordinary when the day is still under 8 hours", () => {
  const split = classifyApprovedAdditional(0, 0, 2320, 100);
  assert.equal(split.ordinary, 80);
  assert.equal(split.extraordinary, 20);
  assert.equal(split.weekOrdinaryAfter, 2400);
});

test("a second shift the same day does not get another 8 ordinary hours", () => {
  const splits = classifyDays([
    { date: "2026-10-13", regular: 300, approved: 0 },
    { date: "2026-10-13", regular: 300, approved: 30 }
  ]);
  assert.equal(splits[1].ordinary, 0);
  assert.equal(splits[1].extraordinary, 30);
});

test("the same approved minute is not counted as both daily and weekly overtime", () => {
  const splits = classifyDays([
    { date: "2026-10-12", regular: 480, approved: 0 },
    { date: "2026-10-13", regular: 480, approved: 0 },
    { date: "2026-10-14", regular: 480, approved: 0 },
    { date: "2026-10-15", regular: 480, approved: 0 },
    { date: "2026-10-16", regular: 480, approved: 60 }
  ]);
  assert.equal(splits[4].ordinary, 0);
  assert.equal(splits[4].extraordinary, 60);
  assert.equal(splits[4].weekOrdinaryAfter, 2400);
});

test("pending or rejected minutes are not part of the approved input", () => {
  const split = classifyApprovedAdditional(0, 480, 0, 0);
  assert.equal(split.ordinary, 0);
  assert.equal(split.extraordinary, 0);
});

test("daily overtime on a completed shift is paid even when the week is under 40 hours", () => {
  const split = classifyApprovedAdditional(0, 600, 0, 0);
  assert.equal(split.regularOrdinary, 480);
  assert.equal(split.regularExtraordinary, 120);
  assert.equal(split.ordinary, 0);
});

test("weekly overtime on regular time is not dropped when the day is under 8 hours", () => {
  const split = classifyApprovedAdditional(0, 200, 2300, 0);
  assert.equal(split.regularOrdinary, 100);
  assert.equal(split.regularExtraordinary, 100);
});

test("payroll pays legal overtime without converting a monthly salary or rewriting punches", () => {
  assert.match(migration, /coalesce\(\(day->>'regular_minutes'\)::integer, 0\)/);
  assert.match(migration, /day->>'approved_overtime_minutes'/);
  assert.match(migration, /least\(rec\.worked_minutes, remaining\)/);
  assert.match(migration, /remaining := 2400/);
  assert.match(migration, /d\.hourly_rate \* 1\.5/);
  assert.match(migration, /least\(\s*shift_regular, greatest\(0, 480 - day_before\)\s*\)/);
  assert.match(migration, /greatest\(0, 480 - day_total\)/);
  assert.match(migration, /greatest\(0, 2400 - week_after_regular\)/);
  assert.match(migration, /regular_extraordinary_minutes/);
  assert.match(migration, /set amount = 0\s+from payroll_monthly_salary/);
  assert.match(migration, /WEEKLY_SCHEDULE_LIMIT/);
  assert.match(migration, /list_weekly_hour_warnings/);
  assert.match(migration, /1920/);
  assert.doesNotMatch(migration, /record_employee_attendance/);
  assert.doesNotMatch(migration, /update public\.finance_records/);
  assert.doesNotMatch(migration, /update public\.attendance_events/);
  assert.doesNotMatch(migration, /update public\.attendance_overtime_reviews/);
  assert.doesNotMatch(migration, /worked := coalesce\(\(day->>'regular_minutes'\)::integer, 0\) \+ /);
});

test("an approved review cannot be approved again and only authorized profiles can decide", () => {
  assert.match(decision, /attendance\.overtime\.decide/);
  assert.match(decision, /and status = 'pending'/);
  assert.match(decision, /OVERTIME_ALREADY_DECIDED/);
  assert.match(decision, /audit_logs/);
  assert.match(decision, /director_ejecutivo','gerente_administrativo'/);
  assert.match(overtimeProfiles, /attendance\.overtime\.decide/);
  assert.match(overtimeProfiles, /director_ejecutivo'',''gerente_administrativo/);
  assert.match(overtimeProfiles, /COMPENSATION_GRANT_REMOVED/);
  assert.match(decisionTest, /SECOND_DECISION/);
  assert.match(decisionTest, /OVERTIME_ALREADY_DECIDED/);
});

test("Finance attendance decides through the existing review and hides the action without permission", () => {
  const attendance = app.slice(app.indexOf('activeTab === "asistencia"'), app.indexOf('activeTab === "reportes"'));
  const panel = app.slice(app.indexOf("function bindFinanceAdditionalTimeReview"), app.indexOf("function bindOvertimeReviews"));
  assert.match(attendance, /hasPermission\("attendance\.overtime\.decide"\) \?/);
  assert.match(attendance, /data-finance-additional-time/);
  assert.equal(attendance.indexOf("data-finance-additional-time") > attendance.indexOf('hasPermission("attendance.overtime.decide")'), true);
  assert.match(panel, /if \(!root \|\| !hasPermission\("attendance\.overtime\.decide"\)\) return/);
  assert.match(panel, /decideOvertimeReview/);
  assert.match(panel, /OVERTIME_ALREADY_DECIDED/);
  assert.match(panel, /data-decision="approve_all"/);
  assert.match(panel, /Ya decidida/);
  assert.doesNotMatch(panel, /aprobación queda deshabilitada/);
  assert.match(panel, /fetchWeeklyHourWarnings/);
  assert.match(app, /WEEKLY_SCHEDULE_LIMIT/);
  assert.match(financePage, /js\/app\.js\?v=finance-week-20261026/);
  assert.match(fs.readFileSync("js/services/supabase.js", "utf8"), /\/rest\/v1\/rpc\/decide_overtime_review/);
  assert.match(fs.readFileSync("js/services/supabase.js", "utf8"), /\/rest\/v1\/rpc\/list_overtime_reviews/);
});
