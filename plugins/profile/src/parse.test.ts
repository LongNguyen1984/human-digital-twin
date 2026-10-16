import { describe, expect, it } from 'vitest';
import { parseDate, parseGender, parseHour } from './parse.js';

describe('profile parsers', () => {
  it('reads common date formats', () => {
    expect(parseDate('1990-05-12')).toBe('1990-05-12');
    expect(parseDate('12/05/1990')).toBe('1990-05-12');
    expect(parseDate('Tôi sinh ngày 3.7.1985')).toBe('1985-07-03');
    expect(parseDate('31/02/1990')).toBeUndefined();
  });

  it('reads hours, traditional hour names and unknowns', () => {
    expect(parseHour('11h')).toEqual({ hour: 11 });
    expect(parseHour('23:30')).toEqual({ hour: 23 });
    expect(parseHour('8 pm')).toEqual({ hour: 20 });
    expect(parseHour('giờ Ngọ')).toEqual({ hour: 12 });
    expect(parseHour('giờ Tỵ')).toEqual({ hour: 10 });
    expect(parseHour('giờ Tý')).toEqual({ hour: 0 });
    expect(parseHour("I don't know")).toEqual({ hour: null });
    expect(parseHour('không biết')).toEqual({ hour: null });
    expect(parseHour('whenever')).toBeUndefined();
  });

  it('reads gender', () => {
    expect(parseGender('Nữ')).toBe('female');
    expect(parseGender('female')).toBe('female');
    expect(parseGender('Nam')).toBe('male');
  });
});
