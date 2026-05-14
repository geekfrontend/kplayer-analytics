"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useActiveLeague } from "@/components/app/active-league-context";
import { useActiveSeason } from "@/components/app/active-season-context";
import { useAuthUser } from "@/components/app/auth-user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isApiClientError } from "@/lib/api-client";
import { AddClubDialog, type AddClubPayload } from "./components/add-club-dialog";
import { ClubsContextBanner } from "./components/clubs-context-banner";
import { ClubsTable } from "./components/clubs-table";
import { RemoveClubDialog } from "./components/remove-club-dialog";
import {
  clubsKeys,
  createClub,
  fetchSeasonClubs,
  registerClubToSeason,
  removeClubFromSeason,
  seasonClubsKeys,
  type SeasonClubRow,
} from "./services/season-clubs";

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ClubsPage() {
  const { user } = useAuthUser();
  const { activeSeason } = useActiveSeason();
  const { activeLeague } = useActiveLeague();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SeasonClubRow | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const seasonClubsQuery = useQuery({
    queryKey: seasonClubsKeys.bySeason(activeSeason?.id ?? "", page, q),
    enabled: Boolean(activeSeason?.id),
    placeholderData: keepPreviousData,
    queryFn: () => fetchSeasonClubs(activeSeason!.id, page),
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const addAndRegisterMutation = useMutation({
    mutationFn: async (payload: AddClubPayload) => {
      const { id } = await createClub(payload.name);
      await registerClubToSeason(activeSeason!.id, id);
    },
    onSuccess: async () => {
      toast.success("Klub berhasil ditambahkan");
      setIsAddDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: seasonClubsKeys.all });
      await queryClient.invalidateQueries({ queryKey: clubsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menambahkan klub."));
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeClubFromSeason,
    onSuccess: async () => {
      toast.success("Klub dikeluarkan dari musim");
      setRemoveTarget(null);
      await queryClient.invalidateQueries({ queryKey: seasonClubsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal mengeluarkan klub."));
    },
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  const total = seasonClubsQuery.data?.pagination.total ?? 0;
  const totalPages = seasonClubsQuery.data?.pagination.total_pages ?? 1;

  const errorMessage = seasonClubsQuery.error
    ? getErrorMessage(seasonClubsQuery.error, "Gagal mengambil data klub.")
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <ClubsContextBanner activeSeason={activeSeason} activeLeague={activeLeague} />

      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle>Klub</CardTitle>
            <p className="text-sm text-muted-foreground">
              {activeSeason
                ? `${total} klub terdaftar di musim ${activeSeason.name}`
                : "Pilih musim aktif untuk melihat daftar klub"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(searchInput.trim());
              }}
            >
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari klub..."
                  className="h-8 w-44 pl-8 text-sm"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Cari"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
              {q ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Reset pencarian"
                  onClick={() => {
                    setSearchInput("");
                    setQ("");
                    setPage(1);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </form>

            {canWrite && activeSeason ? (
              <Button
                size="sm"
                className="h-8"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            <p className="rounded-(--radius-md) border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <ClubsTable
            rows={seasonClubsQuery.data?.items ?? []}
            isLoading={seasonClubsQuery.isLoading}
            isFetching={seasonClubsQuery.isFetching}
            hasActiveSeason={Boolean(activeSeason)}
            activeSeasonName={activeSeason?.name ?? ""}
            canWrite={canWrite}
            page={page}
            total={total}
            totalPages={totalPages}
            onRemove={setRemoveTarget}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <AddClubDialog
        open={isAddDialogOpen}
        isPending={addAndRegisterMutation.isPending}
        seasonName={activeSeason?.name}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) addAndRegisterMutation.reset();
        }}
        onSubmit={(values) => void addAndRegisterMutation.mutateAsync(values)}
      />

      <RemoveClubDialog
        target={removeTarget}
        isPending={removeMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
            removeMutation.reset();
          }
        }}
        onConfirm={(id) => void removeMutation.mutateAsync(id)}
      />
    </section>
  );
}
