"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ClusteredPlayer,
  type ClusterSummary,
  getClusterColor,
  getPerformanceLevelLabels,
} from "../services/analytics";

type ClusteredPlayersTableProps = {
  players: ClusteredPlayer[];
  clusters: ClusterSummary[];
  topClusterId: number;
};

export function ClusteredPlayersTable({
  players,
  clusters,
  topClusterId,
}: ClusteredPlayersTableProps) {
  const [filterCluster, setFilterCluster] = useState<string>("all");
  const performanceLabels = getPerformanceLevelLabels(clusters);

  const filtered =
    filterCluster === "all"
      ? players
      : filterCluster === "top"
      ? players.filter((p) => p.cluster === topClusterId)
      : players.filter((p) => p.cluster === Number(filterCluster));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            Hasil Pemain per Cluster
          </p>
          <p className="text-xs text-muted-foreground">
            Pemain di cluster top performer berada di urutan teratas. Performance
            score = jumlah z-score 3 fitur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="filter-cluster" className="text-xs font-medium">
            Tampilkan
          </Label>
          <Select value={filterCluster} onValueChange={setFilterCluster}>
            <SelectTrigger
              id="filter-cluster"
              className="h-8 min-w-44 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua cluster</SelectItem>
              <SelectItem value="top">Top performer saja</SelectItem>
              {clusters.map((c) => (
                <SelectItem key={c.cluster} value={String(c.cluster)}>
                  Cluster {c.cluster + 1} — {performanceLabels[c.cluster]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-(--radius-md) border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Cluster</TableHead>
              <TableHead>Pemain</TableHead>
              <TableHead>Klub</TableHead>
              <TableHead className="w-16">Posisi</TableHead>
              <TableHead className="text-right">Gol</TableHead>
              <TableHead className="text-right">Assist</TableHead>
              <TableHead className="text-right">Tembakan</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Tidak ada pemain di cluster ini.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const color = getClusterColor(p.cluster);
                const isTop = p.cluster === topClusterId;
                return (
                  <TableRow key={p.player_id}>
                    <TableCell>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${color.bg} ${color.text}`}
                        title={`Cluster ${p.cluster + 1} — ${performanceLabels[p.cluster]}`}
                      >
                        {p.cluster + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">
                          {p.player_name}
                        </span>
                        {isTop ? (
                          <Crown
                            className="h-3 w-3 text-primary"
                            aria-label="Top performer"
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.club_name}
                    </TableCell>
                    <TableCell>
                      <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {p.position}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {p.goals}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {p.assists}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {p.shots}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={[
                          "font-mono font-medium tabular-nums",
                          p.performance_score > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : p.performance_score < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-foreground",
                        ].join(" ")}
                      >
                        {p.performance_score > 0 ? "+" : ""}
                        {p.performance_score.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
