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
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type AssignmentItem = {
  id: string;
  player_id: string;
  player_name: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  join_date: string;
  leave_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type AssignmentsListResponse = {
  items: AssignmentItem[];
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

const assignmentFormSchema = z
  .object({
    player_id: z.string().min(1, "Pemain wajib dipilih"),
    season_id: z.string().min(1, "Musim wajib dipilih"),
    club_id: z.string().min(1, "Klub wajib dipilih"),
    join_date: z.string().min(1, "Tanggal bergabung wajib diisi"),
    leave_date: z.string().optional(),
    is_active: z.boolean(),
  })
  .refine(
    (value) => !value.leave_date || value.leave_date.trim() >= value.join_date,
    {
      path: ["leave_date"],
      message:
        "Tanggal keluar harus lebih besar atau sama dengan tanggal bergabung",
    },
  );

type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

const columnHelper = createColumnHelper<AssignmentItem>();
const assignmentsKeys = {
  all: ["assignments"] as const,
  list: (params: {
    page: number;
    player_id: string;
    season_id: string;
    club_id: string;
    is_active: string;
  }) => [...assignmentsKeys.all, "list", params] as const,
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

export default function AssignmentsPage() {
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<AssignmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentItem | null>(null);
  const [playerFilterInput, setPlayerFilterInput] = useState("");
  const [seasonFilterInput, setSeasonFilterInput] = useState("");
  const [clubFilterInput, setClubFilterInput] = useState("");
  const [activeFilterInput, setActiveFilterInput] = useState("all");
  const [playerFilter, setPlayerFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      player_id: "",
      season_id: "",
      club_id: "",
      join_date: "",
      leave_date: "",
      is_active: true,
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

  const assignmentsQuery = useQuery({
    queryKey: assignmentsKeys.list({
      page,
      player_id: playerFilter,
      season_id: seasonFilter,
      club_id: clubFilter,
      is_active: activeFilter,
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
      if (activeFilter !== "all") {
        params.set("is_active", activeFilter);
      }

      const result = await apiRequest<AssignmentsListResponse>(
        `/api/player-club-history?${params.toString()}`,
        { auth: true },
      );

      return result.envelope.data;
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (payload: {
      player_id: string;
      season_id: string;
      club_id: string;
      join_date: string;
      leave_date?: string;
      is_active: boolean;
    }) => {
      await apiRequest("/api/player-club-history", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Penugasan berhasil dibuat");
      setIsDialogOpen(false);
      setEditingAssignment(null);
      form.reset({
        player_id: "",
        season_id: "",
        club_id: "",
        join_date: "",
        leave_date: "",
        is_active: true,
      });
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: assignmentsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat penugasan."));
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      payload: {
        player_id: string;
        season_id: string;
        club_id: string;
        join_date: string;
        leave_date: string | null;
        is_active: boolean;
      };
    }) => {
      await apiRequest(`/api/player-club-history/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Penugasan berhasil diperbarui");
      setIsDialogOpen(false);
      setEditingAssignment(null);
      form.reset({
        player_id: "",
        season_id: "",
        club_id: "",
        join_date: "",
        leave_date: "",
        is_active: true,
      });
      await queryClient.invalidateQueries({
        queryKey: assignmentsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal memperbarui penugasan."));
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/player-club-history/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Penugasan berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: assignmentsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menghapus penugasan."));
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
        id: "season-club",
        header: "Musim / Klub",
        cell: ({ row }) => (
          <span>{`${row.original.season_name} / ${row.original.club_name}`}</span>
        ),
      }),
      columnHelper.accessor("join_date", {
        header: "Tanggal Bergabung",
      }),
      columnHelper.accessor("leave_date", {
        header: "Tanggal Keluar",
        cell: (info) => info.getValue() ?? "-",
      }),
      columnHelper.accessor("is_active", {
        header: "Status",
        cell: (info) =>
          info.getValue() === 1 ? (
            <Badge>Aktif</Badge>
          ) : (
            <Badge variant="outline">Tidak aktif</Badge>
          ),
      }),
      ...(canWrite
        ? [
            columnHelper.display({
              id: "actions",
              header: "Aksi",
              cell: ({ row }) => (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const item = row.original;
                      setEditingAssignment(item);
                      form.reset({
                        player_id: item.player_id,
                        season_id: item.season_id,
                        club_id: item.club_id,
                        join_date: item.join_date,
                        leave_date: item.leave_date ?? "",
                        is_active: item.is_active === 1,
                      });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(row.original)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
              ),
            }),
          ]
        : []),
    ],
    [canWrite, form],
  );

  const table = useReactTable({
    data: assignmentsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = assignmentsQuery.data?.pagination.total_pages ?? 1;
  const isOptionsLoading =
    playersOptionsQuery.isLoading ||
    seasonsOptionsQuery.isLoading ||
    clubsOptionsQuery.isLoading;

  const queryErrorMessage = assignmentsQuery.error
    ? getErrorMessage(
        assignmentsQuery.error,
        "Gagal mengambil data assignment.",
      )
    : null;
  const createErrorMessage = createAssignmentMutation.error
    ? getErrorMessage(
        createAssignmentMutation.error,
        "Gagal membuat assignment.",
      )
    : null;
  const updateErrorMessage = updateAssignmentMutation.error
    ? getErrorMessage(
        updateAssignmentMutation.error,
        "Gagal memperbarui assignment.",
      )
    : null;
  const deleteErrorMessage = deleteAssignmentMutation.error
    ? getErrorMessage(
        deleteAssignmentMutation.error,
        "Gagal menghapus assignment.",
      )
    : null;
  const errorMessage =
    createErrorMessage ??
    updateErrorMessage ??
    deleteErrorMessage ??
    queryErrorMessage;

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      player_id: values.player_id,
      season_id: values.season_id,
      club_id: values.club_id,
      join_date: values.join_date,
      leave_date: values.leave_date?.trim()
        ? values.leave_date.trim()
        : undefined,
      is_active: values.is_active,
    };

    if (editingAssignment) {
      await updateAssignmentMutation.mutateAsync({
        id: editingAssignment.id,
        payload: {
          ...payload,
          leave_date: payload.leave_date ?? null,
        },
      });
      return;
    }

    await createAssignmentMutation.mutateAsync(payload);
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingAssignment(null);
      form.reset({
        player_id: "",
        season_id: "",
        club_id: "",
        join_date: "",
        leave_date: "",
        is_active: true,
      });
      createAssignmentMutation.reset();
      updateAssignmentMutation.reset();
    }
  }

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Penugasan</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola assignment player ke klub pada season tertentu.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingAssignment(null);
                    form.reset({
                      player_id: "",
                      season_id: "",
                      club_id: "",
                      join_date: "",
                      leave_date: "",
                      is_active: true,
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Penugasan
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>
                    {editingAssignment
                      ? "Edit Penugasan"
                      : "Buat Penugasan Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    Pilih pemain, musim, klub, lalu tentukan periode penugasan.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSubmit}>
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
                    >
                      <SelectTrigger
                        id="player_id"
                        className="w-full bg-background"
                      >
                        <SelectValue placeholder="Pilih pemain" />
                      </SelectTrigger>
                      <SelectContent>
                        {(playersOptionsQuery.data ?? []).map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.name}
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      >
                        <SelectTrigger
                          id="season_id"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih musim" />
                        </SelectTrigger>
                        <SelectContent>
                          {(seasonsOptionsQuery.data ?? []).map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
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
                      >
                        <SelectTrigger
                          id="club_id"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih klub" />
                        </SelectTrigger>
                        <SelectContent>
                          {(clubsOptionsQuery.data ?? []).map((club) => (
                            <SelectItem key={club.id} value={club.id}>
                              {club.name}
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="join_date">Tanggal Bergabung</Label>
                      <Input
                        id="join_date"
                        type="date"
                        {...form.register("join_date")}
                      />
                      {form.formState.errors.join_date ? (
                        <p className="text-sm text-danger" role="alert">
                          {form.formState.errors.join_date.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="leave_date">Tanggal Keluar</Label>
                      <Input
                        id="leave_date"
                        type="date"
                        {...form.register("leave_date")}
                      />
                      {form.formState.errors.leave_date ? (
                        <p className="text-sm text-danger" role="alert">
                          {form.formState.errors.leave_date.message}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={form.watch("is_active")}
                      onCheckedChange={(checked) =>
                        form.setValue("is_active", checked === true, {
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                    />
                    Assignment aktif
                  </label>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        isOptionsLoading ||
                        createAssignmentMutation.isPending ||
                        updateAssignmentMutation.isPending ||
                        !form.formState.isValid
                      }
                    >
                      {createAssignmentMutation.isPending ||
                      updateAssignmentMutation.isPending ? (
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
            className="grid gap-3 rounded-(--radius-md) border border-border/80 bg-muted/50 p-3 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setPlayerFilter(playerFilterInput);
              setSeasonFilter(seasonFilterInput);
              setClubFilter(clubFilterInput);
              setActiveFilter(activeFilterInput);
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

            <Select
              value={activeFilterInput}
              onValueChange={setActiveFilterInput}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="1">Aktif</SelectItem>
                <SelectItem value="0">Tidak aktif</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
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
                  setActiveFilterInput("all");
                  setPlayerFilter("");
                  setSeasonFilter("");
                  setClubFilter("");
                  setActiveFilter("all");
                  setPage(1);
                }}
              >
                Reset
              </Button>
            </div>
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
                {assignmentsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 6 : 5}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data assignment...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 6 : 5}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada data penugasan.
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
              <p>Total {assignmentsQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || assignmentsQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || assignmentsQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={canWrite && Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deleteAssignmentMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Assignment{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.player_name} ({deleteTarget?.season_name})
              </span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAssignmentMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteAssignmentMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) {
                  return;
                }
                void deleteAssignmentMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteAssignmentMutation.isPending
                ? "Menghapus..."
                : "Ya, hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
