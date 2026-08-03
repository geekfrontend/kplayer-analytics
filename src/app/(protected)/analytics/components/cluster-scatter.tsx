"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  type ClusteredPlayer,
  type ClusterSummary,
  type FeatureValues,
  FEATURE_LABELS,
  getClusterColor,
  getPerformanceLevelLabels,
} from "../services/analytics";

type AxisFeature = keyof FeatureValues;

type ClusterScatterProps = {
  players: ClusteredPlayer[];
  clusters: ClusterSummary[];
  topClusterId: number;
};

type ScatterPoint = {
  x: number;
  y: number;
  z: number;
  name: string;
  position: string;
  performance: number;
  cluster?: number;
  isCentroid?: boolean;
};

export function ClusterScatter({
  players,
  clusters,
  topClusterId,
}: ClusterScatterProps) {
  const [xAxis, setXAxis] = useState<AxisFeature>("goals");
  const [yAxis, setYAxis] = useState<AxisFeature>("assists");

  const performanceLabels = getPerformanceLevelLabels(clusters);

  // Group points by cluster
  const pointsByCluster = clusters.map((c) => {
    const points: ScatterPoint[] = players
      .filter((p) => p.cluster === c.cluster)
      .map((p) => ({
        x: p[xAxis],
        y: p[yAxis],
        z: 60,
        name: p.player_name,
        position: p.position,
        performance: p.performance_score,
        cluster: p.cluster,
      }));
    return { cluster: c.cluster, size: c.size, points };
  });

  // Centroid markers
  const centroidPoints = clusters.map((c) => ({
    cluster: c.cluster,
    points: [
      {
        x: c.centroid[xAxis],
        y: c.centroid[yAxis],
        z: 200,
        name: `Centroid ${c.cluster + 1}`,
        position: "—",
        performance: c.avg_performance_score,
        isCentroid: true,
      } satisfies ScatterPoint,
    ],
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="scatter-x" className="text-xs font-medium">
            Sumbu X
          </Label>
          <Select
            value={xAxis}
            onValueChange={(v) => setXAxis(v as AxisFeature)}
          >
            <SelectTrigger id="scatter-x" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FEATURE_LABELS) as AxisFeature[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FEATURE_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scatter-y" className="text-xs font-medium">
            Sumbu Y
          </Label>
          <Select
            value={yAxis}
            onValueChange={(v) => setYAxis(v as AxisFeature)}
          >
            <SelectTrigger id="scatter-y" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FEATURE_LABELS) as AxisFeature[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FEATURE_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-80 w-full rounded-(--radius-md) border border-border bg-muted/20 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(2,8,23,0.08)" />
            <XAxis
              type="number"
              dataKey="x"
              name={FEATURE_LABELS[xAxis]}
              label={{
                value: FEATURE_LABELS[xAxis],
                position: "insideBottom",
                offset: -10,
                style: { fontSize: 11, fill: "currentColor" },
              }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={FEATURE_LABELS[yAxis]}
              label={{
                value: FEATURE_LABELS[yAxis],
                angle: -90,
                position: "insideLeft",
                offset: 16,
                style: { fontSize: 11, fill: "currentColor" },
              }}
              tick={{ fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[60, 200]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload as ScatterPoint;
                return (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-foreground">
                      {data.name}
                    </p>
                    {!data.isCentroid ? (
                      <p className="text-muted-foreground">
                        Posisi: {data.position}
                      </p>
                    ) : null}
                    {!data.isCentroid && data.cluster !== undefined ? (
                      <p className="text-muted-foreground">
                        {performanceLabels[data.cluster]}
                      </p>
                    ) : null}
                    <p className="font-mono tabular-nums">
                      {FEATURE_LABELS[xAxis]}: {data.x.toFixed(1)}
                    </p>
                    <p className="font-mono tabular-nums">
                      {FEATURE_LABELS[yAxis]}: {data.y.toFixed(1)}
                    </p>
                    {!data.isCentroid ? (
                      <p className="font-mono tabular-nums">
                        Score: {data.performance > 0 ? "+" : ""}
                        {data.performance.toFixed(2)}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
            />

            {pointsByCluster.map((g) => (
              <Scatter
                key={`pts-${g.cluster}`}
                name={`Cluster ${g.cluster + 1} — ${performanceLabels[g.cluster]}${
                  g.cluster === topClusterId ? " (top)" : ""
                }`}
                data={g.points}
                fill={getClusterColor(g.cluster).hex}
                fillOpacity={0.7}
              />
            ))}

            {centroidPoints.map((g) => (
              <Scatter
                key={`centroid-${g.cluster}`}
                name={`Centroid ${g.cluster + 1}`}
                data={g.points}
                fill={getClusterColor(g.cluster).hex}
                shape="cross"
                stroke="#0f172a"
                strokeWidth={1.5}
                legendType="none"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Lingkaran = pemain, tanda silang = centroid cluster. Ganti sumbu untuk
        melihat dimensi lain dari cluster.
      </p>
    </div>
  );
}
