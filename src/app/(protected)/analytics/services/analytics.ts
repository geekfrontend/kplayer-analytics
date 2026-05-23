import { apiRequest } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeatureValues = {
  goals: number;
  assists: number;
  shots: number;
};

export type ClusterSummary = {
  cluster: number;
  size: number;
  centroid: FeatureValues;
  avg_performance_score: number;
  is_top_performer: boolean;
};

export type ClusteredPlayer = {
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
  cluster: number;
  performance_score: number;
};

export type KMeansStepDTO = {
  iteration: number;
  centroids_zscore: FeatureValues[];
  centroids_original: FeatureValues[];
  new_centroids_zscore: FeatureValues[];
  assignments: number[];
  changed_count: number;
  converged: boolean;
};

export type KMeansResult = {
  total_players: number;
  k_used: number;
  iterations: number;
  converged: boolean;
  filters: {
    season_id?: string;
    club_id?: string;
    league_id?: string;
  };
  feature_means: FeatureValues;
  feature_stds: FeatureValues;
  clusters: ClusterSummary[];
  top_cluster_id: number;
  players: ClusteredPlayer[];
  steps: KMeansStepDTO[];
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const analyticsKeys = {
  kmeans: (params: {
    seasonId: string;
    clubId: string;
    leagueId: string;
    k: number;
    maxIter: number;
    includeSteps: boolean;
  }) => ["analytics", "kmeans", params] as const,
};

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchKMeans(params: {
  seasonId?: string;
  clubId?: string;
  leagueId?: string;
  k: number;
  maxIter: number;
  includeSteps: boolean;
}): Promise<KMeansResult> {
  const search = new URLSearchParams();
  if (params.seasonId) search.set("season_id", params.seasonId);
  if (params.clubId) search.set("club_id", params.clubId);
  if (params.leagueId) search.set("league_id", params.leagueId);
  search.set("k", String(params.k));
  search.set("max_iter", String(params.maxIter));
  if (params.includeSteps) search.set("include_steps", "true");

  const result = await apiRequest<KMeansResult>(
    `/api/analytics/kmeans?${search.toString()}`,
    { auth: true },
  );

  if (!result.envelope.data) throw new Error("Data tidak ditemukan");
  return result.envelope.data;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

/**
 * Palet warna untuk cluster — konsisten antar komponen.
 * Menggunakan warna yang ramah accessibility.
 */
export const CLUSTER_COLORS = [
  { bg: "bg-blue-500", text: "text-white", soft: "bg-blue-50 text-blue-700 border-blue-200", hex: "#3b82f6" },
  { bg: "bg-emerald-500", text: "text-white", soft: "bg-emerald-50 text-emerald-700 border-emerald-200", hex: "#10b981" },
  { bg: "bg-amber-500", text: "text-white", soft: "bg-amber-50 text-amber-700 border-amber-200", hex: "#f59e0b" },
  { bg: "bg-pink-500", text: "text-white", soft: "bg-pink-50 text-pink-700 border-pink-200", hex: "#ec4899" },
  { bg: "bg-indigo-500", text: "text-white", soft: "bg-indigo-50 text-indigo-700 border-indigo-200", hex: "#6366f1" },
  { bg: "bg-teal-500", text: "text-white", soft: "bg-teal-50 text-teal-700 border-teal-200", hex: "#14b8a6" },
  { bg: "bg-orange-500", text: "text-white", soft: "bg-orange-50 text-orange-700 border-orange-200", hex: "#f97316" },
  { bg: "bg-fuchsia-500", text: "text-white", soft: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", hex: "#d946ef" },
  { bg: "bg-cyan-500", text: "text-white", soft: "bg-cyan-50 text-cyan-700 border-cyan-200", hex: "#06b6d4" },
  { bg: "bg-rose-500", text: "text-white", soft: "bg-rose-50 text-rose-700 border-rose-200", hex: "#f43f5e" },
] as const;

export function getClusterColor(cluster: number) {
  return CLUSTER_COLORS[cluster % CLUSTER_COLORS.length];
}

export const FEATURE_LABELS: Record<keyof FeatureValues, string> = {
  goals: "Gol",
  assists: "Assist",
  shots: "Tembakan",
};
