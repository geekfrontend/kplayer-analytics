"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { PLAYER_POSITIONS, type PlayerItem, type PlayerFormValues } from "../services/players";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const playerSchema = z.object({
  full_name: z.string().trim().min(3, "Nama pemain minimal 3 karakter"),
  date_of_birth: z
    .iso.date("Format tanggal lahir harus YYYY-MM-DD")
    .refine((v) => new Date(v).getTime() <= Date.now(), {
      message: "Tanggal lahir tidak boleh di masa depan",
    }),
  nationality: z
    .string()
    .trim()
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => !v || v.length >= 2, {
      message: "Kebangsaan minimal 2 karakter",
    }),
  primary_position: z.string().trim().min(2, "Posisi utama minimal 2 karakter"),
});

type PlayerSchemaInput = z.input<typeof playerSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

type PlayerFormDialogProps = {
  open: boolean;
  isPending: boolean;
  editingPlayer: PlayerItem | null;
  activeClubName?: string;
  activeSeasonName?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PlayerFormValues) => void;
};

export function PlayerFormDialog({
  open,
  isPending,
  editingPlayer,
  activeClubName,
  activeSeasonName,
  onOpenChange,
  onSubmit,
}: PlayerFormDialogProps) {
  const isEditing = Boolean(editingPlayer);

  const form = useForm<PlayerSchemaInput, unknown, PlayerFormValues>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      full_name: "",
      date_of_birth: "",
      nationality: "",
      primary_position: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (editingPlayer) {
      form.reset({
        full_name: editingPlayer.full_name,
        date_of_birth: editingPlayer.date_of_birth,
        nationality: editingPlayer.nationality ?? "",
        primary_position: editingPlayer.primary_position,
      });
    } else {
      form.reset({
        full_name: "",
        date_of_birth: "",
        nationality: "",
        primary_position: "",
      });
    }
  }, [editingPlayer, form]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Pemain" : "Tambah Pemain"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Perbarui data pemain sesuai kebutuhan."
              : "Pemain akan langsung ditugaskan ke klub dan musim aktif."}
          </DialogDescription>
        </DialogHeader>

        {/* Konteks klub & musim — hanya saat create */}
        {!isEditing && (activeClubName ?? activeSeasonName) ? (
          <div className="flex items-center gap-3 rounded-(--radius-md) border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {activeClubName ? (
              <span>
                Klub:{" "}
                <span className="font-medium text-foreground">
                  {activeClubName}
                </span>
              </span>
            ) : null}
            {activeClubName && activeSeasonName ? (
              <span className="text-border">·</span>
            ) : null}
            {activeSeasonName ? (
              <span>
                Musim:{" "}
                <span className="font-medium text-foreground">
                  {activeSeasonName}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="pf-full-name">Nama Lengkap</Label>
            <Input
              id="pf-full-name"
              placeholder="Jay Idzes"
              {...form.register("full_name")}
            />
            {form.formState.errors.full_name ? (
              <p className="text-xs text-destructive" role="alert">
                {form.formState.errors.full_name.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-dob">Tanggal Lahir</Label>
              <Input
                id="pf-dob"
                type="date"
                {...form.register("date_of_birth")}
              />
              {form.formState.errors.date_of_birth ? (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.date_of_birth.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-position">Posisi Utama</Label>
              <Select
                value={form.watch("primary_position")}
                onValueChange={(v) =>
                  form.setValue("primary_position", v, {
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="pf-position">
                  <SelectValue placeholder="Pilih posisi..." />
                </SelectTrigger>
                <SelectContent>
                  {PLAYER_POSITIONS.map((pos) => (
                    <SelectItem key={pos.value} value={pos.value}>
                      {pos.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.primary_position ? (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.primary_position.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-nationality">
              Kebangsaan{" "}
              <span className="text-xs text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              id="pf-nationality"
              placeholder="Indonesia"
              {...form.register("nationality")}
            />
            {form.formState.errors.nationality ? (
              <p className="text-xs text-destructive" role="alert">
                {form.formState.errors.nationality.message}
              </p>
            ) : null}
          </div>

          {/* Tanggal bergabung dihapus — diisi otomatis dengan tanggal hari ini */}

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || !form.formState.isValid}
            >
              {isPending ? (
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
  );
}
