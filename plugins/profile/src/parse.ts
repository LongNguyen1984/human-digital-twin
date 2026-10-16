import { fold } from '@hdt/core';

const BRANCHES = ['ty', 'suu', 'dan', 'mao', 'thin', 'ty.', 'ngo', 'mui', 'than', 'dau', 'tuat', 'hoi'];

/** Accepts yyyy-mm-dd, yyyy/mm/dd, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy. Returns yyyy-mm-dd or undefined. */
export function parseDate(text: string): string | undefined {
  const t = text.trim();
  let y: number, m: number, d: number;
  let match = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else {
    match = t.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (!match) return undefined;
    [d, m, y] = [+match[1], +match[2], +match[3]];
  }
  if (m < 1 || m > 12 || d < 1) return undefined;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > dim || y < 1800 || y > 2200) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type HourParse = { hour: number | null } | undefined;

/**
 * Reads a birth hour from "11h", "23:30", "8 pm", "giờ Ngọ", or "I don't know".
 * A traditional hour name maps to its middle clock hour (Ngọ → 12).
 */
export function parseHour(text: string): HourParse {
  const f = fold(text);
  if (/(don'?t know|not sure|unknown|khong biet|khong nho|chua biet)/.test(f)) return { hour: null };
  const clock = f.match(/(\d{1,2})\s*(?:h|:|gio|am|pm|g\b)/) ?? f.match(/^\s*(\d{1,2})\s*$/);
  if (clock) {
    let h = +clock[1];
    if (/pm|chieu|toi/.test(f) && h < 12) h += 12;
    if (/am|sang/.test(f) && h === 12) h = 0;
    return h >= 0 && h <= 23 ? { hour: h } : undefined;
  }
  // "giờ Tỵ" vs "giờ Tý" fold to the same text; check the original for the accent.
  const named = text.toLowerCase().match(/gi[ờo]\s+(tý|tỵ|sửu|dần|mão|mẹo|thìn|ngọ|mùi|thân|dậu|tuất|hợi)/);
  if (named) {
    const word = named[1];
    const idx = word === 'tỵ' ? 5 : word === 'mẹo' ? 3 : BRANCHES.indexOf(fold(word));
    if (idx >= 0) return { hour: (idx * 2) % 24 };
  }
  return undefined;
}

export function parseGender(text: string): 'male' | 'female' | undefined {
  const f = fold(text);
  if (/\b(nu|female|woman|girl|con gai)\b/.test(f)) return 'female';
  if (/\b(nam|male|man|boy|con trai)\b/.test(f)) return 'male';
  return undefined;
}
