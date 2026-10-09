// The PWA manifest registers LinkPaddy as a share target: the OS share sheet
// opens the app with ?title=&text=&url=. Android apps often put the link in
// `text` instead of `url`, so look in both.

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

export type SharedPayload = { url: string } | { text: string } | null;

export function extractShared(params: URLSearchParams): SharedPayload {
  const url = (params.get("url") ?? "").trim();
  if (/^https?:\/\//i.test(url)) return { url };

  const text = (params.get("text") ?? "").trim();
  const embedded = text.match(URL_PATTERN);
  if (embedded) return { url: embedded[0] };

  // A bare title (some apps share only that) is still worth sending as a note.
  const note = text || (params.get("title") ?? "").trim();
  return note ? { text: note } : null;
}
