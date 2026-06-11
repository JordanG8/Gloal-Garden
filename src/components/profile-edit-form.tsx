"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateProfile } from "@/lib/social-actions";

export default function ProfileEditForm({
  displayName,
  bio,
  location,
}: {
  displayName: string;
  bio: string | null;
  location: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updateProfile({
        displayName: String(formData.get("displayName") ?? ""),
        bio: String(formData.get("bio") ?? ""),
        location: String(formData.get("location") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-white/15 text-white border border-white/40 hover:bg-white/25 transition"
      >
        <Pencil className="w-4 h-4" /> Edit profile
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-3xl shadow-2xl border border-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Edit profile</h2>
          <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-secondary transition" aria-label="Close">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form action={onSubmit} className="space-y-3">
          <input
            name="displayName"
            defaultValue={displayName}
            maxLength={50}
            required
            placeholder="Display name"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <textarea
            name="bio"
            defaultValue={bio ?? ""}
            maxLength={280}
            rows={3}
            placeholder="Tell the neighborhood about your garden…"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
          <input
            name="location"
            defaultValue={location ?? ""}
            maxLength={80}
            placeholder="Location (e.g. Givat Ada)"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
