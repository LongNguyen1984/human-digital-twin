import { describe, expect, it } from 'vitest';
import { cycleIndex, hourBranch, napAm } from './canchi.js';
import { buildChart, palaceStem, placeMainStars, tuViPosition } from './chart.js';
import { solarToLunar } from './lunar.js';

describe('lunar calendar (UTC+7)', () => {
  it.each([
    ['2023-01-22', 2023],
    ['2024-02-10', 2024],
    ['2025-01-29', 2025],
    ['2026-02-17', 2026],
    // Vietnam and China celebrated Tết a month apart in 1985 because of the time zone.
    ['1985-01-21', 1985],
  ])('%s is Tết (1/1/%i)', (iso, year) => {
    const [y, m, d] = iso.split('-').map(Number);
    expect(solarToLunar(d, m, y, 7)).toEqual({ day: 1, month: 1, year, leap: false });
  });

  it('marks leap months (2023 had a leap 2nd month)', () => {
    expect(solarToLunar(22, 3, 2023, 7)).toEqual({ day: 1, month: 2, year: 2023, leap: true });
  });

  it('day before Tết belongs to the previous lunar year', () => {
    expect(solarToLunar(16, 2, 2026, 7)).toMatchObject({ month: 12, year: 2025 });
  });
});

describe('Can Chi and Nạp âm', () => {
  it('cycle index and nạp âm', () => {
    expect(cycleIndex(0, 0)).toBe(0); // Giáp Tý
    expect(cycleIndex(0, 10)).toBe(10); // Giáp Tuất
    expect(napAm(6, 6)).toEqual({ name: 'Lộ Bàng Thổ', element: 'Thổ' }); // Canh Ngọ 1990
    expect(napAm(9, 11)).toEqual({ name: 'Đại Hải Thủy', element: 'Thủy' }); // Quý Hợi
  });

  it('hour branches', () => {
    expect(hourBranch(23)).toBe(0);
    expect(hourBranch(0)).toBe(0);
    expect(hourBranch(1)).toBe(1);
    expect(hourBranch(11)).toBe(6);
    expect(hourBranch(12)).toBe(6);
  });

  it('Ngũ Hổ Độn palace stems', () => {
    expect(palaceStem(0, 2)).toBe(2); // Giáp year → Bính Dần
    expect(palaceStem(0, 0)).toBe(2); // … and Bính Tý
    expect(palaceStem(6, 2)).toBe(4); // Canh year → Mậu Dần
  });
});

describe('main stars', () => {
  it('places Tử Vi per the standard table', () => {
    expect(tuViPosition(2, 1)).toBe(1); // Thủy nhị cục, day 1 → Sửu
    expect(tuViPosition(2, 2)).toBe(2); // → Dần
    expect(tuViPosition(3, 1)).toBe(4); // Mộc tam cục, day 1 → Thìn
    expect(tuViPosition(4, 1)).toBe(11); // Kim tứ cục, day 1 → Hợi
    expect(tuViPosition(5, 1)).toBe(6); // Thổ ngũ cục, day 1 → Ngọ
    expect(tuViPosition(6, 1)).toBe(9); // Hỏa lục cục, day 1 → Dậu
  });

  it('places all 14 stars with Tử Vi and Thiên Phủ together at Dần', () => {
    const m = placeMainStars(2);
    expect(m.get(2)).toEqual(['Tử Vi', 'Thiên Phủ']);
    expect([...m.values()].flat()).toHaveLength(14);
  });
});

describe('buildChart', () => {
  it('builds a full chart', () => {
    const c = buildChart({ date: '1990-05-12', hour: 11, gender: 'male' });
    expect(c.yearCanChi).toBe('Canh Ngọ');
    expect(c.banMenh.element).toBe('Thổ');
    expect(c.complete).toBe(true);
    expect(c.palaces).toHaveLength(12);
    expect(new Set(c.palaces!.map((p) => p.branch)).size).toBe(12);
    expect(c.palaces!.flatMap((p) => p.mainStars)).toHaveLength(14);
    expect(c.palaces![0].name).toBe('Mệnh');
    expect(c.daiVan![0]).toMatchObject({ palace: 'Mệnh', fromAge: c.cuc!.number });
    expect(c.direction).toBe('thuận'); // Canh is a Dương stem, male → forward
  });

  it('returns a partial chart when the hour is unknown', () => {
    const c = buildChart({ date: '1990-05-12', hour: null, gender: 'female' });
    expect(c.complete).toBe(false);
    expect(c.missing).toEqual(['hour']);
    expect(c.palaces).toBeUndefined();
    expect(c.yearCanChi).toBe('Canh Ngọ');
  });

  it('moves 23:xx births to the next day by default', () => {
    const late = buildChart({ date: '2024-02-09', hour: 23, gender: 'male' });
    expect(late.lunar).toMatchObject({ day: 1, month: 1, year: 2024 });
    const kept = buildChart({ date: '2024-02-09', hour: 23, gender: 'male', options: { ratHourNextDay: false } });
    expect(kept.lunar).toMatchObject({ month: 12, year: 2023 });
  });
});
