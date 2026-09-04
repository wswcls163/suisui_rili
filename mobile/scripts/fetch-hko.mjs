import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const base = new URL('../', import.meta.url);
const cache = new URL('.cache/hko/', base);
await mkdir(cache, { recursive: true });
await mkdir(new URL('tests/fixtures/', base), { recursive: true });
const indexUrl = 'https://www.hko.gov.hk/en/gts/time/conversion1_text.htm';
const response = await fetch(indexUrl);
assert.ok(response.ok, `HKO index: ${response.status}`);
const index = await response.text();
const links = [...index.matchAll(/href="([^"\n]*\/T(\d{4})e\.txt)"/g)]
  .map((m) => ({ year: Number(m[2]), url: new URL(m[1], indexUrl).href }))
  .filter(({ year }) => year >= 1901 && year <= 2100);
assert.equal(new Set(links.map((l) => l.year)).size, 200);
const sources = [];
const interpolated = [];
const solarTerms = [];
// HKO's English names, in Gregorian-year order, mapped independently of the library.
const termNames = {
  'Moderate Cold': '小寒',
  'Severe Cold': '大寒',
  'Spring Commences': '立春',
  'Spring Showers': '雨水',
  'Insects Waken': '惊蛰',
  'Vernal Equinox': '春分',
  'Bright & Clear': '清明',
  'Corn Rain': '谷雨',
  'Summer Commences': '立夏',
  'Corn Forms': '小满',
  'Corn on Ear': '芒种',
  'Summer Solstice': '夏至',
  'Moderate Heat': '小暑',
  'Great Heat': '大暑',
  'Autumn Commences': '立秋',
  'End of Heat': '处暑',
  'White Dew': '白露',
  'Autumnal Equinox': '秋分',
  'Cold Dew': '寒露',
  Frost: '霜降',
  'Winter Commences': '立冬',
  'Light Snow': '小雪',
  'Heavy Snow': '大雪',
  'Winter Solstice': '冬至',
};
const byYear = new Map();
let position = 0;
async function worker() {
  while (position < links.length) {
    const { year, url } = links[position++];
    const target = new URL(`${year}.txt`, cache);
    let raw;
    try {
      raw = await readFile(target, 'utf8');
    } catch {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert.ok(res.ok, `${url}: ${res.status}`);
      raw = await res.text();
      await writeFile(target, raw);
    }
    const termRows = raw
      .split(/\r?\n/)
      .filter((line) => /^\d{4}\//.test(line))
      .map((line) => line.trim().split(/\s{2,}/))
      .filter((columns) => columns.length === 4);
    assert.equal(termRows.length, 24, `Incomplete solar terms in HKO ${year}`);
    assert.equal(new Set(termRows.map((columns) => columns[3])).size, 24, `Duplicate solar term in ${year}`);
    for (const columns of termRows) {
      const name = termNames[columns[3]];
      assert.ok(name, `Unknown HKO solar term: ${columns[3]}`);
      const date = columns[0]
        .split('/')
        .map((value, index) => (index ? value.padStart(2, '0') : value))
        .join('-');
      solarTerms.push([date, name]);
    }
    const rows = raw
      .split(/\r?\n/)
      .filter((l) => /^\d{4}\/\d+\/\d+\s/.test(l))
      .map((line) => {
        const match = /^(\d{4})\/(\d+)\/(\d+)\s{2,}(.+?)\s{2,}/.exec(line);
        assert.ok(match, line);
        return {
          date: `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
          value: match[4],
        };
      });
    // Only interpolate a missing ordinary day when both source neighbours prove it.
    // A missing month boundary is never inferred this way.
    for (let i = 1; i < rows.length; i++) {
      const before = rows[i - 1];
      const after = rows[i];
      const gap = (Date.parse(after.date) - Date.parse(before.date)) / 86400000;
      if (gap === 2 && /^\d+$/.test(before.value) && Number(after.value) === Number(before.value) + 2) {
        const date = new Date(Date.parse(before.date) + 86400000).toISOString().slice(0, 10);
        const value = String(Number(before.value) + 1);
        interpolated.push({ date, value, before: before.date, after: after.date, source: url });
        rows.splice(i, 0, { date, value });
      }
    }
    const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    assert.equal(rows.length, days, `Incomplete HKO ${year}`);
    byYear.set(year, rows);
    sources.push({ year, url, sha256: createHash('sha256').update(raw).digest('hex') });
    if (byYear.size % 25 === 0) console.log(`HKO: ${byYear.size}/200 years downloaded`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const rows = [...byYear.entries()].sort(([a], [b]) => a - b).flatMap(([, value]) => value);
const firstMonth = rows.find((r) => /lunar month/i.test(r.value));
assert.ok(firstMonth);
let year = 1900;
let month = Number.parseInt(firstMonth.value, 10) - 1;
assert.ok(month >= 1 && month <= 12);
const firstDay = Number(rows[0].value);
assert.ok(firstDay >= 1 && firstDay <= 30);
const start = new Date(Date.parse(`${rows[0].date}T00:00:00Z`) - (firstDay - 1) * 86400000)
  .toISOString()
  .slice(0, 10);
const months = [[start, year, month]];
let previous = start;
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  assert.equal(row.date, new Date(Date.UTC(1901, 0, i + 1)).toISOString().slice(0, 10));
  if (/lunar month/i.test(row.value)) {
    const number = Number.parseInt(row.value, 10);
    const leap = number === Math.abs(month);
    if (number === 1 && !leap) year++;
    month = leap ? -number : number;
    const length = (Date.parse(row.date) - Date.parse(previous)) / 86400000;
    assert.ok(length === 29 || length === 30, `${previous}: ${length}`);
    months.push([row.date, year, month]);
    previous = row.date;
  } else {
    assert.equal(Number(row.value), (Date.parse(row.date) - Date.parse(previous)) / 86400000 + 1, row.date);
  }
}
await writeFile(
  new URL('tests/fixtures/hko-months.json', base),
  JSON.stringify(
    {
      source: indexUrl,
      fetchedAt: new Date().toISOString(),
      from: '1901-01-01',
      to: '2100-12-31',
      days: rows.length,
      interpolated,
      columns: ['solarStart', 'lunarYear', 'signedLunarMonth'],
      months,
      solarTerms: solarTerms.sort(([a], [b]) => a.localeCompare(b)),
      sources: sources.sort((a, b) => a.year - b.year),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Validated ${rows.length - interpolated.length} source rows + ${interpolated.length} explicitly recorded interpolation; saved ${months.length} month starts.`,
);
