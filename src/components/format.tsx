"use client";

import { useFormatter, useLocale } from "next-intl";

export function useFmt() {
  const f = useFormatter();
  const locale = useLocale();
  const toDate = (v: string | Date) => (typeof v === "string" ? new Date(v) : v);
  return {
    date: (v?: string | Date | null) => (v ? f.dateTime(toDate(v), { year: "numeric", month: "2-digit", day: "2-digit" }) : ""),
    datetime: (v?: string | Date | null) =>
      v ? f.dateTime(toDate(v), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "",
    time: (v?: string | Date | null) => (v ? f.dateTime(toDate(v), { hour: "2-digit", minute: "2-digit" }) : ""),
    money: (v?: string | number | null, currency = "AED") =>
      v === null || v === undefined || v === "" ? "" : f.number(Number(v), { style: "currency", currency, minimumFractionDigits: 2 }),
    number: (v?: string | number | null) => (v === null || v === undefined || v === "" ? "" : f.number(Number(v))),
    hours: (minutes?: number | null) => (minutes ? f.number(minutes / 60, { maximumFractionDigits: 2 }) : "0"),
    hijri: (v?: string | Date | null) =>
      v
        ? new Intl.DateTimeFormat(`${locale === "ar" ? "ar" : "en"}-u-ca-islamic-umalqura`, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Dubai",
          }).format(toDate(v))
        : "",
  };
}

export function DateText({ value, withTime, hijri }: { value?: string | Date | null; withTime?: boolean; hijri?: boolean }) {
  const fmt = useFmt();
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {withTime ? fmt.datetime(value) : fmt.date(value)}
      {hijri && <span className="ms-2 text-xs text-muted-foreground">({fmt.hijri(value)})</span>}
    </span>
  );
}

export function Money({ value, currency }: { value?: string | number | null; currency?: string }) {
  const fmt = useFmt();
  return <span className="tabular-nums">{fmt.money(value ?? 0, currency)}</span>;
}
