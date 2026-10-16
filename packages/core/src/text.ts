/** Small text helpers shared by extractors (Vietnamese + English). */

/** Lowercase and strip Vietnamese diacritics: "Dạ dày" → "da day". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** True if any keyword (already folded) appears as a whole word/phrase in folded text. */
export function hasAny(foldedText: string, keywords: string[]): string | undefined {
  for (const k of keywords) {
    const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
    if (re.test(foldedText)) return k;
  }
  return undefined;
}
