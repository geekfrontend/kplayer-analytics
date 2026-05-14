"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type ActiveSeason } from "@/components/app/active-season-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, isApiClientError } from "@/lib/api-client";
import { setActiveSeason } from "@/lib/auth";

type SeasonItem = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  league_id: string | null;
  league_name: string | null;
};

type SeasonsListResponse = {
  items: SeasonItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

type ChooseSeasonDialogProps = {
  open: boolean;
  onSeasonChosen: (season: ActiveSeason) => void;
};

function getErrorMessage(error: unknown) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

export function ChooseSeasonDialog({
  open,
  onSeasonChosen,
}: ChooseSeasonDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const seasonsQuery = useQuery({
    queryKey: ["seasons", "choose-dialog"],
    enabled: open,
    queryFn: async () => {
      const result = await apiRequest<SeasonsListResponse>(
        "/api/seasons?limit=100",
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  const setSeasonMutation = useMutation({
    mutationFn: (seasonId: string) => setActiveSeason(seasonId),
    onSuccess: (data) => {
      if (!data) return;
      onSeasonChosen({
        id: data.active_season_id,
        name: data.active_season_name,
        league_id: data.active_league_id ?? null,
        league_name: data.active_league_name ?? null,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  function handleConfirm() {
    if (!selectedId) return;
    setSeasonMutation.mutate(selectedId);
  }

  const seasons = seasonsQuery.data?.items ?? [];

  return (
    <Dialog open={open}>
      <DialogContent
        className="border-border bg-background sm:max-w-md"
        // Tidak bisa ditutup tanpa memilih season
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Pilih Musim Aktif
          </DialogTitle>
          <DialogDescription>
            Pilih musim yang ingin Anda pantau. Semua data akan ditampilkan
            berdasarkan musim yang dipilih.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {seasonsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat daftar musim...
            </div>
          ) : seasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada musim yang tersedia.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {seasons.map((season) => {
                const isSelected = selectedId === season.id;
                return (
                  <li key={season.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(season.id)}
                      className={[
                        "flex w-full items-center justify-between rounded-(--radius-md) border px-3 py-2.5 text-left text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-foreground hover:border-border/80 hover:bg-muted/50",
                      ].join(" ")}
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium">{season.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {season.start_date} — {season.end_date}
                        </p>
                        {season.league_name ? (
                          <p className="text-xs text-muted-foreground">
                            {season.league_name}
                          </p>
                        ) : null}
                      </div>
                      {season.is_active === 1 ? (
                        <Badge variant="default" className="ml-2 shrink-0 text-xs">
                          Aktif
                        </Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || setSeasonMutation.isPending}
          >
            {setSeasonMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Lanjutkan"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
