"use client";

import { Crown, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type ClusterSummary,
  FEATURE_LABELS,
  getClusterColor,
  getPerformanceLevelLabels,
} from "../services/analytics";

type ClusterSummaryCardsProps = {
  clusters: ClusterSummary[];
  topClusterId: number;
};

export function ClusterSummaryCards({
  clusters,
  topClusterId,
}: ClusterSummaryCardsProps) {
  if (clusters.length === 0) return null;

  const performanceLabels = getPerformanceLevelLabels(clusters);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clusters.map((c) => {
        const color = getClusterColor(c.cluster);
        const isTop = c.cluster === topClusterId;
        return (
          <Card
            key={c.cluster}
            className={[
              "border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]",
              isTop ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
            ].join(" ")}
          >
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                  >
                    {c.cluster + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Cluster {c.cluster + 1}
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {performanceLabels[c.cluster]}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {c.size} pemain
                    </p>
                  </div>
                </div>
                {isTop ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Crown className="h-3 w-3" />
                    Top
                  </span>
                ) : null}
              </div>

              <div className="space-y-1 rounded-(--radius-md) border border-border/60 bg-muted/30 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Centroid (rata-rata)
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {(Object.keys(c.centroid) as (keyof typeof c.centroid)[]).map(
                    (key) => (
                      <div
                        key={key}
                        className="flex items-baseline justify-between gap-1"
                      >
                        <span className="text-muted-foreground">
                          {FEATURE_LABELS[key]}
                        </span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {c.centroid[key].toFixed(1)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  Avg performance score
                </span>
                <span
                  className={[
                    "font-mono font-semibold tabular-nums",
                    c.avg_performance_score > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : c.avg_performance_score < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground",
                  ].join(" ")}
                >
                  {c.avg_performance_score > 0 ? "+" : ""}
                  {c.avg_performance_score.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
