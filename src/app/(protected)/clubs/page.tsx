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

type ClubItem = {
  id: string;
  name: string;
  country: string | null;
  created_at: string;
  updated_at: string;
};

type ClubsListResponse = {
  items: ClubItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

const createClubSchema = z.object({
  name: z.string().trim().min(2, "Nama klub minimal 2 karakter"),
  country: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || value.length >= 2, {
      message: "Negara minimal 2 karakter",
    }),
});

type CreateClubPayload = z.infer<typeof createClubSchema>;
type CreateClubInput = z.input<typeof createClubSchema>;

const columnHelper = createColumnHelper<ClubItem>();
const clubsKeys = {
  all: ["clubs"] as const,
  list: (params: { page: number; q: string }) =>
    [...clubsKeys.all, "list", params] as const,
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

export default function ClubsPage() {
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClubItem | null>(null);

  const form = useForm<CreateClubInput, unknown, CreateClubPayload>({
    resolver: zodResolver(createClubSchema),
    defaultValues: {
      name: "",
      country: "",
    },
    mode: "onTouched",
  });

  const clubsQuery = useQuery({
    queryKey: clubsKeys.list({ page, q }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) {
        params.set("q", q.trim());
      }

      const result = await apiRequest<ClubsListResponse>(
        `/api/clubs?${params.toString()}`,
        {
          auth: true,
        },
      );

      return result.envelope.data;
    },
  });

  const createClubMutation = useMutation({
    mutationFn: async (payload: CreateClubPayload) => {
      await apiRequest("/api/clubs", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil dibuat");
      setIsDialogOpen(false);
      form.reset();
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: clubsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat klub."));
    },
  });

  const updateClubMutation = useMutation({
    mutationFn: async (params: { id: string; payload: CreateClubPayload }) => {
      await apiRequest(`/api/clubs/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil diperbarui");
      setIsDialogOpen(false);
      setEditingClub(null);
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: clubsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal memperbarui klub."));
    },
  });

  const deleteClubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/clubs/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: clubsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menghapus klub."));
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Nama klub",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("country", {
        header: "Negara",
        cell: (info) => info.getValue() ?? "-",
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
                      const club = row.original;
                      setEditingClub(club);
                      form.reset({
                        name: club.name,
                        country: club.country ?? "",
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
    data: clubsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = clubsQuery.data?.pagination.total_pages ?? 1;

  const queryErrorMessage = clubsQuery.error
    ? getErrorMessage(clubsQuery.error, "Gagal mengambil data klub.")
    : null;
  const mutationErrorMessage = createClubMutation.error
    ? getErrorMessage(createClubMutation.error, "Gagal membuat klub.")
    : null;
  const updateErrorMessage = updateClubMutation.error
    ? getErrorMessage(updateClubMutation.error, "Gagal memperbarui klub.")
    : null;
  const deleteErrorMessage = deleteClubMutation.error
    ? getErrorMessage(deleteClubMutation.error, "Gagal menghapus klub.")
    : null;
  const errorMessage =
    mutationErrorMessage ??
    updateErrorMessage ??
    deleteErrorMessage ??
    queryErrorMessage;

  const handleCreateClub = form.handleSubmit(async (values) => {
    if (editingClub) {
      await updateClubMutation.mutateAsync({
        id: editingClub.id,
        payload: values,
      });
      return;
    }

    await createClubMutation.mutateAsync(values);
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingClub(null);
      form.reset();
      createClubMutation.reset();
      updateClubMutation.reset();
    }
  }

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Klub</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola data klub dan negara asal klub.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingClub(null);
                    form.reset({
                      name: "",
                      country: "",
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Klub
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>
                    {editingClub ? "Edit Klub" : "Buat Klub Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingClub
                      ? "Perbarui data klub sesuai kebutuhan."
                      : "Isi nama klub dan negara asal (opsional)."}
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateClub}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Klub</Label>
                    <Input
                      id="name"
                      placeholder="Persija Jakarta"
                      {...form.register("name")}
                    />
                    {form.formState.errors.name ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.name.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Negara</Label>
                    <Input
                      id="country"
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
                        createClubMutation.isPending ||
                        updateClubMutation.isPending ||
                        !form.formState.isValid
                      }
                    >
                      {createClubMutation.isPending ||
                      updateClubMutation.isPending ? (
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
              placeholder="Cari klub..."
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
                {clubsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 4 : 3}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data klub...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 4 : 3}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada data klub.
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
              <p>Total {clubsQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || clubsQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || clubsQuery.isFetching}
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
            deleteClubMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus klub</AlertDialogTitle>
            <AlertDialogDescription>
              Data klub{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClubMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteClubMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) {
                  return;
                }
                void deleteClubMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteClubMutation.isPending ? "Menghapus..." : "Ya, hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
