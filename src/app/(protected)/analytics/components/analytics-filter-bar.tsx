"use client";

import { useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AsyncSelect } from "@/components/ui/async-select";
import {
  clubOptionsKeys,
  fetchClubOptionsBySeason,
  type ClubOption,
} from "../../players/services/players";

type AnalyticsFilterBarProps = {
  seasonId: string;
  selectedClubId: string;
  selectedClubName: string;
  isFetching: boolean;
  onClubChange: (clubId: string, clubName: string) => void;
  onRunAgain: () => void;
};

export function AnalyticsFilterBar({
  seasonId,
  selectedClubId,
  selectedClubName,
  isFetching,
  onClubChange,
  onRunAgain,
}: AnalyticsFilterBarProps) {
  const queryClient = useQueryClient();

  const clubFetcher = useCallback(
    async (_query?: string): Promise<ClubOption[]> => {
      if (!seasonId) return [];
      return queryClient.fetchQuery({
        queryKey: clubOptionsKeys.bySeason(seasonId),
        queryFn: () => fetchClubOptionsBySeason(seasonId),
        staleTime: 60_000,
      });
    },
    [seasonId, queryClient],
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="filter-club" className="text-xs font-medium">
          Klub
        </Label>
        <AsyncSelect<ClubOption>
          fetcher={clubFetcher}
          preload
          disabled={!seasonId}
          value={selectedClubId}
          onChange={(v) => {
            const id = typeof v === "string" ? v : "";
            onClubChange(id, "");
          }}
          getOptionValue={(o) => o.club_id}
          getDisplayValue={(o) => o.club_name}
          renderOption={(o) => <span>{o.club_name}</span>}
          placeholder={seasonId ? "Semua klub" : "Pilih musim dulu"}
          searchPlaceholder="Cari klub..."
          defaultDisplayValue={selectedClubName || undefined}
          clearable
          width="100%"
          triggerClassName="h-9 text-sm"
          noResultsMessage="Tidak ada klub di musim ini"
        />
      </div>

      <div className="flex items-end">
        <Button
          onClick={onRunAgain}
          disabled={isFetching}
          className="h-9 w-full"
          variant="outline"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Jalankan Ulang
        </Button>
      </div>
    </div>
  );
}
