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

// ─── Types ────────────────────────────────────────────────────────────────────

type LeagueItem = {
  id: string;
  name: string;
  country: string;
  created_at: string;
  updated_at: string;
};

type LeaguesListResponse = {
  items: LeagueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const leagueSchema = z.object({
  name: z.string().trim().min(2, "Nama liga minimal 2 karakter"),
  country: z.string().trim().min(2, "Negara minimal 2 karakter"),
});

type LeaguePayload = z.infer<typeof leagueSchema>;
type LeagueInput = z.input<typeof leagueSchema>;

// ─── Query keys ───────────────────────────────────────────────────────────────

const leaguesKeys = {
  all: ["leagues"] as const,
  list: (params: { page: number; q: string }) =>
    [...leaguesKeys.all, "list", params] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<LeagueItem>();

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<LeagueItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeagueItem | null>(null);

  const form = useForm<LeagueInput, unknown, LeaguePayload>({
    resolver: zodResolver(leagueSchema),
    defaultValues: { name: "", country: "" },
    mode: "onTouched",
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

  const leaguesQuery = useQuery({
    queryKey: leaguesKeys.list({ page, q }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) params.set("q", q.trim());

      const result = await apiRequest<LeaguesListResponse>(
        `/api/leagues?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

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
      setIsDialogOpen(false);
      form.reset();
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Gagal membuat liga.")),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; payload: LeaguePayload }) => {
      await apiRequest(`/api/leagues/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Liga berhasil diperbarui");
      setIsDialogOpen(false);
      setEditingLeague(null);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Gagal memperbarui liga.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/leagues/${id}`, { method: "DELETE", auth: true });
    },
    onSuccess: async () => {
      toast.success("Liga berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: leaguesKeys.all });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Gagal menghapus liga.")),
  });

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Nama Liga",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("country", {
        header: "Negara",
        cell: (info) => info.getValue(),
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
                      const league = row.original;
                      setEditingLeague(league);
                      form.reset({ name: league.name, country: league.country });
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
    data: leaguesQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = leaguesQuery.data?.pagination.total_pages ?? 1;
  const colSpan = canWrite ? 4 : 3;

  const errorMessage =
    (createMutation.error
      ? getErrorMessage(createMutation.error, "Gagal membuat liga.")
      : null) ??
    (updateMutation.error
      ? getErrorMessage(updateMutation.error, "Gagal memperbarui liga.")
      : null) ??
    (leaguesQuery.error
      ? getErrorMessage(leaguesQuery.error, "Gagal mengambil data liga.")
      : null);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmit = form.handleSubmit(async (values) => {
    if (editingLeague) {
      await updateMutation.mutateAsync({ id: editingLeague.id, payload: values });
      return;
    }
    await createMutation.mutateAsync(values);
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingLeague(null);
      form.reset();
      createMutation.reset();
      updateMutation.reset();
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Liga</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola data liga dan negara asal liga.
            </p>
          </div>

          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingLeague(null);
                    form.reset({ name: "", country: "" });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Liga
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>
                    {editingLeague ? "Edit Liga" : "Buat Liga Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingLeague
                      ? "Perbarui data liga sesuai kebutuhan."
                      : "Isi nama liga dan negara asal."}
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="league-name">Nama Liga</Label>
                    <Input
                      id="league-name"
                      placeholder="Liga 1"
                      {...form.register("name")}
                    />
                    {form.formState.errors.name ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.name.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="league-country">Negara</Label>
                    <Input
                      id="league-country"
                      placeholder="Indonesia"
                      {...form.register("country")}
                    />
                    {form.formState.errors.country ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.country.message}
                      </p>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        createMutation.isPending ||
                        updateMutation.isPending ||
                        !form.formState.isValid
                      }
                    >
                      {createMutation.isPending || updateMutation.isPending ? (
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
          {/* Search */}
          <form
            className="flex flex-col gap-3 rounded-(--radius-md) border border-border/80 bg-muted/50 p-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari liga..."
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

          {/* Table */}
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
                {leaguesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={colSpan}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data liga...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada data liga.
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

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <p>Halaman {page}</p>
              <span className="text-border">•</span>
              <p>Total {leaguesQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || leaguesQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || leaguesQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Konfirmasi hapus */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Liga</AlertDialogTitle>
            <AlertDialogDescription>
              Data liga{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              akan dihapus permanen. Musim yang terhubung ke liga ini akan
              kehilangan referensi liganya.
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
              {deleteMutation.isPending ? "Menghapus..." : "Ya, hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
