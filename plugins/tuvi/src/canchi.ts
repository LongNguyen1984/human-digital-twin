export const STEMS = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const;
export const BRANCHES = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'] as const;

export type Element = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ';

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const yearStem = (lunarYear: number) => mod(lunarYear + 6, 10);
export const yearBranch = (lunarYear: number) => mod(lunarYear + 8, 12);

/** Clock hour 0–23 → branch index (Tý = 23:00–00:59 → 0). */
export const hourBranch = (hour: number) => mod(Math.floor((hour + 1) / 2), 12);

/** Nạp âm for the 30 pairs of the sexagenary cycle, in order from Giáp Tý. */
const NAP_AM: Array<[string, Element]> = [
  ['Hải Trung Kim', 'Kim'], ['Lư Trung Hỏa', 'Hỏa'], ['Đại Lâm Mộc', 'Mộc'], ['Lộ Bàng Thổ', 'Thổ'],
  ['Kiếm Phong Kim', 'Kim'], ['Sơn Đầu Hỏa', 'Hỏa'], ['Giản Hạ Thủy', 'Thủy'], ['Thành Đầu Thổ', 'Thổ'],
  ['Bạch Lạp Kim', 'Kim'], ['Dương Liễu Mộc', 'Mộc'], ['Tuyền Trung Thủy', 'Thủy'], ['Ốc Thượng Thổ', 'Thổ'],
  ['Tích Lịch Hỏa', 'Hỏa'], ['Tùng Bách Mộc', 'Mộc'], ['Trường Lưu Thủy', 'Thủy'], ['Sa Trung Kim', 'Kim'],
  ['Sơn Hạ Hỏa', 'Hỏa'], ['Bình Địa Mộc', 'Mộc'], ['Bích Thượng Thổ', 'Thổ'], ['Kim Bạch Kim', 'Kim'],
  ['Phú Đăng Hỏa', 'Hỏa'], ['Thiên Hà Thủy', 'Thủy'], ['Đại Dịch Thổ', 'Thổ'], ['Thoa Xuyến Kim', 'Kim'],
  ['Tang Đố Mộc', 'Mộc'], ['Đại Khê Thủy', 'Thủy'], ['Sa Trung Thổ', 'Thổ'], ['Thiên Thượng Hỏa', 'Hỏa'],
  ['Thạch Lựu Mộc', 'Mộc'], ['Đại Hải Thủy', 'Thủy'],
];

/** Position 0–59 in the sexagenary cycle; stem and branch must share parity. */
export function cycleIndex(stem: number, branch: number): number {
  if (stem % 2 !== branch % 2) throw new Error(`Invalid Can Chi pair ${STEMS[stem]} ${BRANCHES[branch]}`);
  return mod(6 * stem - 5 * branch, 60);
}

export function napAm(stem: number, branch: number): { name: string; element: Element } {
  const [name, element] = NAP_AM[Math.floor(cycleIndex(stem, branch) / 2)];
  return { name, element };
}

export const canChi = (stem: number, branch: number) => `${STEMS[stem]} ${BRANCHES[branch]}`;
