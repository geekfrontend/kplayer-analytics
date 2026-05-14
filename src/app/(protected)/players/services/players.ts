import { apiRequest } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayerItem = {
  id: string;
  full_name: string;
  date_of_birth: string;
  nationality: string | null;
  primary_position: string;
  created_at: string;
  updated_at: string;
};

export type PlayersListResponse = {
  items: PlayerItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type ClubOption = {
  id: string;        // season_clubs.id
  club_id: string;
  club_name: string;
};

type SeasonClubsResponse = {
  items: ClubOption[];
  pagination: { total: number };
};

export type PlayerFormValues = {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  primary_position: string;
  join_date: string;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const playersKeys = {
  all: ["players"] as const,
  list: (params: { page: number; q: string; clubId: string }) =>
    [...playersKeys.all, "list", params] as const,
};

export const clubOptionsKeys = {
  bySeason: (seasonId: string) => ["club-options", seasonId] as const,
};

// ─── API functions ────────────────────────────────────────────────────────────

export async function fetchPlayers(
  page: number,
  q: string,
  clubId: string,
  seasonId: string,
): Promise<PlayersListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "10");
  if (q.trim()) params.set("q", q.trim());
  if (clubId) params.set("club_id", clubId);
  if (seasonId) params.set("season_id", seasonId);

  const result = await apiRequest<PlayersListResponse>(
    `/api/players?${params.toString()}`,
    { auth: true },
  );

  if (!result.envelope.data) throw new Error("Data tidak ditemukan");
  return result.envelope.data;
}

export async function fetchClubOptionsBySeason(
  seasonId: string,
): Promise<ClubOption[]> {
  const result = await apiRequest<SeasonClubsResponse>(
    `/api/season-clubs?season_id=${seasonId}&limit=100`,
    { auth: true },
  );
  return result.envelope.data?.items ?? [];
}

export async function createPlayer(
  payload: PlayerFormValues,
  seasonId: string,
  clubId: string,
): Promise<void> {
  // 1. Buat data pemain
  const result = await apiRequest<{ id: string }>("/api/players", {
    method: "POST",
    auth: true,
    body: {
      full_name: payload.full_name,
      date_of_birth: payload.date_of_birth,
      primary_position: payload.primary_position,
      ...(payload.nationality && payload.nationality.trim().length >= 2
        ? { nationality: payload.nationality.trim() }
        : {}),
    },
  });

  const playerId = result.envelope.data?.id;
  if (!playerId) throw new Error("Gagal mendapatkan ID pemain baru");

  // 2. Buat penugasan ke klub + musim aktif
  await apiRequest("/api/player-club-history", {
    method: "POST",
    auth: true,
    body: {
      player_id: playerId,
      season_id: seasonId,
      club_id: clubId,
      join_date: payload.join_date,
      is_active: true,
    },
  });
}

export async function updatePlayer(
  id: string,
  payload: Partial<PlayerFormValues>,
): Promise<void> {
  await apiRequest(`/api/players/${id}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

export async function deletePlayer(id: string): Promise<void> {
  await apiRequest(`/api/players/${id}`, {
    method: "DELETE",
    auth: true,
  });
}
