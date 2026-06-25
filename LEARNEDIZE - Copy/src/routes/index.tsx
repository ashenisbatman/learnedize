import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { MachaWidget } from "@/components/Macha";
import { AuthGateModal } from "@/components/AuthGate";
import { HistoryPanel, pushHistory } from "@/components/ReadingHistory";
import {
  searchArchiveStream,
  resolveReading,
  type ReadingResource,
  type Record as ArchRecord,
} from "@/lib/bookEngine";
import { LibraryPanel, StarButton } from "@/components/Library";
import { UserMenu } from "@/components/UserMenu";
import { ProfileModal } from "@/components/Profile";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Achieved — An Archive of Human Scholarship" },
      {
        name: "description",
        content:
          "Achieved is a matte, minimal archive of human scholarship — research papers, books, and literature, searchable across the world's open repositories.",
      },
    ],
  }),
  component: Index,
});

type Filter = "all" | "papers" | "books";

function Index() {
  const [authed, setAuthed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [results, setResults] = useState<ArchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<ArchRecord | null>(null);
  const [reading, setReading] = useState<ReadingResource | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gate, setGate] = useState<{ open: boolean; msg?: string }>({ open: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    const stored = (typeof window !== "undefined" && localStorage.getItem("Learnedize.theme")) as
      | "dark"
      | "light"
      | null;
    if (stored === "light") {
      setTheme("light");
      document.documentElement.classList.add("light");
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("light", next === "light");
      localStorage.setItem("Learnedize.theme", next);
    }
  };

  const signIn = async () => {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const runSearch = async () => {
    if (loading) return;
    if (!query.trim()) {
      setResults([]);
      setActive(null);
      setReading(null);
      return;
    }
    setLoading(true);
    setActive(null);
    setResults([]);
    try {
      await searchArchiveStream(query, filter, (chunk: ArchRecord[]) => {
        setResults((prev) => [...prev, ...chunk]);
      });
    } finally {
      setLoading(false);
    }
  };


  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setActive(null);
    setReading(null);
  };


  const openRecord = async (rec: ArchRecord) => {
    setActive(rec);
    setReading(null);
    setReadingLoading(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    pushHistory({
      id: rec.id,
      title: rec.title,
      author: rec.author,
      source: rec.source,
      kind: rec.kind,
      year: rec.year,
      readUrl: rec.readUrl,
      textUrl: rec.textUrl,
      description: rec.description,
      cover: rec.cover,
    });
    try {
      const res = await resolveReading(rec);
      setReading(res);
    } finally {
      setReadingLoading(false);
    }
  };

  const goHome = () => {
    setActive(null);
    setReading(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const showHistory = () => {
    if (!authed)
      return setGate({ open: true, msg: "Please sign in to access your personal archive." });
    setHistoryOpen(true);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return results;
    if (filter === "papers") return results.filter((r) => r.kind === "paper");
    return results.filter((r) => r.kind === "book");
  }, [results, filter]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground">
          Est. MMXXVI
        </p>
        <nav className="flex items-center gap-2">
          <button onClick={showHistory} className="pill-btn tap">
            Reading History
          </button>
          {authed ? (
            <UserMenu
              onOpenProfile={() => setProfileOpen(true)}
              onOpenLibrary={() => setLibraryOpen(true)}
              onSignOut={signOut}
            />
          ) : (
            <button onClick={signIn} className="pill-btn tap inline-flex items-center gap-2">
              <GIcon /> Sign in with Google
            </button>
          )}
          <button onClick={toggleTheme} className="pill-btn tap">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </nav>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-5xl px-6 pt-10 md:pt-16">
        {active ? (
          <ReaderView
            rec={active}
            reading={reading}
            loading={readingLoading}
            onHome={goHome}
          />
        ) : (

          <>
            {/* Static Logo group */}
            <div className="flex flex-col items-center text-center select-none">
              <button
                onClick={clearQuery}
                aria-label="Home"
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border font-serif italic text-lg tap"
              >
                Z
              </button>
              <h1 className="font-serif text-6xl md:text-8xl tracking-wide text-foreground">
                Learnedize
              </h1>
              <div className="mt-6 flex w-full max-w-md items-center gap-4">
                <span className="divider-line" />
                <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground whitespace-nowrap">
                  An Archive of Human Scholarship
                </p>
                <span className="divider-line" />
              </div>
            </div>

            {/* SEARCH */}
            <div className="mx-auto mt-12 max-w-3xl">
              <div className="flex border bg-card">
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="Search the archive — e.g. general relativity, democracy, Aristotle..."
                    className="w-full bg-transparent px-5 py-4 pr-10 font-serif italic text-lg tracking-wide placeholder:italic placeholder:text-muted-foreground focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={clearQuery}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground tap text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  onClick={runSearch}
                  disabled={loading}
                  className={`border-l bg-muted px-6 text-[11px] uppercase tracking-archive tap hover:bg-secondary ${loading ? "pulse-text" : ""}`}
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                {(["all", "papers", "books"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`pill-btn tap ${filter === f ? "pill-active" : ""}`}
                  >
                    {f === "all" ? "All Records" : f === "papers" ? "Research Papers" : "Books & Literature"}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                English Editions · Worldwide Archives
              </p>
            </div>

            {/* RESULTS */}
            <section className="mt-16">
              {filtered.length > 0 && (
                <>
                  <p className="mb-6 text-center text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                    {filtered.length} records found{loading ? " — still fetching…" : ""}
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filtered.map((r, idx) => (
                      <div
                        key={`${r.id}-${idx}`}
                        onClick={() => openRecord(r)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRecord(r);
                          }
                        }}
                        className="group relative border bg-card p-5 text-left tap transition-colors hover:bg-secondary fade-up cursor-pointer"
                      >
                        <div className="absolute right-3 top-3">
                          <StarButton rec={r} />
                        </div>
                        <p className="pr-8 text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                          {r.source} {r.year ? `· ${r.year}` : ""} · {r.kind === "paper" ? "Paper" : "Book"}
                        </p>
                        <p className="mt-2 font-serif text-xl leading-snug text-foreground">{r.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{r.author}</p>
                        {r.description && (
                          <p className="mt-3 line-clamp-3 font-serif text-[15px] leading-relaxed text-foreground/80">
                            {r.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!loading && filtered.length === 0 && (
                <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                  <blockquote className="mx-auto font-serif italic text-2xl leading-relaxed text-foreground/85">
                    "All that mankind has done, thought, gained or been: it is lying as in magic
                    preservation in the pages of books."
                  </blockquote>
                  <p className="mt-3 text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                    — Thomas Carlyle
                  </p>
                </div>
              )}
            </section>
          </>
        )}


        <footer className="mt-24 pb-12 flex justify-center">
          <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground text-center">
            A Quant Project
          </p>
        </footer>
      </main>

      <MachaWidget
        isAuthed={authed}
        onRequireAuth={() =>
          setGate({
            open: true,
            msg: "Please sign in to access your personal archive and Macha assistant.",
          })
        }
      />
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpen={(rec) => openRecord(rec)}
      />
      <LibraryPanel
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onOpen={(rec) => openRecord(rec)}
      />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      <AuthGateModal open={gate.open} onClose={() => setGate({ open: false })} message={gate.msg} />
    </div>
  );
}

function GIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6c1.9-5.6 7.1-9.7 13.6-9.7z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
      <path fill="#FBBC05" d="M10.4 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.5 0-12-4.4-13.9-10.3l-7.8 6C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

function ReaderView({
  rec,
  reading,
  loading,
  onHome,
}: {
  rec: ArchRecord;
  reading: ReadingResource | null;
  loading: boolean;
  onHome: () => void;
}) {
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onSelectionChange = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed) {
        setSel(null);
        return;
      }
      const text = s.toString().trim();
      if (text.length < 4) {
        setSel(null);
        return;
      }
      // Only when selection is inside the article
      const node = s.anchorNode;
      if (!node || !articleRef.current?.contains(node)) {
        setSel(null);
        return;
      }
      try {
        const range = s.getRangeAt(0);
        const r = range.getBoundingClientRect();
        if (!r || (r.width === 0 && r.height === 0)) return;
        setSel({
          text,
          x: r.left + r.width / 2 + window.scrollX,
          y: r.top + window.scrollY,
        });
      } catch {
        /* noop */
      }
    };
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-macha-tooltip]")) return;
      setSel(null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, []);

  const askMachaAboutSelection = () => {
    if (!sel) return;
    window.dispatchEvent(new CustomEvent("macha:ask", { detail: { text: sel.text } }));
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="mx-auto max-w-3xl fade-up">
      <button
        onClick={onHome}
        className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider-archive text-muted-foreground tap hover:bg-secondary hover:text-foreground"
      >
        ← Back to Home
      </button>
      <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground">
        {rec.source} {rec.year ? `· ${rec.year}` : ""} · {rec.kind === "paper" ? "Paper" : "Book"}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <h2 className="flex-1 font-serif text-4xl leading-tight">{rec.title}</h2>
        <StarButton rec={rec} className="mt-2 text-2xl" />
      </div>
      <p className="mt-1 font-serif italic text-muted-foreground">{rec.author}</p>
      {rec.readUrl && (
        <a
          href={rec.readUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-4 py-2 text-[11px] uppercase tracking-wider-archive text-background tap hover:opacity-90"
        >
          Read Original ↗
        </a>
      )}
      <div className="mt-8 border-t pt-8">
        {loading || !reading ? (
          <div className="flex gap-1.5">
            <span className="macha-dot" />
            <span className="macha-dot" />
            <span className="macha-dot" />
          </div>
        ) : reading.mode === "structured" ? (
          <article ref={articleRef} className="font-serif text-lg leading-[1.9] text-foreground/95">
            {reading.sections.map((s, i) => (
              <section key={i} className="mb-10">
                <h3 className="mb-3 text-[11px] uppercase tracking-wider-archive text-muted-foreground">
                  {s.heading}
                </h3>
                <p className="whitespace-pre-wrap">{s.body}</p>
              </section>
            ))}
          </article>
        ) : reading.mode === "embed" ? (
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-wider-archive text-muted-foreground">
              Native text unavailable — rendering source document
            </p>
            <iframe
              src={reading.embedUrl}
              title={rec.title}
              className="h-[85vh] w-full rounded-md border bg-background"
              allow="fullscreen"
            />
          </div>
) : reading.mode === "structured" ? (
  <article
    ref={articleRef}
    className="font-serif text-lg leading-[1.9] text-foreground/95"
  >
    {reading.sections.map((section, i) => (
      <section key={i} className="mb-10">
        <h3 className="mb-4 text-2xl font-semibold">
          {section.heading}
        </h3>
        <p className="whitespace-pre-wrap">
          {section.body}
        </p>
      </section>
    ))}
  </article>
) : (
  <article
    ref={articleRef}
    className="whitespace-pre-wrap font-serif text-lg leading-[1.9] text-foreground/95"
  >
    {reading.text}
  </article>
)}
      </div>

      {sel && (
        <button
          data-macha-tooltip
          onMouseDown={(e) => e.preventDefault()}
          onClick={askMachaAboutSelection}
          style={{
            position: "absolute",
            left: sel.x,
            top: sel.y - 44,
            transform: "translateX(-50%)",
          }}
          className="z-50 rounded-full border bg-background/95 px-3 py-1.5 text-[10px] uppercase tracking-archive shadow-lg backdrop-blur tap hover:bg-secondary fade-up inline-flex items-center gap-2"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full border font-serif italic text-[9px]">
            M
          </span>
          Ask Macha to explain this
        </button>
      )}
    </div>
  );
}





