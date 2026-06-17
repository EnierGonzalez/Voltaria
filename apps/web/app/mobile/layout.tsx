import { MobileShell } from "@/components/mobile-shell";
import { isDevelopmentAuthFallbackAllowed, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MobileLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser("/mobile/home");

  if (!user.permissions.includes("mobile.charge.view")) {
    redirect("/403");
  }

  if (!user.activeMembership?.residentId && !isDevelopmentAuthFallbackAllowed()) {
    redirect("/select-property");
  }

  return <MobileShell currentUser={user}>{children}</MobileShell>;
}
