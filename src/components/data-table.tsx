"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ArrowDownUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "./ui/badge";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { useFmt } from "./format";

export type ColumnType = "text" | "date" | "datetime" | "money" | "number" | "badge" | "bool" | "hours";

export type Column = {
  key: string;
  label: string;
  type?: ColumnType;
  /** Link pattern such as "/clients/:id"; `:field` is replaced from the row. */
  href?: string;
  /** Translation namespace for badge values, e.g. "MatterStatus" -> enum.MatterStatus.OPEN */
  enumKey?: string;
  currencyKey?: string;
};

export type Filter = { key: string; label: string; options: { value: string; label: string }[] };

type Row = Record<string, unknown> & { id: string };

const fillHref = (pattern: string, row: Row) => pattern.replace(/:(\w+)/g, (_, k: string) => String(row[k] ?? ""));

export function DataTable({
  columns,
  rows,
  filters = [],
  exportName,
  pageSize = 25,
  emptyText,
}: {
  columns: Column[];
  rows: Row[];
  filters?: Filter[];
  exportName?: string;
  pageSize?: number;
  emptyText?: string;
}) {
  const t = useTranslations();
  const fmt = useFmt();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const display = (col: Column, row: Row): string => {
    const v = row[col.key];
    if (v === null || v === undefined || v === "") return "";
    switch (col.type) {
      case "date":
        return fmt.date(String(v));
      case "datetime":
        return fmt.datetime(String(v));
      case "money":
        return fmt.money(String(v), col.currencyKey ? String(row[col.currencyKey] ?? "AED") : "AED");
      case "number":
        return fmt.number(String(v));
      case "hours":
        return fmt.hours(Number(v));
      case "bool":
        return v ? t("common.yes") : t("common.no");
      case "badge":
        return col.enumKey ? t(`enum.${col.enumKey}.${v}`) : String(v);
      default:
        return String(v);
    }
  };

  const data = useMemo(
    () => rows.filter((r) => Object.entries(filterValues).every(([k, v]) => !v || String(r[k]) === v)),
    [rows, filterValues],
  );

  const columnDefs = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => {
          const v = row[col.key];
          if (col.type === "money" || col.type === "number" || col.type === "hours") return Number(v ?? 0);
          if (col.type === "badge" || col.type === "bool") return display(col, row);
          return v ?? "";
        },
        header: col.label,
        cell: ({ row }) => {
          const r = row.original;
          const text = display(col, r);
          if (col.type === "badge" && r[col.key]) {
            return <Badge tone={STATUS_TONES[String(r[col.key])] ?? "neutral"}>{text}</Badge>;
          }
          const content = col.type === "money" || col.type === "number" || col.type === "hours" ? <span className="tabular-nums">{text}</span> : text;
          if (col.href && text) {
            return (
              <Link href={fillHref(col.href, r)} className="font-medium text-primary hover:underline dark:text-accent">
                {content}
              </Link>
            );
          }
          return content;
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value: string) => {
      const q = value.toLowerCase();
      return columns.some((c) => display(c, row.original).toLowerCase().includes(q));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const exportCsv = () => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      columns.map((c) => escape(c.label)).join(","),
      ...table.getFilteredRowModel().rows.map((r) => columns.map((c) => escape(display(c, r.original))).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={t("common.search")} className="ps-8" />
        </div>
        {filters.map((f) => (
          <Select
            key={f.key}
            className="w-auto min-w-36"
            value={filterValues[f.key] ?? ""}
            onChange={(e) => setFilterValues((s) => ({ ...s, [f.key]: e.target.value }))}
            aria-label={f.label}
          >
            <option value="">
              {f.label}: {t("common.all")}
            </option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <div className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
          {t("common.records", { count: table.getFilteredRowModel().rows.length })}
          <Button variant="outline" size="sm" onClick={exportCsv} type="button">
            <Download /> {t("common.export")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="cursor-pointer select-none border-b bg-muted/60 px-3 py-2 text-start text-xs font-semibold text-muted-foreground"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <ArrowDownUp className={`size-3 ${h.column.getIsSorted() ? "opacity-100" : "opacity-30"}`} />
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                  {emptyText ?? t("common.empty")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="border-b px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={t("common.previous")}>
            <ChevronRight className="ltr:rotate-180" />
          </Button>
          <span className="tabular-nums">
            {pageIndex + 1} / {pageCount}
          </span>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={t("common.next")}>
            <ChevronLeft className="ltr:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
