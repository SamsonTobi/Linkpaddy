import React, { useEffect, useMemo, useRef } from "react";

/** Maps a normalised position (0..1, 0..1) to dot coverage (0..1). */
export type HalftoneField = (x: number, y: number) => number;

export const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Coverage 1 must fill the screen solid: dots on a rotated grid touch when
// r = cell / sqrt(2), so a hair past that closes the gaps.
const FULL_RADIUS = 0.72;

interface PaintOptions {
  cell: number;
  angle: number;
  color: string;
  field: HalftoneField;
  bump?: { x: number; y: number; strength: number; radius: number };
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  { cell, angle, color, field, bump }: PaintOptions,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const n = Math.ceil(Math.hypot(w, h) / cell / 2) + 1;
  const cx = w / 2;
  const cy = h / 2;

  ctx.beginPath();
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = cx + (i * cos - j * sin) * cell;
      const y = cy + (i * sin + j * cos) * cell;
      if (x < -cell || x > w + cell || y < -cell || y > h + cell) continue;

      let f = field(Math.min(1, Math.max(0, x / w)), Math.min(1, Math.max(0, y / h)));
      if (bump && bump.strength > 0.001) {
        const d2 = (x - bump.x) ** 2 + (y - bump.y) ** 2;
        f += bump.strength * Math.exp(-d2 / (2 * bump.radius ** 2));
      }
      if (f < 0.03) continue;
      const r = Math.sqrt(Math.min(1, f)) * cell * FULL_RADIUS;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

interface HalftoneProps {
  field: HalftoneField;
  color: string;
  /** Distance between dot centres in CSS pixels. */
  cell?: number;
  /** Screen angle. 45 is the classic print screen. */
  angle?: number;
  /** Dots swell around the pointer. Ignored under reduced motion. */
  interactive?: boolean;
  className?: string;
}

/** A decorative halftone screen drawn to fill its positioned parent. */
export const Halftone: React.FC<HalftoneProps> = ({
  field,
  color,
  cell = 14,
  angle = 45,
  interactive = false,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let frame = 0;
    const pointer = { x: 0, y: 0, strength: 0 };
    const target = { x: 0, y: 0, strength: 0 };

    const render = () =>
      paint(ctx, w, h, {
        cell,
        angle,
        color,
        field,
        bump: interactive
          ? { x: pointer.x, y: pointer.y, strength: pointer.strength * 0.22, radius: Math.max(90, cell * 8) }
          : undefined,
      });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    };

    const tick = () => {
      pointer.x += (target.x - pointer.x) * 0.16;
      pointer.y += (target.y - pointer.y) * 0.16;
      pointer.strength += (target.strength - pointer.strength) * 0.12;
      render();
      const settled =
        Math.abs(target.x - pointer.x) < 0.5 &&
        Math.abs(target.y - pointer.y) < 0.5 &&
        Math.abs(target.strength - pointer.strength) < 0.005;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (inside && target.strength === 0) {
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
      }
      target.x = event.clientX - rect.left;
      target.y = event.clientY - rect.top;
      target.strength = inside ? 1 : 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (interactive && !reduceMotion) window.addEventListener("pointermove", onMove);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [field, color, cell, angle, interactive]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
};

/**
 * Renders a halftone screen to a PNG data URL so it can act as a CSS mask,
 * letting a photograph dissolve into dots at its edges.
 */
export function useHalftoneMask(field: HalftoneField, width: number, height: number, cell: number, angle = 45) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    paint(ctx, width, height, { cell, angle, color: "#000", field });
    return canvas.toDataURL("image/png");
  }, [field, width, height, cell, angle]);
}
