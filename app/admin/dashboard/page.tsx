import Link from "next/link";
import { CalendarDays, Users, DoorOpen, MessageSquare, type LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { loadConflicts } from "@/lib/schedule";
import { ConflictPanel } from "@/components/admin/conflict-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dateFr } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COMPLAINT_STATUS: Record<string, { label: string; variant: "default" | "warning" | "success" | "danger" }> = {
  NOUVELLE: { label: "Nouvelle", variant: "warning" },
  EN_COURS: { label: "En cours", variant: "default" },
  RESOLUE: { label: "Résolue", variant: "success" },
  REFUSEE: { label: "Refusée", variant: "danger" },
};

function StatCard({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold leading-none">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const [draftCount, publishedCount, workersCount, roomsCount, complaints, conflicts] =
    await Promise.all([
      prisma.scheduleItem.count({ where: { status: "DRAFT" } }),
      prisma.scheduleItem.count({ where: { status: "PUBLISHED" } }),
      prisma.worker.count({ where: { actif: true } }),
      prisma.room.count({ where: { actif: true } }),
      prisma.complaint.findMany({
        where: { status: { in: ["NOUVELLE", "EN_COURS"] } },
        include: { worker: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      loadConflicts("DRAFT"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d&apos;ensemble du planning et des alertes.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Créneaux brouillon" value={draftCount} href="/admin/planning" />
        <StatCard icon={CalendarDays} label="Créneaux publiés" value={publishedCount} href="/admin/planning" />
        <StatCard icon={Users} label="Travailleurs actifs" value={workersCount} href="/admin/travailleurs" />
        <StatCard icon={DoorOpen} label="Salles actives" value={roomsCount} href="/admin/salles" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConflictPanel conflicts={conflicts} />

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Réclamations à traiter
            </CardTitle>
            <Link href="/admin/reclamations" className="text-xs text-primary hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {complaints.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune réclamation en attente.</p>
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {c.worker.user.prenom} {c.worker.user.nom}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dateFr(c.createdAt.toISOString().slice(0, 10))}
                    </div>
                  </div>
                  <Badge variant={COMPLAINT_STATUS[c.status].variant}>
                    {COMPLAINT_STATUS[c.status].label}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
