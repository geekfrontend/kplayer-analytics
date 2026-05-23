"use client";

import { useCallback, useEffect, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useActiveLeague } from "@/components/app/active-league-context";
import { useActiveSeason } from "@/components/app/active-season-context";
import { AsyncSelect } from "@/components/ui/async-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, isApiClientError } from "@/lib/api-client";
import {
  clubOptionsKeys,
  fetchClubOptionsBySeason,
  type ClubOption,
} from "./players/services/players";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardSummary = {
  season_id: string;
  club_id: string | null;
  total_players: number;
  top_scorer: { player_id: string; full_name: string; goals: number }[];
  top_assist: { player_id: string; full_name: string; assists: number }[];
};

type StatRow = {
  id: string;
  player_id: string;
  player_name: string;
  club_id: string;
  club_name: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
};

type StatsListResponse = {
  items: StatRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

type SortBy = "goals" | "assists";

// ─── Query keys ───────────────────────────────────────────────────────────────

const summaryKeys = {
  bySeason: (seasonId: string, clubId: string) =>
    ["dashboard-summary", seasonId, clubId] as const,
};

const statsKeys = {
  list: (seasonId: string, clubId: string, sortBy: SortBy, page: number) =>
    ["dashboard-stats", seasonId, clubId, sortBy, page] as const,
};

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<StatRow>();

// ─── Summary card skeleton ────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-12 animate-pulse rounded bg-muted" />
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stats table skeleton ─────────────────────────────────────────────────────

function StatsTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {[32, 24, 12, 12, 12, 16].map((w, j) => (
            <TableCell key={j}>
              <div
                className={`h-4 w-${w} animate-pulse rounded bg-muted`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeSeason } = useActiveSeason();
  const { activeLeague } = useActiveLeague();
  const queryClient = useQueryClient();

  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedClubName, setSelectedClubName] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("goals");
  const [page, setPage] = useState(1);

  // Reset saat musim berubah
  useEffect(() => {
    setSelectedClubId("");
    setSelectedClubName("");
    setPage(1);
  }, [activeSeason?.id]);

  // ─── Club options query (untuk AsyncSelect + auto-select) ──────────────────

  const clubOptionsQuery = useQuery({
    queryKey: clubOptionsKeys.bySeason(activeSeason?.id ?? ""),
    enabled: Boolean(activeSeason?.id),
    staleTime: 60_000,
    queryFn: () => fetchClubOptionsBySeason(activeSeason!.id),
  });

  // Auto-select klub pertama
  useEffect(() => {
    if (selectedClubId) return;
    const first = clubOptionsQuery.data?.[0];
    if (first) {
      setSelectedClubId(first.club_id);
      setSelectedClubName(first.club_name);
    }
  }, [clubOptionsQuery.data, selectedClubId]);

  // ─── Summary query ─────────────────────────────────────────────────────────

  const summaryQuery = useQuery({
    queryKey: summaryKeys.bySeason(activeSeason?.id ?? "", selectedClubId),
    enabled: Boolean(activeSeason?.id),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("season_id", activeSeason!.id);
      if (selectedClubId) params.set("club_id", selectedClubId);

      const result = await apiRequest<DashboardSummary>(
        `/api/dashboard/summary?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // ─── Stats query ───────────────────────────────────────────────────────────

  const statsQuery = useQuery({
    queryKey: statsKeys.list(
      activeSeason?.id ?? "",
      selectedClubId,
      sortBy,
      page,
    ),
    enabled: Boolean(activeSeason?.id),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("season_id", activeSeason!.id);
      if (selectedClubId) params.set("club_id", selectedClubId);
      params.set("sort_by", sortBy);
      params.set("sort_order", "desc");
      params.set("page", String(page));
      params.set("limit", "10");

      const result = await apiRequest<StatsListResponse>(
        `/api/stats?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // ─── Club fetcher for AsyncSelect ──────────────────────────────────────────

  const clubFetcher = useCallback(
    async (_query?: string): Promise<ClubOption[]> => {
      if (!activeSeason?.id) return [];
      return queryClient.fetchQuery({
        queryKey: clubOptionsKeys.bySeason(activeSeason.id),
        queryFn: () => fetchClubOptionsBySeason(activeSeason.id),
        staleTime: 60_000,
      });
    },
    [activeSeason?.id, queryClient],
  );

  // ─── Sort toggle ───────────────────────────────────────────────────────────

  function handleSortChange(col: SortBy) {
    setSortBy(col);
    setPage(1);
  }

  function handleClubChange(clubId: string) {
    setSelectedClubId(clubId);
    const name =
      clubOptionsQuery.data?.find((c) => c.club_id === clubId)?.club_name ?? "";
    setSelectedClubName(name);
    setPage(1);
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  function SortHeader({
    col,
    label,
  }: {
    col: SortBy;
    label: string;
  }) {
    const isActive = sortBy === col;
    return (
      <button
        type="button"
        onClick={() => handleSortChange(col)}
        className={[
          "flex items-center gap-1 text-xs font-medium transition-colors",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        {label}
        {isActive ? <span className="text-primary">↓</span> : null}
      </button>
    );
  }

  const columns = [
    columnHelper.accessor("player_name", {
      header: "Pemain",
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("club_name", {
      header: "Klub",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("goals", {
      header: () => <SortHeader col="goals" label="Gol" />,
      cell: (info) => (
        <span className="font-medium tabular-nums">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("assists", {
      header: () => <SortHeader col="assists" label="Assist" />,
      cell: (info) => (
        <span className="tabular-nums text-muted-foreground">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("shots", {
      header: "Tembakan",
      cell: (info) => (
        <span className="tabular-nums text-muted-foreground">
          {info.getValue()}
        </span>
      ),
    }),
  ];

  const table = useReactTable({
    data: statsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ─── Derived ───────────────────────────────────────────────────────────────

  const summary = summaryQuery.data;
  const topScorer = summary?.top_scorer[0];
  const topAssist = summary?.top_assist[0];
  const total = statsQuery.data?.pagination.total ?? 0;
  const totalPages = statsQuery.data?.pagination.total_pages ?? 1;

  const statsError = statsQuery.error
    ? isApiClientError(statsQuery.error)
      ? statsQuery.error.message
      : "Gagal mengambil statistik"
    : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-6">
      {/* Context banner + filter klub global */}
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

        {/* Filter klub — berlaku global untuk summary cards dan tabel */}
        <AsyncSelect<ClubOption>
          fetcher={clubFetcher}
          preload
          disabled={!activeSeason?.id}
          value={selectedClubId}
          onChange={(v) => handleClubChange(typeof v === "string" ? v : "")}
          getOptionValue={(o) => o.club_id}
          getDisplayValue={(o) => o.club_name}
          renderOption={(o) => <span>{o.club_name}</span>}
          placeholder={activeSeason ? "Semua klub" : "Pilih musim dulu"}
          searchPlaceholder="Cari klub..."
          defaultDisplayValue={selectedClubName || undefined}
          clearable
          width="180px"
          triggerClassName="h-8 text-sm"
          noResultsMessage="Tidak ada klub di musim ini"
        />
      </div>

      {/* Summary cards */}
      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total pemain */}
          <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total Pemain
                  </p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {summary?.total_players ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedClubName
                      ? `di ${selectedClubName}`
                      : "di semua klub"}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top scorer */}
          <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Top Scorer
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {topScorer?.full_name ?? "—"}
                  </p>
                  {topScorer ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {topScorer.goals}
                      </span>{" "}
                      gol
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Belum ada data
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-950/30">
                  <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top assist */}
          <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Top Assist
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {topAssist?.full_name ?? "—"}
                  </p>
                  {topAssist ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {topAssist.assists}
                      </span>{" "}
                      assist
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Belum ada data
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950/30">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats table */}
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle>Statistik Pemain</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total} data · klik header untuk sort
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {statsError ? (
            <p className="rounded-(--radius-md) border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {statsError}
            </p>
          ) : null}

          {/* Info total */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {total} data · klik header untuk sort
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {!activeSeason ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Pilih musim aktif untuk melihat statistik.
                    </TableCell>
                  </TableRow>
                ) : statsQuery.isLoading ? (
                  <StatsTableSkeleton />
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Belum ada data statistik.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} data · hal. {page}/{totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1 || statsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages || statsQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
                title="Halaman selanjutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
