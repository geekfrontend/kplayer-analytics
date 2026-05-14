"use client";

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
import type { PlayerItem } from "../services/players";

type DeletePlayerDialogProps = {
  target: PlayerItem | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
};

export function DeletePlayerDialog({
  target,
  isPending,
  onOpenChange,
  onConfirm,
}: DeletePlayerDialogProps) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Pemain</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">
              {target?.full_name}
            </span>{" "}
            akan dihapus permanen. Data penugasan dan statistik yang terkait
            tidak dapat dihapus jika masih ada referensi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!target || isPending}
            onClick={(e) => {
              e.preventDefault();
              if (!target) return;
              onConfirm(target.id);
            }}
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
