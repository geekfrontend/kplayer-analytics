"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SeasonClubRow } from "../services/season-clubs";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

type ClubsTableSkeletonProps = {
  canWrite: boolean;
};

function ClubsTableSkeleton({ canWrite }: ClubsTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </TableCell>
          {canWrite ? (
            <TableCell>
              <div className="flex justify-end">
                <div className="h-6 w-6 animate-pulse rounded bg-muted" />
              </div>
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<SeasonClubRow>();

type ClubsTableProps = {
  rows: SeasonClubRow[];
  isLoading: boolean;
  isFetching: boolean;
  hasActiveSeason: boolean;
  activeSeasonName: string;
  canWrite: boolean;
  page: number;
  total: number;
  totalPages: number;
  onRemove: (row: SeasonClubRow) => void;
  onPageChange: (page: number) => void;
};

export function ClubsTable({
  rows,
  isLoading,
  isFetching,
  hasActiveSeason,
  activeSeasonName,
  canWrite,
  page,
  total,
  totalPages,
  onRemove,
  onPageChange,
}: ClubsTableProps) {
  const colSpan = canWrite ? 3 : 2;

  const columns = [
    columnHelper.accessor("club_name", {
      header: "Nama Klub",
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: "Didaftarkan",
      cell: (info) => (
        <span className="text-muted-foreground">
          {info.getValue().slice(0, 10)}
        </span>
      ),
    }),
    ...(canWrite
      ? [
          columnHelper.display({
            id: "actions",
            header: "",
            cell: ({ row }) => (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Keluarkan dari musim"
                  onClick={() => onRemove(row.original)}
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
            {!hasActiveSeason ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Pilih musim aktif terlebih dahulu.
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <ClubsTableSkeleton canWrite={canWrite} />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada klub di musim {activeSeasonName}.
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
