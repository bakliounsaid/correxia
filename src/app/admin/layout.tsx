import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { adminInitials, requirePlatformAdmin } from "@/lib/admin-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePlatformAdmin();
  const displayName = profile.full_name?.trim() || profile.email || "Admin";
  const initials = adminInitials(profile.full_name || "", profile.email);

  return (
    <div className="flex min-h-[100dvh] flex-col items-stretch bg-gray-50 md:flex-row md:items-stretch">
      <AdminSidebar
        displayName={displayName}
        subtitle="Plateforme"
        initials={initials}
      />
      <main className="min-h-[100dvh] min-w-0 flex-1 overflow-auto md:min-h-0">
        {children}
      </main>
    </div>
  );
}
