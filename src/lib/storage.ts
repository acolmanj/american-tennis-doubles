"use client";

import { useSyncExternalStore } from "react";

// Browser storage can be unavailable (private mode, blocked site data), so every access is guarded.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Ignore: the app still works for this page view.
  }
  window.dispatchEvent(new Event("ad-storage"));
}

function subscribe(onChange: () => void) {
  window.addEventListener("ad-storage", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("ad-storage", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A stored value that re-renders when it changes; null while rendering on the server. */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}

const ORGANIZER_KEY = "ad.organizerKey";

export function getOrganizerKey() {
  return read(ORGANIZER_KEY);
}

export function setOrganizerKey(key: string | null) {
  write(ORGANIZER_KEY, key);
}

export function useOrganizerKey() {
  return useStoredValue(ORGANIZER_KEY);
}

export const tokensKey = (eventId: string) => `ad.tokens.${eventId}`;
export const meKey = (eventId: string) => `ad.me.${eventId}`;

export function parseTokens(raw: string | null): Record<string, string> {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
}

/** Tokens for the players checked in on this phone, by player id. */
export function getTokens(eventId: string): Record<string, string> {
  return parseTokens(read(tokensKey(eventId)));
}

export function addTokens(eventId: string, tokens: Record<string, string>) {
  write(tokensKey(eventId), JSON.stringify({ ...getTokens(eventId), ...tokens }));
}

export function setMe(eventId: string, playerId: string) {
  write(meKey(eventId), playerId);
}
