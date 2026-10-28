import { LazyMotion, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Gives the animated components their features. Only the animation features are loaded (no drag, no
 * layout animation), which keeps the bundle smaller than the full `motion` component would.
 */
export default function MotionFeatures({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
