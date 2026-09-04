import fs from 'node:fs';
import assert from 'node:assert/strict';
import { lunarCalendar, solarTermOn } from '../src/core/calendar';
import { addDays, dayNumber, FIRST_DATE, LAST_DATE } from '../src/core/dates';

const data = JSON.parse(
  fs.readFileSync(new URL('../tests/fixtures/hko-months.json', import.meta.url), 'utf8'),
) as {
  days: number;
  months: [string, number, number][];
  solarTerms: [string, string][];
};
assert.equal(data.solarTerms.length, 200 * 24);
const expectedTerms = new Map(data.solarTerms);
assert.equal(expectedTerms.size, 200 * 24);
const differences: { date: string; expected: unknown; actual: unknown }[] = [];
let index = 0,
  checked = 0;
for (let date = FIRST_DATE; date <= LAST_DATE; date = addDays(date, 1)) {
  while (index + 1 < data.months.length && data.months[index + 1][0] <= date) index++;
  const [start, year, signedMonth] = data.months[index];
  const expected = {
    year,
    month: Math.abs(signedMonth),
    day: dayNumber(date) - dayNumber(start) + 1,
    isLeap: signedMonth < 0,
  };
  const actual = lunarCalendar.lunarOn(date);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) differences.push({ date, expected, actual });
  assert.equal(solarTermOn(date), expectedTerms.get(date) ?? null, `Solar term on ${date}`);
  checked++;
}
assert.equal(checked, data.days);
let monthsChecked = 0;
for (let i = 0; i < data.months.length; i++) {
  const [start, year, signedMonth] = data.months[i];
  const actual = lunarCalendar.month(year, Math.abs(signedMonth), signedMonth < 0);
  assert.ok(actual, `Missing lunar month ${year}/${signedMonth}`);
  assert.equal(actual.start, start, `Month start ${year}/${signedMonth}`);
  if (i + 1 < data.months.length)
    assert.equal(
      actual.days,
      dayNumber(data.months[i + 1][0]) - dayNumber(start),
      `Month length ${year}/${signedMonth}`,
    );
  monthsChecked++;
}
console.log(
  JSON.stringify(
    {
      checked,
      monthsChecked,
      solarTermsChecked: expectedTerms.size,
      differences: differences.length,
      firstDifferences: differences.slice(0, 12),
    },
    null,
    2,
  ),
);
if (differences.length) {
  fs.mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
  fs.writeFileSync(
    new URL('../.cache/calendar-differences.json', import.meta.url),
    JSON.stringify(differences, null, 2),
  );
  process.exitCode = 1;
}
