import type { ReactNode } from "react";
import { cn } from "../utils/cn";

const PATHS: Record<string, ReactNode> = {
  play: <path d="M6 4.5v15l13-7.5-13-7.5Z" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1.3" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.3" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3.2-6.9" />
      <path d="M3 4.5V10h5.5" />
    </>
  ),
  skip: (
    <>
      <path d="M5 5.5v13l9-6.5-9-6.5Z" />
      <path d="M18 5v14" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" />
      <path d="M6.5 7l.8 12.2a1 1 0 0 0 1 .8h7.4a1 1 0 0 0 1-.8L17.5 7" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </>
  ),
  command: (
    <path d="M7.5 4.5a2.5 2.5 0 1 0 0 5H9v5H7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 2.5-2.5V16h5v1A2.5 2.5 0 1 0 19 14.5a2.5 2.5 0 0 0-2.5 2.5h-.5v-9h.5A2.5 2.5 0 1 0 14.5 4.5v.5h-5v-.5a2.5 2.5 0 0 0-2-2.5Z" />
  ),
  flame: (
    <path d="M12 3s5 4.2 5 8.6A5 5 0 0 1 7 12c0-1.6.7-2.7 1.6-3.7C9.6 7.2 11 6 12 3Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
      <path d="M16 9.5h1.8a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M4 21h13" />
    </>
  ),
  rain: (
    <>
      <path d="M7 14a4 4 0 0 1 .5-8 5.2 5.2 0 0 1 10 1.2A3.4 3.4 0 0 1 17.5 14H7Z" />
      <path d="M9 17.5l-.8 2M13 17.5l-.8 2M17 17.5l-.8 2" />
    </>
  ),
  waves: <path d="M3 9.5c2.2 0 3-1.6 4.6-1.6S9.4 9.5 12 9.5s3-1.6 4.6-1.6S19.8 9.5 21 9.5M3 15c2.2 0 3-1.6 4.6-1.6S9.4 15 12 15s3-1.6 4.6-1.6S19.8 15 21 15" />,
  cafe: (
    <>
      <path d="M4 6h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V6Z" />
      <path d="M17 7h2.2a2 2 0 0 1 0 4H17" />
      <path d="M5.5 3.2 7 4.6M11 2.6l1.2 1.4" />
    </>
  ),
  deep: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M5 12a7 7 0 0 1 14 0M2.5 12A9.5 9.5 0 0 1 21.5 12" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 12.5h14a2.75 2.75 0 1 1-2.75 2.75" />
      <path d="M3 17h6.5" />
    </>
  ),
  fire: (
    <>
      <path d="M12 3.5s4.5 3.7 4.5 7.4a4.5 4.5 0 0 1-9 0c0-2.2 1.4-3.6 2.6-4.8" />
      <path d="M12 20.5a3 3 0 0 0 3-3c0-1.7-3-3.5-3-3.5s-3 1.8-3 3.5a3 3 0 0 0 3 3Z" />
    </>
  ),
  moon: (
    <>
      <path d="M20 14.6A8.5 8.5 0 0 1 9.4 4 8.5 8.5 0 1 0 20 14.6Z" />
      <path d="M16.5 4.5h.01" />
    </>
  ),
  wave: <path d="M2.5 12h2.2L6.4 7l2.6 10L11.6 5l2.6 9 1.6-4 1.7 2h4" />,
  drone: <path d="M2.5 12c3 0 3-5.5 6-5.5s3 11 6 11 3-5.5 6-5.5" />,
  layers: (
    <>
      <path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" />
      <path d="M3.5 12.5l8.5 4.5 8.5-4.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  keyboard: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  sparkles: (
    <path d="M12 3.5l1.6 4.2L18 9.3l-4.4 1.6L12 15l-1.6-4.1L6 9.3l4.4-1.6L12 3.5ZM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
  ),
};

export function Icon({
  name,
  className,
  strokeWidth = 1.8,
  filled = false,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? null}
    </svg>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "glass relative overflow-hidden rounded-3xl shadow-[0_18px_60px_-24px_rgba(0,0,0,0.9)]",
        padded && "p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  icon,
  title,
  hint,
  right,
}: {
  icon?: string;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 ring-1 ring-white/10">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
          {hint && <p className="text-[11.5px] text-white/45">{hint}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

export function Pill({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        tone === "accent"
          ? "bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/25"
          : "bg-white/[0.06] text-white/60 ring-1 ring-white/10",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function GhostButton({
  children,
  onClick,
  title,
  className,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium transition",
        active
          ? "bg-white/[0.13] text-white ring-1 ring-white/20"
          : "bg-white/[0.04] text-white/60 ring-1 ring-white/10 hover:bg-white/[0.09] hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white/[0.03] px-3.5 py-3 text-left ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]"
    >
      <span>
        <span className="block text-[13px] font-medium text-white/90">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-white/40">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "accent-grad" : "bg-white/12 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 90,
  suffix,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  label: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-2.5 ring-1 ring-white/[0.07]">
      <span className="text-[13px] text-white/80">{label}</span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => set(value - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
          aria-label={`decrease ${label}`}
        >
          −
        </button>
        <span className="tabular w-14 text-center text-[13px] font-semibold text-white">
          {value}
          {suffix}
        </span>
        <button
          type="button"
          onClick={() => set(value + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
          aria-label={`increase ${label}`}
        >
          +
        </button>
      </span>
    </div>
  );
}
