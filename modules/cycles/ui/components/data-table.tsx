"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  OnChangeFn,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo } from "react"; // 1. Import useMemo

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  sorting?: SortingState;
  deleteButton?: boolean; // This is the prop we control
  onSortingChange?: OnChangeFn<SortingState>;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting,
  onSortingChange,
  onRowClick,
  deleteButton = true, // 2. Default to true (Show actions by default)
}: DataTableProps<TData, TValue>) {

  // 3. Filter columns: If deleteButton is false, remove the "actions" column
  const visibleColumns = useMemo(() => {
    if (deleteButton === false) {
      return columns.filter((col) => col.id !== "actions");
    }
    return columns;
  }, [columns, deleteButton]);

  const table = useReactTable({
    data,
    columns: visibleColumns, // 4. Pass the filtered columns here
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    onSortingChange: onSortingChange,
    state: {
      sorting,
    },
  });

  return (
    <div className="w-full overflow-x-auto rounded-md border shadow-sm scrollbar-thin text-xs sm:text-sm">
      <Table className="min-w-[600px] md:min-w-full text-inherit">
        <TableHeader className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur shadow-sm">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} className="h-9 px-2 text-[10px] sm:h-11 sm:px-4 sm:text-[11px]">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="p-2 sm:p-4 text-xs sm:text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={visibleColumns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}