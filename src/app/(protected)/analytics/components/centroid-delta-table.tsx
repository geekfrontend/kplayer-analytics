"use client";

import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FEATURE_LABELS,
  getClusterColor,
  type FeatureValues,
  type KMeansStepDTO,
} from "../services/analytics";

type CentroidDeltaTableProps = {
  currentStep: KMeansStepDTO;
  previousStep: KMeansStepDTO | null;
  performanceLabels: Record<number, string>;
};

const FEATURE_KEYS: (keyof FeatureValues)[] = [
  "goals",
  "assists",
  "shots",
];

function DeltaCell({ delta }: { delta: number }) {
  const abs = Math.abs(delta);
  if (abs < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        0.00
      </span>
    );
  }
  const isUp = delta > 0;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-mono text-[10px] tabular-nums",
        isUp
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
      ].join(" ")}
    >
      {isUp ? (
        <ArrowUp className="h-2.5 w-2.5" />
      ) : (
        <ArrowDown className="h-2.5 w-2.5" />
      )}
      {isUp ? "+" : ""}
      {delta.toFixed(2)}
    </span>
  );
}

export function CentroidDeltaTable({
  currentStep,
  previousStep,
  performanceLabels,
}: CentroidDeltaTableProps) {
  const centroidsOriginal = currentStep.centroids_original;
  const centroidsZ = currentStep.centroids_zscore;
  const newCentroidsZ = currentStep.new_centroids_zscore;

  const isInit = currentStep.iteration === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          Centroid {isInit ? "Awal" : "pada Iterasi Ini"}
        </p>
        <p className="text-xs text-muted-foreground">
          Nilai centroid (unit asli + z-score) dan pergeserannya{" "}
          {isInit ? "dari titik data" : "dari iterasi sebelumnya"}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-(--radius-md) border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Cluster</TableHead>
              {FEATURE_KEYS.map((k) => (
                <TableHead key={k} className="text-right">
                  {FEATURE_LABELS[k]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {centroidsOriginal.map((centroid, i) => {
              const color = getClusterColor(i);
              const prevZ = previousStep?.centroids_zscore[i];
              return (
                <TableRow key={i}>
                  <TableCell>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${color.bg} ${color.text}`}
                      title={performanceLabels[i]}
                    >
                      {i + 1}
                    </span>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {performanceLabels[i]}
                    </p>
                  </TableCell>
                  {FEATURE_KEYS.map((key) => {
                    const original = centroid[key];
                    const z = centroidsZ[i][key];
                    const newZ = newCentroidsZ[i][key];
                    const stepDelta = newZ - z;
                    const prevDelta =
                      prevZ != null ? z - prevZ[key] : 0;

                    return (
                      <TableCell key={key} className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                            {original.toFixed(1)}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                            z = {z >= 0 ? "+" : ""}
                            {z.toFixed(2)}
                          </span>
                          {!isInit ? (
                            <DeltaCell delta={prevDelta} />
                          ) : null}
                          {!isInit && Math.abs(stepDelta) >= 0.005 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                              <ArrowRight className="h-2.5 w-2.5" />
                              akan ke z={newZ >= 0 ? "+" : ""}
                              {newZ.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
