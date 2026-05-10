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
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

type SeasonItem = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type SeasonsListResponse = {
  items: SeasonItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

const createSeasonSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format season harus YYYY/YYYY"),
    start_date: z.iso.date("Format start date harus YYYY-MM-DD"),
    end_date: z.iso.date("Format end date harus YYYY-MM-DD"),
    is_active: z.boolean(),
  })
  .refine(
    (value) =>
      Number(value.name.split("/")[1]) === Number(value.name.split("/")[0]) + 1,
    {
      path: ["name"],
      message: "Tahun season tidak valid",
    },
  )
  .refine((value) => value.start_date < value.end_date, {
    path: ["end_date"],
    message: "End date harus lebih besar dari start date",
  });

type CreateSeasonPayload = z.infer<typeof createSeasonSchema>;
type CreateSeasonInput = z.input<typeof createSeasonSchema>;

const columnHelper = createColumnHelper<SeasonItem>();
const seasonsKeys = {
  all: ["seasons"] as const,
  list: (params: { page: number; q: string }) =>
    [...seasonsKeys.all, "list", params] as const,
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

export default function SeasonsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<CreateSeasonInput, unknown, CreateSeasonPayload>({
    resolver: zodResolver(createSeasonSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
      is_active: false,
    },
    mode: "onTouched",
  });

  const seasonsQuery = useQuery({
    queryKey: seasonsKeys.list({ page, q }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) {
        params.set("q", q.trim());
      }

      const result = await apiRequest<SeasonsListResponse>(
        `/api/seasons?${params.toString()}`,
        {
          auth: true,
        },
      );

      return result.envelope.data;
    },
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (payload: CreateSeasonPayload) => {
      await apiRequest("/api/seasons", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      setIsDialogOpen(false);
      form.reset();
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: seasonsKeys.all,
      });
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Season",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "period",
        header: "Periode",
        cell: ({ row }) => (
          <span>{`${row.original.start_date} - ${row.original.end_date}`}</span>
        ),
      }),
      columnHelper.accessor("is_active", {
        header: "Status",
        cell: (info) => {
          const isActive = info.getValue() === 1;
          return (
            <span
              className={
                isActive
                  ? "rounded-(--radius-md) bg-success/15 px-2 py-1 text-xs font-medium text-success"
                  : "rounded-(--radius-md) bg-muted/20 px-2 py-1 text-xs font-medium text-muted"
              }
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          );
        },
      }),
      columnHelper.accessor("updated_at", {
        header: "Updated",
        cell: (info) => info.getValue().slice(0, 10),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: seasonsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = seasonsQuery.data?.pagination.total_pages ?? 1;

  const queryErrorMessage = seasonsQuery.error
    ? getErrorMessage(seasonsQuery.error, "Gagal mengambil data season.")
    : null;
  const mutationErrorMessage = createSeasonMutation.error
    ? getErrorMessage(createSeasonMutation.error, "Gagal membuat season.")
    : null;
  const errorMessage = mutationErrorMessage ?? queryErrorMessage;

  const handleCreateSeason = form.handleSubmit(async (values) => {
    await createSeasonMutation.mutateAsync(values);
  });

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      form.reset();
      createSeasonMutation.reset();
    }
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Seasons</CardTitle>
            <p className="text-sm text-muted">
              Kelola data season dan status aktif season.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Tambah Season
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Season Baru</DialogTitle>
                <DialogDescription>
                  Format season: `YYYY/YYYY` (contoh `2026/2027`).
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateSeason}>
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Season</Label>
                  <Input
                    id="name"
                    placeholder="2026/2027"
                    {...form.register("name")}
                  />
                  {form.formState.errors.name ? (
                    <p className="text-sm text-danger" role="alert">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      {...form.register("start_date")}
                    />
                    {form.formState.errors.start_date ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.start_date.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      {...form.register("end_date")}
                    />
                    {form.formState.errors.end_date ? (
                      <p className="text-sm text-danger" role="alert">
                        {form.formState.errors.end_date.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-accent"
                    {...form.register("is_active")}
                  />
                  Jadikan season aktif
                </label>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      createSeasonMutation.isPending || !form.formState.isValid
                    }
                  >
                    {createSeasonMutation.isPending ? (
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
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
          >
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari season..."
              className="max-w-sm"
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

          <div className="rounded-lg border border-border bg-surface">
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
                {seasonsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat season...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted">
                      Belum ada data season.
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

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Halaman {page}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || seasonsQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || seasonsQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
