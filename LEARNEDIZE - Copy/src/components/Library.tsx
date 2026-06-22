import { useEffect, useState } from "react";
import type { Record as ArchRecord } from "@/lib/bookEngine";

export type LibraryItem = ArchRecord & { ts: number };

const KEY = "learnedize.library";

export function loadLibrary(): LibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLibrary(items: LibraryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
  window.dispatchEvent(new CustomEvent("library:changed"));
}

export function isInLibrary(id: string): boolean {
  return loadLibrary().some((i) => i.id === id);
}

export function toggleLibrary(rec: ArchRecord): boolean {
  const list = loadLibrary();
  const exists = list.some((i) => i.id === rec.id);
  if (exists) {
    saveLibrary(list.filter((i) => i.id !== rec.id));
    return false;
  }
  saveLibrary([{ ...rec, ts: Date.now() }, ...list]);
  return true;
}

export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  useEffect(() => {
    setItems(loadLibrary());
    const handler = () => setItems(loadLibrary());
    window.addEventListener("library:changed", handler);
    return () => window.removeEventListener("library:changed", handler);
  }, []);
  return items;
}

export function StarButton({
  rec,
  className = "",
}: {
  rec: ArchRecord;
  className?: string;
}) {
  const [starred, setStarred] = useState(false);
  useEffect(() => {
    setStarred(isInLibrary(rec.id));
    const handler = () => setStarred(isInLibrary(rec.id));
    window.addEventListener("library:changed", handler);
    return () => window.removeEventListener("library:changed", handler);
  }, [rec.id]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setStarred(toggleLibrary(rec));
      }}
      aria-label={starred ? "Remove from library" : "Add to library"}
      title={starred ? "Remove from library" : "Add to library"}
      className={`tap text-lg leading-none transition-colors ${
        starred ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {starred ? "★" : "☆"}
    </button>
  );
}

export function LibraryPanel({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen?: (rec: ArchRecord) => void;
}) {
  const items = useLibrary();
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
            My Library
          </p>
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-wider-archive text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {items.length === 0 && (
            <p className="font-serif italic text-muted-foreground">
              Your library is empty. Tap the ☆ on any paper or book to save it here.
            </p>
          )}
          {items.map((h) => (
            <div key={h.id + h.ts} className="flex items-start gap-3 border-b pb-3">
              <button
                onClick={() => {
                  if (!onOpen) return;
                  onOpen(h);
                  onClose();
                }}
                className="flex-1 text-left tap hover:bg-secondary/60 px-1 py-1"
              >
                <p className="font-serif text-lg leading-snug">{h.title}</p>
                <p className="text-xs text-muted-foreground">{h.author}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                  {h.source} · saved {new Date(h.ts).toLocaleDateString()}
                </p>
              </button>
              <StarButton rec={h} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
