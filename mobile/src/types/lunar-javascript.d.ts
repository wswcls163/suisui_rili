declare module 'lunar-javascript' {
  interface LunarValue {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): SolarValue;
    getJieQiTable(): Record<string, SolarValue>;
  }
  interface SolarValue {
    getLunar(): LunarValue;
    toYmd(): string;
  }
  interface MonthValue {
    getDayCount(): number;
    getFirstJulianDay(): number;
  }
  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarValue;
    fromJulianDay(day: number): SolarValue;
  };
  export const Lunar: { fromYmd(year: number, month: number, day: number): LunarValue };
  export const LunarYear: {
    fromYear(year: number): { getMonth(month: number): MonthValue | null; getLeapMonth(): number };
  };
}
