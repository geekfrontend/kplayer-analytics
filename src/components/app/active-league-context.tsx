"use client";

import { createContext, useContext } from "react";

export type ActiveLeague = {
  id: string;
  name: string;
  country: string;
};

type ActiveLeagueContextValue = {
  activeLeague: ActiveLeague | null;
  setActiveLeague: (league: ActiveLeague | null) => void;
};

const ActiveLeagueContext = createContext<ActiveLeagueContextValue>({
  activeLeague: null,
  setActiveLeague: () => {},
});

type ActiveLeagueProviderProps = {
  activeLeague: ActiveLeague | null;
  setActiveLeague: (league: ActiveLeague | null) => void;
  children: React.ReactNode;
};

export function ActiveLeagueProvider({
  activeLeague,
  setActiveLeague,
  children,
}: ActiveLeagueProviderProps) {
  return (
    <ActiveLeagueContext.Provider value={{ activeLeague, setActiveLeague }}>
      {children}
    </ActiveLeagueContext.Provider>
  );
}

export function useActiveLeague() {
  return useContext(ActiveLeagueContext);
}
