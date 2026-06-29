import { ChangePasswordCard } from "@/components/change-password-card";

export const dynamic = "force-dynamic";

export default function WorkerParametresPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Gérez votre compte.</p>
      </div>
      <ChangePasswordCard />
    </div>
  );
}
