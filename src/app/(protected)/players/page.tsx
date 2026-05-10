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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, isApiClientError } from "@/lib/api-client";

type PlayerItem = {
  id: string;
  full_name: string;
  date_of_birth: string;
  nationality: string | null;
  primary_position: string;
  created_at: string;
  updated_at: string;
};

type PlayersListResponse = {
  items: PlayerItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

const createPlayerSchema = z.object({
  full_name: z.string().trim().min(3, "Nama pemain minimal 3 karakter"),
  date_of_birth: z
    .iso
    .date("Format tanggal lahir harus YYYY-MM-DD")
    .refine((value) => new Date(value).getTime() <= Date.now(), {
      message: "Tanggal lahir tidak boleh di masa depan",
    }),
  nationality: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || value.length >= 2, {
      message: "Kebangsaan minimal 2 karakter",
    }),
  primary_position: z.string().trim().min(2, "Posisi utama minimal 2 karakter"),
});

type CreatePlayerPayload = z.infer<typeof createPlayerSchema>;
type CreatePlayerInput = z.input<typeof createPlayerSchema>;

const columnHelper = createColumnHelper<PlayerItem>();
const playersKeys = {
  all: ["players"] as const,
  list: (params: { page: number; q: string }) =>
    [...playersKeys.all, "list", params] as const,
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

export default function PlayersPage() {
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlayerItem | null>(null);

  const form = useForm<CreatePlayerInput, unknown, CreatePlayerPayload>({
    resolver: zodResolver(createPlayerSchema),
    defaultValues: {
      full_name: "",
      date_of_birth: "",
      nationality: "",
      primary_position: "",
    },
    mode: "onTouched",
  });

  const playersQuery = useQuery({
    queryKey: playersKeys.list({ page, q }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) {
        params.set("q", q.trim());
      }

      const result = await apiRequest<PlayersListResponse>(
        `/api/players?${params.toString()}`,
        {
          auth: true,
        },
      );

      return result.envelope.data;
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: async (payload: CreatePlayerPayload) => {
      await apiRequest("/api/players", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Pemain berhasil dibuat");
      setIsDialogOpen(false);
      form.reset();
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: playersKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat pemain."));
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async (params: { id: string; payload: CreatePlayerPayload }) => {
      await apiRequest(`/api/players/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Pemain berhasil diperbarui");
      setIsDialogOpen(false);
      setEditingPlayer(null);
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: playersKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal memperbarui pemain."));
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/players/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Pemain berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: playersKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menghapus pemain."));
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("full_name", {
        header: "Nama pemain",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("primary_position", {
        header: "Posisi",
      }),
      columnHelper.accessor("nationality", {
        header: "Kebangsaan",
        cell: (info) => info.getValue() ?? "-",
      }),
      columnHelper.accessor("date_of_birth", {
        header: "Tanggal lahir",
      }),
      columnHelper.accessor("updated_at", {
        header: "Diperbarui",
        cell: (info) => info.getValue().slice(0, 10),
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
                      const player = row.original;
                      setEditingPlayer(player);
                      form.reset({
                        full_name: player.full_name,
                        date_of_birth: player.date_of_birth,
                        nationality: player.nationality ?? "",
                        primary_position: player.primary_position,
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
    data: playersQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = playersQuery.data?.pagination.total_pages ?? 1;

  const queryErrorMessage = playersQuery.error
    ? getErrorMessage(playersQuery.error, "Gagal mengambil data pemain.")
    : null;
  const mutationErrorMessage = createPlayerMutation.error
    ? getErrorMessage(createPlayerMutation.error, "Gagal membuat pemain.")
    : null;
  const updateErrorMessage = updatePlayerMutation.error
    ? getErrorMessage(updatePlayerMutation.error, "Gagal memperbarui pemain.")
    : null;
  const deleteErrorMessage = deletePlayerMutation.error
    ? getErrorMessage(deletePlayerMutation.error, "Gagal menghapus pemain.")
    : null;
  const errorMessage =
    mutationErrorMessage ??
    updateErrorMessage ??
    deleteErrorMessage ??
    queryErrorMessage;

  const handleCreatePlayer = form.handleSubmit(async (values) => {
    if (editingPlayer) {
      await updatePlayerMutation.mutateAsync({
        id: editingPlayer.id,
        payload: values,
      });
      return;
    }

    await createPlayerMutation.mutateAsync(values);
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingPlayer(null);
      form.reset();
      createPlayerMutation.reset();
      updatePlayerMutation.reset();
    }
  }

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Pemain</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola profil pemain untuk kebutuhan statistik dan assignment.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingPlayer(null);
                  form.reset({
                    full_name: "",
                    date_of_birth: "",
                    nationality: "",
                    primary_position: "",
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                Tambah Pemain
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-background">
              <DialogHeader>
                <DialogTitle>
                  {editingPlayer ? "Edit Pemain" : "Buat Pemain Baru"}
                </DialogTitle>
                <DialogDescription>
                  {editingPlayer
                    ? "Perbarui data pemain sesuai kebutuhan."
                    : "Isi data utama pemain dengan format tanggal `YYYY-MM-DD`."}
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreatePlayer}>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nama Lengkap</Label>
                  <Input
                    id="full_name"
                    placeholder="Jay Idzes"
                    {...form.register("full_name")}
                  />
                  {form.formState.errors.full_name ? (
                    <p className="text-sm text-danger" role="alert">
                      {form.formState.errors.full_name.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Tanggal Lahir</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      {...form.register("date_of_birth")}
                    />
                    {form.formState.errors.date_of_birth ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.date_of_birth.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_position">Posisi Utama</Label>
                    <Input
                      id="primary_position"
                      placeholder="Center Back"
                      {...form.register("primary_position")}
                    />
                    {form.formState.errors.primary_position ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.primary_position.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Kebangsaan</Label>
                  <Input
                    id="nationality"
                    placeholder="Indonesia"
                    {...form.register("nationality")}
                  />
                  {form.formState.errors.nationality ? (
                    <p className="text-sm text-danger" role="alert">
                      {form.formState.errors.nationality.message}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      createPlayerMutation.isPending ||
                      updatePlayerMutation.isPending ||
                      !form.formState.isValid
                    }
                  >
                    {createPlayerMutation.isPending ||
                    updatePlayerMutation.isPending ? (
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
            className="flex flex-col gap-3 rounded-(--radius-md) border border-border/80 bg-muted/50 p-3 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
          >
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari pemain..."
              className="max-w-sm bg-background"
            />
            <Button type="submit" variant="outline">
              Cari
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setQ("");
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
                {playersQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 6 : 5}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data pemain...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 6 : 5}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada data pemain.
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
              <p>Total {playersQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || playersQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || playersQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deletePlayerMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pemain</AlertDialogTitle>
            <AlertDialogDescription>
              Data pemain{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.full_name}
              </span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlayerMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deletePlayerMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) {
                  return;
                }
                void deletePlayerMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deletePlayerMutation.isPending ? "Menghapus..." : "Ya, hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
