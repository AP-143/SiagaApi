import type { ReactNode } from "react";

// Inline SVG icons (stroke style, 24px grid). They are decorative: the text next to them carries
// the meaning, so they are hidden from screen readers.
function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Corner brackets: "show everything". */
export const FrameIcon = () => (
  <Icon size={20}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
  </Icon>
);

/** A circled "i": information. */
export const InfoIcon = () => (
  <Icon size={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

/** An arrow pointing up and to the right: send. */
export const SendIcon = () => (
  <Icon size={18}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

/** Two overlapping dots, like the Hotspot marks a map key explains. */
export const KeyIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="4.5" />
    <circle cx="15.5" cy="15.5" r="4.5" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon size={16}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const AlertIcon = () => (
  <Icon>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon size={16}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
);

export const FilterIcon = () => (
  <Icon>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
  </Icon>
);

export const ChatIcon = () => (
  <Icon>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);

export const LayersIcon = () => (
  <Icon>
    <path d="m12 2 10 5-10 5L2 7l10-5Z" />
    <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
  </Icon>
);

export const ListIcon = () => (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);
