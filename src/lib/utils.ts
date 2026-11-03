import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function localized<T extends { nameAr: string; nameEn?: string | null }>(row: T | null | undefined, locale: string) {
  if (!row) return "";
  return locale === "en" ? row.nameEn || row.nameAr : row.nameAr || row.nameEn || "";
}

export function localizedTitle(row: { titleAr: string; titleEn?: string | null } | null | undefined, locale: string) {
  if (!row) return "";
  return locale === "en" ? row.titleEn || row.titleAr : row.titleAr;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
