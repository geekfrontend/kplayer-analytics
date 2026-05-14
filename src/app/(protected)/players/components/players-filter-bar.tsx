"use client";

import { Plus, Search, X } from "lucide-react";
import { AsyncSelect } from "@/components/ui/async-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClubOption } from "../services/players";

type PlayersFilterBarProps = {
  searchInput: string;
  activeQ: string;
  selectedClubId: string;
  selectedClubName: string;
  canWrite: boolean;
  hasActiveSeason: boolean;
  clubFetcher: (query?: string) => Promise<ClubOption[]>;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchReset: () => void;
  onClubChange: (clubId: string) => void;
  onAddClick: () => void;
};

export function PlayersFilterBar({
  searchInput,
  activeQ,
  selectedClubId,
  selectedClubName,
  canWrite,
  hasActiveSeason,
  clubFetcher,
  onSearchChange,
  onSearchSubmit,
  onSearchReset,
  onClubChange,
  onAddClick,
}: PlayersFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari pemain..."
            className="h-8 w-44 pl-8 text-sm"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title="Cari"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
        {activeQ ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Reset pencarian"
            onClick={onSearchReset}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </form>

      {/* Filter klub — hanya aktif jika ada musim aktif */}
      <AsyncSelect<ClubOption>
        fetcher={clubFetcher}
        preload
        disabled={!hasActiveSeason}
        value={selectedClubId}
        onChange={(v) => onClubChange(typeof v === "string" ? v : "")}
        getOptionValue={(o) => o.club_id}
        getDisplayValue={(o) => o.club_name}
        renderOption={(o) => <span>{o.club_name}</span>}
        placeholder={hasActiveSeason ? "Semua klub" : "Pilih musim dulu"}
        searchPlaceholder="Cari klub..."
        defaultDisplayValue={selectedClubName || undefined}
        clearable
        width="180px"
        triggerClassName="h-8 text-sm"
        noResultsMessage="Tidak ada klub di musim ini"
      />

      {/* Tombol tambah */}
      {canWrite ? (
        <Button size="sm" className="h-8 ml-auto" onClick={onAddClick}>
          <Plus className="h-3.5 w-3.5" />
          Tambah
        </Button>
      ) : null}
    </div>
  );
}
