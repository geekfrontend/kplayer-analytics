"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  type ClusteredPlayer,
  type ClusterSummary,
  FEATURE_LABELS,
  getClusterColor,
  getPerformanceLevelLabels,
  type KMeansStepDTO,
} from "../services/analytics";
import { CentroidDeltaTable } from "./centroid-delta-table";
import { AssignmentMatrix } from "./assignment-matrix";

type IterationStepperProps = {
  steps: KMeansStepDTO[];
  players: ClusteredPlayer[];
  clusters: ClusterSummary[];
  iterations: number;
  converged: boolean;
};

export function IterationStepper({
  steps,
  players,
  clusters,
  iterations,
  converged,
}: IterationStepperProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset jika data berubah
  useEffect(() => {
    setStepIdx(0);
    setIsPlaying(false);
  }, [steps]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;
    if (stepIdx >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const t = window.setTimeout(() => {
      setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    }, 1200);
    return () => window.clearTimeout(t);
  }, [isPlaying, stepIdx, steps.length]);

  const currentStep = steps[stepIdx];
  const previousStep = stepIdx > 0 ? steps[stepIdx - 1] : null;

  const performanceLabels = getPerformanceLevelLabels(clusters);

  const isInit = currentStep?.iteration === 0;
  const isConverged = currentStep?.converged === true;

  // Build assignment counts per cluster di iterasi saat ini
  const counts = useMemo(() => {
    if (!currentStep) return [] as number[];
    const k = currentStep.centroids_zscore.length;
    const c = new Array(k).fill(0);
    for (const a of currentStep.assignments) c[a] += 1;
    return c;
  }, [currentStep]);

  if (steps.length === 0 || !currentStep) {
    return (
      <div className="rounded-(--radius-md) border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Tidak ada data iterasi.
      </div>
    );
  }

  function goPrev() {
    setStepIdx((i) => Math.max(0, i - 1));
    setIsPlaying(false);
  }

  function goNext() {
    setStepIdx((i) => Math.min(steps.length - 1, i + 1));
    setIsPlaying(false);
  }

  function reset() {
    setStepIdx(0);
    setIsPlaying(false);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-(--radius-md) border border-border bg-muted/20 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={reset}
            disabled={stepIdx === 0}
            title="Mulai dari iterasi 0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goPrev}
            disabled={stepIdx === 0}
            title="Iterasi sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={stepIdx >= steps.length - 1}
            title={isPlaying ? "Jeda" : "Putar otomatis"}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goNext}
            disabled={stepIdx >= steps.length - 1}
            title="Iterasi berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <Slider
            value={[stepIdx]}
            min={0}
            max={steps.length - 1}
            step={1}
            onValueChange={(v) => {
              setStepIdx(v[0] ?? 0);
              setIsPlaying(false);
            }}
            className="flex-1"
          />
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {stepIdx + 1} / {steps.length}
          </span>
        </div>
      </div>

      {/* Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-md) border border-border bg-background p-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isInit
              ? "Inisialisasi (K-Means++)"
              : `Iterasi ${currentStep.iteration}`}
          </p>
          <p className="text-sm text-foreground">
            {isInit ? (
              <>
                Centroid awal dipilih via{" "}
                <span className="font-medium">K-Means++</span> — titik pertama
                acak, sisanya dipilih probabilistik proporsional terhadap jarak²
                ke centroid terdekat.
              </>
            ) : isConverged ? (
              <>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Konvergen
                </span>{" "}
                — tidak ada pemain yang pindah cluster.
              </>
            ) : (
              <>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {currentStep.changed_count}
                </span>{" "}
                pemain pindah cluster di iterasi ini.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Total iterasi:{" "}
            <span className="font-mono tabular-nums text-foreground">
              {iterations}
            </span>
          </span>
          <span>·</span>
          <span>
            Status:{" "}
            <span
              className={
                converged
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-amber-600 dark:text-amber-400"
              }
            >
              {converged ? "Konvergen" : "Mencapai max_iter"}
            </span>
          </span>
        </div>
      </div>

      {/* Cluster size distribution */}
      <div className="rounded-(--radius-md) border border-border bg-background p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Distribusi Anggota Cluster
        </p>
        <div className="space-y-1.5">
          {counts.map((cnt, i) => {
            const color = getClusterColor(i);
            const max = Math.max(...counts, 1);
            const widthPct = (cnt / max) * 100;
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${color.bg} ${color.text}`}
                >
                  {i + 1}
                </span>
                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                  {performanceLabels[i]}
                </span>
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${color.bg} transition-all duration-500`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {cnt} pemain
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Centroid delta table */}
      <CentroidDeltaTable
        currentStep={currentStep}
        previousStep={previousStep}
        performanceLabels={performanceLabels}
      />

      {/* Assignment matrix */}
      <AssignmentMatrix
        players={players}
        currentStep={currentStep}
        previousStep={previousStep}
        performanceLabels={performanceLabels}
      />

      <div className="rounded-(--radius-md) border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Cara baca:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            Tabel centroid menampilkan nilai dalam{" "}
            <span className="font-mono">unit asli</span> (misal: gol, menit) dan{" "}
            <span className="font-mono">z-score</span> yang dipakai untuk hitung
            jarak.
          </li>
          <li>
            Angka <span className="font-medium">Δ</span> menunjukkan pergeseran
            centroid dari iterasi sebelumnya — saat semua mendekati 0,
            algoritma akan konvergen.
          </li>
          <li>
            Pemain yang pindah cluster di iterasi ini ditandai dengan{" "}
            <span className="font-mono">→</span> di matriks assignment.
          </li>
          <li>
            Fitur <span className="font-medium">{FEATURE_LABELS.goals}</span>,{" "}
            <span className="font-medium">{FEATURE_LABELS.assists}</span>,{" "}
            <span className="font-medium">{FEATURE_LABELS.shots}</span>{" "}
            di-standarisasi (z-score) sebelum clustering.
          </li>
        </ul>
      </div>
    </div>
  );
}
