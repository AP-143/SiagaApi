// The hero is drawn, not photographed: a smoky dawn over Kalimantan, with a dark canopy mound in
// front that rises into the lower half of the title, the way the elephant's back does in the
// reference. Both drawings share the stage's 1000 x 565 box (the ratio of 2688 x 1520).
const WIDTH = 1000;
const HEIGHT = 565;

/** A small deterministic random sequence, so the canopy is drawn the same way on every visit. */
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** One soft hump of the ground line. */
/** A higher `power` makes a rounder, flatter top with steeper sides. */
type Hump = { at: number; height: number; spread: number; power?: number };

/** A ridge of tree crowns: a few humps for the lie of the land, under a row of uneven crowns. */
function canopy(seed: number, ground: number, humps: Hump[]) {
  const random = sequence(seed);
  const edge = (x: number) =>
    ground - humps.reduce((sum, h) => sum + h.height * Math.exp(-(Math.abs((x - h.at) / h.spread) ** (h.power ?? 2))), 0);
  let path = `M0 ${HEIGHT} L0 ${edge(0).toFixed(1)}`;
  let x = 0;
  while (x < WIDTH) {
    const width = 14 + random() * 26;
    const next = Math.min(WIDTH, x + width);
    const middle = (x + next) / 2;
    // Wide crowns bulge more than narrow ones, as they do in a real canopy.
    const crown = 4 + random() * 8 + width * 0.35;
    path += ` Q${middle.toFixed(1)} ${(edge(middle) - crown).toFixed(1)} ${next.toFixed(1)} ${edge(next).toFixed(1)}`;
    x = next;
  }
  return `${path} L${WIDTH} ${HEIGHT} Z`;
}

const FAR_RIDGE = canopy(7, 458, [
  { at: 220, height: 70, spread: 190 },
  { at: 780, height: 110, spread: 230 },
]);
const NEAR_RIDGE = canopy(31, 492, [
  { at: 505, height: 300, spread: 215, power: 3 },
  { at: 255, height: 105, spread: 150, power: 2 },
  { at: 800, height: 80, spread: 150, power: 2 },
]);

export function HeroSky() {
  return (
    <svg
      className="hero-art"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hero-sky-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1e9d9" />
          <stop offset="0.34" stopColor="#ecd9b8" />
          <stop offset="0.56" stopColor="#e6b88a" />
          <stop offset="0.74" stopColor="#d58a58" />
          <stop offset="1" stopColor="#7a5244" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f4c98a" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#e8894e" stopOpacity="0.4" />
          <stop offset="1" stopColor="#e8894e" stopOpacity="0" />
        </radialGradient>
        <filter id="hero-haze" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="url(#hero-sky-fill)" />
      <ellipse cx="640" cy="360" rx="330" ry="190" fill="url(#hero-glow)" />
      <circle cx="640" cy="352" r="34" fill="#f8e2b4" opacity="0.92" />
      <g filter="url(#hero-haze)" fill="#8b6c5f">
        <ellipse cx="300" cy="215" rx="260" ry="26" opacity="0.2" />
        <ellipse cx="720" cy="170" rx="300" ry="22" opacity="0.16" />
        <ellipse cx="520" cy="300" rx="360" ry="30" opacity="0.26" />
        <ellipse cx="860" cy="330" rx="200" ry="24" opacity="0.22" />
      </g>
      <path d={FAR_RIDGE} fill="#7d554a" opacity="0.88" />
    </svg>
  );
}

export function HeroForeground() {
  return (
    <svg
      className="hero-art"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path d={NEAR_RIDGE} fill="#2a191c" />
    </svg>
  );
}
