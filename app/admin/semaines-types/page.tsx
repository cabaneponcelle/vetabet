import { WeekTemplatesClient } from "@/components/admin/week-templates-client";
import { getReferenceData } from "@/lib/reference";

export const dynamic = "force-dynamic";

export default async function SemainesTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ workerId?: string }>;
}) {
  const [reference, params] = await Promise.all([getReferenceData(), searchParams]);
  return <WeekTemplatesClient reference={reference} initialWorkerId={params.workerId} />;
}
