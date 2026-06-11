"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Sprout } from "lucide-react";
import type { SpeciesOption } from "@/lib/types";
import { createPlant } from "@/lib/plant-actions";

export default function AddPlantForm({
  location,
  speciesList,
  onCancel,
  onCreated,
}: {
  location: { lat: number; lng: number };
  speciesList: SpeciesOption[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createPlant({
        speciesId: parseInt(String(formData.get("speciesId")), 10),
        lat: location.lat,
        lng: location.lng,
        nickname: String(formData.get("nickname") ?? ""),
        description: String(formData.get("description") ?? ""),
        accessNotes: String(formData.get("accessNotes") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated();
    });
  }

  return (
    <div className="absolute z-30 bottom-0 left-0 w-full md:w-[400px] md:bottom-6 md:left-6 bg-background border border-border md:rounded-3xl rounded-t-3xl shadow-2xl p-5 pointer-events-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <Sprout className="w-5 h-5 text-primary" /> New Plant
        </h2>
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-secondary transition" aria-label="Cancel">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <p className="text-xs font-mono text-muted-foreground mb-4">
        📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
      </p>

      <form action={handleSubmit} className="space-y-3">
        <select
          name="speciesId"
          required
          defaultValue=""
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="" disabled>
            What did you plant?
          </option>
          {speciesList.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.emoji} {sp.commonName}
            </option>
          ))}
        </select>
        <input
          name="nickname"
          type="text"
          maxLength={80}
          placeholder="Nickname (e.g. Corner Lot Tomatoes)"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          placeholder="Notes about this plant (optional)"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
        />
        <input
          name="accessNotes"
          type="text"
          maxLength={300}
          placeholder="Access notes (e.g. behind the bench, public sidewalk)"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition disabled:opacity-60"
        >
          {pending ? "Planting…" : "Plant It 🌱"}
        </button>
      </form>
    </div>
  );
}
