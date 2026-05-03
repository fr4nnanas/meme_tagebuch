import type {
  ExportPayloadPost,
  ExportPayloadUser,
} from "@/lib/actions/export";
import { fullStarsFromAverage } from "@/lib/meme/star-display";

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

function avatarThumbHtml(
  user: ExportPayloadUser,
  avatarRelByUserId: ReadonlyMap<string, string>,
  size: "card" | "comment",
): string {
  const rel = user.id ? avatarRelByUserId.get(user.id) : undefined;
  const alt = `Profilbild ${user.username}`;
  const cls =
    size === "card" ? "avatar-thumb-wrap lightbox-trigger" : "avatar-sm-wrap lightbox-trigger";
  const aria = escapeHtml(`${alt} vergrößern`);
  if (rel) {
    return `<span class="${cls}" role="button" tabindex="0" aria-label="${aria}">
    <img src="${escapeHtml(rel)}" alt="${escapeHtml(alt)}" width="40" height="40" decoding="async" />
  </span>`;
  }
  const initial = escapeHtml(
    user.username.trim().charAt(0).toUpperCase() || "?",
  );
  const phCls = size === "card" ? "avatar-placeholder" : "avatar-placeholder avatar-placeholder-sm";
  return `<span class="${phCls}" aria-hidden="true">${initial}</span>`;
}

function buildExportScoreboardSection(
  posts: readonly ExportPayloadPost[],
  avatarRelByUserId: ReadonlyMap<string, string>,
): string {
  const byUser = new Map<string, { user: ExportPayloadUser; count: number }>();
  for (const p of posts) {
    const id = p.user.id;
    const prev = byUser.get(id);
    if (prev) prev.count += 1;
    else byUser.set(id, { user: p.user, count: 1 });
  }
  const rows = [...byUser.values()].sort((a, b) => b.count - a.count);
  if (rows.length === 0) return "";

  function rankCell(rank: number): string {
    if (rank === 1) {
      return `<span class="medal medal-gold" title="Platz 1">🥇</span><span class="sr-only">Platz 1</span>`;
    }
    if (rank === 2) {
      return `<span class="medal medal-silver" title="Platz 2">🥈</span><span class="sr-only">Platz 2</span>`;
    }
    if (rank === 3) {
      return `<span class="medal medal-bronze" title="Platz 3">🥉</span><span class="sr-only">Platz 3</span>`;
    }
    return `<span class="medal medal-num">${rank}</span>`;
  }

  const body = rows
    .map((r, i) => {
      const rank = i + 1;
      return `<tr>
  <td class="sb-rank">${rankCell(rank)}</td>
  <td class="sb-user"><span class="sb-av">${avatarThumbHtml(r.user, avatarRelByUserId, "comment")}</span><span class="sb-name">${escapeHtml(r.user.username)}</span></td>
  <td class="sb-count">${r.count}</td>
</tr>`;
    })
    .join("\n");

  return `<section class="scoreboard" aria-labelledby="sb-title">
  <h2 id="sb-title">Meme-Scoreboard</h2>
  <p class="sb-sub">Anzahl veröffentlichter Memes pro Person in diesem Export.</p>
  <table class="sb-table">
    <thead><tr><th scope="col">Rang</th><th scope="col">Person</th><th scope="col">Memes</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
</section>`;
}

/** Standalone Offline-Galerie (dunkles Grid, keine externen Assets). */
export function buildOfflineGalleryHtml(
  projectName: string,
  posts: readonly ExportPayloadPost[],
  avatarRelByUserId: ReadonlyMap<string, string> = new Map(),
): string {
  const scoreboardHtml = buildExportScoreboardSection(posts, avatarRelByUserId);

  const cards = posts
    .map((p) => {
      const fullStars = fullStarsFromAverage(p.star_rating_avg);
      const avgTitle =
        p.star_rating_avg != null && p.star_rating_count > 0
          ? `Ø ${Number(p.star_rating_avg).toFixed(2)} (${p.star_rating_count} Bewertung${p.star_rating_count === 1 ? "" : "en"})`
          : "Noch keine Bewertung";
      const stars =
        fullStars > 0
          ? `<span class="stars" title="${escapeHtml(avgTitle)}">${"★".repeat(fullStars)}<span class="stars-empty">${"☆".repeat(5 - fullStars)}</span></span>`
          : "";
      const cap = p.caption
        ? `<p class="caption">${escapeHtml(p.caption)}</p>`
        : "";
      const gen =
        p.pipeline_input_text && p.pipeline_input_text.trim()
          ? `<p class="gen-prompt"><span class="gen-label">Erzeugung</span> ${escapeHtml(p.pipeline_input_text.trim())}</p>`
          : "";
      const commentsHtml =
        p.comments.length === 0
          ? '<p class="muted">Keine Kommentare.</p>'
          : `<ul class="comments">${p.comments
              .map(
                (c) =>
                  `<li class="comment-row">${avatarThumbHtml(c.user, avatarRelByUserId, "comment")}<span class="comment-text"><span class="c-user">${escapeHtml(c.user.username)}</span> · ${escapeHtml(c.content)} · <span class="muted">${formatDe(c.created_at)}</span> · ♥ ${c.like_count}</span></li>`,
              )
              .join("")}</ul>`;

      return `
<article class="card">
  <div class="meta">
    <div class="author-row">
      ${avatarThumbHtml(p.user, avatarRelByUserId, "card")}
      <span class="author">${escapeHtml(p.user.username)}</span>
    </div>
    <div class="meta-aside">
      <span class="muted meta-date">${formatDe(p.created_at)}</span>
      ${stars ? `<span class="meta-stars">${stars}</span>` : ""}
    </div>
  </div>
  <div class="img-wrap lightbox-trigger" role="button" tabindex="0" aria-label="Foto vergrößern">
    <img src="./images/${p.id}.jpg" alt="Meme" width="600" height="800" decoding="async" />
  </div>
  ${gen}
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
  .hint { color: #71717a; font-size: 0.85rem; margin: 8px 0 0; }
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
    align-items: center;
    gap: 12px;
    font-size: 0.85rem;
  }
  .author-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .author {
    font-weight: 600;
    color: #fb923c;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-aside {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  .meta-date { text-align: right; }
  .meta-stars { font-size: 0.95rem; line-height: 1; }
  .stars { color: #fbbf24; letter-spacing: 1px; }
  .stars-empty { opacity: 0.35; }
  .muted { color: #71717a; font-size: 0.8rem; }
  .avatar-thumb-wrap,
  .avatar-sm-wrap {
    flex-shrink: 0;
    border-radius: 999px;
    overflow: hidden;
    background: #3f3f46;
    cursor: zoom-in;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .avatar-thumb-wrap {
    width: 36px;
    height: 36px;
  }
  .avatar-sm-wrap {
    width: 28px;
    height: 28px;
    margin-top: 1px;
  }
  .avatar-thumb-wrap:focus-visible,
  .avatar-sm-wrap:focus-visible {
    outline: 2px solid #fb923c;
    outline-offset: 2px;
  }
  .avatar-thumb-wrap img,
  .avatar-sm-wrap img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  .avatar-placeholder,
  .avatar-placeholder-sm {
    flex-shrink: 0;
    border-radius: 999px;
    background: #3f3f46;
    color: #fafafa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }
  .avatar-placeholder {
    width: 36px;
    height: 36px;
    font-size: 0.85rem;
  }
  .avatar-placeholder-sm {
    width: 28px;
    height: 28px;
    font-size: 0.72rem;
    margin-top: 1px;
  }
  .img-wrap {
    border-radius: 8px;
    overflow: hidden;
    background: #27272a;
    aspect-ratio: 3 / 4;
    cursor: zoom-in;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .img-wrap:focus-visible {
    outline: 2px solid #fb923c;
    outline-offset: 2px;
  }
  .img-wrap img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    pointer-events: none;
  }
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.92);
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    display: none;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }
  .lightbox.is-open {
    display: flex;
  }
  .lightbox-inner {
    position: relative;
    max-width: min(96vw, 1400px);
    max-height: 92vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lightbox-inner img {
    display: block;
    max-width: 100%;
    max-height: 92vh;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }
  .lightbox-close {
    position: absolute;
    top: -8px;
    right: -8px;
    z-index: 2;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 999px;
    background: #27272a;
    color: #fafafa;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
  .lightbox-close:hover {
    background: #3f3f46;
  }
  .caption {
    margin: 0;
    font-size: 0.95rem;
    color: #e4e4e7;
  }
  .gen-prompt {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: #a1a1aa;
  }
  .gen-label {
    display: block;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #71717a;
    margin-bottom: 2px;
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
  .comments li,
  .comments .comment-row {
    padding: 6px 0;
    border-top: 1px solid #27272a;
    color: #d4d4d8;
  }
  .comments .comment-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    list-style: none;
  }
  .comments li:first-child,
  .comments .comment-row:first-child {
    border-top: none;
    padding-top: 0;
  }
  .comment-text { min-width: 0; flex: 1; }
  .c-user { font-weight: 600; color: #fdba74; }
  .empty {
    text-align: center;
    color: #71717a;
    padding: 48px 16px;
    grid-column: 1 / -1;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .scoreboard {
    max-width: 1200px;
    margin: 0 auto 28px;
    padding: 0 16px;
  }
  .scoreboard h2 {
    margin: 0 0 6px;
    font-size: 1.15rem;
    font-weight: 700;
    color: #fafafa;
  }
  .sb-sub {
    margin: 0 0 14px;
    font-size: 0.85rem;
    color: #a1a1aa;
  }
  .sb-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    background: #27272a;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #3f3f46;
  }
  .sb-table th {
    text-align: left;
    padding: 10px 14px;
    background: #18181b;
    color: #a1a1aa;
    font-weight: 600;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sb-table td {
    padding: 10px 14px;
    border-top: 1px solid #3f3f46;
    vertical-align: middle;
  }
  .sb-rank { width: 4rem; text-align: center; }
  .sb-user {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sb-av { flex-shrink: 0; display: flex; align-items: center; }
  .sb-name { font-weight: 600; color: #fb923c; }
  .sb-count { text-align: right; font-variant-numeric: tabular-nums; color: #e4e4e7; }
  .medal { font-size: 1.35rem; line-height: 1; }
  .medal-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.75rem;
    height: 1.75rem;
    border-radius: 8px;
    background: #3f3f46;
    color: #d4d4d8;
    font-size: 0.8rem;
    font-weight: 700;
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(projectName)}</h1>
  <p class="subtitle">Offline-Export · ZIP zuerst entpacken, dann diese Datei öffnen (nicht aus dem Archiv-Viewer).</p>
  <p class="hint">Tipp: Auf ein Meme oder Profilbild tippen oder klicken, um es groß anzuzeigen.</p>
</header>
${scoreboardHtml}
<main class="grid">
${empty}
${cards}
</main>
<div id="lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Vergrößertes Foto" hidden>
  <div class="lightbox-inner">
    <button type="button" class="lightbox-close" id="lightbox-close" aria-label="Schließen">×</button>
    <img id="lightbox-img" alt="" />
  </div>
</div>
<script>
(function () {
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightbox-img");
  var closeBtn = document.getElementById("lightbox-close");
  if (!lb || !lbImg || !closeBtn) return;

  function openLightbox(src, alt) {
    lbImg.src = src;
    lbImg.alt = alt || "";
    lb.removeAttribute("hidden");
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeLightbox() {
    lb.setAttribute("hidden", "");
    lb.classList.remove("is-open");
    lbImg.removeAttribute("src");
    lbImg.alt = "";
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".lightbox-trigger").forEach(function (wrap) {
    var img = wrap.querySelector("img");
    if (!img) return;
    wrap.addEventListener("click", function () {
      openLightbox(img.src, img.alt);
    });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(img.src, img.alt);
      }
    });
  });

  lb.addEventListener("click", function (e) {
    if (e.target === lb) closeLightbox();
  });
  closeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lb.classList.contains("is-open")) closeLightbox();
  });
})();
</script>
</body>
</html>`;
}
