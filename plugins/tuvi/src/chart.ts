import type { Gender } from '@hdt/core';
import { BRANCHES, canChi, hourBranch, mod, napAm, STEMS, yearBranch, yearStem, type Element } from './canchi.js';
import { isoToLunar, type LunarDate } from './lunar.js';

export const RULE_VERSION = 'tuvi-core/0.1';

export const PALACE_NAMES = [
  'Mệnh', 'Phụ Mẫu', 'Phúc Đức', 'Điền Trạch', 'Quan Lộc', 'Nô Bộc',
  'Thiên Di', 'Tật Ách', 'Tài Bạch', 'Tử Tức', 'Phu Thê', 'Huynh Đệ',
] as const;
export type PalaceName = (typeof PALACE_NAMES)[number];

export interface ChartOptions {
  /** Births 23:00–23:59 count as Tý hour of the NEXT day (common Vietnamese practice). */
  ratHourNextDay?: boolean;
  /** Leap month: treat as the same month, or as the next month after day 15. */
  leapMonth?: 'same' | 'split';
}

export interface ChartInput {
  date: string;
  hour?: number | null;
  gender?: Gender;
  timeZone?: number;
  options?: ChartOptions;
}

export interface Palace {
  name: PalaceName;
  branch: string;
  branchIndex: number;
  stem: string;
  isThan: boolean;
  mainStars: string[];
}

export interface Chart {
  ruleVersion: string;
  input: ChartInput;
  lunar: LunarDate;
  /** Lunar month used for placement after leap-month handling. */
  effectiveMonth: number;
  yearCanChi: string;
  yinYang: 'Dương' | 'Âm';
  banMenh: { napAm: string; element: Element };
  complete: boolean;
  missing: Array<'hour' | 'gender'>;
  hourBranch?: string;
  menh?: string;
  than?: string;
  cuc?: { element: Element; number: number; name: string };
  palaces?: Palace[];
  direction?: 'thuận' | 'nghịch';
  daiVan?: Array<{ palace: PalaceName; branch: string; fromAge: number; toAge: number }>;
}

const CUC: Record<Element, { number: number; name: string }> = {
  Thủy: { number: 2, name: 'Thủy nhị cục' },
  Mộc: { number: 3, name: 'Mộc tam cục' },
  Kim: { number: 4, name: 'Kim tứ cục' },
  Thổ: { number: 5, name: 'Thổ ngũ cục' },
  Hỏa: { number: 6, name: 'Hỏa lục cục' },
};

/** Ngũ Hổ Độn: stem of the Dần palace from the year stem. */
const DAN_STEM = [2, 4, 6, 8, 0]; // Giáp/Kỷ→Bính, Ất/Canh→Mậu, Bính/Tân→Canh, Đinh/Nhâm→Nhâm, Mậu/Quý→Giáp

export function palaceStem(yStem: number, branch: number): number {
  return mod(DAN_STEM[yStem % 5] + mod(branch - 2, 12), 10);
}

/** Tử Vi position from Cục number and lunar day. */
export function tuViPosition(cuc: number, lunarDay: number): number {
  const k = mod(cuc - (lunarDay % cuc), cuc);
  const q = (lunarDay + k) / cuc;
  let pos = 2 + (q - 1);
  pos += k % 2 === 0 ? k : -k;
  return mod(pos, 12);
}

/** The 14 main stars (chính tinh), by branch index. */
export function placeMainStars(tuVi: number): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const put = (pos: number, star: string) => {
    const b = mod(pos, 12);
    out.set(b, [...(out.get(b) ?? []), star]);
  };
  // Tử Vi group runs backwards.
  put(tuVi, 'Tử Vi');
  put(tuVi - 1, 'Thiên Cơ');
  put(tuVi - 3, 'Thái Dương');
  put(tuVi - 4, 'Vũ Khúc');
  put(tuVi - 5, 'Thiên Đồng');
  put(tuVi - 8, 'Liêm Trinh');
  // Thiên Phủ mirrors Tử Vi across the Dần–Thân axis and runs forwards.
  const phu = mod(4 - tuVi, 12);
  put(phu, 'Thiên Phủ');
  put(phu + 1, 'Thái Âm');
  put(phu + 2, 'Tham Lang');
  put(phu + 3, 'Cự Môn');
  put(phu + 4, 'Thiên Tướng');
  put(phu + 5, 'Thiên Lương');
  put(phu + 6, 'Thất Sát');
  put(phu + 10, 'Phá Quân');
  return out;
}

export function buildChart(input: ChartInput): Chart {
  const opts: Required<ChartOptions> = { ratHourNextDay: true, leapMonth: 'same', ...(input.options ?? {}) };
  const tz = input.timeZone ?? 7;
  const hour = input.hour ?? null;
  const shift = hour === 23 && opts.ratHourNextDay ? 1 : 0;
  const lunar = isoToLunar(input.date, tz, shift);
  const effectiveMonth = lunar.leap && opts.leapMonth === 'split' && lunar.day > 15 ? (lunar.month % 12) + 1 : lunar.month;

  const ys = yearStem(lunar.year);
  const yb = yearBranch(lunar.year);
  const yang = ys % 2 === 0;
  const missing: Chart['missing'] = [];
  if (hour === null) missing.push('hour');
  if (!input.gender) missing.push('gender');

  const chart: Chart = {
    ruleVersion: RULE_VERSION,
    input,
    lunar,
    effectiveMonth,
    yearCanChi: canChi(ys, yb),
    yinYang: yang ? 'Dương' : 'Âm',
    banMenh: (({ name, element }) => ({ napAm: name, element }))(napAm(ys, yb)),
    complete: false,
    missing,
  };
  if (hour === null) return chart; // Mệnh palace needs the birth hour.

  const hb = hourBranch(hour);
  const menh = mod(2 + (effectiveMonth - 1) - hb, 12);
  const than = mod(2 + (effectiveMonth - 1) + hb, 12);
  const menhStem = palaceStem(ys, menh);
  const cucEl = napAm(menhStem, menh).element;
  const cuc = { element: cucEl, ...CUC[cucEl] };
  const stars = placeMainStars(tuViPosition(cuc.number, lunar.day));

  const palaces: Palace[] = PALACE_NAMES.map((name, i) => {
    const b = mod(menh + i, 12);
    return {
      name,
      branch: BRANCHES[b],
      branchIndex: b,
      stem: STEMS[palaceStem(ys, b)],
      isThan: b === than,
      mainStars: stars.get(b) ?? [],
    };
  });

  Object.assign(chart, {
    hourBranch: BRANCHES[hb],
    menh: BRANCHES[menh],
    than: BRANCHES[than],
    cuc,
    palaces,
  });

  if (input.gender) {
    const forward = (yang && input.gender === 'male') || (!yang && input.gender === 'female');
    chart.direction = forward ? 'thuận' : 'nghịch';
    chart.daiVan = Array.from({ length: 12 }, (_, i) => {
      const b = mod(menh + (forward ? i : -i), 12);
      const p = palaces.find((x) => x.branchIndex === b)!;
      return { palace: p.name, branch: p.branch, fromAge: cuc.number + i * 10, toAge: cuc.number + i * 10 + 9 };
    });
  }
  chart.complete = missing.length === 0;
  return chart;
}

export function findPalace(chart: Chart, name: PalaceName): Palace | undefined {
  return chart.palaces?.find((p) => p.name === name);
}
