"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplet, Camera, Apple, AlertTriangle, HeartPulse, Zap, Award, Sprout } from "lucide-react";
import type { SessionUser } from "@/lib/types";
import type { PlantStatus } from "@/lib/plant-status";
import { logCareAction } from "@/lib/plant-actions";
import PhotoInput from "./photo-input";

type ComposerType = "photo" | "harvest" | "report" | null;

interface Toast {
  points: number;
  badges: string[];
  note?: string;
}

const COMPOSER_TITLES: Record<Exclude<ComposerType, null>, string> = {
  photo: "Photo update",
  harvest: "Log a harvest",
  report: "Report a problem",
};

export default function CareActions({
  plantId,
  status,
  user,
  onLogged,
}: {
  plantId: number;
  status: PlantStatus;
  user: SessionUser | null;
  onLogged?: () => void;
}) {
  const router = useRouter();
  const [composer, setComposer] = useState<ComposerType>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [pending, startTransition] = useTransition();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(toast: Toast) {
    setToast(toast);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  function runAction(input: Parameters<typeof logCareAction>[0]) {
    if (!user) {
      router.push("/login");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await logCareAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setComposer(null);
      showToast({
        points: result.pointsAwarded ?? 0,
        badges: result.newBadges ?? [],
        note: result.note,
      });
      router.refresh();
      onLogged?.();
    });
  }

  function submitComposer(formData: FormData) {
    if (!composer) return;
    runAction({
      plantId,
      type: composer,
      caption: String(formData.get("caption") ?? ""),
      photoUrl: String(formData.get("photoUrl") ?? ""),
      harvestQuantity: String(formData.get("harvestQuantity") ?? ""),
      diseaseTag: String(formData.get("diseaseTag") ?? ""),
    });
  }

  const needsResolve = status === "needs_attention" || status === "diseased";

  const actionButton =
    "flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-card py-3.5 " +
    "text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60";

  return (
    <section className="mb-10">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Lend a hand
      </h3>

      {toast && (
        <div className="mb-5 rounded-2xl border border-border bg-card px-5 py-4 text-sm space-y-1.5 shadow-sm">
          {toast.points > 0 ? (
            <p className="flex items-center gap-1.5 font-bold text-primary">
              <Zap className="w-4 h-4" strokeWidth={1.75} /> +{toast.points} karma
            </p>
          ) : (
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Sprout className="w-4 h-4 text-primary" strokeWidth={1.75} /> Logged — thank you!
            </p>
          )}
          {toast.note && <p className="text-muted-foreground leading-relaxed">{toast.note}</p>}
          {toast.badges.map((badge) => (
            <p key={badge} className="flex items-center gap-1.5 font-medium text-amber-700">
              <Award className="w-4 h-4" strokeWidth={1.75} /> Badge earned: {badge}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <button disabled={pending} onClick={() => runAction({ plantId, type: "water" })} className={actionButton}>
          <Droplet className="w-4 h-4 text-blue-500" strokeWidth={1.75} /> Water
        </button>
        <button
          disabled={pending}
          onClick={() => setComposer(composer === "photo" ? null : "photo")}
          className={actionButton}
        >
          <Camera className="w-4 h-4 text-primary" strokeWidth={1.75} /> Photo
        </button>
        <button
          disabled={pending}
          onClick={() => setComposer(composer === "harvest" ? null : "harvest")}
          className={actionButton}
        >
          <Apple className="w-4 h-4 text-destructive" strokeWidth={1.75} /> Harvest
        </button>
        <button
          disabled={pending}
          onClick={() => setComposer(composer === "report" ? null : "report")}
          className={actionButton}
        >
          <AlertTriangle className="w-4 h-4 text-orange-500" strokeWidth={1.75} /> Report
        </button>
      </div>

      {needsResolve && (
        <button
          disabled={pending}
          onClick={() => runAction({ plantId, type: "resolve" })}
          className="w-full mb-5 flex items-center justify-center gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 py-3.5 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
        >
          <HeartPulse className="w-4 h-4" strokeWidth={1.75} /> Mark healthy
        </button>
      )}

      {composer && (
        <form action={submitComposer} className="mb-6 rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {COMPOSER_TITLES[composer]}
          </p>

          {(composer === "photo" || composer === "harvest") && (
            <PhotoInput
              name="photoUrl"
              label={composer === "harvest" ? "Photo — verified harvests earn double" : "Photo"}
            />
          )}
          {composer === "harvest" && (
            <input
              name="harvestQuantity"
              type="text"
              placeholder="How much did you harvest? e.g. 3 tomatoes"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition"
            />
          )}
          {composer === "report" && (
            <select
              name="diseaseTag"
              defaultValue=""
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition"
            >
              <option value="">General concern (needs attention)</option>
              <option value="pests">Pests</option>
              <option value="fungus">Fungus / mildew</option>
              <option value="blight">Blight</option>
              <option value="wilting">Wilting / disease</option>
            </select>
          )}
          <textarea
            name="caption"
            rows={2}
            placeholder={composer === "report" ? "Describe what you saw…" : "Add a note (optional)…"}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 transition resize-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Saving…" : `Log ${composer}`}
          </button>
        </form>
      )}

      {error && (
        <p className="mb-5 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
