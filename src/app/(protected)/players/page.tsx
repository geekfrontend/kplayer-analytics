"use client";

import { useCallback, useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveSeason } from "@/components/app/active-season-context";
import { useAuthUser } from "@/components/app/auth-user-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isApiClientError } from "@/lib/api-client";
import { DeletePlayerDialog } from "./components/delete-player-dialog";
import { PlayerFormDialog } from "./components/player-form-dialog";
import { PlayersFilterBar } from "./components/players-filter-bar";
import { PlayersTable } from "./components/players-table";
import {
  clubOptionsKeys,
  createPlayer,
  deletePlayer,
  fetchClubOptionsBySeason,
  fetchPlayers,
  playersKeys,
  updatePlayer,
  type ClubOption,
  type PlayerFormValues,
  type PlayerItem,
} from "./services/players";

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function PlayersPage() {
  const { user } = useAuthUser();
  const { activeSeason } = useActiveSeason();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlayerItem | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────

  // Fetch clubs untuk auto-select pertama kali
  const clubOptionsQuery = useQuery({
    queryKey: clubOptionsKeys.bySeason(activeSeason?.id ?? ""),
    enabled: Boolean(activeSeason?.id),
    staleTime: 60_000,
    queryFn: () => fetchClubOptionsBySeason(activeSeason!.id),
  });

  // Reset pilihan klub saat musim aktif berubah
  useEffect(() => {
    setSelectedClubId("");
    setPage(1);
  }, [activeSeason?.id]);

  // Auto-select klub pertama saat data clubs pertama kali tersedia
  useEffect(() => {
    if (selectedClubId) return; // sudah ada pilihan, jangan override
    const firstClub = clubOptionsQuery.data?.[0];
    if (firstClub) {
      setSelectedClubId(firstClub.club_id);
    }
  }, [clubOptionsQuery.data, selectedClubId]);

  const playersQuery = useQuery({
    queryKey: playersKeys.list({ page, q, clubId: selectedClubId }),
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchPlayers(page, q, selectedClubId, activeSeason?.id ?? ""),
  });

  // Fetcher untuk AsyncSelect klub — pakai cache dari clubOptionsQuery
  const clubFetcher = useCallback(
    async (_query?: string): Promise<ClubOption[]> => {
      if (!activeSeason?.id) return [];
      // Pakai data yang sudah di-cache oleh clubOptionsQuery
      return queryClient.fetchQuery({
        queryKey: clubOptionsKeys.bySeason(activeSeason.id),
        queryFn: () => fetchClubOptionsBySeason(activeSeason.id),
        staleTime: 60_000,
      });
    },
    [activeSeason?.id, queryClient],
  );

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: PlayerFormValues) =>
      createPlayer(payload, activeSeason?.id ?? "", selectedClubId),
    onSuccess: async () => {
      toast.success("Pemain berhasil ditambahkan");
      setIsFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: playersKeys.all });
    },    onError: (error) =>
      toast.error(getErrorMessage(error, "Gagal menambahkan pemain.")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: PlayerFormValues) =>
      updatePlayer(editingPlayer!.id, payload),
    onSuccess: async () => {
      toast.success("Pemain berhasil diperbarui");
      setIsFormOpen(false);
      setEditingPlayer(null);
      await queryClient.invalidateQueries({ queryKey: playersKeys.all });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Gagal memperbarui pemain.")),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlayer,
    onSuccess: async () => {
      toast.success("Pemain berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: playersKeys.all });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Gagal menghapus pemain.")),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleFormSubmit(values: PlayerFormValues) {
    if (editingPlayer) {
      void updateMutation.mutateAsync(values);
    } else {
      void createMutation.mutateAsync(values);
    }
  }

  function handleEditClick(player: PlayerItem) {
    setEditingPlayer(player);
    setIsFormOpen(true);
  }

  function handleFormOpenChange(open: boolean) {
    setIsFormOpen(open);
    if (!open) {
      setEditingPlayer(null);
      createMutation.reset();
      updateMutation.reset();
    }
  }

  function handleClubChange(clubId: string) {
    setSelectedClubId(clubId);
    setPage(1);
  }

  function handleSearchSubmit() {
    setPage(1);
    setQ(searchInput.trim());
  }

  function handleSearchReset() {
    setSearchInput("");
    setQ("");
    setPage(1);
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const total = playersQuery.data?.pagination.total ?? 0;
  const totalPages = playersQuery.data?.pagination.total_pages ?? 1;
  const isFormPending = createMutation.isPending || updateMutation.isPending;

  // Nama klub yang sedang dipilih — untuk ditampilkan di AsyncSelect trigger
  const selectedClubName =
    clubOptionsQuery.data?.find((c) => c.club_id === selectedClubId)
      ?.club_name ?? "";

  const errorMessage = playersQuery.error
    ? getErrorMessage(playersQuery.error, "Gagal mengambil data pemain.")
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle>Pemain</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total} pemain{selectedClubId ? " di klub ini" : " terdaftar"}
            </p>
          </div>

          <PlayersFilterBar
            searchInput={searchInput}
            activeQ={q}
            selectedClubId={selectedClubId}
            selectedClubName={selectedClubName}
            canWrite={canWrite}
            hasActiveSeason={Boolean(activeSeason?.id)}
            clubFetcher={clubFetcher}
            onSearchChange={setSearchInput}
            onSearchSubmit={handleSearchSubmit}
            onSearchReset={handleSearchReset}
            onClubChange={handleClubChange}
            onAddClick={() => setIsFormOpen(true)}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            <p className="rounded-(--radius-md) border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <PlayersTable
            rows={playersQuery.data?.items ?? []}
            isLoading={playersQuery.isLoading}
            isFetching={playersQuery.isFetching}
            canWrite={canWrite}
            page={page}
            total={total}
            totalPages={totalPages}
            onEdit={handleEditClick}
            onDelete={setDeleteTarget}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <PlayerFormDialog
        open={isFormOpen}
        isPending={isFormPending}
        editingPlayer={editingPlayer}
        activeClubName={selectedClubName}
        activeSeasonName={activeSeason?.name}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
      />

      <DeletePlayerDialog
        target={deleteTarget}
        isPending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
        onConfirm={(id) => void deleteMutation.mutateAsync(id)}
      />
    </section>
  );
}
