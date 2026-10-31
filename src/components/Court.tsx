"use client";

import { MatchRow, PlayerRow } from "@/lib/types";
import { LevelBadge } from "./ui";

interface Props {
  match: MatchRow;
  playerById: Map<string, PlayerRow>;
  highlightId?: string | null;
  onPlayerTap?: (playerId: string) => void;
  selectedId?: string | null;
  large?: boolean;
}

/** A court drawn as a white-lined rectangle: one pair each side of the net. */
export function Court({ match, playerById, highlightId, onPlayerTap, selectedId, large }: Props) {
  const scored = match.score_a != null && match.score_b != null;
  const name = (id: string) => {
    const p = playerById.get(id);
    const isMe = id === highlightId;
    const isSelected = id === selectedId;
    const content = (
      <span
        className={`flex items-center gap-1.5 ${isMe ? "rounded bg-white px-1.5 text-black" : ""} ${
          isSelected ? "rounded outline-2 outline-offset-2 outline-white outline-dashed" : ""
        }`}
      >
        {p && !isMe && (
          <span className="shrink-0">
            <LevelBadge level={p.level} />
          </span>
        )}
        {/* Long names wrap rather than being cut off. */}
        <span className="min-w-0 break-words leading-tight">{p?.name ?? "?"}</span>
      </span>
    );
    return onPlayerTap ? (
      <button type="button" className="min-h-9 max-w-full text-left" onClick={() => onPlayerTap(id)}>
        {content}
      </button>
    ) : (
      content
    );
  };
  const side = (ids: string[], score: number | null) => (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className={`min-w-0 space-y-1 font-semibold ${large ? "text-xl" : "text-base"}`}>
        {ids.map((id) => (
          <div key={id}>{name(id)}</div>
        ))}
      </div>
      <div className={`display shrink-0 tabular-nums ${large ? "text-4xl" : "text-3xl"} ${scored ? "" : "text-line"}`}>
        {scored ? score : "–"}
      </div>
    </div>
  );
  return (
    <div className="relative rounded-md border-2 border-white/80 bg-card">
      <div className="display absolute -top-3 left-3 bg-black px-2 text-xs">Court {match.court}</div>
      <div className="pt-2">{side([match.a1, match.a2], match.score_a)}</div>
      <div className="mx-2 border-t-2 border-dashed border-white/60" aria-hidden />
      {side([match.b1, match.b2], match.score_b)}
    </div>
  );
}
