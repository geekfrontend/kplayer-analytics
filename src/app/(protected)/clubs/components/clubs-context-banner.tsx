"use client";

import { CalendarDays, Trophy } from "lucide-react";
import type { ActiveLeague } from "@/components/app/active-league-context";
import type { ActiveSeason } from "@/components/app/active-season-context";

type ClubsContextBannerProps = {
  activeSeason: ActiveSeason | null;
  activeLeague: ActiveLeague | null;
};

export function ClubsContextBanner({
  activeSeason,
  activeLeague,
}: ClubsContextBannerProps) {
  if (!activeSeason && !activeLeague) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {activeSeason ? (
        <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium text-foreground">{activeSeason.name}</span>
          {activeSeason.league_name ? (
            <span className="text-muted-foreground">
              · {activeSeason.league_name}
            </span>
          ) : null}
        </div>
      ) : null}
      {activeLeague ? (
        <div className="flex flex-1 items-center gap-2 rounded-(--radius-md) border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-foreground">{activeLeague.name}</span>
          <span className="text-xs text-muted-foreground">
            · {activeLeague.country}
          </span>
        </div>
      ) : null}
    </div>
  );
}
