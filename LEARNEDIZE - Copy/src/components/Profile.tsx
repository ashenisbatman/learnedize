import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  name: string;
  avatar: string; // data URL or remote URL
  email: string;
};

const KEY = "learnedize.profile";

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { name: "", avatar: "", email: "" };
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Profile;
  } catch {
    return { name: "", avatar: "", email: "" };
  }
}

function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent("profile:changed"));
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>({ name: "", avatar: "", email: "" });

  useEffect(() => {
    // Hydrate from local first, then enrich from Supabase user metadata.
    setProfile(loadProfile());
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const local = loadProfile();
      const merged: Profile = {
        name:
          local.name ||
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          (u.email?.split("@")[0] ?? "Reader"),
        avatar:
          local.avatar ||
          (u.user_metadata?.avatar_url as string) ||
          (u.user_metadata?.picture as string) ||
          "",
        email: u.email ?? "",
      };
      if (
        merged.name !== local.name ||
        merged.avatar !== local.avatar ||
        merged.email !== local.email
      ) {
        saveProfile(merged);
      }
      setProfile(merged);
    });

    const handler = () => setProfile(loadProfile());
    window.addEventListener("profile:changed", handler);
    return () => window.removeEventListener("profile:changed", handler);
  }, []);

  return profile;
}

export function ProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [email, setEmail] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = loadProfile();
    setName(p.name);
    setAvatar(p.avatar);
    setEmail(p.email);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickFile = () => fileRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      alert("Please choose an image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result || ""));
    reader.readAsDataURL(f);
  };

  const save = () => {
    saveProfile({ name: name.trim() || "Reader", avatar, email });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm fade-up"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md border bg-card p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] uppercase tracking-wider-archive text-muted-foreground">
          Account
        </p>
        <h3 className="mt-2 font-serif text-2xl">Your Profile</h3>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={pickFile}
            className="relative h-20 w-20 overflow-hidden rounded-full border tap"
            aria-label="Change picture"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-serif italic text-2xl">
                {(name || "R").slice(0, 1).toUpperCase()}
              </span>
            )}
          </button>
          <div className="flex flex-col gap-2">
            <button
              onClick={pickFile}
              className="pill-btn tap text-[10px]"
            >
              Upload picture
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar("")}
                className="text-[10px] uppercase tracking-wider-archive text-muted-foreground tap hover:text-foreground"
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="hidden"
            />
          </div>
        </div>

        <label className="mt-6 block text-[10px] uppercase tracking-wider-archive text-muted-foreground">
          Display name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-2 w-full border bg-transparent px-3 py-2 font-serif italic focus:outline-none"
        />

        {email && (
          <>
            <label className="mt-4 block text-[10px] uppercase tracking-wider-archive text-muted-foreground">
              Email
            </label>
            <p className="mt-1 font-serif italic text-muted-foreground">{email}</p>
          </>
        )}

        <div className="mt-8 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="pill-btn tap"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="pill-btn tap pill-active"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function Avatar({
  profile,
  size = 32,
}: {
  profile: Profile;
  size?: number;
}) {
  const initial = (profile.name || profile.email || "R").slice(0, 1).toUpperCase();
  return (
    <span
      className="flex items-center justify-center overflow-hidden rounded-full border font-serif italic"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {profile.avatar ? (
        <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
