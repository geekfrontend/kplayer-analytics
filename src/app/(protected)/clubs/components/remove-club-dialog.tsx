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
import type { SeasonClubRow } from "../services/season-clubs";

type RemoveClubDialogProps = {
  target: SeasonClubRow | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (seasonClubId: string) => void;
};

export function RemoveClubDialog({
  target,
  isPending,
  onOpenChange,
  onConfirm,
}: RemoveClubDialogProps) {
  return (
    <AlertDialog
      open={Boolean(target)}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keluarkan Klub</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">
              {target?.club_name}
            </span>{" "}
            akan dikeluarkan dari musim{" "}
            <span className="font-medium text-foreground">
              {target?.season_name}
            </span>
            . Data penugasan dan statistik tidak terhapus.
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
            {isPending ? "Mengeluarkan..." : "Keluarkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
