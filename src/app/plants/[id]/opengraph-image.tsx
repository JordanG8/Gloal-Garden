import { ImageResponse } from "next/og";
import { getPlantDetail } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Plant on Global Garden";

const STATUS_COLORS: Record<string, string> = {
  growing: "#7CB342",
  needs_water: "#3b82f6",
  ready_to_harvest: "#C84B31",
  needs_attention: "#f97316",
  diseased: "#ea580c",
  dormant: "#a8a29e",
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlantDetail(parseInt(id, 10));

  const plant = detail?.plant;
  const name = plant?.name ?? "Global Garden";
  const species = plant ? `${plant.speciesName} · ${plant.scientificName}` : "A community map of public food plants";
  const emoji = plant?.emoji ?? "🌱";
  const status = plant?.status.replace(/_/g, " ") ?? "";
  const statusColor = STATUS_COLORS[plant?.status ?? "growing"] ?? "#7CB342";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #2D5016 0%, #3d6b1f 55%, #7CB342 100%)",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -40,
            top: -80,
            fontSize: 420,
            opacity: 0.22,
            display: "flex",
          }}
        >
          {emoji}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 72,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18 }}>
            <div style={{ fontSize: 64, display: "flex" }}>{emoji}</div>
            {status && (
              <div
                style={{
                  display: "flex",
                  background: statusColor,
                  color: "white",
                  fontSize: 26,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  padding: "8px 22px",
                  borderRadius: 10,
                }}
              >
                {status}
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#FAF7F0", lineHeight: 1.05 }}>
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "rgba(250,247,240,0.85)", marginTop: 12, fontStyle: "italic" }}>
            {species}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 40 }}>
            <div style={{ display: "flex", fontSize: 30 }}>🌍</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#FAF7F0", letterSpacing: 1 }}>
              Global Garden
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
