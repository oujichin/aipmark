import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DocumentsClient from "./documents-client";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const orgId = session.user.organizationId;

  const documents = await prisma.pMSDocument.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Date -> string にシリアライズ（クライアントコンポーネントに渡すため）
  const initialDocuments = JSON.parse(JSON.stringify(documents));

  return <DocumentsClient initialDocuments={initialDocuments} />;
}
