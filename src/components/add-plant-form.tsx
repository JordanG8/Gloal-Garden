"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Sprout, MapPin } from "lucide-react";
import type { SpeciesOption } from "@/lib/types";
import { createPlant } from "@/lib/plant-actions";

const INPUT =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm " +
  "focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition";

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
    <div className="absolute z-30 bottom-0 left-0 w-full md:w-[420px] md:bottom-8 md:left-8 bg-background border border-border md:rounded-3xl rounded-t-3xl shadow-2xl p-7 pointer-events-auto">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-heading text-2xl font-medium text-foreground flex items-center gap-2.5">
          <Sprout className="w-5 h-5 text-primary" strokeWidth={1.75} /> New plant
        </h2>
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-secondary transition" aria-label="Cancel">
          <X className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-7">
        <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
      </p>

      <form action={handleSubmit} className="space-y-4">
        <select name="speciesId" required defaultValue="" className={INPUT}>
          <option value="" disabled>
            What did you plant?
          </option>
          {speciesList.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.commonName}
            </option>
          ))}
        </select>
        <input
          name="nickname"
          type="text"
          maxLength={80}
          placeholder="Nickname (e.g. Corner Lot Tomatoes)"
          className={INPUT}
        />
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          placeholder="Notes about this plant (optional)"
          className={`${INPUT} resize-none`}
        />
        <input
          name="accessNotes"
          type="text"
          maxLength={300}
          placeholder="Access notes (e.g. behind the bench, public sidewalk)"
          className={INPUT}
        />

        {error && (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Planting…" : "Plant it"}
          </button>
        </div>
      </form>
    </div>
  );
}
