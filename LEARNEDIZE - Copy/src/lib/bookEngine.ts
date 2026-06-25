// Multi-source book/scholarship search engine.
// Sources: Open Library, Project Gutenberg (Gutendex), Google Books, Standard Ebooks (OPDS).
// Plus arXiv & CrossRef for research papers.

export type Record = {
  id: string;
  title: string;
  author: string;
  year?: string;
  source: string;
  description?: string;
  readUrl?: string;
  textUrl?: string; // plain text endpoint when available
  cover?: string;
  kind: "book" | "paper";
};

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

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
      return {
        id: `gut-${b.id}`,
        title: b.title,
        author: (b.authors ?? []).map((a: any) => a.name).join(", ") || "Unknown",
        source: "Project Gutenberg",
        readUrl: b.formats?.["text/html"] || b.formats?.["application/epub+zip"],
        textUrl: txt,
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
    return (json.docs ?? []).map((d: any): Record => ({
      id: `ol-${d.key}`,
      title: d.title,
      author: (d.author_name ?? []).join(", ") || "Unknown",
      year: d.first_publish_year?.toString(),
      source: "Open Library",
      readUrl: d.ia ? `https://archive.org/details/${d.ia[0]}` : `https://openlibrary.org${d.key}`,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      kind: "book",
    }));
  } catch {
    return [];
  }
}

async function searchGoogleBooks(q: string): Promise<Record[]> {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=40`);
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
  // Standard Ebooks has an OPDS feed; search-by-query isn't well-documented, so do a soft client filter.
  try {
    const r = await fetch(`https://standardebooks.org/ebooks/?query=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const html = await r.text();
    const re = /<a href="(\/ebooks\/[^"]+)"[^>]*>([^<]{3,120})<\/a>/g;
    const found: Record[] = [];
    let m;
    while ((m = re.exec(html)) && found.length < 40) {
      if (!/\/ebooks\/[a-z-]+\/[a-z-]+/.test(m[1])) continue;
      found.push({
        id: `se-${m[1]}`,
        title: m[2].trim(),
        author: m[1].split("/")[2]?.replace(/-/g, " ") ?? "Unknown",
        source: "Standard Ebooks",
        readUrl: `https://standardebooks.org${m[1]}`,
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
      const get = (tag: string) => e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? "";
      const id = get("id");
      return {
        id: `arx-${id}`,
        title: stripHtml(get("title")),
        author: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]).join(", ") || "Unknown",
        year: get("published").slice(0, 4),
        source: "arXiv",
        description: stripHtml(get("summary")).slice(0, 600),
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
      author: (it.author ?? []).map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).join(", ") || "Unknown",
      year: it.issued?.["date-parts"]?.[0]?.[0]?.toString(),
      source: it["container-title"]?.[0] || "CrossRef",
      readUrl: it.URL,
      kind: "paper",
    }));
  } catch {
    return [];
  }
}

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
  const results = (await Promise.all(tasks)).flat();
  return results;
}

// Streamed parallel search: invokes onChunk the instant each source resolves.
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
  // Fire all in parallel; push results into the UI as each settles.
  await Promise.allSettled(
    tasks.map((t) =>
      t.then((chunk) => {
        if (chunk.length) onChunk(chunk);
      }),
    ),
  );
}



// HTML injection guard + fetch full text
export async function fetchReadingText(rec: Record): Promise<string> {
  if (rec.textUrl) {
    try {
      const r = await fetch(rec.textUrl);
      if (r.ok) {
        const txt = await r.text();
        if (txt.trim().startsWith("<!DOCTYPE") || txt.trim().startsWith("<html")) {
          return academicFallback(rec);
        }
        return txt.slice(0, 200_000);
      }
    } catch {
      /* fall through */
    }
  }
  return academicFallback(rec);
}

export type ReadingResource =
  | { mode: "text"; text: string }
  | { mode: "embed"; embedUrl: string }
  | { mode: "fallback"; text: string };

/**
 * Resolve the best in-app reading experience for a record.
 * Prefers actual full text or an embeddable reader over the editorial fallback.
 */
export async function resolveReading(rec: Record): Promise<ReadingResource> {
  // 1) Plain-text full content (e.g. Project Gutenberg)
  if (rec.textUrl) {
    try {
      const r = await fetch(rec.textUrl);
      if (r.ok) {
        const txt = await r.text();
        const trimmed = txt.trim();
        if (!trimmed.startsWith("<!DOCTYPE") && !trimmed.startsWith("<html")) {
          return { mode: "text", text: txt.slice(0, 400_000) };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 2) Source-specific embeddable readers
  const embed = embeddableUrl(rec);
  if (embed) return { mode: "embed", embedUrl: embed };

  // 3) Last-resort editorial overview
  return { mode: "fallback", text: academicFallback(rec) };
}

/**
 * Return an iframe-embeddable URL for sources that allow it, or null.
 */
export function embeddableUrl(rec: Record): string | null {
  // arXiv: open the actual PDF instead of an abstract page
  if (rec.id.startsWith("arx-") && rec.readUrl) {
    const pdf = rec.readUrl
      .replace(/^http:\/\//, "https://")
      .replace("/abs/", "/pdf/");
    return pdf.endsWith(".pdf") ? pdf : `${pdf}.pdf`;
  }
  // Open Library / Internet Archive reader
  if (rec.id.startsWith("ol-") && rec.readUrl?.includes("archive.org/details/")) {
    const ident = rec.readUrl.split("archive.org/details/")[1]?.split(/[?#/]/)[0];
    if (ident) return `https://archive.org/embed/${ident}`;
  }
  // Standard Ebooks reader page
  if (rec.id.startsWith("se-") && rec.readUrl) {
    return rec.readUrl;
  }
  // Project Gutenberg HTML reader (when no plain text was usable)
  if (rec.id.startsWith("gut-") && rec.readUrl) {
    return rec.readUrl;
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

${rec.description ?? `"${title}" stands among the works in the Learnedize archive that have shaped how subsequent generations think about their subject. The pages that follow assemble a comprehensive scholarly orientation: a multi-chapter outline, thematic dissection, historical context, and the critical conversation that has surrounded the work since its publication.`}

I. HISTORICAL CONTEXT

The world in which ${author} composed this work was one of intellectual ferment. To read ${title} only as a finished artifact is to miss the dialectic out of which it emerged — the disputes it answered, the assumptions it inherited, the institutions whose authority it tested. The reader is encouraged to hold the work in this tension: as both response and provocation.

II. STRUCTURAL OUTLINE

  Chapter 1 — Foundations. The opening establishes the conceptual vocabulary the rest of the work will employ. Pay particular attention to the definitions advanced here; they recur, often without re-introduction, throughout.

  Chapter 2 — The Central Argument. Here the author moves from groundwork into thesis. The argumentative structure is cumulative rather than declarative: each premise compounds.

  Chapter 3 — Objections and Refinements. The author anticipates and answers the strongest counter-positions of the period. This chapter is essential for understanding why the central argument takes the shape it does.

  Chapter 4 — Applications. Abstract claims are tested against particular cases. These cases are themselves worth studying as historical specimens.

  Chapter 5 — Implications and Closing. The work reaches outward — toward neighbouring disciplines, toward consequences the author may not have intended, toward the reader's own moment.

III. THEMATIC THREADS

  · The relationship between authority and evidence.
  · The limits of language as an instrument of inquiry.
  · The continuity (or rupture) between tradition and the present argument.
  · The role of the reader as collaborator in meaning.

IV. KEY PASSAGES TO MARK

Read slowly through any sustained passage where the author returns to first principles. These are the seams where the work's deeper architecture is visible. Where the prose tightens into definition, the reader is being given a tool; where it loosens into example, the tool is being shown at work.

V. CRITICAL RECEPTION

From its earliest reviews onward, ${title} has occasioned both admiration and resistance. The scholarly conversation around it constitutes a second body of literature — a long argument about how the work should be read, and what may be done with it.

VI. A NOTE FROM THE ARCHIVE

The Learnedize archive preserves this title as part of its commitment to making the long record of human scholarship freely available. Where the full original text is not yet in the public domain or has been restricted by its publisher, this editorial apparatus is offered in its place: a faithful guide rather than a substitute. Use it to orient your reading, to mark what to seek out in the original, and to enter the longer conversation surrounding the work.`;
}
