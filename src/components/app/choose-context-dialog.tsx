"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { type ActiveLeague } from "@/components/app/active-league-context";
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
import { Separator } from "@/components/ui/separator";
import { apiRequest, isApiClientError } from "@/lib/api-client";
import { setActiveLeague, setActiveSeason } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeagueItem = {
  id: string;
  name: string;
  country: string;
};

type SeasonItem = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  league_id: string | null;
};

type LeaguesListResponse = {
  items: LeagueItem[];
};

type SeasonsListResponse = {
  items: SeasonItem[];
};

type Step = "league" | "season";

// ─── Props ────────────────────────────────────────────────────────────────────

type ChooseContextDialogProps = {
  open: boolean;
  /** Dipanggil setelah liga dan season berhasil dipilih */
  onContextChosen: (league: ActiveLeague, season: ActiveSeason) => void;
  /** Liga yang sudah aktif sebelumnya (jika ada), untuk skip step liga */
  initialLeague?: ActiveLeague | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChooseContextDialog({
  open,
  onContextChosen,
  initialLeague,
}: ChooseContextDialogProps) {
  // Jika sudah ada liga aktif, langsung ke step season
  const [step, setStep] = useState<Step>(initialLeague ? "season" : "league");
  const [selectedLeague, setSelectedLeague] = useState<LeagueItem | null>(
    initialLeague ?? null,
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const leaguesQuery = useQuery({
    queryKey: ["leagues", "choose-dialog"],
    enabled: open && step === "league",
    queryFn: async () => {
      const result = await apiRequest<LeaguesListResponse>(
        "/api/leagues?limit=100",
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  const seasonsQuery = useQuery({
    queryKey: ["seasons", "choose-dialog", selectedLeague?.id],
    enabled: open && step === "season" && Boolean(selectedLeague?.id),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (selectedLeague?.id) params.set("league_id", selectedLeague.id);

      const result = await apiRequest<SeasonsListResponse>(
        `/api/seasons?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const setLeagueMutation = useMutation({
    mutationFn: (leagueId: string) => setActiveLeague(leagueId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const setSeasonMutation = useMutation({
    mutationFn: (seasonId: string) => setActiveSeason(seasonId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleLeagueConfirm() {
    if (!selectedLeague) return;

    const data = await setLeagueMutation.mutateAsync(selectedLeague.id);
    if (!data) return;

    setStep("season");
    setSelectedSeasonId(null);
  }

  async function handleSeasonConfirm() {
    if (!selectedSeasonId || !selectedLeague) return;

    const data = await setSeasonMutation.mutateAsync(selectedSeasonId);
    if (!data) return;

    onContextChosen(
      {
        id: selectedLeague.id,
        name: selectedLeague.name,
        country: selectedLeague.country,
      },
      {
        id: data.active_season_id,
        name: data.active_season_name,
        league_id: data.active_league_id ?? null,
        league_name: data.active_league_name ?? null,
      },
    );
  }

  function handleBackToLeague() {
    setStep("league");
    setSelectedSeasonId(null);
    // Jangan reset selectedLeague agar tetap terlihat terpilih
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const leagues = leaguesQuery.data?.items ?? [];
  const seasons = seasonsQuery.data?.items ?? [];

  return (
    <Dialog open={open}>
      <DialogContent
        className="border-border bg-background sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* ── Step: Pilih Liga ── */}
        {step === "league" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Pilih Liga
              </DialogTitle>
              <DialogDescription>
                Pilih liga yang ingin Anda pantau. Musim akan disesuaikan
                berdasarkan liga yang dipilih.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-2">
              {leaguesQuery.isLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat daftar liga...
                </div>
              ) : leagues.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada liga yang tersedia.
                </p>
              ) : (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {leagues.map((league) => {
                    const isSelected = selectedLeague?.id === league.id;
                    return (
                      <li key={league.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLeague(league)}
                          className={[
                            "flex w-full items-center justify-between rounded-(--radius-md) border px-3 py-2.5 text-left text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border bg-background text-foreground hover:border-border/80 hover:bg-muted/50",
                          ].join(" ")}
                        >
                          <div className="space-y-0.5">
                            <p className="font-medium">{league.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {league.country}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-2 flex justify-end">
              <Button
                onClick={() => void handleLeagueConfirm()}
                disabled={
                  !selectedLeague || setLeagueMutation.isPending
                }
              >
                {setLeagueMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Lanjutkan"
                )}
              </Button>
            </div>
          </>
        ) : (
          /* ── Step: Pilih Season ── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Pilih Musim
              </DialogTitle>
              <DialogDescription>
                Pilih musim untuk liga{" "}
                <span className="font-medium text-foreground">
                  {selectedLeague?.name}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            {/* Info liga terpilih */}
            <div className="flex items-center gap-2 rounded-(--radius-md) border border-border bg-muted/50 px-3 py-2 text-sm">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{selectedLeague?.name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {selectedLeague?.country}
              </span>
            </div>

            <Separator />

            <div className="space-y-2">
              {seasonsQuery.isLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat daftar musim...
                </div>
              ) : seasons.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada musim untuk liga ini.
                </p>
              ) : (
                <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {seasons.map((season) => {
                    const isSelected = selectedSeasonId === season.id;
                    return (
                      <li key={season.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedSeasonId(season.id)}
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
                          </div>
                          {season.is_active === 1 ? (
                            <Badge
                              variant="default"
                              className="ml-2 shrink-0 text-xs"
                            >
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

            <div className="mt-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToLeague}
                disabled={setSeasonMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4" />
                Ganti Liga
              </Button>
              <Button
                onClick={() => void handleSeasonConfirm()}
                disabled={!selectedSeasonId || setSeasonMutation.isPending}
              >
                {setSeasonMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Mulai"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
