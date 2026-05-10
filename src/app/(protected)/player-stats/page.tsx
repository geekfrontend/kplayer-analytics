"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { History, Loader2, Pencil, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuthUser } from "@/components/app/auth-user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, isApiClientError } from "@/lib/api-client";

type PlayerStatsItem = {
  id: string;
  player_id: string;
  player_name: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

type PlayerStatsListResponse = {
  items: PlayerStatsItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

type OptionItem = {
  id: string;
  name: string;
};

type PlayerStatsHistoryItem = {
  id: string;
  player_stats_id: string;
  before_payload: {
    minutes_played?: number;
    goals?: number;
    assists?: number;
    shots?: number;
  } | null;
  after_payload: {
    minutes_played?: number;
    goals?: number;
    assists?: number;
    shots?: number;
  } | null;
  changed_by: string;
  changed_at: string;
};

type PlayerStatsHistoryResponse = {
  items: PlayerStatsHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

const statsFormSchema = z
  .object({
    player_id: z.string().min(1, "Pemain wajib dipilih"),
    season_id: z.string().min(1, "Musim wajib dipilih"),
    club_id: z.string().min(1, "Klub wajib dipilih"),
    minutes_played: z.coerce.number().int().min(0, "Menit minimal 0"),
    goals: z.coerce.number().int().min(0, "Gol minimal 0"),
    assists: z.coerce.number().int().min(0, "Asis minimal 0"),
    shots: z.coerce.number().int().min(0, "Tembakan minimal 0"),
  })
  .refine((data) => data.shots >= data.goals, {
    path: ["shots"],
    message: "Tembakan tidak boleh lebih kecil dari gol",
  });

type StatsFormValues = z.infer<typeof statsFormSchema>;
type StatsFormInput = z.input<typeof statsFormSchema>;

const columnHelper = createColumnHelper<PlayerStatsItem>();
const statsKeys = {
  all: ["player-stats"] as const,
  list: (params: {
    page: number;
    player_id: string;
    season_id: string;
    club_id: string;
  }) => [...statsKeys.all, "list", params] as const,
  history: (params: { id: string; page: number }) =>
    [...statsKeys.all, "history", params] as const,
};

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function PlayerStatsPage() {
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlayerStatsItem | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PlayerStatsItem | null>(
    null,
  );
  const [historyPage, setHistoryPage] = useState(1);
  const [playerFilterInput, setPlayerFilterInput] = useState("");
  const [seasonFilterInput, setSeasonFilterInput] = useState("");
  const [clubFilterInput, setClubFilterInput] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");

  const form = useForm<StatsFormInput, unknown, StatsFormValues>({
    resolver: zodResolver(statsFormSchema),
    defaultValues: {
      player_id: "",
      season_id: "",
      club_id: "",
      minutes_played: 0,
      goals: 0,
      assists: 0,
      shots: 0,
    },
    mode: "onTouched",
  });

  const playersOptionsQuery = useQuery({
    queryKey: ["players", "options"],
    queryFn: async () => {
      const result = await apiRequest<{ items: OptionItem[] }>(
        "/api/players?page=1&limit=100",
        { auth: true },
      );
      return result.envelope.data?.items ?? [];
    },
  });

  const seasonsOptionsQuery = useQuery({
    queryKey: ["seasons", "options"],
    queryFn: async () => {
      const result = await apiRequest<{ items: OptionItem[] }>(
        "/api/seasons?page=1&limit=100",
        { auth: true },
      );
      return result.envelope.data?.items ?? [];
    },
  });

  const clubsOptionsQuery = useQuery({
    queryKey: ["clubs", "options"],
    queryFn: async () => {
      const result = await apiRequest<{ items: OptionItem[] }>(
        "/api/clubs?page=1&limit=100",
        { auth: true },
      );
      return result.envelope.data?.items ?? [];
    },
  });

  const playerStatsQuery = useQuery({
    queryKey: statsKeys.list({
      page,
      player_id: playerFilter,
      season_id: seasonFilter,
      club_id: clubFilter,
    }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (playerFilter) {
        params.set("player_id", playerFilter);
      }
      if (seasonFilter) {
        params.set("season_id", seasonFilter);
      }
      if (clubFilter) {
        params.set("club_id", clubFilter);
      }

      const result = await apiRequest<PlayerStatsListResponse>(
        `/api/player-stats?${params.toString()}`,
        {
          auth: true,
        },
      );

      return result.envelope.data;
    },
  });

  const historyQuery = useQuery({
    queryKey: statsKeys.history({
      id: historyTarget?.id ?? "",
      page: historyPage,
    }),
    enabled: Boolean(historyTarget),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!historyTarget) {
        return undefined;
      }

      const result = await apiRequest<PlayerStatsHistoryResponse>(
        `/api/player-stats/${historyTarget.id}/history?page=${historyPage}&limit=5`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  const createStatsMutation = useMutation({
    mutationFn: async (payload: {
      player_id: string;
      season_id: string;
      club_id: string;
      minutes_played: number;
      goals: number;
      assists: number;
      shots: number;
    }) => {
      await apiRequest("/api/player-stats", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Statistik pemain berhasil dibuat");
      setIsDialogOpen(false);
      setEditingItem(null);
      form.reset({
        player_id: "",
        season_id: "",
        club_id: "",
        minutes_played: 0,
        goals: 0,
        assists: 0,
        shots: 0,
      });
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: statsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat statistik pemain."));
    },
  });

  const updateStatsMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      payload: {
        minutes_played: number;
        goals: number;
        assists: number;
        shots: number;
      };
    }) => {
      await apiRequest(`/api/player-stats/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Statistik pemain berhasil diperbarui");
      setIsDialogOpen(false);
      setEditingItem(null);
      await queryClient.invalidateQueries({
        queryKey: statsKeys.all,
      });
      if (historyTarget) {
        await queryClient.invalidateQueries({
          queryKey: statsKeys.history({
            id: historyTarget.id,
            page: historyPage,
          }),
        });
      }
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal memperbarui statistik pemain."),
      );
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("player_name", {
        header: "Pemain",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "scope",
        header: "Musim / Klub",
        cell: ({ row }) => (
          <span>{`${row.original.season_name} / ${row.original.club_name}`}</span>
        ),
      }),
      columnHelper.accessor("minutes_played", {
        header: "Menit",
      }),
      columnHelper.accessor("goals", {
        header: "Gol",
      }),
      columnHelper.accessor("assists", {
        header: "Asis",
      }),
      columnHelper.accessor("shots", {
        header: "Tembakan",
      }),
      columnHelper.accessor("updated_at", {
        header: "Diperbarui",
        cell: (info) => info.getValue().slice(0, 10),
      }),
      columnHelper.display({
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {canWrite ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const item = row.original;
                  setEditingItem(item);
                  form.reset({
                    player_id: item.player_id,
                    season_id: item.season_id,
                    club_id: item.club_id,
                    minutes_played: item.minutes_played,
                    goals: item.goals,
                    assists: item.assists,
                    shots: item.shots,
                  });
                  setIsDialogOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setHistoryTarget(row.original);
                setHistoryPage(1);
              }}
            >
              <History className="h-3.5 w-3.5" />
              Riwayat
            </Button>
          </div>
        ),
      }),
    ],
    [canWrite, form],
  );

  const table = useReactTable({
    data: playerStatsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = playerStatsQuery.data?.pagination.total_pages ?? 1;
  const historyTotalPages = historyQuery.data?.pagination.total_pages ?? 1;
  const isOptionsLoading =
    playersOptionsQuery.isLoading ||
    seasonsOptionsQuery.isLoading ||
    clubsOptionsQuery.isLoading;

  const queryErrorMessage = playerStatsQuery.error
    ? getErrorMessage(
        playerStatsQuery.error,
        "Gagal mengambil data statistik pemain.",
      )
    : null;
  const createErrorMessage = createStatsMutation.error
    ? getErrorMessage(
        createStatsMutation.error,
        "Gagal membuat statistik pemain.",
      )
    : null;
  const updateErrorMessage = updateStatsMutation.error
    ? getErrorMessage(
        updateStatsMutation.error,
        "Gagal memperbarui statistik pemain.",
      )
    : null;
  const historyErrorMessage = historyQuery.error
    ? getErrorMessage(
        historyQuery.error,
        "Gagal mengambil riwayat statistik pemain.",
      )
    : null;
  const errorMessage =
    createErrorMessage ??
    updateErrorMessage ??
    historyErrorMessage ??
    queryErrorMessage;

  const handleSubmit = form.handleSubmit(async (values) => {
    if (editingItem) {
      await updateStatsMutation.mutateAsync({
        id: editingItem.id,
        payload: {
          minutes_played: values.minutes_played,
          goals: values.goals,
          assists: values.assists,
          shots: values.shots,
        },
      });
      return;
    }

    await createStatsMutation.mutateAsync({
      player_id: values.player_id,
      season_id: values.season_id,
      club_id: values.club_id,
      minutes_played: values.minutes_played,
      goals: values.goals,
      assists: values.assists,
      shots: values.shots,
    });
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingItem(null);
      form.reset({
        player_id: "",
        season_id: "",
        club_id: "",
        minutes_played: 0,
        goals: 0,
        assists: 0,
        shots: 0,
      });
      createStatsMutation.reset();
      updateStatsMutation.reset();
    }
  }

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Statistik Pemain</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola statistik pemain per season dan klub.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    form.reset({
                      player_id: "",
                      season_id: "",
                      club_id: "",
                      minutes_played: 0,
                      goals: 0,
                      assists: 0,
                      shots: 0,
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Statistik
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem
                      ? "Edit Statistik Pemain"
                      : "Buat Statistik Pemain Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    Isi data statistik sesuai assignment player-season-club.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="player_id">Pemain</Label>
                      <Select
                        value={form.watch("player_id")}
                        onValueChange={(value) =>
                          form.setValue("player_id", value, {
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }
                        disabled={Boolean(editingItem)}
                      >
                        <SelectTrigger
                          id="player_id"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih pemain" />
                        </SelectTrigger>
                        <SelectContent>
                          {(playersOptionsQuery.data ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.player_id ? (
                        <p className="text-sm text-danger" role="alert">
                          {form.formState.errors.player_id.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="season_id">Musim</Label>
                      <Select
                        value={form.watch("season_id")}
                        onValueChange={(value) =>
                          form.setValue("season_id", value, {
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }
                        disabled={Boolean(editingItem)}
                      >
                        <SelectTrigger
                          id="season_id"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih musim" />
                        </SelectTrigger>
                        <SelectContent>
                          {(seasonsOptionsQuery.data ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.season_id ? (
                        <p className="text-sm text-danger" role="alert">
                          {form.formState.errors.season_id.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="club_id">Klub</Label>
                      <Select
                        value={form.watch("club_id")}
                        onValueChange={(value) =>
                          form.setValue("club_id", value, {
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }
                        disabled={Boolean(editingItem)}
                      >
                        <SelectTrigger
                          id="club_id"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih klub" />
                        </SelectTrigger>
                        <SelectContent>
                          {(clubsOptionsQuery.data ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.club_id ? (
                        <p className="text-sm text-danger" role="alert">
                          {form.formState.errors.club_id.message}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="minutes_played">Menit Bermain</Label>
                      <Input
                        id="minutes_played"
                        type="number"
                        min={0}
                        {...form.register("minutes_played")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goals">Gol</Label>
                      <Input
                        id="goals"
                        type="number"
                        min={0}
                        {...form.register("goals")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assists">Asis</Label>
                      <Input
                        id="assists"
                        type="number"
                        min={0}
                        {...form.register("assists")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shots">Tembakan</Label>
                      <Input
                        id="shots"
                        type="number"
                        min={0}
                        {...form.register("shots")}
                      />
                    </div>
                  </div>

                  {form.formState.errors.shots ? (
                    <p className="text-sm text-danger" role="alert">
                      {form.formState.errors.shots.message}
                    </p>
                  ) : null}

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        isOptionsLoading ||
                        createStatsMutation.isPending ||
                        updateStatsMutation.isPending ||
                        !form.formState.isValid
                      }
                    >
                      {createStatsMutation.isPending ||
                      updateStatsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        "Simpan"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          <form
            className="grid gap-3 rounded-(--radius-md) border border-border/80 bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setPlayerFilter(playerFilterInput);
              setSeasonFilter(seasonFilterInput);
              setClubFilter(clubFilterInput);
            }}
          >
            <Select
              value={playerFilterInput}
              onValueChange={setPlayerFilterInput}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Filter pemain" />
              </SelectTrigger>
              <SelectContent>
                {(playersOptionsQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={seasonFilterInput}
              onValueChange={setSeasonFilterInput}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Filter musim" />
              </SelectTrigger>
              <SelectContent>
                {(seasonsOptionsQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clubFilterInput} onValueChange={setClubFilterInput}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Filter klub" />
              </SelectTrigger>
              <SelectContent>
                {(clubsOptionsQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Terapkan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPlayerFilterInput("");
                setSeasonFilterInput("");
                setClubFilterInput("");
                setPlayerFilter("");
                setSeasonFilter("");
                setClubFilter("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </form>

          {errorMessage ? (
            <p className="rounded-(--radius-md) border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {playerStatsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data statistik pemain...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada data statistik pemain.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <p>Halaman {page}</p>
              <span className="text-border">•</span>
              <p>Total {playerStatsQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || playerStatsQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || playerStatsQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(historyTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryTarget(null);
            setHistoryPage(1);
          }
        }}
      >
        <DialogContent className="max-w-3xl border-border bg-background">
          <DialogHeader>
            <DialogTitle>Riwayat Perubahan Statistik</DialogTitle>
            <DialogDescription>
              {historyTarget
                ? `${historyTarget.player_name} - ${historyTarget.season_name} / ${historyTarget.club_name}`
                : "Riwayat perubahan"}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Sebelum</TableHead>
                  <TableHead>Sesudah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat riwayat...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada riwayat perubahan.
                    </TableCell>
                  </TableRow>
                ) : (
                  (historyQuery.data?.items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.changed_at.slice(0, 19)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {`M:${item.before_payload?.minutes_played ?? "-"} G:${item.before_payload?.goals ?? "-"} A:${item.before_payload?.assists ?? "-"} S:${item.before_payload?.shots ?? "-"}`}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {`M:${item.after_payload?.minutes_played ?? "-"} G:${item.after_payload?.goals ?? "-"} A:${item.after_payload?.assists ?? "-"} S:${item.after_payload?.shots ?? "-"}`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Halaman {historyPage}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={historyPage <= 1 || historyQuery.isFetching}
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={
                  historyPage >= historyTotalPages || historyQuery.isFetching
                }
                onClick={() => setHistoryPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
