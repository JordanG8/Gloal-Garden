"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplet, Camera, CheckCircle2, AlertTriangle, HeartPulse, Zap } from "lucide-react";
import type { SessionUser } from "@/lib/types";
import type { PlantStatus } from "@/lib/plant-status";
import { logCareAction } from "@/lib/plant-actions";

type ComposerType = "photo" | "harvest" | "report" | null;

interface Toast {
  points: number;
  badges: string[];
  note?: string;
}

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

  return (
    <>
      {toast && (
        <div className="mb-4 rounded-2xl border px-4 py-3 text-sm space-y-1 bg-card border-border shadow-sm">
          {toast.points > 0 ? (
            <p className="flex items-center gap-1.5 font-bold text-primary">
              <Zap className="w-4 h-4" /> +{toast.points} karma
            </p>
          ) : (
            <p className="font-medium text-foreground">Logged — thank you! 🌱</p>
          )}
          {toast.note && <p className="text-muted-foreground">{toast.note}</p>}
          {toast.badges.map((badge) => (
            <p key={badge} className="font-medium text-amber-700">
              🏅 Badge earned: {badge}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          disabled={pending}
          onClick={() => runAction({ plantId, type: "water" })}
          className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-xl font-medium hover:bg-blue-100 transition border border-blue-200 disabled:opacity-60"
        >
          <Droplet className="w-4 h-4" /> Water
        </button>
        <button
          disabled={pending}
          onClick={() => setComposer(composer === "photo" ? null : "photo")}
          className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-xl font-medium hover:bg-secondary/80 transition border border-border disabled:opacity-60"
        >
          <Camera className="w-4 h-4" /> Photo
        </button>
        <button
          disabled={pending}
          onClick={() => setComposer(composer === "harvest" ? null : "harvest")}
          className="flex items-center justify-center gap-2 bg-destructive/10 text-destructive py-3 rounded-xl font-medium hover:bg-destructive/20 transition border border-destructive/20 disabled:opacity-60"
        >
          <CheckCircle2 className="w-4 h-4" /> Harvest
        </button>
        <button
          disabled={pending}
          onClick={() => setComposer(composer === "report" ? null : "report")}
          className="flex items-center justify-center gap-2 bg-orange-50 text-orange-700 py-3 rounded-xl font-medium hover:bg-orange-100 transition border border-orange-200 disabled:opacity-60"
        >
          <AlertTriangle className="w-4 h-4" /> Report
        </button>
      </div>

      {needsResolve && (
        <button
          disabled={pending}
          onClick={() => runAction({ plantId, type: "resolve" })}
          className="w-full mb-4 flex items-center justify-center gap-2 bg-primary/10 text-primary py-3 rounded-xl font-medium hover:bg-primary/20 transition border border-primary/20 disabled:opacity-60"
        >
          <HeartPulse className="w-4 h-4" /> Mark Healthy
        </button>
      )}

      {composer && (
        <form action={submitComposer} className="mb-6 bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
          {(composer === "photo" || composer === "harvest") && (
            <input
              name="photoUrl"
              type="url"
              placeholder={
                composer === "harvest"
                  ? "Photo URL — photo-verified harvests earn double"
                  : "Photo URL (https://…)"
              }
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          )}
          {composer === "harvest" && (
            <input
              name="harvestQuantity"
              type="text"
              placeholder="How much did you harvest? e.g. 3 tomatoes"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          )}
          {composer === "report" && (
            <select
              name="diseaseTag"
              defaultValue=""
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
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
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {pending ? "Saving…" : `Log ${composer}`}
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
          {error}
        </p>
      )}
    </>
  );
}
