"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Gender, GENDER_LABELS, Level, LEVEL_LABELS, MemberRow } from "@/lib/types";
import { LevelBadge } from "./ui";

let cache: Promise<MemberRow[]> | null = null;

/** Everyone who has played at the club before, with their last Male/Female and level. */
export function useMembers(): MemberRow[] {
  const [members, setMembers] = useState<MemberRow[]>([]);
  useEffect(() => {
    cache ??= Promise.resolve(
      supabase
        .from("members")
        .select("id, name, gender, level")
        .order("name")
        .then(({ data }) => (data as MemberRow[]) ?? []),
    );
    let live = true;
    cache.then((m) => live && setMembers(m));
    return () => {
      live = false;
    };
  }, []);
  return members;
}

/** Compares names ignoring case, spacing and accents, so "sean" finds "Seán". */
export const nameKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * A name box that suggests players the club already knows. Picking one, or typing a
 * known name in full, fills in their Male/Female and level from last time.
 */
export function NameField({
  value,
  onChange,
  onRemembered,
  placeholder,
  autoFocus,
  exclude,
}: {
  value: string;
  onChange: (name: string) => void;
  onRemembered: (gender: Gender, level: Level) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Names to leave out of the suggestions, such as players already signed up tonight. */
  exclude?: Set<string>;
}) {
  const members = useMembers();
  const [focused, setFocused] = useState(false);
  const key = nameKey(value);

  const suggestions = useMemo(() => {
    if (key.length < 2) return [];
    return members
      .filter((m) => {
        const k = nameKey(m.name);
        return k !== key && !exclude?.has(k) && (k.startsWith(key) || k.includes(` ${key}`));
      })
      .slice(0, 5);
  }, [members, key, exclude]);

  function pick(m: MemberRow) {
    onChange(m.name);
    onRemembered(m.gender, m.level);
    setFocused(false);
  }

  function type(text: string) {
    onChange(text);
    const exact = members.find((m) => nameKey(m.name) === nameKey(text));
    if (exact) onRemembered(exact.gender, exact.level);
  }

  return (
    <div className="relative">
      <input
        className="field"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={80}
        onChange={(e) => type(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border-2 border-white bg-black">
          {suggestions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left hover:bg-raised"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
              >
                <span className="font-semibold">{m.name}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {GENDER_LABELS[m.gender]} · <LevelBadge level={m.level} /> {LEVEL_LABELS[m.level]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
