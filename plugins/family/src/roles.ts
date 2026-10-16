import { fold, type Gender } from '@hdt/core';

export type Relation = 'parent' | 'child' | 'spouse' | 'sibling';
export type Role = 'father' | 'mother' | 'husband' | 'wife' | 'son' | 'daughter' | 'child' | 'brother' | 'sister';

export interface RoleDef {
  role: Role;
  relation: Relation;
  gender?: Gender;
  label: { en: string; vi: string };
  /** Vietnamese words matched on the accented, lowercased text (accents matter: mẹ ≠ me). */
  vi: string[];
  /** English words matched on folded text. */
  en: string[];
}

export const ROLES: RoleDef[] = [
  { role: 'father', relation: 'parent', gender: 'male', label: { en: 'Father', vi: 'Bố' }, vi: ['bố', 'cha', 'ba'], en: ['father', 'dad'] },
  { role: 'mother', relation: 'parent', gender: 'female', label: { en: 'Mother', vi: 'Mẹ' }, vi: ['mẹ', 'má'], en: ['mother', 'mom', 'mum'] },
  { role: 'husband', relation: 'spouse', gender: 'male', label: { en: 'Husband', vi: 'Chồng' }, vi: ['chồng'], en: ['husband'] },
  { role: 'wife', relation: 'spouse', gender: 'female', label: { en: 'Wife', vi: 'Vợ' }, vi: ['vợ'], en: ['wife'] },
  { role: 'son', relation: 'child', gender: 'male', label: { en: 'Son', vi: 'Con trai' }, vi: ['con trai'], en: ['son'] },
  { role: 'daughter', relation: 'child', gender: 'female', label: { en: 'Daughter', vi: 'Con gái' }, vi: ['con gái'], en: ['daughter'] },
  { role: 'child', relation: 'child', label: { en: 'Child', vi: 'Con' }, vi: ['con tôi', 'con mình', 'con của tôi', 'các con'], en: ['child', 'kid', 'kids', 'children'] },
  { role: 'brother', relation: 'sibling', gender: 'male', label: { en: 'Brother', vi: 'Anh/em trai' }, vi: ['anh trai', 'em trai'], en: ['brother'] },
  { role: 'sister', relation: 'sibling', gender: 'female', label: { en: 'Sister', vi: 'Chị/em gái' }, vi: ['chị gái', 'em gái'], en: ['sister'] },
];

export const INVERSE: Record<Relation, Relation> = { parent: 'child', child: 'parent', spouse: 'spouse', sibling: 'sibling' };

export const roleDef = (role: string) => ROLES.find((r) => r.role === role);

const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, 'u');

/** Roles mentioned in a message; "parents"/"bố mẹ" count as both. */
export function rolesInText(text: string): Role[] {
  const raw = text.toLowerCase();
  const f = fold(text);
  const found = new Set<Role>();
  for (const r of ROLES) {
    if (r.vi.some((w) => wordRe(w).test(raw)) || r.en.some((w) => wordRe(w).test(f))) found.add(r.role);
  }
  if (/\bparents\b/.test(f)) {
    found.add('father');
    found.add('mother');
  }
  if (found.has('son') || found.has('daughter')) found.delete('child');
  return [...found];
}
