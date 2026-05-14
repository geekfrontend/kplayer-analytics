"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, Trophy, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  type ActiveLeague,
  useActiveLeague,
} from "@/components/app/active-league-context";
import { useActiveSeason } from "@/components/app/active-season-context";
import { useAuthUser } from "@/components/app/auth-user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { apiRequest, isApiClientError } from "@/lib/api-client";
import {
  clearActiveLeague as clearActiveLeagueApi,
  setActiveLeague as setActiveLeagueApi,
} from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeagueItem = {
  id: string;
  name: string;
  country: string;
};

type LeaguesListResponse = {
  items: LeagueItem[];
  pagination: { total: number };
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const createLeagueSchema = z.object({
  name: z.string().trim().min(2, "Nama liga minimal 2 karakter"),
  country: z.string().trim().min(2, "Negara minimal 2 karakter"),
});

type CreateLeaguePayload = z.infer<typeof createLeagueSchema>;
type CreateLeagueInput = z.input<typeof createLeagueSchema>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const leaguesKeys = {
  all: ["leagues"] as const,
  list: () => [...leaguesKeys.all, "switcher-list"] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeagueSwitcher() {
  const { user } = useAuthUser();
  const { activeLeague, setActiveLeague } = useActiveLeague();
  const { setActiveSeason } = useActiveSeason();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "admin";

  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const form = useForm<CreateLeagueInput, unknown, CreateLeaguePayload>({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: { name: "", country: "" },
    mode: "onTouched",
  });

  // Fetch daftar liga
  const leaguesQuery = useQuery({
    queryKey: leaguesKeys.list(),
    enabled: open,
    queryFn: async () => {
      const result = await apiRequest<LeaguesListResponse>(
        "/api/leagues?limit=100",
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // Switch liga aktif — reset season karena season terikat ke liga
  const switchMutation = useMutation({
    mutationFn: (leagueId: string) => setActiveLeagueApi(leagueId),
    onSuccess: (data) => {
      if (!data) return;
      const next: ActiveLeague = {
        id: data.active_league_id,
        name: data.active_league_name,
        country: data.active_league_country,
      };
      setActiveLeague(next);
      // Reset season — user harus pilih season baru dari liga ini
      setActiveSeason(null);
      setOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Hapus liga aktif — juga reset season
  const clearMutation = useMutation({
    mutationFn: () => clearActiveLeagueApi(),
    onSuccess: () => {
      setActiveLeague(null);
      setActiveSeason(null);
      setOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Buat liga baru
  const createMutation = useMutation({
    mutationFn: async (payload: CreateLeaguePayload) => {
      await apiRequest("/api/leagues", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Liga berhasil dibuat");
      form.reset();
      setShowCreateForm(false);
      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setShowCreateForm(false);
      form.reset();
      createMutation.reset();
    }
  }

  const handleCreateLeague = form.handleSubmit(async (values) => {
    await createMutation.mutateAsync(values);
  });

  const leagues = leaguesQuery.data?.items ?? [];
  const isBusy = switchMutation.isPending || clearMutation.isPending;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden items-center gap-1.5 md:flex"
          aria-label="Ganti liga aktif"
        >
          <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-28 truncate text-sm font-medium">
            {activeLeague?.name ?? "Semua Liga"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filter Liga
          </p>
          {canWrite && !showCreateForm ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </Button>
          ) : null}
        </div>

        <Separator />

        {/* Form tambah liga (admin only) */}
        {showCreateForm ? (
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Liga Baru</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setShowCreateForm(false);
                  form.reset();
                  createMutation.reset();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <form onSubmit={handleCreateLeague} className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="ls-name" className="text-xs">
                  Nama Liga
                </Label>
                <Input
                  id="ls-name"
                  placeholder="Liga 1"
                  className="h-8 text-sm"
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-danger">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="ls-country" className="text-xs">
                  Negara
                </Label>
                <Input
                  id="ls-country"
                  placeholder="Indonesia"
                  className="h-8 text-sm"
                  {...form.register("country")}
                />
                {form.formState.errors.country ? (
                  <p className="text-xs text-danger">
                    {form.formState.errors.country.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={createMutation.isPending || !form.formState.isValid}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Liga"
                )}
              </Button>
            </form>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto py-1">
            {/* Opsi "Semua Liga" */}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                if (activeLeague) clearMutation.mutate();
                else setOpen(false);
              }}
              className={[
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                !activeLeague ? "bg-primary/5 text-foreground" : "text-foreground hover:bg-muted",
                isBusy ? "opacity-50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {clearMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : !activeLeague ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : null}
              </span>
              <span className="flex-1 font-medium">Semua Liga</span>
            </button>

            <Separator className="my-1" />

            {leaguesQuery.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat...
              </div>
            ) : leagues.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Belum ada liga.
              </p>
            ) : (
              leagues.map((league) => {
                const isActive = activeLeague?.id === league.id;
                const isSwitching =
                  switchMutation.isPending &&
                  switchMutation.variables === league.id;

                return (
                  <button
                    key={league.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      if (!isActive) switchMutation.mutate(league.id);
                      else setOpen(false);
                    }}
                    className={[
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-primary/5 text-foreground"
                        : "text-foreground hover:bg-muted",
                      isBusy && !isSwitching ? "opacity-50" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSwitching ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : isActive ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : null}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {league.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {league.country}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
