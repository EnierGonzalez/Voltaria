import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TenantRootPage({
  params
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  redirect(`/app/${propertySlug}/dashboard`);
}
