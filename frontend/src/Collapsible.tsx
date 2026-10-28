import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { ChevronIcon } from "./icons";
import MotionFeatures from "./MotionFeatures";

type Props = {
  /** The button text; it names the panel for screen readers too. */
  label: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

// The panel body scrolls (overflow-y: auto in the CSS), which also clips it while its height moves.
const CLOSED = { height: 0, opacity: 0 };
const OPEN = { height: "auto", opacity: 1 };

/** A header button that shows or hides its content, so panels never have to hide the map. */
export default function Collapsible({ label, icon, open, onToggle, children }: Props) {
  const reduced = useReducedMotion();
  return (
    <>
      <button type="button" className="panel-toggle" aria-expanded={open} onClick={onToggle}>
        {icon}
        <span className="panel-toggle-label">{label}</span>
        <span className="chevron">
          <ChevronIcon />
        </span>
      </button>
      {reduced ? (
        open && <div className="panel-body">{children}</div>
      ) : (
        <MotionFeatures>
        <AnimatePresence initial={false}>
          {open && (
            <m.div
              key="body"
              className="panel-body"
              initial={CLOSED}
              animate={OPEN}
              exit={CLOSED}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {children}
            </m.div>
          )}
        </AnimatePresence>
        </MotionFeatures>
      )}
    </>
  );
}
