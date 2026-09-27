import { getReferenceData } from "@/lib/reference";
import { WorkerWeekClient } from "@/components/admin/worker-week-client";

export const dynamic = "force-dynamic";

// /admin/semaine?workerId=… — construction de la semaine d'une seule personne.
export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ workerId?: string }>;
}) {
  const [reference, sp] = await Promise.all([getReferenceData(), searchParams]);
  return <WorkerWeekClient reference={reference} initialWorkerId={sp.workerId ?? ""} />;
}
