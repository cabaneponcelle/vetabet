"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { SerializedItem } from "@/lib/schedule";

interface Props {
  items: SerializedItem[];
  readOnly?: boolean;
  onSelectSlot?: (d: { date: string; heureDebut: string; heureFin: string }) => void;
  onEventClick?: (item: SerializedItem) => void;
  onDatesSet?: (startStr: string) => void; // 1er jour visible (pour la duplication)
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
}

// Fond = couleur de l'activité (légende Excel). Liséré = couleur de la salle.
function bgColor(it: SerializedItem): string {
  return it.activityCouleur || it.roomCouleur || "#2563eb";
}
function borderColor(it: SerializedItem): string {
  return it.roomCouleur || it.activityCouleur || "#2563eb";
}

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const nh = Math.min(h + 1, 23);
  return `${String(nh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function PlanningCalendar({
  items,
  readOnly,
  onSelectSlot,
  onEventClick,
  onDatesSet,
  initialView = "timeGridWeek",
}: Props) {
  const events = items.map((it) => ({
    id: it.id,
    title:
      [it.workerNom, it.roomNom, it.titre || it.activityNom].filter(Boolean).join(" · ") ||
      "Créneau",
    start: `${it.date}T${it.heureDebut}:00`,
    end: `${it.date}T${it.heureFin}:00`,
    backgroundColor: bgColor(it),
    borderColor: borderColor(it),
    textColor: "#0f172a",
    extendedProps: { item: it },
  }));

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
      initialView={initialView}
      locale={frLocale}
      firstDay={1}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
      }}
      buttonText={{
        today: "Aujourd'hui",
        month: "Mois",
        week: "Semaine",
        day: "Jour",
        list: "Liste",
      }}
      slotMinTime="07:00:00"
      slotMaxTime="22:00:00"
      allDaySlot={false}
      height="auto"
      nowIndicator
      selectable={!readOnly}
      selectMirror={!readOnly}
      events={events}
      select={(info) => {
        if (readOnly || !onSelectSlot) return;
        onSelectSlot({
          date: info.startStr.slice(0, 10),
          heureDebut: info.startStr.slice(11, 16) || "09:00",
          heureFin: info.endStr.slice(11, 16) || "10:00",
        });
      }}
      dateClick={(info) => {
        if (readOnly || !onSelectSlot) return;
        const time = info.dateStr.slice(11, 16);
        onSelectSlot({
          date: info.dateStr.slice(0, 10),
          heureDebut: time || "09:00",
          heureFin: time ? addHour(time) : "10:00",
        });
      }}
      eventClick={(info) => {
        onEventClick?.(info.event.extendedProps.item as SerializedItem);
      }}
      datesSet={(arg) => onDatesSet?.(arg.startStr.slice(0, 10))}
    />
  );
}
