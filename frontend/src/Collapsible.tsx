import type { ReactNode } from "react";

import { ChevronIcon } from "./icons";

type Props = {
  /** The button text; it names the panel for screen readers too. */
  label: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A header button that shows or hides its content, so panels never have to hide the map. */
export default function Collapsible({ label, icon, open, onToggle, children }: Props) {
  return (
    <>
      <button type="button" className="panel-toggle" aria-expanded={open} onClick={onToggle}>
        {icon}
        <span className="panel-toggle-label">{label}</span>
        <span className="chevron">
          <ChevronIcon />
        </span>
      </button>
      {open && <div className="panel-body">{children}</div>}
    </>
  );
}
