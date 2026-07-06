"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updatePlantDetails } from "@/lib/plant-actions";

export default function EditPlantDetails({
  plantId,
  nickname,
  description,
  accessNotes,
}: {
  plantId: number;
  nickname: string;
  description: string;
  accessNotes: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updatePlantDetails({
        plantId,
        nickname: String(formData.get("nickname") ?? ""),
        description: String(formData.get("description") ?? ""),
        accessNotes: String(formData.get("accessNotes") ?? ""),
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
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"
      >
        <Pencil className="w-3.5 h-3.5" /> Edit details
      </button>
    );
  }

  return (
    <form action={submit} className="mb-6 bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
      <input
        name="nickname"
        defaultValue={nickname}
        placeholder="Nickname"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
      <textarea
        name="description"
        defaultValue={description}
        rows={2}
        placeholder="Description"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
      />
      <textarea
        name="accessNotes"
        defaultValue={accessNotes}
        rows={2}
        placeholder="Access notes (how to find & reach it)"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
