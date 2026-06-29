import { getReferenceData } from "@/lib/reference";
import { PlanningClient } from "@/components/admin/planning-client";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const reference = await getReferenceData();
  return <PlanningClient reference={reference} />;
}
