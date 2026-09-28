const fs = require("fs");
const src = fs.readFileSync("js/app.js", "utf8");
const start = src.indexOf("const currentShiftPunchAction");
const end = src.indexOf("const historicalShiftNote", start);
if (start < 0 || end < 0) {
  console.error("MISSING_FUNCTION");
  process.exit(1);
}
const currentShiftPunchAction = new Function(`${src.slice(start, end)}; return currentShiftPunchAction;`)();
const at = (type, minute) => ({ event_type: type, occurred_at: `2026-09-28T12:${String(minute).padStart(2, "0")}:00Z` });
const expect = (name, actual, wanted) => {
  if (actual !== wanted) {
    console.error(`${name}: ${actual} !== ${wanted}`);
    process.exit(1);
  }
};
expect("empty today", currentShiftPunchAction([]), "clock_in");
expect("ignored history is not passed", currentShiftPunchAction([]), "clock_in");
expect("clock in", currentShiftPunchAction([at("clock_in", 1)]), "lunch_out");
expect("at lunch", currentShiftPunchAction([at("clock_in", 1), at("lunch_out", 2)]), "lunch_in");
expect("returned", currentShiftPunchAction([at("clock_in", 1), at("lunch_out", 2), at("lunch_in", 3)]), "clock_out");
expect("completed", currentShiftPunchAction([at("clock_in", 1), at("lunch_out", 2), at("lunch_in", 3), at("clock_out", 4)]), null);
expect("order", currentShiftPunchAction([at("lunch_out", 5), at("clock_in", 1)]), "lunch_in");
console.log("CURRENT_SHIFT_PUNCH_ACTION_OK");
