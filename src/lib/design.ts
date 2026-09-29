export const COVER_COLORS = ['#8c3b2e', '#2f4b3a', '#1f3a5f', '#6b4e9b', '#c28a2c', '#3b3b3b', '#b5566b', '#4f7a8a']

export const PAGE_COLORS = ['#faf6ee', '#f5efe3', '#fdfdfb', '#eef3ea', '#eaf0f6', '#f7e9e4', '#2b2622', '#1f2a36']

export const TEXT_COLORS = ['#2b2622', '#5a4636', '#1f3a5f', '#8c3b2e', '#2f4b3a', '#ffffff', '#f5e6c8']

export const NOTE_COLORS = [
  { value: '#fff176', label: 'Amarillo' },
  { value: '#ffcc80', label: 'Naranja' },
  { value: '#f8bbd0', label: 'Rosa' },
  { value: '#b2ebf2', label: 'Celeste' },
  { value: '#c5e1a5', label: 'Verde' },
  { value: '#d1c4e9', label: 'Lila' },
]

export const INK = '#2b2622'

/** Stable pseudo-random tilt so items keep their "hand-placed" angle across reloads. */
export function tiltFor(id: number, max = 3): number {
  const x = Math.sin(id * 12.9898) * 43758.5453
  return ((x - Math.floor(x)) * 2 - 1) * max
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Uses the preferred color if it is legible on the background, otherwise falls back to ink. */
export function readableOn(bg: string, preferred: string): string {
  return contrastRatio(bg, preferred) >= 3 ? preferred : INK
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.2
}
