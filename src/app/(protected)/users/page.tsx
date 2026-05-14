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
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyPage } from "@/components/app/empty-page";
import { useAdminGuard } from "@/components/app/use-admin-guard";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "analyst";
  created_at: string;
  updated_at: string;
};

type UsersListResponse = {
  items: UserItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const passwordRules = z
  .string()
  .min(8, "Minimal 8 karakter")
  .regex(/[A-Z]/, "Wajib mengandung huruf besar")
  .regex(/[a-z]/, "Wajib mengandung huruf kecil")
  .regex(/[0-9]/, "Wajib mengandung angka")
  .regex(/[^A-Za-z0-9]/, "Wajib mengandung simbol");

const createUserSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.email("Email tidak valid").transform((v) => v.toLowerCase()),
  role: z.enum(["admin", "analyst"]),
  password: passwordRules,
});

const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.email("Email tidak valid").transform((v) => v.toLowerCase()),
  role: z.enum(["admin", "analyst"]),
});

const resetPasswordSchema = z.object({
  new_password: passwordRules,
});

type CreateUserPayload = z.infer<typeof createUserSchema>;
type CreateUserInput = z.input<typeof createUserSchema>;
type UpdateUserPayload = z.infer<typeof updateUserSchema>;
type UpdateUserInput = z.input<typeof updateUserSchema>;
type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

// ─── Query keys ───────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<UserItem>();

const usersKeys = {
  all: ["users"] as const,
  list: (params: { page: number; q: string; role: string }) =>
    [...usersKeys.all, "list", params] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function UsersTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><div className="h-4 w-28 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-4 w-40 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-5 w-14 animate-pulse rounded-full bg-muted" /></TableCell>
          <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell>
            <div className="flex justify-end gap-1">
              <div className="h-6 w-6 animate-pulse rounded bg-muted" />
              <div className="h-6 w-6 animate-pulse rounded bg-muted" />
              <div className="h-6 w-6 animate-pulse rounded bg-muted" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Role select ──────────────────────────────────────────────────────────────

function RoleSelect({
  value,
  onChange,
  id,
}: {
  value: "admin" | "analyst";
  onChange: (v: "admin" | "analyst") => void;
  id?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as "admin" | "analyst")}
    >
      <SelectTrigger id={id} className="bg-background">
        <SelectValue placeholder="Pilih peran" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="analyst">Analis</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { isAdmin } = useAdminGuard();

  if (!isAdmin) {
    return (
      <EmptyPage
        title="Akses Ditolak"
        description="Halaman pengguna hanya dapat diakses oleh admin."
      />
    );
  }

  return <UsersPageContent />;
}

function UsersPageContent() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Forms
  const createForm = useForm<CreateUserInput, unknown, CreateUserPayload>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: "analyst", password: "" },
    mode: "onTouched",
  });

  const updateForm = useForm<UpdateUserInput, unknown, UpdateUserPayload>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: "", email: "", role: "analyst" },
    mode: "onTouched",
  });

  const resetForm = useForm<ResetPasswordInput, unknown, ResetPasswordPayload>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "" },
    mode: "onTouched",
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

  const usersQuery = useQuery({
    queryKey: usersKeys.list({ page, q, role: roleFilter }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) params.set("q", q.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);

      const result = await apiRequest<UsersListResponse>(
        `/api/users?${params.toString()}`,
        { auth: true },
      );
      return result.envelope.data ?? {
        items: [],
        pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
      };
    },
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      await apiRequest("/api/users", { method: "POST", auth: true, body: payload });
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil dibuat");
      setIsFormOpen(false);
      createForm.reset();
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Gagal membuat pengguna.")),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; payload: UpdateUserPayload }) => {
      await apiRequest(`/api/users/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil diperbarui");
      setIsFormOpen(false);
      setEditingUser(null);
      updateForm.reset();
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Gagal memperbarui pengguna.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/users/${id}`, { method: "DELETE", auth: true });
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Gagal menghapus pengguna.")),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (params: { id: string; payload: ResetPasswordPayload }) => {
      await apiRequest(`/api/users/${params.id}/reset-password`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: () => {
      toast.success("Kata sandi berhasil diatur ulang");
      setIsResetOpen(false);
      setResetTarget(null);
      resetForm.reset();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Gagal mengatur ulang kata sandi.")),
  });

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    columnHelper.accessor("name", {
      header: "Nama",
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("role", {
      header: "Peran",
      cell: (info) =>
        info.getValue() === "admin" ? (
          <Badge>Admin</Badge>
        ) : (
          <Badge variant="outline">Analis</Badge>
        ),
    }),
    columnHelper.accessor("updated_at", {
      header: "Diperbarui",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue().slice(0, 10)}</span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Edit pengguna"
            onClick={() => {
              setEditingUser(row.original);
              updateForm.reset({
                name: row.original.name,
                email: row.original.email,
                role: row.original.role,
              });
              setIsFormOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Atur ulang kata sandi"
            onClick={() => {
              setResetTarget(row.original);
              resetForm.reset({ new_password: "" });
              setIsResetOpen(true);
            }}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Hapus pengguna"
            onClick={() => setDeleteTarget(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: usersQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  const total = usersQuery.data?.pagination.total ?? 0;
  const totalPages = usersQuery.data?.pagination.total_pages ?? 1;
  const isEditing = Boolean(editingUser);

  const errorMessage = usersQuery.error
    ? getErrorMessage(usersQuery.error, "Gagal mengambil data pengguna.")
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle>Pengguna</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total} pengguna terdaftar
            </p>
          </div>

          {/* Filter bar + tombol tambah */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
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
                  placeholder="Cari nama atau email..."
                  className="h-8 w-48 pl-8 text-sm"
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
                  title="Reset"
                  onClick={() => { setSearchInput(""); setQ(""); setPage(1); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </form>

            {/* Filter role */}
            <Select
              value={roleFilter}
              onValueChange={(v) => { setRoleFilter(v); setPage(1); }}
            >
              <SelectTrigger className="h-8 w-32 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua peran</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analis</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                setEditingUser(null);
                createForm.reset({ name: "", email: "", role: "analyst", password: "" });
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </Button>
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {usersQuery.isLoading ? (
                  <UsersTableSkeleton />
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Belum ada data pengguna.
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} data · hal. {page}/{totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages || usersQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
                title="Halaman selanjutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog: Create / Edit ── */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingUser(null);
            createForm.reset();
            updateForm.reset();
            createMutation.reset();
            updateMutation.reset();
          }
        }}
      >
        <DialogContent className="border-border bg-background sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Pengguna" : "Tambah Pengguna"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Perbarui profil pengguna. Kata sandi tidak berubah."
                : "Isi data pengguna dan kata sandi awal."}
            </DialogDescription>
          </DialogHeader>

          {isEditing ? (
            <form
              className="space-y-4"
              onSubmit={updateForm.handleSubmit((v) =>
                void updateMutation.mutateAsync({ id: editingUser!.id, payload: v }),
              )}
            >
              <div className="space-y-1.5">
                <Label htmlFor="u-name">Nama</Label>
                <Input id="u-name" {...updateForm.register("name")} />
                {updateForm.formState.errors.name ? (
                  <p className="text-xs text-destructive">{updateForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Email</Label>
                <Input id="u-email" type="email" {...updateForm.register("email")} />
                {updateForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">{updateForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Peran</Label>
                <RoleSelect
                  id="u-role"
                  value={updateForm.watch("role")}
                  onChange={(v) => updateForm.setValue("role", v, { shouldTouch: true, shouldValidate: true })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending || !updateForm.formState.isValid}>
                  {updateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</>
                  ) : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={createForm.handleSubmit((v) =>
                void createMutation.mutateAsync(v),
              )}
            >
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Nama</Label>
                <Input id="c-name" {...createForm.register("name")} />
                {createForm.formState.errors.name ? (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" type="email" {...createForm.register("email")} />
                {createForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">{createForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-role">Peran</Label>
                <RoleSelect
                  id="c-role"
                  value={createForm.watch("role")}
                  onChange={(v) => createForm.setValue("role", v, { shouldTouch: true, shouldValidate: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-password">Kata Sandi Awal</Label>
                <Input id="c-password" type="password" {...createForm.register("password")} />
                {createForm.formState.errors.password ? (
                  <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</>
                  ) : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reset password ── */}
      <Dialog
        open={isResetOpen}
        onOpenChange={(open) => {
          setIsResetOpen(open);
          if (!open) {
            setResetTarget(null);
            resetForm.reset();
            resetPasswordMutation.reset();
          }
        }}
      >
        <DialogContent className="border-border bg-background sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atur Ulang Kata Sandi</DialogTitle>
            <DialogDescription>
              Kata sandi baru untuk{" "}
              <span className="font-medium text-foreground">{resetTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={resetForm.handleSubmit((v) =>
              void resetPasswordMutation.mutateAsync({ id: resetTarget!.id, payload: v }),
            )}
          >
            <div className="space-y-1.5">
              <Label htmlFor="r-password">Kata Sandi Baru</Label>
              <Input id="r-password" type="password" {...resetForm.register("new_password")} />
              {resetForm.formState.errors.new_password ? (
                <p className="text-xs text-destructive">{resetForm.formState.errors.new_password.message}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={resetPasswordMutation.isPending || !resetForm.formState.isValid}>
                {resetPasswordMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</>
                ) : "Atur Ulang"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Konfirmasi hapus ── */}
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
            <AlertDialogTitle>Hapus Pengguna</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>{" "}
              akan dihapus dan semua sesi login-nya akan ditutup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                void deleteMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
