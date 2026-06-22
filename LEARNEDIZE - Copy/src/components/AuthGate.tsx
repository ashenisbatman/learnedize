import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AuthGateModal({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const signIn = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://learnedize.vercel.app",
    },
  });
};
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm fade-up"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md border bg-card p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground">
          Sign in required
        </p>
        <p className="mt-4 font-serif text-lg leading-relaxed text-foreground">
          {message ??
            "Please sign in to access your personal archive and Macha assistant."}
        </p>
        <button
          onClick={signIn}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-[11px] uppercase tracking-archive tap hover:bg-secondary"
        >
          <GIcon /> Sign in with Google
        </button>
        <button
          onClick={onClose}
          className="mt-3 w-full text-[10px] uppercase tracking-wider-archive text-muted-foreground tap hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function GIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6c1.9-5.6 7.1-9.7 13.6-9.7z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
      <path fill="#FBBC05" d="M10.4 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.5 0-12-4.4-13.9-10.3l-7.8 6C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}
