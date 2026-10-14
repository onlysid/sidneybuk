// Twelve notes from C, as frequency ratios above C, in five historical tunings.
export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];

const cents = (c: number) => Math.pow(2, c / 1200);
const fold = (r: number) => {
  while (r >= 2) r /= 2;
  while (r < 1) r *= 2;
  return r;
};

// Quarter-comma meantone: a chain of fifths, each narrowed to 5^(1/4), running E♭ … G♯.
const meanFifth = Math.pow(5, 0.25);
const chain = [0, 7, 2, -3, 4, -1, 6, 1, 8, 3, -2, 5]; // steps along the chain of fifths for C, C♯, D, …

export const TEMPERAMENTS = {
  equal: {
    label: "Equal",
    about: "Every semitone is the same size. Nothing is perfectly pure and nothing is sour: the modern piano.",
    ratios: NOTE_NAMES.map((_, n) => Math.pow(2, n / 12)),
  },
  just: {
    label: "Just",
    about: "Whole-number ratios measured from C. Thirds and fifths ring pure in C, and fall apart in distant keys.",
    ratios: [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8],
  },
  pythagorean: {
    label: "Pythagorean",
    about: "Stacked from pure 3:2 fifths. Bright, wide thirds, and one leftover wolf fifth that howls.",
    ratios: [1, 2187 / 2048, 9 / 8, 32 / 27, 81 / 64, 4 / 3, 729 / 512, 3 / 2, 6561 / 4096, 27 / 16, 16 / 9, 243 / 128],
  },
  meantone: {
    label: "Meantone",
    about: "Quarter-comma meantone narrows each fifth so the major thirds come out pure. The sound of the Renaissance.",
    ratios: chain.map((k) => fold(Math.pow(meanFifth, k))),
  },
  werckmeister: {
    label: "Werckmeister",
    about: "Werckmeister III, a well temperament: every key is usable, and each has its own colour.",
    ratios: [0, 90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18, 888.27, 996.09, 1092.18].map(cents),
  },
} as const;
export type Temperament = keyof typeof TEMPERAMENTS;

export const toCents = (ratio: number) => 1200 * Math.log2(ratio);

// How far each note sits from equal temperament, in cents.
export const deviations = (t: Temperament) => TEMPERAMENTS[t].ratios.map((r, n) => toCents(r) - n * 100);

// The fifth above each note, and how far it is from a pure 3:2 (701.955 cents).
export const fifths = (t: Temperament) => {
  const r = TEMPERAMENTS[t].ratios;
  return r.map((from, n) => {
    const to = r[(n + 7) % 12] * (n + 7 >= 12 ? 2 : 1);
    return toCents(to / from) - 701.955;
  });
};

// Middle C for a given concert pitch, keeping A where the tuning fork says.
export const middleC = (a4: number, t: Temperament) => a4 / TEMPERAMENTS[t].ratios[9];

export const INTERVALS = {
  third: { label: "Major third", upper: 4, pure: [5, 4] },
  fifth: { label: "Fifth", upper: 7, pure: [3, 2] },
  octave: { label: "Octave", upper: 12, pure: [2, 1] },
} as const;
export type Interval = keyof typeof INTERVALS;
