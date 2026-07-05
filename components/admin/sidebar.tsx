"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  DoorOpen,
  Search,
  AlertTriangle,
  MessageSquare,
  Plane,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/planning", label: "Planning", icon: CalendarDays },
  { href: "/admin/travailleurs", label: "Travailleurs", icon: Users },
  { href: "/admin/salles", label: "Salles", icon: DoorOpen },
  { href: "/admin/recherche", label: "Recherche", icon: Search },
  { href: "/admin/incoherences", label: "Incohérences", icon: AlertTriangle },
  { href: "/admin/reclamations", label: "Réclamations", icon: MessageSquare },
  { href: "/admin/conges", label: "Congés", icon: Plane },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const Panel = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Vetelio</div>
          <div className="text-[11px] text-sidebar-foreground">Espace RH</div>
        </div>
      </div>

      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-active text-white"
                : "text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}

      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="px-3 pb-2 text-xs text-sidebar-foreground">{userName}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Barre supérieure mobile */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold">Vetelio — RH</span>
      </div>

      {/* Sidebar fixe (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block">{Panel}</aside>

      {/* Drawer (mobile) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-sidebar-foreground"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
            {Panel}
          </aside>
        </div>
      )}
    </>
  );
}
