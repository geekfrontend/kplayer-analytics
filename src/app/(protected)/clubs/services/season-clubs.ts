import { apiRequest } from "@/lib/api-client";

export type SeasonClubRow = {
  id: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  created_at: string;
};

export type SeasonClubsListResponse = {
  items: SeasonClubRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export const seasonClubsKeys = {
  all: ["season-clubs"] as const,
  bySeason: (seasonId: string, page: number, q: string) =>
    [...seasonClubsKeys.all, seasonId, page, q] as const,
};

export const clubsKeys = {
  all: ["clubs"] as const,
};

export async function fetchSeasonClubs(
  seasonId: string,
  page: number,
  limit = 10,
): Promise<SeasonClubsListResponse> {
  const params = new URLSearchParams();
  params.set("season_id", seasonId);
  params.set("page", String(page));
  params.set("limit", String(limit));

  const result = await apiRequest<SeasonClubsListResponse>(
    `/api/season-clubs?${params.toString()}`,
    { auth: true },
  );

  if (!result.envelope.data) {
    throw new Error("Data tidak ditemukan");
  }

  return result.envelope.data;
}

export async function createClub(name: string): Promise<{ id: string }> {
  const result = await apiRequest<{ id: string }>("/api/clubs", {
    method: "POST",
    auth: true,
    body: { name },
  });

  const id = result.envelope.data?.id;
  if (!id) throw new Error("Gagal mendapatkan ID klub baru");

  return { id };
}

export async function registerClubToSeason(
  seasonId: string,
  clubId: string,
): Promise<void> {
  await apiRequest("/api/season-clubs", {
    method: "POST",
    auth: true,
    body: { season_id: seasonId, club_id: clubId },
  });
}

export async function removeClubFromSeason(
  seasonClubId: string,
): Promise<void> {
  await apiRequest(`/api/season-clubs/${seasonClubId}`, {
    method: "DELETE",
    auth: true,
  });
}
