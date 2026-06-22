import { useEffect, useState } from "react";
import type { Record as ArchRecord } from "@/lib/bookEngine";

export type HistoryItem = {
  id: string;
  title: string;
  author: string;
  source: string;
  kind?: "book" | "paper";
  year?: string;
  readUrl?: string;
  textUrl?: string;
  description?: string;
  cover?: string;
  ts: number;
};

const KEY = "learnedize.history";

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushHistory(item: Omit<HistoryItem, "ts">) {
  if (typeof window === "undefined") return;
  const list = loadHistory().filter((h) => h.id !== item.id);
  list.unshift({ ...item, ts: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}

export function HistoryPanel({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen?: (rec: ArchRecord) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    if (open) setItems(loadHistory());
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm fade-up"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md border-l bg-card p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground">
            Reading History
          </p>
          <button onClick={onClose} className="text-[10px] uppercase tracking-wider-archive text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {items.length === 0 && (
            <p className="font-serif italic text-muted-foreground">
              Your archive is empty. Records you open will appear here.
            </p>
          )}
          {items.map((h) => (
            <button
              key={h.id + h.ts}
              onClick={() => {
                if (!onOpen) return;
                const rec: ArchRecord = {
                  id: h.id,
                  title: h.title,
                  author: h.author,
                  source: h.source,
                  kind: h.kind ?? "book",
                  year: h.year,
                  readUrl: h.readUrl,
                  textUrl: h.textUrl,
                  description: h.description,
                  cover: h.cover,
                };
                onOpen(rec);
                onClose();
              }}
              className="block w-full text-left border-b pb-3 tap hover:bg-secondary/60 px-1"
            >
              <p className="font-serif text-lg leading-snug">{h.title}</p>
              <p className="text-xs text-muted-foreground">{h.author}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                {h.source} · {new Date(h.ts).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
