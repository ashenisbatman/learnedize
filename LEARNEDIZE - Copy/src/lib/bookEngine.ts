// Multi-source book/scholarship search + native reading pipeline.
// Goal: render the *actual work* inside Achieved whenever legally possible.
// Sources: Project Gutenberg, Standard Ebooks, Open Library / Internet Archive,
// Google Books, arXiv, CrossRef.

export type Record = {
  id: string;
  title: string;
  author: string;
  year?: string;
  source: string;
  description?: string;
  readUrl?: string;
  textUrl?: string; // plain text endpoint when available
  htmlUrl?: string; // single-page HTML reader when available
  iaId?: string; // Internet Archive identifier
  cover?: string;
  kind: "book" | "paper";
};

// ---------- helpers ----------
const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Convert a chunk of HTML into clean reader text preserving paragraphs/headings. */
function htmlToReaderText(html: string): string {
  if (!html) return "";
  let h = html;
  // Drop noisy elements entirely
  h = h.replace(/<script[\s\S]*?<\/script>/gi, "");
  h = h.replace(/<style[\s\S]*?<\/style>/gi, "");
  h = h.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  h = h.replace(/<header[\s\S]*?<\/header>/gi, "");
  h = h.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  h = h.replace(/<aside[\s\S]*?<\/aside>/gi, "");
  h = h.replace(/<form[\s\S]*?<\/form>/gi, "");
  // Prefer the main reading region when present
  const main =
    h.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    h.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    h.match(/<section[^>]*id=["']?(text|content|book)["']?[\s\S]*?<\/section>/i)?.[0] ??
    h;
  // Promote headings and paragraphs to plain text with spacing
  let t = main
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n$1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n$1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n$1\n\n")
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n\n$1\n\n")
    .replace(/<\/(p|div|li|blockquote|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  t = stripHtml(t)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
  // Re-collapse the explicit paragraph breaks we inserted
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

async function tryFetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

// ---------- search adapters ----------
async function searchGutendex(q: string): Promise<Record[]> {
  try {
    const r = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const json = await r.json();
    return (json.results ?? []).map((b: any): Record => {
      const txt =
        b.formats?.["text/plain; charset=utf-8"] ||
        b.formats?.["text/plain"] ||
        b.formats?.["text/plain; charset=us-ascii"];
      const html = b.formats?.["text/html; charset=utf-8"] || b.formats?.["text/html"];
      return {
        id: `gut-${b.id}`,
        title: b.title,
        author: (b.authors ?? []).map((a: any) => a.name).join(", ") || "Unknown",
        source: "Project Gutenberg",
        readUrl: html || b.formats?.["application/epub+zip"],
        textUrl: txt,
        htmlUrl: html,
        cover: b.formats?.["image/jpeg"],
        kind: "book",
      };
    });
  } catch {
    return [];
  }
}

async function searchOpenLibrary(q: string): Promise<Record[]> {
  try {
    const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=50`);
    if (!r.ok) return [];
    const json = await r.json();
    return (json.docs ?? []).map((d: any): Record => {
      const ia = d.ia?.[0];
      return {
        id: `ol-${d.key}`,
        title: d.title,
        author: (d.author_name ?? []).join(", ") || "Unknown",
        year: d.first_publish_year?.toString(),
        source: "Open Library",
        readUrl: ia ? `https://archive.org/details/${ia}` : `https://openlibrary.org${d.key}`,
        iaId: ia,
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
        kind: "book",
      };
    });
  } catch {
    return [];
  }
}

async function searchGoogleBooks(q: string): Promise<Record[]> {
  try {
    const r = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=40`,
    );
    if (!r.ok) return [];
    const json = await r.json();
    return (json.items ?? []).map((b: any): Record => ({
      id: `gb-${b.id}`,
      title: b.volumeInfo?.title ?? "Untitled",
      author: (b.volumeInfo?.authors ?? []).join(", ") || "Unknown",
      year: (b.volumeInfo?.publishedDate ?? "").slice(0, 4) || undefined,
      source: "Google Books",
      description: b.volumeInfo?.description ? stripHtml(b.volumeInfo.description) : undefined,
      readUrl: b.volumeInfo?.previewLink,
      cover: b.volumeInfo?.imageLinks?.thumbnail?.replace("http://", "https://"),
      kind: "book",
    }));
  } catch {
    return [];
  }
}

async function searchStandardEbooks(q: string): Promise<Record[]> {
  try {
    const r = await fetch(`https://standardebooks.org/ebooks/?query=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const html = await r.text();
    const re = /<a href="(\/ebooks\/[^"]+)"[^>]*>([^<]{3,120})<\/a>/g;
    const found: Record[] = [];
    let m;
    while ((m = re.exec(html)) && found.length < 40) {
      if (!/\/ebooks\/[a-z-]+\/[a-z-]+/.test(m[1])) continue;
      const base = `https://standardebooks.org${m[1]}`;
      found.push({
        id: `se-${m[1]}`,
        title: m[2].trim(),
        author: m[1].split("/")[2]?.replace(/-/g, " ") ?? "Unknown",
        source: "Standard Ebooks",
        readUrl: base,
        htmlUrl: `${base}/text/single-page`,
        kind: "book",
      });
    }
    return found;
  } catch {
    return [];
  }
}

async function searchArxiv(q: string): Promise<Record[]> {
  try {
    const r = await fetch(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=50`,
    );
    if (!r.ok) return [];
    const text = await r.text();
    const entries = text.split("<entry>").slice(1);
    return entries.map((e): Record => {
      const get = (tag: string) =>
        e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? "";
      const id = get("id");
      return {
        id: `arx-${id}`,
        title: stripHtml(get("title")),
        author: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]).join(", ") || "Unknown",
        year: get("published").slice(0, 4),
        source: "arXiv",
        description: stripHtml(get("summary")),
        readUrl: id,
        kind: "paper",
      };
    });
  } catch {
    return [];
  }
}

async function searchCrossref(q: string): Promise<Record[]> {
  try {
    const r = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=50`);
    if (!r.ok) return [];
    const json = await r.json();
    return (json.message?.items ?? []).map((it: any): Record => ({
      id: `cr-${it.DOI}`,
      title: Array.isArray(it.title) ? it.title[0] : "Untitled",
      author:
        (it.author ?? [])
          .map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim())
          .join(", ") || "Unknown",
      year: it.issued?.["date-parts"]?.[0]?.[0]?.toString(),
      source: it["container-title"]?.[0] || "CrossRef",
      description: it.abstract ? stripHtml(it.abstract) : undefined,
      readUrl: it.URL,
      kind: "paper",
    }));
  } catch {
    return [];
  }
}

// ---------- search orchestration ----------
export async function searchArchive(
  q: string,
  filter: "all" | "papers" | "books",
): Promise<Record[]> {
  if (!q.trim()) return [];
  const tasks: Promise<Record[]>[] = [];
  if (filter === "books" || filter === "all") {
    tasks.push(searchGutendex(q), searchOpenLibrary(q), searchGoogleBooks(q), searchStandardEbooks(q));
  }
  if (filter === "papers" || filter === "all") {
    tasks.push(searchArxiv(q), searchCrossref(q));
  }
  return (await Promise.all(tasks)).flat();
}

export async function searchArchiveStream(
  q: string,
  filter: "all" | "papers" | "books",
  onChunk: (chunk: Record[]) => void,
): Promise<void> {
  if (!q.trim()) return;
  const tasks: Promise<Record[]>[] = [];
  if (filter === "books" || filter === "all") {
    tasks.push(searchGutendex(q), searchOpenLibrary(q), searchGoogleBooks(q), searchStandardEbooks(q));
  }
  if (filter === "papers" || filter === "all") {
    tasks.push(searchArxiv(q), searchCrossref(q));
  }
  await Promise.allSettled(
    tasks.map((t) =>
      t.then((chunk) => {
        if (chunk.length) onChunk(chunk);
      }),
    ),
  );
}

// ---------- reading pipeline ----------
export type ReadingResource =
  | { mode: "text"; text: string }
  | { mode: "structured"; sections: { heading: string; body: string }[] }
  | { mode: "embed"; embedUrl: string }
  | { mode: "fallback"; text: string };

/** Legacy helper retained for compatibility. */
export async function fetchReadingText(rec: Record): Promise<string> {
  const r = await resolveReading(rec);
  if (r.mode === "text" || r.mode === "fallback") return r.text;
  if (r.mode === "structured") return r.sections.map((s) => `${s.heading}\n\n${s.body}`).join("\n\n");
  return academicFallback(rec);
}

/**
 * Priority order:
 *   1) Native rendered content (plain text / extracted HTML / structured paper)
 *   2) Embedded reader (only when no text can be extracted)
 *   3) Editorial fallback (only when nothing readable exists)
 */
export async function resolveReading(rec: Record): Promise<ReadingResource> {
  // ----- Project Gutenberg: plain-text first, then HTML extraction -----
  if (rec.id.startsWith("gut-")) {
    if (rec.textUrl) {
      const txt = await tryFetchText(rec.textUrl);
      if (txt && !looksLikeHtml(txt)) {
        return { mode: "text", text: cleanGutenbergText(txt).slice(0, 600_000) };
      }
    }
    if (rec.htmlUrl) {
      const html = await tryFetchText(rec.htmlUrl);
      if (html) {
        const t = htmlToReaderText(html);
        if (t.length > 500) return { mode: "text", text: t.slice(0, 600_000) };
      }
    }
  }

  // ----- Standard Ebooks: extract single-page HTML reader -----
  if (rec.id.startsWith("se-") && rec.htmlUrl) {
    const html = await tryFetchText(rec.htmlUrl);
    if (html) {
      const t = htmlToReaderText(html);
      if (t.length > 500) return { mode: "text", text: t.slice(0, 800_000) };
    }
  }

  // ----- Open Library / Internet Archive: stream the OCR'd plain text -----
  if (rec.id.startsWith("ol-") && rec.iaId) {
    const candidates = [
      `https://archive.org/stream/${rec.iaId}/${rec.iaId}_djvu.txt`,
      `https://archive.org/download/${rec.iaId}/${rec.iaId}_djvu.txt`,
    ];
    for (const url of candidates) {
      const txt = await tryFetchText(url);
      if (txt && !looksLikeHtml(txt) && txt.length > 500) {
        return { mode: "text", text: txt.slice(0, 600_000) };
      }
      if (txt && looksLikeHtml(txt)) {
        const t = htmlToReaderText(txt);
        if (t.length > 500) return { mode: "text", text: t.slice(0, 600_000) };
      }
    }
  }

  // ----- arXiv: structured paper view (title / authors / abstract) -----
  if (rec.id.startsWith("arx-") && rec.description) {
    return {
      mode: "structured",
      sections: [
        { heading: "Abstract", body: rec.description },
        {
          heading: "About this paper",
          body:
            `${rec.title} by ${rec.author}${rec.year ? ` (${rec.year})` : ""}. ` +
            `Hosted by arXiv. The full PDF and source files are available via "Read Original".`,
        },
      ],
    };
  }

  // ----- CrossRef: abstract when publisher allows -----
  if (rec.id.startsWith("cr-") && rec.description) {
    return {
      mode: "structured",
      sections: [
        { heading: "Abstract", body: rec.description },
        {
          heading: "Publication",
          body: `${rec.source}${rec.year ? ` · ${rec.year}` : ""}. Authors: ${rec.author}.`,
        },
      ],
    };
  }

  // ----- Google Books: publisher-provided description as readable view -----
  if (rec.id.startsWith("gb-") && rec.description) {
    return {
      mode: "structured",
      sections: [
        { heading: "Overview", body: rec.description },
        {
          heading: "About this edition",
          body: `${rec.title} by ${rec.author}${rec.year ? ` (${rec.year})` : ""}. Google Books may offer a partial preview via "Read Original".`,
        },
      ],
    };
  }

  // ----- Last-resort: embed if we have a readable URL -----
  const embed = embeddableUrl(rec);
  if (embed) return { mode: "embed", embedUrl: embed };

  // ----- Nothing usable: editorial overview -----
  return { mode: "fallback", text: academicFallback(rec) };
}

function looksLikeHtml(s: string): boolean {
  const t = s.trimStart().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || /<head[> ]/.test(t);
}

function cleanGutenbergText(t: string): string {
  // Drop Project Gutenberg legal boilerplate at top/bottom when present.
  const startRe = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\*]*\*\*\*/i;
  const endRe = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG[^\*]*\*\*\*/i;
  const s = t.search(startRe);
  const e = t.search(endRe);
  let body = t;
  if (s >= 0) body = body.slice(s).replace(startRe, "").trimStart();
  if (e >= 0) body = body.slice(0, body.search(endRe)).trimEnd();
  return body;
}

/** Return an iframe-embeddable URL. Only used as a deep fallback. */
export function embeddableUrl(rec: Record): string | null {
  if (rec.id.startsWith("ol-") && rec.readUrl?.includes("archive.org/details/")) {
    const ident = rec.readUrl.split("archive.org/details/")[1]?.split(/[?#/]/)[0];
    if (ident) return `https://archive.org/embed/${ident}`;
  }
  if (rec.id.startsWith("arx-") && rec.readUrl) {
    const pdf = rec.readUrl.replace(/^http:\/\//, "https://").replace("/abs/", "/pdf/");
    return pdf.endsWith(".pdf") ? pdf : `${pdf}.pdf`;
  }
  return null;
}

export function academicFallback(rec: Record): string {
  const title = rec.title;
  const author = rec.author;
  const year = rec.year ? ` (${rec.year})` : "";
  return `${title}${year}
by ${author}
Source: ${rec.source}

— EDITORIAL OVERVIEW —

${rec.description ?? `"${title}" is preserved in the Learnedize archive. The full readable text is not currently available from this source; the original may be consulted via "Read Original".`}`;
}
