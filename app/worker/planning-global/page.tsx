import { WorkerPlanning } from "@/components/worker/worker-planning";
import { getReferenceData } from "@/lib/reference";

export const dynamic = "force-dynamic";

export default async function PlanningGlobalPage() {
  const ref = await getReferenceData();
  return (
    <WorkerPlanning
      scope="global"
      reference={{ workers: ref.workers, rooms: ref.rooms, activities: ref.activities }}
    />
  );
}
