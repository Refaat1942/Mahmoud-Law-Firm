"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import arLocale from "@fullcalendar/core/locales/ar";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export type CalendarEvent = { id: string; title: string; start: string; allDay?: boolean; url: string; kind: "hearing" | "deadline" | "task"; done: boolean };

const COLORS = { hearing: "#1b2a4a", deadline: "#c53030", task: "#c9a24b" };

export function CalendarView({
  events,
  lawyers,
  lawyer,
  canCreate,
}: {
  events: CalendarEvent[];
  lawyers: { value: string; label: string }[];
  lawyer: string;
  canCreate: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select className="w-auto min-w-48" value={lawyer} onChange={(e) => router.push(e.target.value ? `/calendar?lawyer=${e.target.value}` : "/calendar")}>
          <option value="">
            {t("f.lawyer")}: {t("common.all")}
          </option>
          {lawyers.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
        <div className="flex gap-3 text-xs">
          {(["hearing", "deadline", "task"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="size-3 rounded" style={{ background: COLORS[k] }} /> {t(`hearings.legend.${k}`)}
            </span>
          ))}
        </div>
      </div>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={locale === "ar" ? arLocale : "en"}
        direction={locale === "ar" ? "rtl" : "ltr"}
        firstDay={1}
        height="auto"
        headerToolbar={{ start: "prev,next today", center: "title", end: "dayGridMonth,timeGridWeek,listWeek" }}
        events={events.map((e) => ({
          ...e,
          backgroundColor: COLORS[e.kind],
          borderColor: COLORS[e.kind],
          classNames: e.done ? ["opacity-50", "line-through"] : [],
        }))}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          if (info.event.url) window.location.href = info.event.url;
        }}
        dateClick={(info) => {
          if (canCreate) router.push(`/hearings/new?date=${info.dateStr.slice(0, 10)}`);
        }}
      />
    </Card>
  );
}
