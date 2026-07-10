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
        className="mb-10 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition"
      >
        <Pencil className="w-3.5 h-3.5" /> Edit details
      </button>
    );
  }

  return (
    <form action={submit} className="mb-10 bg-card border border-border rounded-3xl p-5 space-y-4 shadow-sm">
      <input
        name="nickname"
        defaultValue={nickname}
        placeholder="Nickname"
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition"
      />
      <textarea
        name="description"
        defaultValue={description}
        rows={2}
        placeholder="Description"
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition resize-none"
      />
      <textarea
        name="accessNotes"
        defaultValue={accessNotes}
        rows={2}
        placeholder="Access notes (how to find & reach it)"
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition resize-none"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-6 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
