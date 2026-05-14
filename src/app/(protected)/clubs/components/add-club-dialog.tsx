"use client";

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

// ─── Schema ───────────────────────────────────────────────────────────────────

export const addClubSchema = z.object({
  name: z.string().trim().min(2, "Nama klub minimal 2 karakter"),
});

export type AddClubPayload = z.infer<typeof addClubSchema>;
export type AddClubInput = z.input<typeof addClubSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

type AddClubDialogProps = {
  open: boolean;
  isPending: boolean;
  seasonName: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddClubPayload) => void;
};

export function AddClubDialog({
  open,
  isPending,
  seasonName,
  onOpenChange,
  onSubmit,
}: AddClubDialogProps) {
  const form = useForm<AddClubInput, unknown, AddClubPayload>({
    resolver: zodResolver(addClubSchema),
    defaultValues: { name: "" },
    mode: "onTouched",
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tambah Klub</DialogTitle>
          <DialogDescription>
            Klub akan langsung didaftarkan ke musim{" "}
            <span className="font-medium text-foreground">{seasonName}</span>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-club-name">Nama Klub</Label>
            <Input
              id="new-club-name"
              placeholder="Real Madrid"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive" role="alert">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
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
