import { useEffect, useRef, useState } from "react";
import { Avatar, useProfile } from "./Profile";

export function UserMenu({
  onOpenProfile,
  onOpenLibrary,
  onSignOut,
}: {
  onOpenProfile: () => void;
  onOpenLibrary: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useProfile();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="tap rounded-full"
        aria-label="Open account menu"
        aria-expanded={open}
      >
        <Avatar profile={profile} size={32} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 border bg-card shadow-xl fade-up">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Avatar profile={profile} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-sm">
                {profile.name || "Reader"}
              </p>
              {profile.email && (
                <p className="truncate text-[10px] uppercase tracking-wider-archive text-muted-foreground">
                  {profile.email}
                </p>
              )}
            </div>
          </div>
          <MenuItem
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
            label="Profile"
            hint="Change name & picture"
          />
          <MenuItem
            onClick={() => {
              setOpen(false);
              onOpenLibrary();
            }}
            label="Library"
            hint="Your saved papers & books"
          />
          <MenuItem
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            label="Sign out"
            hint=""
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  label,
  hint,
  danger,
}: {
  onClick: () => void;
  label: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left tap hover:bg-secondary ${
        danger ? "text-foreground/90" : ""
      }`}
    >
      <span className="text-[11px] uppercase tracking-archive">{label}</span>
      {hint && (
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      )}
    </button>
  );
}
