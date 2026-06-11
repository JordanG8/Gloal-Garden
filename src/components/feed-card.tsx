import Link from "next/link";
import { Droplet, Camera, CheckCircle2, AlertTriangle, Clock, Sprout, HeartPulse } from "lucide-react";
import type { FeedEntry } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const ICONS: Record<string, React.ReactNode> = {
  water: <Droplet className="w-4 h-4 text-blue-500" />,
  photo: <Camera className="w-4 h-4 text-primary" />,
  harvest: <CheckCircle2 className="w-4 h-4 text-destructive" />,
  alert: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  resolve: <HeartPulse className="w-4 h-4 text-primary" />,
};

const LABELS: Record<string, string> = {
  water: "watered",
  photo: "added a photo of",
  harvest: "harvested from",
  alert: "reported an issue on",
  resolve: "marked healthy",
};

export default function FeedCard({ entry, hideUser = false }: { entry: FeedEntry; hideUser?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-start gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border shadow-sm shrink-0 mt-0.5">
        {ICONS[entry.type] ?? <Sprout className="w-4 h-4 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <p className="text-sm text-foreground">
            {!hideUser && (
              <>
                <Link href={`/gardeners/${entry.userId}`} className="font-bold hover:text-primary hover:underline">
                  {entry.userName}
                </Link>{" "}
              </>
            )}
            {LABELS[entry.type] ?? entry.type}{" "}
            <Link href={`/plants/${entry.plantId}`} className="font-medium text-primary hover:underline">
              {entry.plantEmoji} {entry.plantName || entry.plantSpecies}
            </Link>
            {entry.harvestQuantity ? <span className="text-muted-foreground"> · {entry.harvestQuantity}</span> : null}
            {entry.diseaseTag ? <span className="text-muted-foreground"> · {entry.diseaseTag}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
            <Clock className="w-3 h-3" /> {timeAgo(entry.createdAt)}
          </p>
        </div>
        {entry.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.photoUrl}
            alt={entry.caption ?? "Plant photo"}
            className="w-full h-40 object-cover rounded-xl my-2 border border-border"
          />
        )}
        {entry.caption && <p className="text-sm text-muted-foreground leading-relaxed mt-1">&ldquo;{entry.caption}&rdquo;</p>}
      </div>
    </div>
  );
}
