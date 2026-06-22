import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askMacha } from "@/lib/macha.functions";

type Msg = { role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; messages: Msg[]; ts: number };

const STORAGE_KEY = "learnedize.macha.threads";

const seedThread = (): Thread => ({
  id: `t-${Date.now()}`,
  title: "New Conversation",
  ts: Date.now(),
  messages: [
    {
      role: "assistant",
      content:
        "I'm Macha. Ask me anything in the archive — a thinker, an idea, a passage.",
    },
  ],
});

function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [seedThread()];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [seedThread()];
    const parsed = JSON.parse(raw) as Thread[];
    return parsed.length ? parsed : [seedThread()];
  } catch {
    return [seedThread()];
  }
}

export function MachaWidget({
  isAuthed,
  onRequireAuth,
}: {
  isAuthed: boolean;
  onRequireAuth: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const ask = useServerFn(askMacha);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = loadThreads();
    setThreads(t);
    setActiveId(t[0].id);
  }, []);

  // Listen for external "ask macha" events (e.g. text selection overlay)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (!detail?.text) return;
      if (!isAuthed) return onRequireAuth();
      setOpen(true);
      const excerpt = detail.text.trim().slice(0, 1200);
      const prompt = `Please explain this excerpt in clear, accessible terms:\n\n"${excerpt}"`;
      // create a new thread so context is clean
      const t: Thread = {
        id: `t-${Date.now()}`,
        title: excerpt.slice(0, 40),
        ts: Date.now(),
        messages: [{ role: "user", content: prompt }],
      };
      setThreads((prev) => [t, ...prev]);
      setActiveId(t.id);
      setThinking(true);
      ask({ data: { messages: t.messages } })
        .then((res) => {
          setThreads((prev) =>
            prev.map((x) =>
              x.id === t.id
                ? { ...x, messages: [...t.messages, { role: "assistant", content: res.content || "…" }] }
                : x,
            ),
          );
        })
        .catch((err) => {
          setThreads((prev) =>
            prev.map((x) =>
              x.id === t.id
                ? {
                    ...x,
                    messages: [
                      ...t.messages,
                      { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong." },
                    ],
                  }
                : x,
            ),
          );
        })
        .finally(() => setThinking(false));
    };
    window.addEventListener("macha:ask", handler as EventListener);
    return () => window.removeEventListener("macha:ask", handler as EventListener);
  }, [isAuthed, onRequireAuth, ask]);


  useEffect(() => {
    if (threads.length && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    }
  }, [threads]);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, thinking]);

  const handleTrigger = () => {
    if (!isAuthed) return onRequireAuth();
    setOpen((v) => !v);
  };

  const newThread = () => {
    const t = seedThread();
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
  };

  const renameThread = (id: string) => {
    const name = typeof window !== "undefined" ? window.prompt("Rename conversation") : null;
    if (!name) return;
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: name } : t)));
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      const list = next.length ? next : [seedThread()];
      if (id === activeId) setActiveId(list[0].id);
      return list;
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking || !active) return;
    const nextMsgs: Msg[] = [...active.messages, { role: "user", content: text }];
    const title =
      active.title === "New Conversation" ? text.slice(0, 40) : active.title;
    setThreads((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, messages: nextMsgs, title } : t)),
    );
    setInput("");
    setThinking(true);
    try {
      const res = await ask({ data: { messages: nextMsgs } });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === active.id
            ? { ...t, messages: [...nextMsgs, { role: "assistant", content: res.content || "…" }] }
            : t,
        ),
      );
    } catch (e) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === active.id
            ? {
                ...t,
                messages: [
                  ...nextMsgs,
                  {
                    role: "assistant",
                    content: e instanceof Error ? e.message : "Something went wrong.",
                  },
                ],
              }
            : t,
        ),
      );
    } finally {
      setThinking(false);
    }
  };

  const panelClass = maximized
    ? "fixed inset-4 md:inset-12 z-40 flex border bg-card shadow-2xl fade-up"
    : "fixed bottom-20 right-6 z-40 flex h-[34rem] w-[36rem] max-w-[95vw] border bg-card shadow-2xl fade-up";

  return (
    <>
      <button
        onClick={handleTrigger}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full border bg-background/90 px-4 py-2.5 text-[11px] uppercase tracking-archive backdrop-blur tap hover:bg-secondary"
        aria-label="Ask Macha"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border font-serif italic">
          M
        </span>
        Ask Macha
      </button>

      {open && isAuthed && active && (
        <div className={panelClass}>
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="flex w-56 flex-col border-r bg-background/40">
              <div className="flex items-center justify-between px-3 py-3 border-b">
                <span className="text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                  Threads
                </span>
                <button
                  onClick={newThread}
                  className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-archive tap hover:bg-secondary"
                >
                  + New
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer tap ${
                      t.id === activeId ? "bg-secondary" : "hover:bg-secondary/60"
                    }`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <span className="truncate font-serif">{t.title}</span>
                    <span className="ml-2 hidden gap-1 group-hover:flex">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          renameThread(t.id);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        aria-label="Rename"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteThread(t.id);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        aria-label="Delete"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* Main */}
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-archive tap hover:bg-secondary"
                  aria-label="Toggle threads"
                >
                  ☰
                </button>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border font-serif italic">
                  M
                </span>
                <span className="text-[11px] uppercase tracking-archive truncate max-w-[16rem]">
                  {active.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMaximized((v) => !v)}
                  className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-archive tap hover:bg-secondary"
                  aria-label="Maximize"
                  title={maximized ? "Restore" : "Maximize"}
                >
                  {maximized ? "⊟" : "⛶"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[10px] uppercase tracking-wider-archive text-muted-foreground tap hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {active.messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-secondary px-3 py-2 text-sm"
                      : "max-w-[90%] font-serif text-[15px] leading-relaxed text-foreground"
                  }
                >
                  {m.content}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 pl-1">
                  <span className="macha-dot" />
                  <span className="macha-dot" />
                  <span className="macha-dot" />
                </div>
              )}
            </div>
            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask Macha…"
                  className="flex-1 bg-transparent px-2 py-2 text-sm placeholder:italic placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  onClick={send}
                  disabled={thinking || !input.trim()}
                  className="rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-archive tap disabled:opacity-40 hover:bg-secondary"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
