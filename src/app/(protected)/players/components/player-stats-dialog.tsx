"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { isApiClientError } from "@/lib/api-client";
import {
  createPlayerStats,
  fetchPlayerStatsByScope,
  playerStatsKeys,
  playerStatsByScopeKeys,
  updatePlayerStats,
  type PlayerItem,
  type PlayerStatsFormValues,
} from "../services/players";

// ─── Schema ───────────────────────────────────────────────────────────────────

const statsSchema = z
  .object({
    goals: z.coerce
      .number()
      .min(0, "Minimal 0"),
    assists: z.coerce
      .number()
      .min(0, "Minimal 0"),
    shots: z.coerce
      .number()
      .min(0, "Minimal 0"),
  })
  .refine((v) => v.shots >= v.goals, {
    message: "Tembakan tidak boleh lebih kecil dari gol",
    path: ["shots"],
  });

type StatsSchemaInput = z.input<typeof statsSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown) {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

// ─── Component ────────────────────────────────────────────────────────────────

type PlayerStatsDialogProps = {
  open: boolean;
  player: PlayerItem | null;
  seasonId: string;
  seasonName: string;
  clubId: string;
  clubName: string;
  onOpenChange: (open: boolean) => void;
};

export function PlayerStatsDialog({
  open,
  player,
  seasonId,
  seasonName,
  clubId,
  clubName,
  onOpenChange,
}: PlayerStatsDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<StatsSchemaInput, unknown, PlayerStatsFormValues>({
    resolver: zodResolver(statsSchema),
    defaultValues: {
      goals: 0,
      assists: 0,
      shots: 0,
    },
    mode: "onChange",
  });

  // Fetch existing stats untuk scope ini
  const statsQuery = useQuery({
    queryKey: playerStatsKeys.byScope(
      player?.id ?? "",
      seasonId,
      clubId,
    ),
    enabled: open && Boolean(player?.id) && Boolean(seasonId) && Boolean(clubId),
    queryFn: () =>
      fetchPlayerStatsByScope(player!.id, seasonId, clubId),
  });

  // Prefill form jika sudah ada data
  useEffect(() => {
    if (statsQuery.data) {
      form.reset({
        goals: statsQuery.data.goals,
        assists: statsQuery.data.assists,
        shots: statsQuery.data.shots,
      });
    } else if (!statsQuery.isLoading) {
      form.reset({ goals: 0, assists: 0, shots: 0 });
    }
  }, [statsQuery.data, statsQuery.isLoading, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: PlayerStatsFormValues) => {
      if (statsQuery.data) {
        // Update existing
        await updatePlayerStats(statsQuery.data.id, values);
      } else {
        // Create new
        await createPlayerStats(player!.id, seasonId, clubId, values);
      }
    },
    onSuccess: async () => {
      toast.success("Statistik berhasil disimpan");
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: playerStatsKeys.byScope(player?.id ?? "", seasonId, clubId),
      });
      await queryClient.invalidateQueries({
        queryKey: playerStatsByScopeKeys.bySeasonClub(seasonId, clubId),
      });
      // Invalidate dashboard stats juga
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      form.reset();
      saveMutation.reset();
    }
  }

  const isExisting = Boolean(statsQuery.data);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Statistik Pemain</DialogTitle>
          <DialogDescription>
            {player?.full_name} · {seasonName} · {clubName}
          </DialogDescription>
        </DialogHeader>

        {statsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat statistik...
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) =>
              void saveMutation.mutateAsync(v),
            )}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ps-goals">Gol</Label>
                <Input
                  id="ps-goals"
                  type="number"
                  min={0}
                  step="any"
                  {...form.register("goals")}
                />
                {form.formState.errors.goals ? (
                  <p className="text-xs text-destructive" role="alert">
                    {form.formState.errors.goals.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ps-assists">Assist</Label>
                <Input
                  id="ps-assists"
                  type="number"
                  min={0}
                  step="any"
                  {...form.register("assists")}
                />
                {form.formState.errors.assists ? (
                  <p className="text-xs text-destructive" role="alert">
                    {form.formState.errors.assists.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="ps-shots">Tembakan</Label>
                <Input
                  id="ps-shots"
                  type="number"
                  min={0}
                  step="any"
                  {...form.register("shots")}
                />
                {form.formState.errors.shots ? (
                  <p className="text-xs text-destructive" role="alert">
                    {form.formState.errors.shots.message}
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {isExisting ? "Perbarui statistik" : "Buat statistik baru"}
              </span>
              <Button
                type="submit"
                disabled={saveMutation.isPending || !form.formState.isValid}
              >
                {saveMutation.isPending ? (
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
  );
}
