import { describe, expect, it } from 'vitest';

describe('color token enforcement', () => {
  it('finds no raw CSS color literals outside the token file', () => {
    const modules = import.meta.glob('../**/*.{css,ts,tsx,html}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
    const colorLiteral = new RegExp(`${String.fromCharCode(35)}[0-9a-f]{3,8}\\b|\\brgb(?:a)?\\s*\\(|\\bhsl(?:a)?\\s*\\(`, 'i');
    const violations = Object.entries(modules)
      .filter(([path]) => path !== '../theme/tokens.css')
      .filter(([, source]) => colorLiteral.test(source))
      .map(([path]) => path);
    expect(violations).toEqual([]);
  });
});
