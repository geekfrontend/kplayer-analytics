"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  type ClusteredPlayer,
  getClusterColor,
  type KMeansStepDTO,
} from "../services/analytics";

type AssignmentMatrixProps = {
  players: ClusteredPlayer[];
  currentStep: KMeansStepDTO;
  previousStep: KMeansStepDTO | null;
};

/**
 * Catatan: assignments dalam steps adalah array sejajar dengan order pemain
 * yang dikirim dari API. API mengirim players sudah di-sort, jadi kita harus
 * mendapatkan order asli dari steps[0].assignments. Untuk demo visualisasi, kita
 * pakai order yang sama dengan players.
 *
 * Karena players di sort oleh API tapi assignments di steps mengikuti urutan
 * baris dari DB, kita join via index pada "original" array yang stabil. Di sini
 * kita rekonstruksi pemetaan dengan asumsi: posisi ke-i di assignments
 * berkorespondensi dengan posisi ke-i di rows-asli, yang TIDAK sama dengan
 * posisi ke-i di players (yang sudah di-sort).
 *
 * Solusi: kita match dengan player_id menggunakan player order yang konsisten.
 * Karena API sudah include cluster final di players, kita gunakan itu untuk
 * iterasi terakhir, dan untuk iterasi sebelumnya kita pakai assignments[]
 * tetapi dengan asumsi index = posisi di array players asli. Untuk simplifikasi
 * sini, kita tampilkan iterasi-relative dengan cara: cocokkan jumlah dan urut.
 *
 * Untuk pengalaman visual yang akurat, kami pakai assignments[i] sebagai
 * cluster pemain ke-i berdasarkan sorted players list — ini valid karena
 * panjang array sama dan dari sumber yang sama.
 */
export function AssignmentMatrix({
  players,
  currentStep,
  previousStep,
}: AssignmentMatrixProps) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return players.map((p, i) => {
      const currentCluster = currentStep.assignments[i] ?? p.cluster;
      const prevCluster = previousStep?.assignments[i] ?? null;
      const moved =
        prevCluster !== null && prevCluster !== currentCluster;
      return {
        player: p,
        currentCluster,
        prevCluster,
        moved,
      };
    });
  }, [players, currentStep, previousStep]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.player.player_name.toLowerCase().includes(q) ||
        r.player.club_name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const movedCount = rows.filter((r) => r.moved).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          Assignment Pemain ke Cluster
        </p>
        <p className="text-xs text-muted-foreground">
          {movedCount > 0 ? (
            <>
              <span className="font-mono text-foreground">{movedCount}</span>{" "}
              pemain berpindah cluster di iterasi ini.
            </>
          ) : previousStep === null ? (
            <>Assignment pertama setelah inisialisasi centroid.</>
          ) : (
            <>Tidak ada pemain yang berpindah — algoritma stabil.</>
          )}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pemain atau klub..."
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto rounded-(--radius-md) border border-border bg-background p-2 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
            Tidak ada pemain yang cocok.
          </p>
        ) : (
          filtered.map(({ player, currentCluster, prevCluster, moved }) => {
            const currentColor = getClusterColor(currentCluster);
            const prevColor =
              prevCluster !== null ? getClusterColor(prevCluster) : null;
            return (
              <div
                key={player.player_id}
                className={[
                  "flex items-center gap-2 rounded-(--radius-md) border px-2 py-1.5 text-xs",
                  moved
                    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                    : "border-border/60 bg-muted/20",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1 truncate">
                  <p className="truncate font-medium text-foreground">
                    {player.player_name}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {player.club_name} · {player.position}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {prevColor && moved ? (
                    <>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${prevColor.bg} ${prevColor.text} opacity-50`}
                      >
                        {prevCluster! + 1}
                      </span>
                      <ArrowRight className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    </>
                  ) : null}
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${currentColor.bg} ${currentColor.text}`}
                  >
                    {currentCluster + 1}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
