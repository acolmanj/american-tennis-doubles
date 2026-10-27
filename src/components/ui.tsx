"use client";

import Image from "next/image";
import Link from "next/link";
import { Level, LEVEL_LABELS, LEVEL_VALUES } from "@/lib/types";

export function Crest({ size = 48 }: { size?: number }) {
  return <Image src="/crest.webp" alt="Charleville Lawn Tennis Club crest" width={size} height={size} priority />;
}

export function Header({ title, subtitle, back, wide }: { title?: string; subtitle?: string; back?: string; wide?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-black/95 backdrop-blur">
      <div className={`mx-auto flex ${wide ? "max-w-7xl" : "max-w-xl"} items-center gap-3 px-4 py-3`}>
        <Link href={back ?? "/"} aria-label="Back" className="shrink-0">
          <Crest size={44} />
        </Link>
        <div className="min-w-0">
          <p className="display text-xs text-muted">Charleville LTC</p>
          {title && <h1 className="display truncate text-lg leading-tight">{title}</h1>}
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

export function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-xl"} px-4 pb-16 pt-5`}>{children}</main>;
}

/** Level shown without colour: a circle filled by level (full = Proficient, empty = Beginner). */
export function LevelBadge({ level, showLabel }: { level: Level; showLabel?: boolean }) {
  const fill = LEVEL_VALUES[level] / 4;
  return (
    <span className="inline-flex items-center gap-1.5" title={LEVEL_LABELS[level]}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <defs>
          <clipPath id={`lv-${level}`}>
            <rect x="0" y={14 - 14 * fill} width="14" height={14 * fill} />
          </clipPath>
        </defs>
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="6" fill="currentColor" clipPath={`url(#lv-${level})`} />
      </svg>
      {showLabel && <span className="text-sm text-muted">{LEVEL_LABELS[level]}</span>}
    </span>
  );
}

export function TennisBall({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.5 5.5c3 2.5 3 10.5 0 13M19.5 5.5c-3 2.5-3 10.5 0 13" />
    </svg>
  );
}

export function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-muted">
      <TennisBall size={32} />
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl border-2 border-white px-4 py-3 font-semibold">
      {message}
    </p>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="display mb-3 mt-8 text-sm text-muted">{children}</h2>;
}
