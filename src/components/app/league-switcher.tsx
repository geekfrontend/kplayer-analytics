"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  type ActiveLeague,
  useActiveLeague,
} from "@/components/app/active-league-context";
import { useActiveSeason } from "@/components/app/active-season-context";
import { useAuthUser } from "@/components/app/auth-user-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type Mode = "list" | "create" | "edit";

// ─── Schema ───────────────────────────────────────────────────────────────────

const leagueSchema = z.object({
  name: z.string().trim().min(2, "Nama liga minimal 2 karakter"),
  country: z.string().trim().min(2, "Negara minimal 2 karakter"),
});

type LeaguePayload = z.infer<typeof leagueSchema>;
type LeagueInput = z.input<typeof leagueSchema>;

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
  const [mode, setMode] = useState<Mode>("list");
  const [editingLeague, setEditingLeague] = useState<LeagueItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeagueItem | null>(null);

  const form = useForm<LeagueInput, unknown, LeaguePayload>({
    resolver: zodResolver(leagueSchema),
    defaultValues: { name: "", country: "" },
    mode: "onTouched",
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

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

  // ─── Mutations ──────────────────────────────────────────────────────────────

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
      setActiveSeason(null);
      setOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearActiveLeagueApi(),
    onSuccess: () => {
      setActiveLeague(null);
      setActiveSeason(null);
      setOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: LeaguePayload) => {
      await apiRequest("/api/leagues", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Liga berhasil dibuat");
      form.reset();
      setMode("list");
      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; payload: LeaguePayload }) => {
      await apiRequest(`/api/leagues/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async (_data, variables) => {
      toast.success("Liga berhasil diperbarui");
      form.reset();
      setMode("list");
      setEditingLeague(null);

      // Update active league context jika yang diedit adalah liga aktif
      if (activeLeague?.id === variables.id) {
        setActiveLeague({
          id: variables.id,
          name: variables.payload.name,
          country: variables.payload.country,
        });
      }

      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/leagues/${id}`, { method: "DELETE", auth: true });
    },
    onSuccess: async (_data, id) => {
      toast.success("Liga berhasil dihapus");
      setDeleteTarget(null);

      // Reset active league jika yang dihapus adalah liga aktif
      if (activeLeague?.id === id) {
        setActiveLeague(null);
        setActiveSeason(null);
      }

      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function resetState() {
    setMode("list");
    setEditingLeague(null);
    form.reset();
    createMutation.reset();
    updateMutation.reset();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  function handleStartCreate() {
    form.reset({ name: "", country: "" });
    setEditingLeague(null);
    setMode("create");
  }

  function handleStartEdit(league: LeagueItem) {
    form.reset({ name: league.name, country: league.country });
    setEditingLeague(league);
    setMode("edit");
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    if (mode === "edit" && editingLeague) {
      await updateMutation.mutateAsync({ id: editingLeague.id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  const leagues = leaguesQuery.data?.items ?? [];
  const isBusy = switchMutation.isPending || clearMutation.isPending;
  const isFormBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
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
          {/* ── Mode: Form (create/edit) ── */}
          {mode !== "list" ? (
            <>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={resetState}
                    title="Kembali"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                  <p className="text-sm font-medium">
                    {mode === "edit" ? "Edit Liga" : "Liga Baru"}
                  </p>
                </div>
              </div>
              <Separator />

              <form onSubmit={handleSubmit} className="space-y-2.5 p-3">
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
                    <p className="text-xs text-destructive">
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
                    <p className="text-xs text-destructive">
                      {form.formState.errors.country.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={isFormBusy || !form.formState.isValid}
                >
                  {isFormBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : mode === "edit" ? (
                    "Perbarui"
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </form>
            </>
          ) : (
            /* ── Mode: List ── */
            <>
              <div className="flex items-center justify-between px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Filter Liga
                </p>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleStartCreate}
                    title="Tambah liga"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <Separator />

              <div className="max-h-72 overflow-y-auto py-1">
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
                    !activeLeague
                      ? "bg-primary/5 text-foreground"
                      : "text-foreground hover:bg-muted",
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
                      <div
                        key={league.id}
                        className={[
                          "group flex items-center gap-1 px-2 transition-colors",
                          isActive
                            ? "bg-primary/5"
                            : "hover:bg-muted",
                        ].join(" ")}
                      >
                        {/* Tombol pilih (mengisi sebagian besar baris) */}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            if (!isActive) switchMutation.mutate(league.id);
                            else setOpen(false);
                          }}
                          className={[
                            "flex flex-1 items-center gap-2.5 py-2 pl-1 text-left text-sm",
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

                        {/* Action icons (admin only) */}
                        {canWrite ? (
                          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(league);
                              }}
                              title="Edit liga"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(league);
                              }}
                              title="Hapus liga"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Konfirmasi hapus */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Liga</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              akan dihapus permanen. Musim yang terhubung akan kehilangan
              referensi liganya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                void deleteMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
