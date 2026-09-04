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
      sources: sources.sort((a, b) => a.year - b.year),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Validated ${rows.length - interpolated.length} source rows + ${interpolated.length} explicitly recorded interpolation; saved ${months.length} month starts.`,
);
