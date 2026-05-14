"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  type ActiveSeason,
  useActiveSeason,
} from "@/components/app/active-season-context";
import { useActiveLeague } from "@/components/app/active-league-context";
import { useAuthUser } from "@/components/app/auth-user-context";
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const createSeasonSchema = z
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

type CreateSeasonPayload = z.infer<typeof createSeasonSchema>;
type CreateSeasonInput = z.input<typeof createSeasonSchema>;

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
  const [showCreateForm, setShowCreateForm] = useState(false);

  const form = useForm<CreateSeasonInput, unknown, CreateSeasonPayload>({
    resolver: zodResolver(createSeasonSchema),
    defaultValues: { name: "", start_date: "", end_date: "", is_active: false },
    mode: "onTouched",
  });
  // Fetch daftar season — filter berdasarkan liga aktif jika ada
  // Query key menyertakan activeLeague.id agar otomatis refetch saat liga berubah
  const seasonsQuery = useQuery({
    queryKey: [...seasonsKeys.list(), activeLeague?.id ?? "all"],
    enabled: open,
    staleTime: 0, // selalu refetch saat liga berubah
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

  // Mutation switch season aktif
  const switchMutation = useMutation({
    mutationFn: (seasonId: string) => setActiveSeasonApi(seasonId),
    onSuccess: (data, seasonId) => {
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
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Mutation buat season baru
  const createMutation = useMutation({
    mutationFn: async (payload: CreateSeasonPayload) => {
      await apiRequest("/api/seasons", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Musim berhasil dibuat");
      form.reset();
      setShowCreateForm(false);
      await queryClient.invalidateQueries({ queryKey: seasonsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setShowCreateForm(false);
      form.reset();
      createMutation.reset();
    }
  }

  const handleCreateSeason = form.handleSubmit(async (values) => {
    await createMutation.mutateAsync(values);
  });

  const seasons = seasonsQuery.data?.items ?? [];

  return (
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
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pilih Musim
            </p>
            {activeLeague ? (
              <p className="text-xs text-muted-foreground">
                Liga: {activeLeague.name}
              </p>
            ) : null}
          </div>
          {canWrite && !showCreateForm ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => {
                // Set league_id otomatis dari liga aktif
                form.setValue("league_id", activeLeague?.id ?? "");
                setShowCreateForm(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </Button>
          ) : null}
        </div>

        <Separator />

        {/* Form tambah musim (admin only) */}
        {showCreateForm ? (
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Musim Baru</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setShowCreateForm(false);
                  form.reset();
                  createMutation.reset();
                }}              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <form onSubmit={handleCreateSeason} className="space-y-2.5">
              {activeLeague ? (
                <div className="flex items-center gap-1.5 rounded-(--radius-md) bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
                  <span>Liga:</span>
                  <span className="font-medium text-foreground">{activeLeague.name}</span>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label htmlFor="sw-name" className="text-xs">
                  Nama Musim
                </Label>
                <Input
                  id="sw-name"
                  placeholder="2026/2027"
                  className="h-8 text-sm"
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-danger">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="sw-start" className="text-xs">
                    Mulai
                  </Label>
                  <Input
                    id="sw-start"
                    type="date"
                    className="h-8 text-sm"
                    {...form.register("start_date")}
                  />
                  {form.formState.errors.start_date ? (
                    <p className="text-xs text-danger">
                      {form.formState.errors.start_date.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sw-end" className="text-xs">
                    Selesai
                  </Label>
                  <Input
                    id="sw-end"
                    type="date"
                    className="h-8 text-sm"
                    {...form.register("end_date")}
                  />
                  {form.formState.errors.end_date ? (
                    <p className="text-xs text-danger">
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
                disabled={createMutation.isPending || !form.formState.isValid}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Musim"
                )}
              </Button>
            </form>
          </div>
        ) : (
          /* Daftar season */
          <div className="max-h-64 overflow-y-auto py-1">
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
                  <button
                    key={season.id}
                    type="button"
                    disabled={switchMutation.isPending}
                    onClick={() => {
                      if (!isActive) switchMutation.mutate(season.id);
                    }}
                    className={[
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-primary/5 text-foreground"
                        : "text-foreground hover:bg-muted",
                      switchMutation.isPending && !isSwitching
                        ? "opacity-50"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Checkmark / spinner */}
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
                    {season.league_name ? (
                      <span className="ml-1 shrink-0 text-xs text-muted-foreground">
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
                );
              })
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
