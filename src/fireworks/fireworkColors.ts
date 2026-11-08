import { ParticleColor } from '../particles/particle';

export const COLORS = {
  GOLD: { r: 255, g: 215, b: 0 },
  AMBER: { r: 255, g: 140, b: 20 },
  DEEP_ORANGE: { r: 255, g: 85, b: 0 },
  WHITE_HOT: { r: 255, g: 255, b: 255 },
  CRIMSON: { r: 255, g: 30, b: 70 },
  EMERALD: { r: 0, g: 255, b: 120 },
  ELECTRIC_BLUE: { r: 0, g: 195, b: 255 },
  MAGENTA: { r: 255, g: 20, b: 147 },
  PURPLE: { r: 180, g: 40, b: 255 },
  SILVER: { r: 220, g: 235, b: 255 },
  BRAND_BLUE: { r: 9, g: 102, b: 171 },
  BRAND_SKY: { r: 36, g: 167, b: 223 },
  BRAND_GREEN: { r: 17, g: 168, b: 111 },
  BRAND_ORANGE: { r: 251, g: 125, b: 4 }
} as const;

export const PALETTES = [
  [COLORS.GOLD, COLORS.AMBER, COLORS.WHITE_HOT],
  [COLORS.CRIMSON, COLORS.GOLD, COLORS.WHITE_HOT],
  [COLORS.EMERALD, COLORS.GOLD, COLORS.WHITE_HOT],
  [COLORS.ELECTRIC_BLUE, COLORS.SILVER, COLORS.WHITE_HOT],
  [COLORS.MAGENTA, COLORS.GOLD, COLORS.ELECTRIC_BLUE],
  [COLORS.BRAND_SKY, COLORS.BRAND_ORANGE, COLORS.WHITE_HOT],
  [COLORS.BRAND_GREEN, COLORS.BRAND_SKY, COLORS.WHITE_HOT],
  [COLORS.BRAND_ORANGE, COLORS.BRAND_BLUE, COLORS.WHITE_HOT]
];

export function getRandomColor(): ParticleColor {
  const all = [
    COLORS.GOLD,
    COLORS.CRIMSON,
    COLORS.EMERALD,
    COLORS.ELECTRIC_BLUE,
    COLORS.MAGENTA,
    COLORS.PURPLE,
    COLORS.BRAND_SKY,
    COLORS.BRAND_GREEN,
    COLORS.BRAND_ORANGE
  ];
  return all[Math.floor(Math.random() * all.length)];
}
