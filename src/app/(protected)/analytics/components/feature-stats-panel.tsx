"use client";

import { Calculator } from "lucide-react";
import {
  type FeatureValues,
  FEATURE_LABELS,
} from "../services/analytics";

type FeatureStatsPanelProps = {
  means: FeatureValues;
  stds: FeatureValues;
  totalPlayers: number;
};

export function FeatureStatsPanel({
  means,
  stds,
  totalPlayers,
}: FeatureStatsPanelProps) {
  const keys = Object.keys(FEATURE_LABELS) as (keyof FeatureValues)[];

  return (
    <div className="space-y-3 rounded-(--radius-md) border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">
          Statistik Fitur (Pre-processing)
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Sebelum clustering, tiap fitur di-standarisasi dengan{" "}
        <span className="font-mono">z = (x − μ) / σ</span> agar skala fitur
        yang berbeda tidak mendominasi perhitungan jarak Euclidean.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="py-1.5 text-left font-medium">Fitur</th>
              <th className="py-1.5 text-right font-medium">Mean (μ)</th>
              <th className="py-1.5 text-right font-medium">Stdev (σ)</th>
              <th className="py-1.5 text-right font-medium">
                Rumus z-score
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-b border-border/40 last:border-0">
                <td className="py-1.5 font-medium text-foreground">
                  {FEATURE_LABELS[k]}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {means[k].toFixed(2)}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {stds[k].toFixed(2)}
                </td>
                <td className="py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                  z = (x − {means[k].toFixed(1)}) / {stds[k].toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Dihitung dari{" "}
        <span className="font-mono text-foreground">{totalPlayers}</span> pemain.
      </p>
    </div>
  );
}
