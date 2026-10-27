export function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}
