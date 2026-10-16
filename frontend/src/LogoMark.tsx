// The mark is a flame built out of satellite pixels, the way a Hotspot is detected, burning above a
// row of purple pixels for peat. It uses the same orange and purple as the points on the map, so the
// logo and the legend speak the same language. The favicon (public/favicon.svg) is the same drawing.
const PIXEL = 3.6;
const GAP = 0.7;
const LEFT = 5.6;
const TOP = 3.45;

// o = the glow fading upward, x = burning, * = the hottest pixel, p = peat, . = nothing
const GRID = [
  "...o.",
  "..oo.",
  ".xxxx",
  "xx*xx",
  ".xxx.",
  "ppppp",
];

const CLASS_OF: Record<string, string> = { o: "logo-spread", x: "logo-hot", "*": "logo-core", p: "logo-peat" };

export default function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="logo-tile" width="32" height="32" rx="8" />
      {GRID.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." ? null : (
            <rect
              key={`${x}-${y}`}
              className={CLASS_OF[cell]}
              x={LEFT + x * (PIXEL + GAP)}
              y={TOP + y * (PIXEL + GAP)}
              width={PIXEL}
              height={PIXEL}
              rx="0.8"
            />
          ),
        ),
      )}
    </svg>
  );
}
