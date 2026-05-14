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
import { CalendarDays, Loader2, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useActiveLeague } from "@/components/app/active-league-context";
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

// Klub yang sudah terdaftar di musim aktif (via season-clubs)
type SeasonClubItem = {
  id: string; // season_clubs.id
  club_id: string;
  club_name: string;
};

type SeasonClubsListResponse = {
  items: SeasonClubItem[];
  pagination: { total: number };
};

const createClubSchema = z.object({
  name: z.string().trim().min(2, "Nama klub minimal 2 karakter"),
});

type CreateClubPayload = z.infer<typeof createClubSchema>;
type CreateClubInput = z.input<typeof createClubSchema>;

const columnHelper = createColumnHelper<ClubItem>();

const clubsKeys = {
  all: ["clubs"] as const,
  list: (params: { page: number; q: string }) =>
    [...clubsKeys.all, "list", params] as const,
};

const seasonClubsKeys = {
  all: ["season-clubs"] as const,
  bySeason: (seasonId: string) =>
    [...seasonClubsKeys.all, seasonId] as const,
};

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ClubsPage() {
  const { user } = useAuthUser();
  const { activeSeason } = useActiveSeason();
  const { activeLeague } = useActiveLeague();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();

  // --- State klub ---
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClubItem | null>(null);

  // --- State untuk daftarkan klub ke musim aktif ---
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<ClubItem | null>(null);

  const form = useForm<CreateClubInput, unknown, CreateClubPayload>({
    resolver: zodResolver(createClubSchema),
    defaultValues: { name: "" },
    mode: "onTouched",
  });

  // Query semua klub — jika ada activeLeague, filter hanya klub yang terdaftar
  // di season aktif yang liga-nya cocok (via registeredClubIds + league filter)
  const clubsQuery = useQuery({
    queryKey: [...clubsKeys.list({ page, q }), activeLeague?.id ?? "all"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) params.set("q", q.trim());

      const result = await apiRequest<ClubsListResponse>(
        `/api/clubs?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // Query klub yang sudah terdaftar di musim aktif
  const seasonClubsQuery = useQuery({
    queryKey: [...seasonClubsKeys.bySeason(activeSeason?.id ?? ""), activeLeague?.id ?? "all"],
    enabled: Boolean(activeSeason?.id),
    queryFn: async () => {
      const result = await apiRequest<SeasonClubsListResponse>(
        `/api/season-clubs?season_id=${activeSeason!.id}&limit=100`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // Set club_id yang sudah terdaftar di musim aktif
  const registeredClubIds = useMemo(
    () => new Set(seasonClubsQuery.data?.items.map((sc) => sc.club_id) ?? []),
    [seasonClubsQuery.data],
  );

  // Mutations
  const createClubMutation = useMutation({
    mutationFn: async (payload: CreateClubPayload) => {
      await apiRequest("/api/clubs", { method: "POST", auth: true, body: payload });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil dibuat");
      setIsDialogOpen(false);
      form.reset();
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: clubsKeys.all });
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
      await queryClient.invalidateQueries({ queryKey: clubsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal memperbarui klub."));
    },
  });

  const deleteClubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/clubs/${id}`, { method: "DELETE", auth: true });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: clubsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menghapus klub."));
    },
  });

  const registerToSeasonMutation = useMutation({
    mutationFn: async (clubId: string) => {
      await apiRequest("/api/season-clubs", {
        method: "POST",
        auth: true,
        body: { season_id: activeSeason!.id, club_id: clubId },
      });
    },
    onSuccess: async () => {
      toast.success(`Klub berhasil didaftarkan ke musim ${activeSeason?.name}`);
      setIsRegisterDialogOpen(false);
      setRegisterTarget(null);
      await queryClient.invalidateQueries({
        queryKey: seasonClubsKeys.bySeason(activeSeason?.id ?? ""),
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal mendaftarkan klub ke musim."));
    },
  });

  const unregisterFromSeasonMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const seasonClub = seasonClubsQuery.data?.items.find(
        (sc) => sc.club_id === clubId,
      );
      if (!seasonClub) throw new Error("Relasi musim-klub tidak ditemukan");
      await apiRequest(`/api/season-clubs/${seasonClub.id}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil dikeluarkan dari musim aktif");
      await queryClient.invalidateQueries({
        queryKey: seasonClubsKeys.bySeason(activeSeason?.id ?? ""),
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal mengeluarkan klub dari musim."));
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Nama Klub",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      // Kolom status musim aktif
      columnHelper.display({
        id: "season-status",
        header: () => (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {activeSeason ? activeSeason.name : "Musim Aktif"}
          </span>
        ),
        cell: ({ row }) => {
          const isRegistered = registeredClubIds.has(row.original.id);
          if (!activeSeason) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          if (isRegistered) {
            return (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Terdaftar
                </span>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-danger"
                    disabled={unregisterFromSeasonMutation.isPending}
                    onClick={() =>
                      void unregisterFromSeasonMutation.mutateAsync(row.original.id)
                    }
                  >
                    Keluarkan
                  </Button>
                ) : null}
              </div>
            );
          }
          return canWrite ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setRegisterTarget(row.original);
                setIsRegisterDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3" />
              Daftarkan
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Tidak terdaftar</span>
          );
        },
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
                      form.reset({ name: club.name });
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
    [canWrite, form, activeSeason, registeredClubIds, unregisterFromSeasonMutation],
  );

  const table = useReactTable({
    // Jika ada activeLeague, filter hanya klub yang terdaftar di musim aktif
    // dan season aktif punya liga yang cocok dengan activeLeague
    data: useMemo(() => {
      const items = clubsQuery.data?.items ?? [];
      if (!activeLeague || !activeSeason) return items;
      // Hanya tampilkan klub yang terdaftar di season aktif
      return items.filter((club) => registeredClubIds.has(club.id));
    }, [clubsQuery.data?.items, activeLeague, activeSeason, registeredClubIds]),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = clubsQuery.data?.pagination.total_pages ?? 1;
  const colSpan = canWrite ? 4 : 3;

  const errorMessage =
    (createClubMutation.error
      ? getErrorMessage(createClubMutation.error, "Gagal membuat klub.")
      : null) ??
    (updateClubMutation.error
      ? getErrorMessage(updateClubMutation.error, "Gagal memperbarui klub.")
      : null) ??
    (deleteClubMutation.error
      ? getErrorMessage(deleteClubMutation.error, "Gagal menghapus klub.")
      : null) ??
    (clubsQuery.error
      ? getErrorMessage(clubsQuery.error, "Gagal mengambil data klub.")
      : null);

  const handleSubmitClub = form.handleSubmit(async (values) => {
    if (editingClub) {
      await updateClubMutation.mutateAsync({ id: editingClub.id, payload: values });
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
    <section className="space-y-6">
      {/* Banner konteks aktif */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {activeSeason ? (
          <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">Musim:</span>
            <span className="font-medium text-foreground">{activeSeason.name}</span>
            {activeSeason.league_name ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{activeSeason.league_name}</span>
              </>
            ) : null}
          </div>
        ) : null}
        {activeLeague ? (
          <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <Trophy className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-muted-foreground">Filter liga:</span>
            <span className="font-medium text-foreground">{activeLeague.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{activeLeague.country}</span>
            {activeSeason?.league_id && activeSeason.league_id !== activeLeague.id ? (
              <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">
                ⚠ Liga berbeda dari musim aktif
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Tabel Klub */}
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Klub</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola data klub dan daftarkan ke musim aktif.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingClub(null);
                    form.reset({ name: "" });
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
                <form className="space-y-4" onSubmit={handleSubmitClub}>
                  <div className="space-y-2">
                    <Label htmlFor="club-name">Nama Klub</Label>
                    <Input
                      id="club-name"
                      placeholder="Persija Jakarta"
                      {...form.register("name")}
                    />
                    {form.formState.errors.name ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.name.message}
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
                      {createClubMutation.isPending || updateClubMutation.isPending ? (
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
              placeholder="Cari klub..."
              className="max-w-sm bg-background"
            />
            <Button type="submit" variant="outline">Cari</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setSearchInput(""); setQ(""); setPage(1); }}
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {clubsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={colSpan}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data klub...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-sm text-muted-foreground">
                      Belum ada data klub.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

      {/* Dialog konfirmasi daftarkan klub ke musim */}
      <AlertDialog
        open={isRegisterDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsRegisterDialogOpen(false);
            setRegisterTarget(null);
            registerToSeasonMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Daftarkan Klub ke Musim</AlertDialogTitle>
            <AlertDialogDescription>
              Daftarkan{" "}
              <span className="font-medium text-foreground">
                {registerTarget?.name}
              </span>{" "}
              ke musim{" "}
              <span className="font-medium text-foreground">
                {activeSeason?.name}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registerToSeasonMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!registerTarget || registerToSeasonMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!registerTarget) return;
                void registerToSeasonMutation.mutateAsync(registerTarget.id);
              }}
            >
              {registerToSeasonMutation.isPending ? "Mendaftarkan..." : "Ya, daftarkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog konfirmasi hapus klub */}
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
            <AlertDialogTitle>Hapus Klub</AlertDialogTitle>
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
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
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
