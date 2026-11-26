// Puerto Rico attendance queries use calendar days (UTC-04:00, no DST).
// Pure helpers to reject overflow dates before computing query windows.
export function validAttendanceDay(value:unknown):string {
  if (typeof value!=="string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value))
    throw Error("INVALID_REQUEST");
  const timestamp=Date.parse(value+"T00:00:00Z");
  if (!Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0,10)!==value)
    throw Error("INVALID_REQUEST");
  return value;
}
export function nextAttendanceDay(day:string):string {
  return new Date(Date.parse(validAttendanceDay(day)+"T00:00:00Z")+86400000)
    .toISOString().slice(0,10);
}
