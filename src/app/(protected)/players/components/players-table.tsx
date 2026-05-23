"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { BarChart2, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlayerItem, PlayerStats } from "../services/players";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PlayersTableSkeleton({ canWrite }: { canWrite: boolean }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><div className="h-4 w-32 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-4 w-10 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
          {/* Stats columns */}
          <TableCell><div className="h-4 w-8 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-4 w-8 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-4 w-12 animate-pulse rounded bg-muted" /></TableCell>
          {canWrite ? (
            <TableCell>
              <div className="flex justify-end gap-1">
                <div className="h-6 w-6 animate-pulse rounded bg-muted" />
                <div className="h-6 w-6 animate-pulse rounded bg-muted" />
                <div className="h-6 w-6 animate-pulse rounded bg-muted" />
              </div>
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }
  return <span className="tabular-nums text-muted-foreground">{value}</span>;
}

// ─── Table ────────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<PlayerItem>();

type PlayersTableProps = {
  rows: PlayerItem[];
  statsMap: Map<string, PlayerStats>;
  isLoading: boolean;
  isFetching: boolean;
  canWrite: boolean;
  page: number;
  total: number;
  totalPages: number;
  onEdit: (player: PlayerItem) => void;
  onDelete: (player: PlayerItem) => void;
  onStats: (player: PlayerItem) => void;
  onPageChange: (page: number) => void;
};

export function PlayersTable({
  rows,
  statsMap,
  isLoading,
  isFetching,
  canWrite,
  page,
  total,
  totalPages,
  onEdit,
  onDelete,
  onStats,
  onPageChange,
}: PlayersTableProps) {
  const colCount = canWrite ? 7 : 6;

  const columns = [
    columnHelper.accessor("full_name", {
      header: "Nama Pemain",
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("primary_position", {
      header: "Pos.",
      cell: (info) => (
        <span className="text-xs font-medium text-muted-foreground">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("nationality", {
      header: "Kebangsaan",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
      ),
    }),
    // ─── Kolom statistik ──────────────────────────────────────────────────────
    columnHelper.display({
      id: "goals",
      header: () => <span className="text-xs">Gol</span>,
      cell: ({ row }) => (
        <StatCell value={statsMap.get(row.original.id)?.goals} />
      ),
    }),
    columnHelper.display({
      id: "assists",
      header: () => <span className="text-xs">Assist</span>,
      cell: ({ row }) => (
        <StatCell value={statsMap.get(row.original.id)?.assists} />
      ),
    }),
    columnHelper.display({
      id: "shots",
      header: () => <span className="text-xs">Tembakan</span>,
      cell: ({ row }) => (
        <StatCell value={statsMap.get(row.original.id)?.shots} />
      ),
    }),
    ...(canWrite
      ? [
          columnHelper.display({
            id: "actions",
            header: "",
            cell: ({ row }) => (
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  title="Kelola statistik"
                  onClick={() => onStats(row.original)}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Edit pemain"
                  onClick={() => onEdit(row.original)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Hapus pemain"
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          }),
        ]
      : []),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <PlayersTableSkeleton canWrite={canWrite} />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada data pemain.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} data · hal. {page}/{totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1 || isFetching}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            title="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages || isFetching}
            onClick={() => onPageChange(page + 1)}
            title="Halaman selanjutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
