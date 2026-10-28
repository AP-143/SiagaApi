// The mark is a double ring around a single flame, drawn in lines like an engraver's seal. It takes
// its colour from the text around it, so it is ink on paper and light on the dark map. The favicon
// (public/favicon.svg) is the same drawing.
export default function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
    >
      <circle cx="16" cy="16" r="14.6" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="12.2" strokeWidth="0.7" />
      <path
        d="M16 7.2C17.2 10.6 21.4 12.6 21.4 17.6C21.4 21.2 19 24.2 16 24.2C13 24.2 10.6 21.2 10.6 17.6C10.6 15.4 11.6 14 12.8 12.8C13 14.8 14.2 15.8 15.2 16C14.4 12.8 14.8 9.6 16 7.2Z"
        strokeWidth="1.3"
      />
      <path
        d="M16 24.2C14.2 24.2 13.2 22.6 13.2 21C13.2 19.6 14.2 18.6 16 17C17.8 18.6 18.8 19.6 18.8 21C18.8 22.6 17.8 24.2 16 24.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
