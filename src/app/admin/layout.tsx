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
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar
        displayName={displayName}
        subtitle="Plateforme"
        initials={initials}
      />
      <main className="min-h-screen flex-1 overflow-auto">{children}</main>
    </div>
  );
}
