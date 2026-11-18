import { LeavesClient } from "@/components/admin/leaves-client";
import { getReferenceData } from "@/lib/reference";

export const dynamic = "force-dynamic";

export default async function CongesPage() {
  const ref = await getReferenceData();
  return <LeavesClient workers={ref.workers} />;
}
