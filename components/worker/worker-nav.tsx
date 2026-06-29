"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarDays, CalendarRange, MessageSquare, Plane, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/worker/mon-planning", label: "Mon planning", icon: CalendarDays },
  { href: "/worker/planning-global", label: "Planning global", icon: CalendarRange },
  { href: "/worker/conges", label: "Congés", icon: Plane },
  { href: "/worker/reclamations", label: "Mes réclamations", icon: MessageSquare },
  { href: "/worker/parametres", label: "Paramètres", icon: Settings },
];

export function WorkerNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
        <div className="mr-2 flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDays className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">Vetabet</span>
        </div>
        <nav className="flex flex-1 flex-wrap gap-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <span className="hidden text-xs text-muted-foreground sm:inline">{userName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          title="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
