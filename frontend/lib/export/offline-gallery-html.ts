import type { ExportPayloadPost } from "@/lib/actions/export";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDe(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** Standalone Offline-Galerie (dunkles Grid, keine externen Assets). */
export function buildOfflineGalleryHtml(
  projectName: string,
  posts: readonly ExportPayloadPost[],
): string {
  const cards = posts
    .map((p) => {
      const cap = p.caption
        ? `<p class="caption">${escapeHtml(p.caption)}</p>`
        : "";
      const commentsHtml =
        p.comments.length === 0
          ? '<p class="muted">Keine Kommentare.</p>'
          : `<ul class="comments">${p.comments
              .map(
                (c) =>
                  `<li><span class="c-user">${escapeHtml(c.user.username)}</span> · ${escapeHtml(c.content)} · <span class="muted">${formatDe(c.created_at)}</span> · ♥ ${c.like_count}</li>`,
              )
              .join("")}</ul>`;

      return `
<article class="card">
  <div class="meta">
    <span class="author">${escapeHtml(p.user.username)}</span>
    <span class="muted">${formatDe(p.created_at)}</span>
  </div>
  <div class="img-wrap">
    <img src="./images/${p.id}.jpg" alt="Meme" width="600" height="800" decoding="async" />
  </div>
  ${cap}
  <div class="likes">♥ ${p.like_count} Likes</div>
  <div class="comments-wrap">
    <h3>Kommentare</h3>
    ${commentsHtml}
  </div>
</article>`;
    })
    .join("\n");

  const empty =
    posts.length === 0
      ? '<p class="empty">Keine Memes in diesem Export.</p>'
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(projectName)} – Meme-Galerie</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #18181b;
    color: #f4f4f5;
    line-height: 1.5;
    padding: 24px 16px 48px;
  }
  header {
    max-width: 1200px;
    margin: 0 auto 28px;
    border-bottom: 1px solid #27272a;
    padding-bottom: 16px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 1.5rem;
    font-weight: 700;
    color: #fafafa;
  }
  .subtitle { color: #a1a1aa; font-size: 0.9rem; }
  .grid {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 28px;
  }
  @media (min-width: 640px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
  .card {
    background: #27272a;
    border: 1px solid #27272a;
    border-radius: 12px;
    overflow: hidden;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 0.85rem;
  }
  .author { font-weight: 600; color: #fb923c; }
  .muted { color: #71717a; font-size: 0.8rem; }
  .img-wrap {
    border-radius: 8px;
    overflow: hidden;
    background: #27272a;
    aspect-ratio: 3 / 4;
  }
  .img-wrap img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .caption {
    margin: 0;
    font-size: 0.95rem;
    color: #e4e4e7;
  }
  .likes {
    font-size: 0.85rem;
    color: #a1a1aa;
  }
  .comments-wrap h3 {
    margin: 0 0 6px;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #71717a;
  }
  .comments {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.82rem;
    max-height: 160px;
    overflow-y: auto;
  }
  .comments li {
    padding: 6px 0;
    border-top: 1px solid #27272a;
    color: #d4d4d8;
  }
  .comments li:first-child { border-top: none; padding-top: 0; }
  .c-user { font-weight: 600; color: #fdba74; }
  .empty {
    text-align: center;
    color: #71717a;
    padding: 48px 16px;
    grid-column: 1 / -1;
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(projectName)}</h1>
  <p class="subtitle">Offline-Export · ZIP zuerst entpacken, dann diese Datei öffnen (nicht aus dem Archiv-Viewer).</p>
</header>
<main class="grid">
${empty}
${cards}
</main>
</body>
</html>`;
}
