import { requireAdmin } from "@/lib/session";
import { Sidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const name = session.user.name ?? "Administrateur";

  return (
    <div className="min-h-full">
      <Sidebar userName={name} />
      <div className="lg:pl-60">
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
