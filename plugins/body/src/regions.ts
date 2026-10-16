import { fold, hasAny } from '@hdt/core';

export interface Region {
  id: string;
  label: { en: string; vi: string };
  group: 'external' | 'internal' | 'system';
  /** Mesh/organ node names the 3D viewer colours for this region. */
  meshes: string[];
  /** Folded (no diacritics) phrases that point at this region. */
  keywords: string[];
}

/**
 * Keywords are deliberately multi-word for Vietnamese: folded "dau" is both
 * "đầu" (head) and "đau" (pain), so "dau dau" (đau đầu) is used instead.
 */
export const REGIONS: Region[] = [
  { id: 'head', label: { en: 'Head', vi: 'Đầu' }, group: 'external', meshes: ['head'], keywords: ['headache', 'head', 'migraine', 'dizzy', 'dau dau', 'nhuc dau', 'chong mat'] },
  { id: 'heart', label: { en: 'Heart', vi: 'Tim' }, group: 'internal', meshes: ['heart'], keywords: ['heart', 'palpitation', 'palpitations', 'blood pressure', 'benh tim', 'tim dap nhanh', 'hoi hop', 'huyet ap'] },
  { id: 'lungs', label: { en: 'Lungs', vi: 'Phổi' }, group: 'internal', meshes: ['lung_l', 'lung_r'], keywords: ['lung', 'lungs', 'cough', 'coughing', 'asthma', 'breath', 'phoi', 'bi ho', 'ho khan', 'ho nhieu', 'hen suyen'] },
  { id: 'stomach', label: { en: 'Stomach', vi: 'Dạ dày' }, group: 'internal', meshes: ['stomach'], keywords: ['stomach', 'reflux', 'indigestion', 'nausea', 'heartburn', 'da day', 'dau bung', 'trao nguoc', 'buon non', 'khong tieu'] },
  { id: 'liver', label: { en: 'Liver', vi: 'Gan' }, group: 'internal', meshes: ['liver'], keywords: ['liver', 'men gan', 'gan nhiem mo'] },
  { id: 'lower_back', label: { en: 'Lower back', vi: 'Thắt lưng' }, group: 'external', meshes: ['spine_lumbar'], keywords: ['back pain', 'lower back', 'my back', 'back hurts', 'spine', 'dau lung', 'that lung', 'cot song', 'moi lung'] },
  { id: 'arms', label: { en: 'Arms & shoulders', vi: 'Tay & vai' }, group: 'external', meshes: ['arm_l', 'arm_r'], keywords: ['arm', 'arms', 'shoulder', 'wrist', 'dau tay', 'moi tay', 'dau vai', 'co tay'] },
  { id: 'legs', label: { en: 'Legs & knees', vi: 'Chân & gối' }, group: 'external', meshes: ['leg_l', 'leg_r'], keywords: ['leg', 'legs', 'knee', 'knees', 'ankle', 'dau chan', 'moi chan', 'dau goi', 'dau khop goi'] },
  { id: 'sleep', label: { en: 'Sleep', vi: 'Giấc ngủ' }, group: 'system', meshes: ['head'], keywords: ['sleep', 'slept', 'insomnia', 'mat ngu', 'kho ngu', 'ngu khong ngon', 'thuc giac'] },
];

export const regionById = (id: string) => REGIONS.find((r) => r.id === id);

export function regionsInText(text: string): Region[] {
  const f = fold(text);
  return REGIONS.filter((r) => hasAny(f, r.keywords));
}

/** Signs that need a doctor now, not a chat. Vietnam emergency number is 115. */
const RED_FLAGS = [
  'chest pain', 'dau nguc', 'tuc nguc', 'shortness of breath', 'cant breathe', 'kho tho', 'faint', 'fainted', 'ngat',
  'coughing blood', 'vomiting blood', 'ho ra mau', 'non ra mau', 'black stool', 'phan den',
  'worst headache', 'numb on one side', 'te nua nguoi', 'yeu nua nguoi', 'stroke', 'dot quy', 'meo mieng',
];

export function redFlag(text: string): string | undefined {
  return hasAny(fold(text), RED_FLAGS);
}

export function severityFrom(text: string): number {
  const f = fold(text);
  const scale = f.match(/(\d{1,2})\s*\/\s*10/);
  if (scale) return Math.min(10, Math.max(0, +scale[1]));
  if (/(severe|terrible|unbearable|rat dau|du doi|kinh khung|qua dau)/.test(f)) return 7;
  if (/(mild|a little|slight|hoi|nhe|chut)/.test(f)) return 2;
  return 4;
}
