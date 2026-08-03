"use client";

import { useCallback, useEffect, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useActiveLeague } from "@/components/app/active-league-context";
import { useActiveSeason } from "@/components/app/active-season-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { isApiClientError } from "@/lib/api-client";
import {
  clubOptionsKeys,
  fetchClubOptionsBySeason,
  type ClubOption,
} from "../players/services/players";
import { AnalyticsFilterBar } from "./components/analytics-filter-bar";
import { ClusterScatter } from "./components/cluster-scatter";
import { ClusterSummaryCards } from "./components/cluster-summary-cards";
import { ClusteredPlayersTable } from "./components/clustered-players-table";
import { FeatureStatsPanel } from "./components/feature-stats-panel";
import { IterationStepper } from "./components/iteration-stepper";
import {
  analyticsKeys,
  fetchKMeans,
  type KMeansResult,
} from "./services/analytics";

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function AnalyticsPage() {
  const { activeSeason } = useActiveSeason();
  const { activeLeague } = useActiveLeague();
  const queryClient = useQueryClient();

  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedClubName, setSelectedClubName] = useState("");

  // Bump untuk trigger refetch saat user klik "Jalankan Ulang"
  const [runVersion, setRunVersion] = useState(0);

  // Reset saat musim berubah
  useEffect(() => {
    setSelectedClubId("");
    setSelectedClubName("");
  }, [activeSeason?.id]);

  // Auto-fetch club options agar nama bisa di-resolve untuk display
  const clubOptionsQuery = useQuery({
    queryKey: clubOptionsKeys.bySeason(activeSeason?.id ?? ""),
    enabled: Boolean(activeSeason?.id),
    staleTime: 60_000,
    queryFn: () => fetchClubOptionsBySeason(activeSeason!.id),
  });

  // Resolve nama klub jika di-set hanya dari ID
  useEffect(() => {
    if (!selectedClubId) {
      setSelectedClubName("");
      return;
    }
    if (selectedClubName) return;
    const found = clubOptionsQuery.data?.find(
      (c) => c.club_id === selectedClubId,
    );
    if (found) setSelectedClubName(found.club_name);
  }, [selectedClubId, selectedClubName, clubOptionsQuery.data]);

  // ─── Main K-Means query ────────────────────────────────────────────────────

  const kmeansQuery = useQuery<KMeansResult>({
    queryKey: analyticsKeys.kmeans({
      seasonId: activeSeason?.id ?? "",
      clubId: selectedClubId,
      leagueId: activeLeague?.id ?? "",
      k: 3,
      maxIter: 100,
      includeSteps: true,
    }),
    enabled: Boolean(activeSeason?.id),
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchKMeans({
        seasonId: activeSeason?.id,
        clubId: selectedClubId || undefined,
        leagueId: activeLeague?.id,
        k: 3,
        maxIter: 100,
        includeSteps: true,
      }),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleClubChange = useCallback(
    (clubId: string, clubName: string) => {
      setSelectedClubId(clubId);
      // Jika nama tidak diberikan (mis. dari AsyncSelect), resolve dari cache
      const resolved = clubName
        ? clubName
        : queryClient
            .getQueryData<ClubOption[]>(
              clubOptionsKeys.bySeason(activeSeason?.id ?? ""),
            )
            ?.find((c) => c.club_id === clubId)?.club_name ?? "";
      setSelectedClubName(resolved);
    },
    [activeSeason?.id, queryClient],
  );

  function handleRunAgain() {
    setRunVersion((v) => v + 1);
    void kmeansQuery.refetch();
  }

  // Memorize untuk runVersion (no-op tapi tampak di handler)
  void runVersion;

  // ─── Derived ───────────────────────────────────────────────────────────────

  const result = kmeansQuery.data;
  const errorMessage = kmeansQuery.error
    ? getErrorMessage(kmeansQuery.error, "Gagal menjalankan analisis K-Means.")
    : null;

  const isLoading = kmeansQuery.isLoading;
  const isFetching = kmeansQuery.isFetching;
  const hasResult = !!result && result.total_players >= 2;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      {/* Context banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {activeSeason ? (
          <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-medium text-foreground">
              {activeSeason.name}
            </span>
            {activeSeason.league_name ? (
              <span className="text-muted-foreground">
                · {activeSeason.league_name}
              </span>
            ) : null}
          </div>
        ) : null}
        {activeLeague ? (
          <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-foreground">
              {activeLeague.name}
            </span>
            <span className="text-xs text-muted-foreground">
              · {activeLeague.country}
            </span>
          </div>
        ) : null}
      </div>

      {/* Filter card */}
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle>Analisis K-Means</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Clustering pemain berdasarkan{" "}
            <span className="font-medium">gol</span>,{" "}
            <span className="font-medium">assist</span>, dan{" "}
            <span className="font-medium">tembakan</span> ke dalam 3 cluster.
            Kluster dengan rata-rata{" "}
            <span className="font-mono">performance score</span> tertinggi
            diidentifikasi sebagai pemain dengan performa terbaik.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <AnalyticsFilterBar
            seasonId={activeSeason?.id ?? ""}
            selectedClubId={selectedClubId}
            selectedClubName={selectedClubName}
            isFetching={isFetching}
            onClubChange={handleClubChange}
            onRunAgain={handleRunAgain}
          />

          {errorMessage ? (
            <p className="rounded-(--radius-md) border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Results */}
      {!activeSeason ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Pilih musim aktif untuk menjalankan analisis.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Menjalankan algoritma K-Means...
          </CardContent>
        </Card>
      ) : !hasResult ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <p>
              Data tidak cukup untuk clustering. Diperlukan minimal{" "}
              <span className="font-medium">2 pemain</span> dengan statistik
              lengkap di scope ini.
            </p>
            <p className="text-xs">
              {result?.total_players ?? 0} pemain ditemukan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <ClusterSummaryCards
            clusters={result.clusters}
            topClusterId={result.top_cluster_id}
          />

          {/* Tabs: hasil + visualisasi proses */}
          <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
            <CardHeader className="space-y-1">
              <CardTitle>Detail Hasil &amp; Proses Clustering</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lihat hasil per pemain, visualisasi 2D, dan langkah-langkah
                iterasi K-Means dengan angka centroid yang sebenarnya.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="players" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:w-fit sm:grid-cols-4">
                  <TabsTrigger value="players">Pemain</TabsTrigger>
                  <TabsTrigger value="scatter">Visualisasi 2D</TabsTrigger>
                  <TabsTrigger value="iterations">Iterasi</TabsTrigger>
                  <TabsTrigger value="preprocess">Pre-processing</TabsTrigger>
                </TabsList>

                <TabsContent value="players" className="space-y-3">
                  <ClusteredPlayersTable
                    players={result.players}
                    clusters={result.clusters}
                    topClusterId={result.top_cluster_id}
                  />
                </TabsContent>

                <TabsContent value="scatter" className="space-y-3">
                  <ClusterScatter
                    players={result.players}
                    clusters={result.clusters}
                    topClusterId={result.top_cluster_id}
                  />
                </TabsContent>

                <TabsContent value="iterations" className="space-y-3">
                  <IterationStepper
                    steps={result.steps}
                    players={result.players}
                    clusters={result.clusters}
                    iterations={result.iterations}
                    converged={result.converged}
                  />
                </TabsContent>

                <TabsContent value="preprocess" className="space-y-3">
                  <FeatureStatsPanel
                    means={result.feature_means}
                    stds={result.feature_stds}
                    totalPlayers={result.total_players}
                  />

                  <div className="rounded-(--radius-md) border border-border bg-muted/20 p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Tahapan algoritma
                    </p>
                    <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                      <li>
                        Ambil data statistik pemain di scope filter (musim,
                        klub, liga).
                      </li>
                      <li>
                        Hitung mean dan stdev tiap fitur, lalu standarisasi
                        dengan z-score.
                      </li>
                      <li>
                        Inisialisasi <span className="font-mono">k</span>{" "}
                        centroid via K-Means++ (probabilistik berdasarkan jarak²
                        ke centroid terdekat).
                      </li>
                      <li>
                        Tiap iterasi: hitung jarak Euclidean tiap pemain ke
                        semua centroid, assign ke yang terdekat, lalu rekap
                        centroid sebagai rata-rata anggota baru.
                      </li>
                      <li>
                        Berhenti saat tidak ada pemain pindah cluster, atau
                        mencapai <span className="font-mono">max_iter</span>.
                      </li>
                      <li>
                        Hitung <span className="font-mono">performance_score</span>{" "}
                        per pemain (sum z-score 3 fitur). Cluster dengan
                        rata-rata score tertinggi = top performer.
                      </li>
                    </ol>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
