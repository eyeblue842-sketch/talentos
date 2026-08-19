// Deterministic calendar-month arithmetic (section 8: "Define deterministic
// month-end behaviour"). When the anchor day does not exist in the target
// month (e.g. 31 Jan + 1 month), the result clamps to the LAST day of the
// target month (28/29 Feb) rather than overflowing into the next month
// (which is what native `Date` month arithmetic does by default).
export function addCalendarMonths(date, months) {
  const source = new Date(date);
  const day = source.getUTCDate();
  const firstOfTargetMonth = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + months,
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
  const daysInTargetMonth = new Date(Date.UTC(
    firstOfTargetMonth.getUTCFullYear(),
    firstOfTargetMonth.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  firstOfTargetMonth.setUTCDate(Math.min(day, daysInTargetMonth));
  return firstOfTargetMonth;
}

export function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
}
