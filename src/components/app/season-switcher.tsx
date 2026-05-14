"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  type ActiveSeason,
  useActiveSeason,
} from "@/components/app/active-season-context";
import { useActiveLeague } from "@/components/app/active-league-context";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { apiRequest, isApiClientError } from "@/lib/api-client";
import { setActiveSeason as setActiveSeasonApi } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  pagination: { total: number };
};

type Mode = "list" | "create" | "edit";

// ─── Schema ───────────────────────────────────────────────────────────────────

const seasonSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format musim harus YYYY/YYYY"),
    league_id: z.string().optional(),
    start_date: z.iso.date("Format tanggal mulai harus YYYY-MM-DD"),
    end_date: z.iso.date("Format tanggal selesai harus YYYY-MM-DD"),
    is_active: z.boolean(),
  })
  .refine(
    (v) => Number(v.name.split("/")[1]) === Number(v.name.split("/")[0]) + 1,
    { path: ["name"], message: "Tahun musim tidak valid" },
  )
  .refine((v) => v.start_date < v.end_date, {
    path: ["end_date"],
    message: "Tanggal selesai harus lebih besar dari tanggal mulai",
  });

type SeasonPayload = z.infer<typeof seasonSchema>;
type SeasonInput = z.input<typeof seasonSchema>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const seasonsKeys = {
  all: ["seasons"] as const,
  list: () => [...seasonsKeys.all, "switcher-list"] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SeasonSwitcher() {
  const { user } = useAuthUser();
  const { activeSeason, setActiveSeason } = useActiveSeason();
  const { activeLeague } = useActiveLeague();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "admin";

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [editingSeason, setEditingSeason] = useState<SeasonItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeasonItem | null>(null);

  const form = useForm<SeasonInput, unknown, SeasonPayload>({
    resolver: zodResolver(seasonSchema),
    defaultValues: { name: "", start_date: "", end_date: "", is_active: false },
    mode: "onTouched",
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

  const seasonsQuery = useQuery({
    queryKey: [...seasonsKeys.list(), activeLeague?.id ?? "all"],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (activeLeague?.id) params.set("league_id", activeLeague.id);

      const result = await apiRequest<SeasonsListResponse>(
        `/api/seasons?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const switchMutation = useMutation({
    mutationFn: (seasonId: string) => setActiveSeasonApi(seasonId),
    onSuccess: (data) => {
      if (!data) return;
      const next: ActiveSeason = {
        id: data.active_season_id,
        name: data.active_season_name ?? "",
        league_id: data.active_league_id ?? null,
        league_name: data.active_league_name ?? null,
      };
      setActiveSeason(next);
      setOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SeasonPayload) => {
      await apiRequest("/api/seasons", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Musim berhasil dibuat");
      form.reset();
      setMode("list");
      await queryClient.invalidateQueries({ queryKey: seasonsKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; payload: SeasonPayload }) => {
      await apiRequest(`/api/seasons/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async (_data, variables) => {
      toast.success("Musim berhasil diperbarui");
      form.reset();
      setMode("list");
      setEditingSeason(null);

      // Update active season context jika yang diedit adalah musim aktif
      if (activeSeason?.id === variables.id) {
        setActiveSeason({
          ...activeSeason,
          name: variables.payload.name,
          league_id: variables.payload.league_id ?? null,
        });
      }

      await queryClient.invalidateQueries({ queryKey: seasonsKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/seasons/${id}`, { method: "DELETE", auth: true });
    },
    onSuccess: async (_data, id) => {
      toast.success("Musim berhasil dihapus");
      setDeleteTarget(null);

      // Reset active season jika yang dihapus adalah musim aktif
      if (activeSeason?.id === id) {
        setActiveSeason(null);
      }

      await queryClient.invalidateQueries({ queryKey: seasonsKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function resetState() {
    setMode("list");
    setEditingSeason(null);
    form.reset();
    createMutation.reset();
    updateMutation.reset();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  function handleStartCreate() {
    form.reset({
      name: "",
      league_id: activeLeague?.id ?? "",
      start_date: "",
      end_date: "",
      is_active: false,
    });
    setEditingSeason(null);
    setMode("create");
  }

  function handleStartEdit(season: SeasonItem) {
    form.reset({
      name: season.name,
      league_id: season.league_id ?? "",
      start_date: season.start_date,
      end_date: season.end_date,
      is_active: season.is_active === 1,
    });
    setEditingSeason(season);
    setMode("edit");
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    if (mode === "edit" && editingSeason) {
      await updateMutation.mutateAsync({ id: editingSeason.id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  const seasons = seasonsQuery.data?.items ?? [];
  const isFormBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="hidden items-center gap-1.5 md:flex"
            aria-label="Ganti musim aktif"
          >
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-28 truncate text-sm font-medium">
              {activeSeason?.name ?? "Pilih Musim"}
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
                    {mode === "edit" ? "Edit Musim" : "Musim Baru"}
                  </p>
                </div>
              </div>
              <Separator />

              <form onSubmit={handleSubmit} className="space-y-2.5 p-3">
                {activeLeague ? (
                  <div className="flex items-center gap-1.5 rounded-(--radius-md) bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
                    <span>Liga:</span>
                    <span className="font-medium text-foreground">
                      {activeLeague.name}
                    </span>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <Label htmlFor="ss-name" className="text-xs">
                    Nama Musim
                  </Label>
                  <Input
                    id="ss-name"
                    placeholder="2026/2027"
                    className="h-8 text-sm"
                    {...form.register("name")}
                  />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ss-start" className="text-xs">
                      Mulai
                    </Label>
                    <Input
                      id="ss-start"
                      type="date"
                      className="h-8 text-sm"
                      {...form.register("start_date")}
                    />
                    {form.formState.errors.start_date ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.start_date.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ss-end" className="text-xs">
                      Selesai
                    </Label>
                    <Input
                      id="ss-end"
                      type="date"
                      className="h-8 text-sm"
                      {...form.register("end_date")}
                    />
                    {form.formState.errors.end_date ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.end_date.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-foreground">
                  <Checkbox
                    checked={form.watch("is_active")}
                    onCheckedChange={(checked) =>
                      form.setValue("is_active", checked === true, {
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  Jadikan musim aktif
                </label>

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
                <div className="space-y-0.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pilih Musim
                  </p>
                  {activeLeague ? (
                    <p className="text-xs text-muted-foreground">
                      Liga: {activeLeague.name}
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleStartCreate}
                    title="Tambah musim"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <Separator />

              <div className="max-h-72 overflow-y-auto py-1">
                {seasonsQuery.isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat...
                  </div>
                ) : seasons.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    {activeLeague
                      ? `Belum ada musim untuk liga ${activeLeague.name}.`
                      : "Belum ada musim."}
                  </p>
                ) : (
                  seasons.map((season) => {
                    const isActive = activeSeason?.id === season.id;
                    const isSwitching =
                      switchMutation.isPending &&
                      switchMutation.variables === season.id;

                    return (
                      <div
                        key={season.id}
                        className={[
                          "group flex items-center gap-1 px-2 transition-colors",
                          isActive ? "bg-primary/5" : "hover:bg-muted",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          disabled={switchMutation.isPending}
                          onClick={() => {
                            if (!isActive) switchMutation.mutate(season.id);
                            else setOpen(false);
                          }}
                          className={[
                            "flex flex-1 items-center gap-2.5 py-2 pl-1 text-left text-sm",
                            switchMutation.isPending && !isSwitching
                              ? "opacity-50"
                              : "",
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
                            {season.name}
                          </span>
                          {!activeLeague && season.league_name ? (
                            <span className="ml-1 shrink-0 truncate text-xs text-muted-foreground">
                              {season.league_name}
                            </span>
                          ) : null}
                          {season.is_active === 1 ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-primary/30 text-xs text-primary"
                            >
                              Aktif
                            </Badge>
                          ) : null}
                        </button>

                        {canWrite ? (
                          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(season);
                              }}
                              title="Edit musim"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(season);
                              }}
                              title="Hapus musim"
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
            <AlertDialogTitle>Hapus Musim</AlertDialogTitle>
            <AlertDialogDescription>
              Musim{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              akan dihapus permanen. Pastikan tidak ada klub, penugasan, atau
              statistik yang masih terhubung ke musim ini.
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
