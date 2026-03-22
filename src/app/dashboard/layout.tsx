import { TeacherSidebar } from "@/components/layout/TeacherSidebar";
import { getDashboardSidebarProfile } from "@/lib/dashboard-profile";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getDashboardSidebarProfile();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <TeacherSidebar
        displayName={profile.displayName}
        subtitle={profile.subtitle}
        initials={profile.initials}
      />
      <main className="min-h-screen flex-1 overflow-auto">{children}</main>
    </div>
  );
}
