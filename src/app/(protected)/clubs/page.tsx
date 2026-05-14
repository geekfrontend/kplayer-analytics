"use client";

import { useState } from "react";
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
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
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

type SeasonClubRow = {
  id: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  created_at: string;
};

type SeasonClubsListResponse = {
  items: SeasonClubRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const addClubSchema = z.object({
  name: z.string().trim().min(2, "Nama klub minimal 2 karakter"),
});

type AddClubPayload = z.infer<typeof addClubSchema>;
type AddClubInput = z.input<typeof addClubSchema>;

// ─── Query keys ───────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<SeasonClubRow>();

const seasonClubsKeys = {
  all: ["season-clubs"] as const,
  bySeason: (seasonId: string, page: number, q: string) =>
    [...seasonClubsKeys.all, seasonId, page, q] as const,
};

const clubsKeys = {
  all: ["clubs"] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClubsPage() {
  const { user } = useAuthUser();
  const { activeSeason } = useActiveSeason();
  const { activeLeague } = useActiveLeague();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SeasonClubRow | null>(null);

  const addForm = useForm<AddClubInput, unknown, AddClubPayload>({
    resolver: zodResolver(addClubSchema),
    defaultValues: { name: "" },
    mode: "onTouched",
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

  const seasonClubsQuery = useQuery({
    queryKey: seasonClubsKeys.bySeason(activeSeason?.id ?? "", page, q),
    enabled: Boolean(activeSeason?.id),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("season_id", activeSeason!.id);
      params.set("page", String(page));
      params.set("limit", "10");

      const result = await apiRequest<SeasonClubsListResponse>(
        `/api/season-clubs?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data;
    },
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const addAndRegisterMutation = useMutation({
    mutationFn: async (payload: AddClubPayload) => {
      const createResult = await apiRequest<{ id: string }>(
        "/api/clubs",
        { method: "POST", auth: true, body: { name: payload.name } },
      );
      const newClubId = createResult.envelope.data?.id;
      if (!newClubId) throw new Error("Gagal mendapatkan ID klub baru");

      await apiRequest("/api/season-clubs", {
        method: "POST",
        auth: true,
        body: { season_id: activeSeason!.id, club_id: newClubId },
      });
    },
    onSuccess: async () => {
      toast.success("Klub berhasil ditambahkan");
      setIsAddDialogOpen(false);
      addForm.reset();
      await queryClient.invalidateQueries({ queryKey: seasonClubsKeys.all });
      await queryClient.invalidateQueries({ queryKey: clubsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menambahkan klub."));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (seasonClubId: string) => {
      await apiRequest(`/api/season-clubs/${seasonClubId}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Klub dikeluarkan dari musim");
      setRemoveTarget(null);
      await queryClient.invalidateQueries({ queryKey: seasonClubsKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal mengeluarkan klub."));
    },
  });

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    columnHelper.accessor("club_name", {
      header: "Nama Klub",
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: "Didaftarkan",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue().slice(0, 10)}</span>
      ),
    }),
    ...(canWrite
      ? [
          columnHelper.display({
            id: "actions",
            header: "",
            cell: ({ row }) => (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Keluarkan dari musim"
                  onClick={() => setRemoveTarget(row.original)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          }),
        ]
      : []),
  ];

  const table = useReactTable({
    data: seasonClubsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  const colSpan = canWrite ? 3 : 2;
  const total = seasonClubsQuery.data?.pagination.total ?? 0;
  const totalPages = seasonClubsQuery.data?.pagination.total_pages ?? 1;

  const errorMessage = seasonClubsQuery.error
    ? getErrorMessage(seasonClubsQuery.error, "Gagal mengambil data klub.")
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      {/* Context banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {activeSeason ? (
          <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-medium text-foreground">{activeSeason.name}</span>
            {activeSeason.league_name ? (
              <span className="text-muted-foreground">· {activeSeason.league_name}</span>
            ) : null}
          </div>
        ) : null}
        {activeLeague ? (
          <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-foreground">{activeLeague.name}</span>
            <span className="text-xs text-muted-foreground">· {activeLeague.country}</span>
          </div>
        ) : null}
      </div>

      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle>Klub</CardTitle>
            <p className="text-sm text-muted-foreground">
              {activeSeason
                ? `${total} klub terdaftar di musim ${activeSeason.name}`
                : "Pilih musim aktif untuk melihat daftar klub"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search dengan icon */}
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(searchInput.trim());
              }}
            >
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari klub..."
                  className="h-8 w-44 pl-8 text-sm"
                />
              </div>
              <Button type="submit" variant="outline" size="icon" className="h-8 w-8" title="Cari">
                <Search className="h-3.5 w-3.5" />
              </Button>
              {q ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Reset pencarian"
                  onClick={() => {
                    setSearchInput("");
                    setQ("");
                    setPage(1);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </form>

            {canWrite && activeSeason ? (
              <Button size="sm" className="h-8" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            <p className="rounded-(--radius-md) border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                {!activeSeason ? (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Pilih musim aktif terlebih dahulu.
                    </TableCell>
                  </TableRow>
                ) : seasonClubsQuery.isLoading ? (
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
                    <TableCell
                      colSpan={colSpan}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Belum ada klub di musim {activeSeason.name}.
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

          {/* Pagination dengan icon */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} data · hal. {page}/{totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1 || seasonClubsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages || seasonClubsQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
                title="Halaman selanjutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog: Tambah klub baru ── */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            addForm.reset();
            addAndRegisterMutation.reset();
          }
        }}
      >
        <DialogContent className="border-border bg-background sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Klub</DialogTitle>
            <DialogDescription>
              Klub akan langsung didaftarkan ke musim{" "}
              <span className="font-medium text-foreground">
                {activeSeason?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={addForm.handleSubmit((values) =>
              void addAndRegisterMutation.mutateAsync(values),
            )}
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-club-name">Nama Klub</Label>
              <Input
                id="new-club-name"
                placeholder="Real Madrid"
                {...addForm.register("name")}
              />
              {addForm.formState.errors.name ? (
                <p className="text-xs text-destructive" role="alert">
                  {addForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  addAndRegisterMutation.isPending || !addForm.formState.isValid
                }
              >
                {addAndRegisterMutation.isPending ? (
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

      {/* ── Dialog: Konfirmasi keluarkan ── */}
      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
            removeMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluarkan Klub</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {removeTarget?.club_name}
              </span>{" "}
              akan dikeluarkan dari musim{" "}
              <span className="font-medium text-foreground">
                {removeTarget?.season_name}
              </span>
              . Data penugasan dan statistik tidak terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!removeTarget || removeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!removeTarget) return;
                void removeMutation.mutateAsync(removeTarget.id);
              }}
            >
              {removeMutation.isPending ? "Mengeluarkan..." : "Keluarkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
