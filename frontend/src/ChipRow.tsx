import { type ReactNode, useEffect, useRef } from "react";

/**
 * A single row of suggested questions that slides sideways. With a mouse the wheel moves it (a
 * touch screen swipes it natively); when everything already fits, the wheel is left to the page.
 */
export default function ChipRow({ children }: { children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    // A native listener: React's own wheel handlers are passive and could not stop the page scrolling.
    const slide = (event: WheelEvent) => {
      if (element.scrollWidth <= element.clientWidth) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // already sideways
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };
    element.addEventListener("wheel", slide, { passive: false });
    return () => element.removeEventListener("wheel", slide);
  }, []);

  return (
    <div className="chat-chips" ref={row}>
      {children}
    </div>
  );
}
