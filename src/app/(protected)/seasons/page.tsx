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
import { toast } from "sonner";
import { z } from "zod";
import { useAuthUser } from "@/components/app/auth-user-context";
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
      .regex(/^\d{4}\/\d{4}$/, "Format musim harus YYYY/YYYY"),
    start_date: z.iso.date("Format tanggal mulai harus YYYY-MM-DD"),
    end_date: z.iso.date("Format tanggal selesai harus YYYY-MM-DD"),
    is_active: z.boolean(),
  })
  .refine(
    (value) =>
      Number(value.name.split("/")[1]) === Number(value.name.split("/")[0]) + 1,
    {
      path: ["name"],
      message: "Tahun musim tidak valid",
    },
  )
  .refine((value) => value.start_date < value.end_date, {
    path: ["end_date"],
    message: "Tanggal selesai harus lebih besar dari tanggal mulai",
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
  const { user } = useAuthUser();
  const canWrite = user?.role === "admin";
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
      toast.success("Musim berhasil dibuat");
      setIsDialogOpen(false);
      form.reset();
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: seasonsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat musim."));
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Musim",
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
            <Badge variant={isActive ? "default" : "outline"}>
              {isActive ? "Aktif" : "Tidak aktif"}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("updated_at", {
        header: "Diperbarui",
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
    ? getErrorMessage(seasonsQuery.error, "Gagal mengambil data musim.")
    : null;
  const mutationErrorMessage = createSeasonMutation.error
    ? getErrorMessage(createSeasonMutation.error, "Gagal membuat musim.")
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
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Musim</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola data musim dan status aktif musim.
            </p>
          </div>
          {canWrite ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Tambah Musim
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>Buat Musim Baru</DialogTitle>
                  <DialogDescription>
                    Format musim: `YYYY/YYYY` (contoh `2026/2027`).
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateSeason}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Musim</Label>
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
                      <Label htmlFor="start_date">Tanggal Mulai</Label>
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
                      <Label htmlFor="end_date">Tanggal Selesai</Label>
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
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        createSeasonMutation.isPending ||
                        !form.formState.isValid
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
              placeholder="Cari musim..."
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
                {seasonsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat season...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-sm text-muted-foreground"
                    >
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <p>Halaman {page}</p>
              <span className="text-border">•</span>
              <p>Total {seasonsQuery.data?.pagination.total ?? 0} data</p>
            </div>
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
