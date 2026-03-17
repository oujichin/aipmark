import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import VendorsClient from "./vendors-client";

export default async function VendorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const vendors = await prisma.vendor.findMany({
    where: {
      organizationId: session.user.organizationId,
    },
    include: {
      evaluations: {
        orderBy: { fiscalYear: "desc" as const },
        take: 1,
      },
      _count: {
        select: { questionnaires: true, evaluations: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Date -> string にシリアライズ（JSON経由でクライアントに渡すため）
  const serialized = JSON.parse(JSON.stringify(vendors));

  return <VendorsClient initialVendors={serialized} />;
}
