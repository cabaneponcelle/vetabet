import { requireAuth } from "@/lib/session";
import { WorkerNav } from "@/components/worker/worker-nav";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const name = session.user.name ?? "Travailleur";

  return (
    <div className="min-h-full">
      <WorkerNav userName={name} />
      {/* pb-24 : espace pour la barre d'onglets mobile fixée en bas */}
      <main className="mx-auto max-w-5xl p-4 pb-24 sm:pb-6 lg:p-6">{children}</main>
    </div>
  );
}
