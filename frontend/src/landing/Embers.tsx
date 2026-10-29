import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/** One glowing speck of ash. Positions are in CSS pixels of the canvas; `age` and `life` are in seconds. */
export type Ember = {
  x: number;
  y: number;
  size: number;
  rise: number;
  sway: number;
  phase: number;
  age: number;
  life: number;
};

/** How many embers a canvas of this width holds: more on a wide screen, fewer on a phone. */
export function emberCount(width: number): number {
  return Math.round(Math.min(90, Math.max(36, width / 22)) * (width <= 760 ? 0.6 : 1));
}

/** A new ember in the lower part of the canvas. `scattered` spreads the first ones over its whole life. */
export function spawnEmber(width: number, height: number, random: () => number, scattered = false): Ember {
  const life = 6 + random() * 6;
  return {
    x: random() * width,
    y: height * (0.55 + random() * 0.5),
    size: 1 + random() * 2.2,
    rise: height * (0.07 + random() * 0.11),
    sway: 0.6 + random() * 1.4,
    phase: random() * Math.PI * 2,
    age: scattered ? random() * life : 0,
    life,
  };
}

/** Moves an ember on by `dt` seconds. */
export function stepEmber(ember: Ember, dt: number): void {
  ember.age += dt;
  ember.y -= ember.rise * dt;
}

/** 0 when the ember is new, 1 when it has burnt out. */
export function emberProgress(ember: Ember): number {
  return Math.min(1, ember.age / ember.life);
}

/** Fades in quickly, glows, and dies away: the brightness of an ember at a point of its life. */
export function emberBrightness(progress: number): number {
  return Math.pow(Math.sin(Math.PI * progress), 0.8) * 0.95;
}

/** A soft round glow, drawn once and stamped for every ember. */
function makeSprite(core: string, mid: string): HTMLCanvasElement | null {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const ctx = sprite.getContext("2d");
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, core);
  glow.addColorStop(0.25, mid);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return sprite;
}

/**
 * Embers drifting up over the fire in the hero. They are decoration: the canvas is hidden from assistive
 * technology, stops drawing when it is off screen or the tab is in the background, and is not drawn at all
 * for a visitor who asked for less motion.
 */
export default function Embers() {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (reduced || !canvas || !ctx) return;
    const sprites = [
      makeSprite("rgba(255, 244, 205, 1)", "rgba(255, 190, 80, 0.55)"),
      makeSprite("rgba(255, 170, 70, 1)", "rgba(255, 100, 30, 0.5)"),
      makeSprite("rgba(255, 110, 50, 1)", "rgba(200, 40, 20, 0.45)"),
    ];
    if (sprites.some((sprite) => !sprite)) return;

    let width = 0;
    let height = 0;
    let ratio = 1;
    let embers: Ember[] = [];
    let frame = 0;
    let last = 0;
    let onScreen = true;

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const wanted = emberCount(width);
      if (embers.length > wanted) embers.length = wanted;
      while (embers.length < wanted) embers.push(spawnEmber(width, height, Math.random, true));
    };

    const draw = (time: number) => {
      frame = 0;
      const dt = Math.min((time - last) / 1000 || 0, 0.05);
      last = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      embers.forEach((ember, i) => {
        stepEmber(ember, dt);
        const progress = emberProgress(ember);
        if (progress >= 1 || ember.y < -10) {
          embers[i] = spawnEmber(width, height, Math.random);
          return;
        }
        const sprite = sprites[progress < 0.3 ? 0 : progress < 0.7 ? 1 : 2]!;
        const size = ember.size * 9 * ratio;
        const x = (ember.x + Math.sin(ember.phase + ember.age * ember.sway) * 14) * ratio;
        ctx.globalAlpha = emberBrightness(progress);
        ctx.drawImage(sprite, x - size / 2, ember.y * ratio - size / 2, size, size);
      });
      ctx.globalAlpha = 1;
      schedule();
    };

    // Drawing runs only while the canvas is seen and the tab is in front.
    const schedule = () => {
      if (!frame && onScreen && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const pause = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const restart = () => {
      last = performance.now();
      schedule();
    };

    resize();
    const sizeWatcher = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    sizeWatcher?.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) restart();
      else pause();
    });
    seen.observe(canvas);
    const onVisibility = () => (document.hidden ? pause() : restart());
    document.addEventListener("visibilitychange", onVisibility);
    restart();

    return () => {
      pause();
      sizeWatcher?.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className="hero-embers" aria-hidden="true" />;
}
