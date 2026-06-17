import { AdminShell } from "@/components/admin-shell";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser("/select-property");

  if (
    !user.permissions.includes("dashboard.view") &&
    !user.permissions.includes("platform.tenants.view")
  ) {
    redirect("/403");
  }

  return <AdminShell currentUser={user}>{children}</AdminShell>;
}
