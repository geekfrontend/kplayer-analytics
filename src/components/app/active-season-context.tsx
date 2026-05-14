"use client";

import { createContext, useContext } from "react";

export type ActiveSeason = {
  id: string;
  name: string;
  league_id: string | null;
  league_name: string | null;
};

type ActiveSeasonContextValue = {
  activeSeason: ActiveSeason | null;
  setActiveSeason: (season: ActiveSeason | null) => void;
};

const ActiveSeasonContext = createContext<ActiveSeasonContextValue>({
  activeSeason: null,
  setActiveSeason: () => {},
});

type ActiveSeasonProviderProps = {
  activeSeason: ActiveSeason | null;
  setActiveSeason: (season: ActiveSeason | null) => void;
  children: React.ReactNode;
};

export function ActiveSeasonProvider({
  activeSeason,
  setActiveSeason,
  children,
}: ActiveSeasonProviderProps) {
  return (
    <ActiveSeasonContext.Provider value={{ activeSeason, setActiveSeason }}>
      {children}
    </ActiveSeasonContext.Provider>
  );
}

export function useActiveSeason() {
  return useContext(ActiveSeasonContext);
}
