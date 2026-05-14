import { and, eq, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm } from "@/db/postgres";
import {
  clubs,
  player_stats,
  players,
  seasons,
} from "@/db/schema";
import {
  computePerformanceScore,
  denormalize,
  findTopCluster,
  runKMeans,
  standardize,
  type Feature,
} from "@/lib/kmeans";

// ─── Query schema ─────────────────────────────────────────────────────────────

const querySchema = z.object({
  season_id: z.uuid("Format season_id tidak valid").optional(),
  club_id: z.uuid("Format club_id tidak valid").optional(),
  league_id: z.uuid("Format league_id tidak valid").optional(),
  k: z.coerce.number().int().min(2).max(10).default(3),
  max_iter: z.coerce.number().int().min(10).max(500).default(100),
  /** Jika true, response menyertakan riwayat iterasi untuk visualisasi */
  include_steps: z.coerce.boolean().default(false),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type StatRow = {
  player_id: string;
  player_name: string;
  position: string;
  club_id: string;
  club_name: string;
  season_id: string;
  season_name: string;
  goals: number;
  assists: number;
  shots: number;
  minutes_played: number;
};

type ClusteredPlayer = StatRow & {
  cluster: number;
  performance_score: number;
};

type ClusterSummary = {
  cluster: number;
  size: number;
  centroid: {
    goals: number;
    assists: number;
    shots: number;
    minutes_played: number;
  };
  avg_performance_score: number;
  is_top_performer: boolean;
};

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    season_id: req.nextUrl.searchParams.get("season_id") ?? undefined,
    club_id: req.nextUrl.searchParams.get("club_id") ?? undefined,
    league_id: req.nextUrl.searchParams.get("league_id") ?? undefined,
    k: req.nextUrl.searchParams.get("k") ?? undefined,
    max_iter: req.nextUrl.searchParams.get("max_iter") ?? undefined,
    include_steps:
      req.nextUrl.searchParams.get("include_steps") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { season_id, club_id, league_id, k, max_iter, include_steps } =
    parsedQuery.data;

  // ─── Fetch data statistik ─────────────────────────────────────────────────

  const whereConditions: SQL[] = [];
  if (season_id) whereConditions.push(eq(player_stats.season_id, season_id));
  if (club_id) whereConditions.push(eq(player_stats.club_id, club_id));
  if (league_id) whereConditions.push(eq(seasons.league_id, league_id));

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const rows = (await orm
    .select({
      player_id: player_stats.player_id,
      player_name: players.full_name,
      position: players.primary_position,
      club_id: player_stats.club_id,
      club_name: clubs.name,
      season_id: player_stats.season_id,
      season_name: seasons.name,
      goals: player_stats.goals,
      assists: player_stats.assists,
      shots: player_stats.shots,
      minutes_played: player_stats.minutes_played,
    })
    .from(player_stats)
    .innerJoin(players, eq(player_stats.player_id, players.id))
    .innerJoin(clubs, eq(player_stats.club_id, clubs.id))
    .innerJoin(seasons, eq(player_stats.season_id, seasons.id))
    .where(whereClause)) as StatRow[];

  // Minimal 2 pemain untuk clustering masuk akal
  if (rows.length < 2) {
    return ApiResponse.ok("Data tidak cukup untuk clustering", {
      total_players: rows.length,
      k_used: 0,
      filters: { season_id, club_id, league_id },
      players: rows.map((r) => ({
        ...r,
        cluster: 0,
        performance_score: 0,
      })),
      clusters: [],
      iterations: 0,
      converged: true,
      steps: [],
    });
  }

  // ─── Standarisasi fitur dan jalankan K-Means ──────────────────────────────

  const features: Feature[] = rows.map(
    (r) => [r.goals, r.assists, r.shots, r.minutes_played] as Feature,
  );

  const { standardized, means, stds } = standardize(features);
  const { assignments, centroids, steps, iterations, converged } = runKMeans(
    standardized,
    { k, maxIter: max_iter, trackSteps: include_steps },
  );

  // ─── Hitung performance score (sum z-score per pemain) ────────────────────

  // Pertahankan original index agar steps.assignments bisa di-remap setelah
  // players di-sort.
  type ClusteredPlayerWithIdx = ClusteredPlayer & { __originalIdx: number };

  const playersWithCluster: ClusteredPlayerWithIdx[] = rows.map((row, i) => {
    const score = computePerformanceScore(standardized[i]);
    return {
      ...row,
      cluster: assignments[i],
      performance_score: Number(score.toFixed(3)),
      __originalIdx: i,
    };
  });

  // ─── Bangun ringkasan kluster ─────────────────────────────────────────────

  const effectiveK = centroids.length;
  const clusterSizes = new Array(effectiveK).fill(0);
  const clusterScoreSums = new Array(effectiveK).fill(0);
  for (const p of playersWithCluster) {
    clusterSizes[p.cluster] += 1;
    clusterScoreSums[p.cluster] += p.performance_score;
  }

  const topClusterIdx = findTopCluster(
    assignments,
    playersWithCluster.map((p) => p.performance_score),
    effectiveK,
  );

  const stats = { means, stds };
  const clusters: ClusterSummary[] = centroids.map((c, i) => {
    const denorm = denormalize(c, stats);
    return {
      cluster: i,
      size: clusterSizes[i],
      centroid: {
        goals: Number(denorm[0].toFixed(2)),
        assists: Number(denorm[1].toFixed(2)),
        shots: Number(denorm[2].toFixed(2)),
        minutes_played: Number(denorm[3].toFixed(2)),
      },
      avg_performance_score:
        clusterSizes[i] === 0
          ? 0
          : Number((clusterScoreSums[i] / clusterSizes[i]).toFixed(3)),
      is_top_performer: i === topClusterIdx,
    };
  });

  // Sort hasil pemain: top performer dulu, lalu by score desc
  playersWithCluster.sort((a, b) => {
    const aTop = a.cluster === topClusterIdx ? 0 : 1;
    const bTop = b.cluster === topClusterIdx ? 0 : 1;
    if (aTop !== bTop) return aTop - bTop;
    return b.performance_score - a.performance_score;
  });

  // ─── Format steps untuk response (jika diminta) ───────────────────────────
  // Karena players di-sort di atas, kita harus remap assignments di steps
  // mengikuti urutan baru agar index di UI konsisten.
  const newOrderIdx = playersWithCluster.map((p) => p.__originalIdx);

  const formattedSteps = include_steps
    ? steps.map((step) => ({
        iteration: step.iteration,
        centroids_zscore: step.centroids.map((c) => ({
          goals: Number(c[0].toFixed(3)),
          assists: Number(c[1].toFixed(3)),
          shots: Number(c[2].toFixed(3)),
          minutes_played: Number(c[3].toFixed(3)),
        })),
        centroids_original: step.centroids.map((c) => {
          const d = denormalize(c, stats);
          return {
            goals: Number(d[0].toFixed(2)),
            assists: Number(d[1].toFixed(2)),
            shots: Number(d[2].toFixed(2)),
            minutes_played: Number(d[3].toFixed(2)),
          };
        }),
        new_centroids_zscore: step.newCentroids.map((c) => ({
          goals: Number(c[0].toFixed(3)),
          assists: Number(c[1].toFixed(3)),
          shots: Number(c[2].toFixed(3)),
          minutes_played: Number(c[3].toFixed(3)),
        })),
        assignments: newOrderIdx.map((origIdx) => step.assignments[origIdx]),
        changed_count: step.changedCount,
        converged: step.converged,
      }))
    : [];

  // Strip helper field sebelum kirim
  const finalPlayers: ClusteredPlayer[] = playersWithCluster.map((p) => {
    const { __originalIdx, ...rest } = p;
    void __originalIdx;
    return rest;
  });

  return ApiResponse.ok("Analisis K-Means berhasil dilakukan", {
    total_players: rows.length,
    k_used: effectiveK,
    iterations,
    converged,
    filters: { season_id, club_id, league_id },
    feature_means: {
      goals: Number(means[0].toFixed(2)),
      assists: Number(means[1].toFixed(2)),
      shots: Number(means[2].toFixed(2)),
      minutes_played: Number(means[3].toFixed(2)),
    },
    feature_stds: {
      goals: Number(stds[0].toFixed(2)),
      assists: Number(stds[1].toFixed(2)),
      shots: Number(stds[2].toFixed(2)),
      minutes_played: Number(stds[3].toFixed(2)),
    },
    clusters,
    top_cluster_id: topClusterIdx,
    players: finalPlayers,
    steps: formattedSteps,
  });
});
