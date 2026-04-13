import { TeacherSidebar } from "@/components/layout/TeacherSidebar";
import { getDashboardSidebarProfile } from "@/lib/dashboard-profile";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getDashboardSidebarProfile();

  return (
    <div className="flex min-h-[100dvh] flex-col items-stretch bg-gray-100 md:flex-row md:items-stretch">
      <TeacherSidebar
        displayName={profile.displayName}
        subtitle={profile.subtitle}
        initials={profile.initials}
        role={profile.role}
        showTeacherUpgrade={profile.isIndependentTeacher}
      />
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}
