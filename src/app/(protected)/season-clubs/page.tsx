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
import { Loader2, Plus, Trash2 } from "lucide-react";
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

type SeasonClubItem = {
  id: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  created_at: string;
};

type SeasonClubsListResponse = {
  items: SeasonClubItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

type SeasonOption = { id: string; name: string };
type ClubOption = { id: string; name: string };

const createSeasonClubSchema = z.object({
  season_id: z.string().min(1, "Musim wajib dipilih"),
  club_id: z.string().min(1, "Klub wajib dipilih"),
});

type CreateSeasonClubPayload = z.infer<typeof createSeasonClubSchema>;
type CreateSeasonClubInput = z.input<typeof createSeasonClubSchema>;

const columnHelper = createColumnHelper<SeasonClubItem>();
const seasonClubsKeys = {
  all: ["season-clubs"] as const,
  list: (params: { page: number; season_id: string; club_id: string }) =>
    [...seasonClubsKeys.all, "list", params] as const,
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

export default function SeasonClubsPage() {
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SeasonClubItem | null>(null);
  const [seasonFilterInput, setSeasonFilterInput] = useState("");
  const [clubFilterInput, setClubFilterInput] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");

  const form = useForm<CreateSeasonClubInput, unknown, CreateSeasonClubPayload>(
    {
      resolver: zodResolver(createSeasonClubSchema),
      defaultValues: {
        season_id: "",
        club_id: "",
      },
      mode: "onTouched",
    },
  );

  const seasonsOptionsQuery = useQuery({
    queryKey: ["seasons", "options"],
    queryFn: async () => {
      const result = await apiRequest<{ items: SeasonOption[] }>(
        "/api/seasons?page=1&limit=100",
        { auth: true },
      );
      return result.envelope.data?.items ?? [];
    },
  });

  const clubsOptionsQuery = useQuery({
    queryKey: ["clubs", "options"],
    queryFn: async () => {
      const result = await apiRequest<{ items: ClubOption[] }>(
        "/api/clubs?page=1&limit=100",
        { auth: true },
      );
      return result.envelope.data?.items ?? [];
    },
  });

  const seasonClubsQuery = useQuery({
    queryKey: seasonClubsKeys.list({
      page,
      season_id: seasonFilter,
      club_id: clubFilter,
    }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (seasonFilter) {
        params.set("season_id", seasonFilter);
      }
      if (clubFilter) {
        params.set("club_id", clubFilter);
      }

      const result = await apiRequest<SeasonClubsListResponse>(
        `/api/season-clubs?${params.toString()}`,
        {
          auth: true,
        },
      );

      return result.envelope.data;
    },
  });

  const createSeasonClubMutation = useMutation({
    mutationFn: async (payload: CreateSeasonClubPayload) => {
      await apiRequest("/api/season-clubs", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Relasi musim-klub berhasil dibuat");
      setIsDialogOpen(false);
      form.reset({
        season_id: "",
        club_id: "",
      });
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: seasonClubsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat relasi musim-klub."));
    },
  });

  const deleteSeasonClubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/season-clubs/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Relasi musim-klub berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: seasonClubsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menghapus relasi musim-klub."));
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("season_name", {
        header: "Musim",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("club_name", {
        header: "Klub",
      }),
      columnHelper.accessor("created_at", {
        header: "Dibuat",
        cell: (info) => info.getValue().slice(0, 10),
      }),
      ...(canWrite
        ? [
            columnHelper.display({
              id: "actions",
              header: "Aksi",
              cell: ({ row }) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </Button>
              ),
            }),
          ]
        : []),
    ],
    [canWrite],
  );

  const table = useReactTable({
    data: seasonClubsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = seasonClubsQuery.data?.pagination.total_pages ?? 1;
  const isOptionsLoading =
    seasonsOptionsQuery.isLoading || clubsOptionsQuery.isLoading;

  const queryErrorMessage = seasonClubsQuery.error
    ? getErrorMessage(
        seasonClubsQuery.error,
        "Gagal mengambil data relasi musim klub.",
      )
    : null;
  const createErrorMessage = createSeasonClubMutation.error
    ? getErrorMessage(
        createSeasonClubMutation.error,
        "Gagal membuat relasi musim klub.",
      )
    : null;
  const deleteErrorMessage = deleteSeasonClubMutation.error
    ? getErrorMessage(
        deleteSeasonClubMutation.error,
        "Gagal menghapus relasi musim klub.",
      )
    : null;
  const errorMessage =
    createErrorMessage ?? deleteErrorMessage ?? queryErrorMessage;

  const handleCreate = form.handleSubmit(async (values) => {
    await createSeasonClubMutation.mutateAsync(values);
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      form.reset({
        season_id: "",
        club_id: "",
      });
      createSeasonClubMutation.reset();
    }
  }

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Relasi Musim Klub</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola relasi antara musim dan klub.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  onClick={() =>
                    form.reset({
                      season_id: "",
                      club_id: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Tambah Relasi
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>Buat Relasi Musim Klub</DialogTitle>
                  <DialogDescription>
                    Pilih musim dan klub untuk membuat relasi baru.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreate}>
                  <div className="space-y-2">
                    <Label htmlFor="season_id">Musim</Label>
                    <Select
                      value={form.watch("season_id") || ""}
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
                      value={form.watch("club_id") || ""}
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
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        isOptionsLoading ||
                        createSeasonClubMutation.isPending ||
                        !form.formState.isValid
                      }
                    >
                      {createSeasonClubMutation.isPending ? (
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
            className="grid gap-3 rounded-(--radius-md) border border-border/80 bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSeasonFilter(seasonFilterInput);
              setClubFilter(clubFilterInput);
            }}
          >
            <Select
              value={seasonFilterInput}
              onValueChange={setSeasonFilterInput}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Filter musim" />
              </SelectTrigger>
              <SelectContent>
                {(seasonsOptionsQuery.data ?? []).map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clubFilterInput} onValueChange={setClubFilterInput}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Filter klub" />
              </SelectTrigger>
              <SelectContent>
                {(clubsOptionsQuery.data ?? []).map((club) => (
                  <SelectItem key={club.id} value={club.id}>
                    {club.name}
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
                setSeasonFilterInput("");
                setClubFilterInput("");
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
                {seasonClubsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 4 : 3}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data relasi...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 4 : 3}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada relasi musim klub.
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
              <p>Total {seasonClubsQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || seasonClubsQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || seasonClubsQuery.isFetching}
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
            deleteSeasonClubMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus relasi musim klub</AlertDialogTitle>
            <AlertDialogDescription>
              Relasi{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.season_name} - {deleteTarget?.club_name}
              </span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSeasonClubMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteSeasonClubMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) {
                  return;
                }
                void deleteSeasonClubMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteSeasonClubMutation.isPending
                ? "Menghapus..."
                : "Ya, hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
