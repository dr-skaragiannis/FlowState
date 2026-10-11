import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

/** Tetromino-like frames on a 3×3 cell, opening on the brand lockup. */
const PATTERNS: number[][] = [
  [0, 1, 0, 1, 1, 0, 0, 1, 1],
  [1, 1, 1, 0, 1, 0, 0, 0, 0],
  [1, 0, 0, 1, 0, 0, 1, 1, 0],
  [0, 0, 1, 0, 0, 1, 0, 1, 1],
  [0, 1, 1, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 1, 1, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 0, 0, 0],
  [0, 1, 0, 1, 1, 1, 0, 1, 0],
];

export function CellularMark({
  size = 58,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % PATTERNS.length), 1100);
    return () => window.clearInterval(id);
  }, []);

  const cells = PATTERNS[frame];
  const gap = Math.max(3, Math.round(size * 0.07));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute -inset-3 -z-10 rounded-full opacity-80 blur-xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent), transparent 68%)",
        }}
      />
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", gap }}
      >
        {cells.map((on, i) => (
          <span
            key={i}
            className="rounded-[4px] transition-[background,box-shadow,transform] duration-700 ease-out"
            style={{
              background: on ? "var(--accent)" : "rgba(255,255,255,0.16)",
              transform: on ? "scale(1)" : "scale(0.96)",
              boxShadow: on
                ? "0 0 8px color-mix(in srgb, var(--accent) 90%, transparent), 0 0 18px color-mix(in srgb, var(--accent) 50%, transparent)"
                : "inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
