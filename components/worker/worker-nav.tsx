"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarDays, CalendarRange, MessageSquare, Plane, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/worker/mon-planning", label: "Mon planning", labelCourt: "Planning", icon: CalendarDays },
  { href: "/worker/planning-global", label: "Planning global", labelCourt: "Global", icon: CalendarRange },
  { href: "/worker/conges", label: "Congés", labelCourt: "Congés", icon: Plane },
  { href: "/worker/reclamations", label: "Mes réclamations", labelCourt: "Réclam.", icon: MessageSquare },
  { href: "/worker/parametres", label: "Paramètres", labelCourt: "Réglages", icon: Settings },
];

export function WorkerNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <>
      {/* Barre supérieure : navigation complète sur desktop, marque seule sur mobile */}
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <div className="mr-2 flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="h-4 w-4" />
            </div>
            <span>Vetelio</span>
          </div>
          <nav className="hidden flex-1 flex-wrap gap-1 sm:flex">
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
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted sm:ml-0"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Barre d'onglets mobile (bas d'écran, façon application native) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="flex justify-around">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] leading-none",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{n.labelCourt}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
