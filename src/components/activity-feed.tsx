import { Droplet, Camera, CheckCircle2, AlertTriangle, Clock, Sprout, HeartPulse } from "lucide-react";
import type { ObservationEntry } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const LOG_ICONS: Record<string, React.ReactNode> = {
  water: <Droplet className="w-4 h-4 text-blue-500" />,
  photo: <Camera className="w-4 h-4 text-primary" />,
  harvest: <CheckCircle2 className="w-4 h-4 text-destructive" />,
  alert: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  resolve: <HeartPulse className="w-4 h-4 text-primary" />,
};

const LOG_LABELS: Record<string, string> = {
  water: "watered",
  photo: "added a photo",
  harvest: "harvested",
  alert: "reported an issue",
  resolve: "marked healthy",
};

export default function ActivityFeed({ logs }: { logs: ObservationEntry[] | null }) {
  return (
    <div className="mb-4">
      <h3 className="mb-5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Activity
        <span className="rounded-full bg-secondary px-2.5 py-1 font-sans text-xs font-normal normal-case tracking-normal text-muted-foreground">
          {logs ? `${logs.length} logs` : "loading…"}
        </span>
      </h3>

      {logs === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-secondary/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 px-6 text-muted-foreground text-sm border border-dashed border-border rounded-3xl leading-relaxed">
          <Sprout className="w-6 h-6 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
          No activity yet. Be the first to check on this plant.
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {logs.map((log) => (
            <div key={log.id} className="relative flex items-start gap-4">
              <div className="z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border shadow-sm shrink-0 mt-1">
                {LOG_ICONS[log.type] ?? <Sprout className="w-4 h-4 text-primary" />}
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm w-full">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <p className="font-medium text-sm text-foreground">
                    <span className="font-bold">{log.userName}</span> {LOG_LABELS[log.type] ?? log.type}
                    {log.harvestQuantity ? ` · ${log.harvestQuantity}` : ""}
                    {log.diseaseTag ? ` · ${log.diseaseTag}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3" /> {timeAgo(log.createdAt)}
                  </p>
                </div>
                {log.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={log.photoUrl}
                    alt={log.caption ?? "Plant photo"}
                    className="w-full h-36 object-cover rounded-xl my-2 border border-border"
                  />
                )}
                {log.caption && (
                  <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{log.caption}&rdquo;</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
