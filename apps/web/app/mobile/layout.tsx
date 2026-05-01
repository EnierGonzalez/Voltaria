import { MobileShell } from "@/components/mobile-shell";

export default function MobileLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MobileShell>{children}</MobileShell>;
}
