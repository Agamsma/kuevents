/**
 * WCAG contrast maths, dependency-free.
 *
 * Lives apart from any React or Next import so `theme.test.mts` can assert the
 * palette under plain `node --test`, where the `@/` alias does not resolve.
 * The palette is the one part of the design system that can be checked by
 * machine rather than by eye, so it is.
 */

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!HEX.test(hex)) {
    throw new Error(`Not a #RRGGBB hex colour: ${hex}`);
  }

  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Per WCAG 2.1: sRGB channels linearised, then weighted. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);

  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );

  return (hi + 0.05) / (lo + 0.05);
}
