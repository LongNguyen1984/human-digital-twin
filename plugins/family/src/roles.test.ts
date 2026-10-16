import { describe, expect, it } from 'vitest';
import { rolesInText } from './roles.js';

describe('rolesInText', () => {
  it('reads Vietnamese and English mentions', () => {
    expect(rolesInText('Tôi sống với bố mẹ và vợ').sort()).toEqual(['father', 'mother', 'wife']);
    expect(rolesInText('My father, mother and my wife').sort()).toEqual(['father', 'mother', 'wife']);
    expect(rolesInText('I live with my parents').sort()).toEqual(['father', 'mother']);
    expect(rolesInText('Con gái tôi 5 tuổi')).toEqual(['daughter']);
  });

  it('does not confuse English "me" with mẹ', () => {
    expect(rolesInText('Tell me about my career')).toEqual([]);
  });
});
