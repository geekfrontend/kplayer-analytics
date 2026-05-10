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
import { KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

const createUserSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.email("Email tidak valid").transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "analyst"]),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter")
    .regex(/[A-Z]/, "Kata sandi wajib mengandung huruf besar")
    .regex(/[a-z]/, "Kata sandi wajib mengandung huruf kecil")
    .regex(/[0-9]/, "Kata sandi wajib mengandung angka")
    .regex(/[^A-Za-z0-9]/, "Kata sandi wajib mengandung simbol"),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.email("Email tidak valid").transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "analyst"]),
});

const resetPasswordSchema = z.object({
  new_password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter")
    .regex(/[A-Z]/, "Kata sandi wajib mengandung huruf besar")
    .regex(/[a-z]/, "Kata sandi wajib mengandung huruf kecil")
    .regex(/[0-9]/, "Kata sandi wajib mengandung angka")
    .regex(/[^A-Za-z0-9]/, "Kata sandi wajib mengandung simbol"),
});

type CreateUserPayload = z.infer<typeof createUserSchema>;
type CreateUserInput = z.input<typeof createUserSchema>;
type UpdateUserPayload = z.infer<typeof updateUserSchema>;
type UpdateUserInput = z.input<typeof updateUserSchema>;
type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

const columnHelper = createColumnHelper<UserItem>();
const usersKeys = {
  all: ["users"] as const,
  list: (params: { page: number; q: string; role: string }) =>
    [...usersKeys.all, "list", params] as const,
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

export default function UsersPage() {
  const { isAdmin } = useAdminGuard();
  const canWrite = isAdmin;

  if (!canWrite) {
    return (
      <EmptyPage
        title="Akses Ditolak"
        description="Halaman pengguna hanya dapat diakses oleh admin."
      />
    );
  }

  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [roleFilterInput, setRoleFilterInput] = useState("all");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);

  const createForm = useForm<CreateUserInput, unknown, CreateUserPayload>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "analyst",
      password: "",
    },
    mode: "onTouched",
  });

  const updateForm = useForm<UpdateUserInput, unknown, UpdateUserPayload>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "analyst",
    },
    mode: "onTouched",
  });

  const resetForm = useForm<ResetPasswordInput, unknown, ResetPasswordPayload>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      new_password: "",
    },
    mode: "onTouched",
  });

  const usersQuery = useQuery({
    queryKey: usersKeys.list({ page, q, role: roleFilter }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (q.trim()) {
        params.set("q", q.trim());
      }
      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }

      const result = await apiRequest<UsersListResponse>(
        `/api/users?${params.toString()}`,
        { auth: true },
      );

      return (
        result.envelope.data ?? {
          items: [],
          pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
        }
      );
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      await apiRequest("/api/users", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil dibuat");
      setIsFormDialogOpen(false);
      createForm.reset();
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal membuat pengguna."));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (params: { id: string; payload: UpdateUserPayload }) => {
      await apiRequest(`/api/users/${params.id}`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil diperbarui");
      setIsFormDialogOpen(false);
      setEditingUser(null);
      updateForm.reset();
      await queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal memperbarui pengguna."));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/users/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil dihapus");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menghapus pengguna."));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      payload: ResetPasswordPayload;
    }) => {
      await apiRequest(`/api/users/${params.id}/reset-password`, {
        method: "PATCH",
        auth: true,
        body: params.payload,
      });
    },
    onSuccess: async () => {
      toast.success("Kata sandi pengguna berhasil diatur ulang");
      setIsResetDialogOpen(false);
      setResetTarget(null);
      resetForm.reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal mengatur ulang kata sandi."));
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Nama",
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("email", {
        header: "Email",
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
                      const rowUser = row.original;
                      setEditingUser(rowUser);
                      updateForm.reset({
                        name: rowUser.name,
                        email: rowUser.email,
                        role: rowUser.role,
                      });
                      setIsFormDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResetTarget(row.original);
                      resetForm.reset({ new_password: "" });
                      setIsResetDialogOpen(true);
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Atur Ulang Kata Sandi
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
    [canWrite, resetForm, updateForm],
  );

  const table = useReactTable({
    data: usersQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = usersQuery.data?.pagination.total_pages ?? 1;

  const queryErrorMessage = usersQuery.error
    ? getErrorMessage(usersQuery.error, "Gagal mengambil data pengguna.")
    : null;
  const createErrorMessage = createUserMutation.error
    ? getErrorMessage(createUserMutation.error, "Gagal membuat pengguna.")
    : null;
  const updateErrorMessage = updateUserMutation.error
    ? getErrorMessage(updateUserMutation.error, "Gagal memperbarui pengguna.")
    : null;
  const deleteErrorMessage = deleteUserMutation.error
    ? getErrorMessage(deleteUserMutation.error, "Gagal menghapus pengguna.")
    : null;
  const resetErrorMessage = resetPasswordMutation.error
    ? getErrorMessage(
        resetPasswordMutation.error,
        "Gagal mengatur ulang kata sandi pengguna.",
      )
    : null;
  const errorMessage =
    createErrorMessage ??
    updateErrorMessage ??
    deleteErrorMessage ??
    resetErrorMessage ??
    queryErrorMessage;

  const handleCreate = createForm.handleSubmit(async (values) => {
    await createUserMutation.mutateAsync(values);
  });

  const handleUpdate = updateForm.handleSubmit(async (values) => {
    if (!editingUser) {
      return;
    }
    await updateUserMutation.mutateAsync({
      id: editingUser.id,
      payload: values,
    });
  });

  const handleResetPassword = resetForm.handleSubmit(async (values) => {
    if (!resetTarget) {
      return;
    }
    await resetPasswordMutation.mutateAsync({
      id: resetTarget.id,
      payload: values,
    });
  });

  return (
    <section className="space-y-4">
      <Card className="border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Pengguna</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kelola akun pengguna dan role akses aplikasi.
            </p>
          </div>
          {canWrite ? (
            <Dialog
              open={isFormDialogOpen}
              onOpenChange={(open) => {
                setIsFormDialogOpen(open);
                if (!open) {
                  setEditingUser(null);
                  createForm.reset();
                  updateForm.reset();
                  createUserMutation.reset();
                  updateUserMutation.reset();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingUser(null);
                    createForm.reset({
                      name: "",
                      email: "",
                      role: "analyst",
                      password: "",
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Pengguna
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-background">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? "Ubah Pengguna" : "Buat Pengguna Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingUser
                      ? "Perbarui profil pengguna tanpa mengubah kata sandi."
                      : "Isi data pengguna dan kata sandi awal."}
                  </DialogDescription>
                </DialogHeader>

                {editingUser ? (
                  <form className="space-y-4" onSubmit={handleUpdate}>
                    <div className="space-y-2">
                      <Label htmlFor="edit_name">Nama</Label>
                      <Input id="edit_name" {...updateForm.register("name")} />
                      {updateForm.formState.errors.name ? (
                        <p className="text-sm text-danger" role="alert">
                          {updateForm.formState.errors.name.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_email">Email</Label>
                      <Input
                        id="edit_email"
                        type="email"
                        {...updateForm.register("email")}
                      />
                      {updateForm.formState.errors.email ? (
                        <p className="text-sm text-danger" role="alert">
                          {updateForm.formState.errors.email.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_role">Peran</Label>
                      <Select
                        value={updateForm.watch("role")}
                        onValueChange={(value) =>
                          updateForm.setValue(
                            "role",
                            value as "admin" | "analyst",
                            {
                              shouldTouch: true,
                              shouldValidate: true,
                            },
                          )
                        }
                      >
                        <SelectTrigger
                          id="edit_role"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih peran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="analyst">Analis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={
                          updateUserMutation.isPending ||
                          !updateForm.formState.isValid
                        }
                      >
                        {updateUserMutation.isPending ? (
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
                ) : (
                  <form className="space-y-4" onSubmit={handleCreate}>
                    <div className="space-y-2">
                      <Label htmlFor="create_name">Nama</Label>
                      <Input
                        id="create_name"
                        {...createForm.register("name")}
                      />
                      {createForm.formState.errors.name ? (
                        <p className="text-sm text-danger" role="alert">
                          {createForm.formState.errors.name.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create_email">Email</Label>
                      <Input
                        id="create_email"
                        type="email"
                        {...createForm.register("email")}
                      />
                      {createForm.formState.errors.email ? (
                        <p className="text-sm text-danger" role="alert">
                          {createForm.formState.errors.email.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create_role">Peran</Label>
                      <Select
                        value={createForm.watch("role")}
                        onValueChange={(value) =>
                          createForm.setValue(
                            "role",
                            value as "admin" | "analyst",
                            {
                              shouldTouch: true,
                              shouldValidate: true,
                            },
                          )
                        }
                      >
                        <SelectTrigger
                          id="create_role"
                          className="w-full bg-background"
                        >
                          <SelectValue placeholder="Pilih peran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="analyst">Analis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="create_password">Kata Sandi Awal</Label>
                      <Input
                        id="create_password"
                        type="password"
                        {...createForm.register("password")}
                      />
                      {createForm.formState.errors.password ? (
                        <p className="text-sm text-danger" role="alert">
                          {createForm.formState.errors.password.message}
                        </p>
                      ) : null}
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={
                          createUserMutation.isPending ||
                          !createForm.formState.isValid
                        }
                      >
                        {createUserMutation.isPending ? (
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
                )}
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          <form
            className="grid gap-3 rounded-(--radius-md) border border-border/80 bg-muted/50 p-3 sm:grid-cols-[1fr_180px_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
              setRoleFilter(roleFilterInput);
            }}
          >
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari nama atau email..."
              className="bg-background"
            />
            <Select value={roleFilterInput} onValueChange={setRoleFilterInput}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Filter peran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analis</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Terapkan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setRoleFilterInput("all");
                setQ("");
                setRoleFilter("all");
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
                {usersQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data pengguna...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-sm text-muted-foreground"
                    >
                      Belum ada data pengguna.
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
              <p>Total {usersQuery.data?.pagination.total ?? 0} data</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || usersQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={canWrite && isResetDialogOpen}
        onOpenChange={(open) => {
          setIsResetDialogOpen(open);
          if (!open) {
            setResetTarget(null);
            resetForm.reset();
            resetPasswordMutation.reset();
          }
        }}
      >
        <DialogContent className="border-border bg-background">
          <DialogHeader>
            <DialogTitle>Atur Ulang Kata Sandi Pengguna</DialogTitle>
            <DialogDescription>
              {resetTarget
                ? `Set password baru untuk ${resetTarget.name}.`
                : "Setel kata sandi baru pengguna."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div className="space-y-2">
              <Label htmlFor="reset_password">Kata Sandi Baru</Label>
              <Input
                id="reset_password"
                type="password"
                {...resetForm.register("new_password")}
              />
              {resetForm.formState.errors.new_password ? (
                <p className="text-sm text-danger" role="alert">
                  {resetForm.formState.errors.new_password.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  resetPasswordMutation.isPending ||
                  !resetForm.formState.isValid
                }
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Atur Ulang Kata Sandi"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={canWrite && Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deleteUserMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna</AlertDialogTitle>
            <AlertDialogDescription>
              Pengguna{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              akan dihapus (soft-delete) dan sesi login pengguna tersebut akan
              ditutup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteUserMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) {
                  return;
                }
                void deleteUserMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteUserMutation.isPending ? "Menghapus..." : "Ya, hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
