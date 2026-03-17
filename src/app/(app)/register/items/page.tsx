import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ItemsClient from "./items-client";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ processId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { processId } = await searchParams;
  const organizationId = session.user.organizationId;

  const where = {
    ...(processId ? { businessProcessId: processId } : {}),
    businessProcess: { organizationId },
  };

  const [itemRows, categories, fields] = await Promise.all([
    prisma.registerItem.findMany({
      where,
      include: {
        businessProcess: { include: { department: true } },
        _count: { select: { evidenceRecords: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.dataCategory.findMany({
      orderBy: [{ isSensitive: "desc" }, { code: "asc" }],
    }),
    prisma.dataFieldDefinition.findMany({
      orderBy: [{ isSensitive: "desc" }, { code: "asc" }],
    }),
  ]);

  // Serialize for client (convert Date objects to strings)
  const items = itemRows.map((item) => ({
    id: item.id,
    dataSubject: item.dataSubject,
    dataCategoryCodes: item.dataCategoryCodes,
    dataFieldCodes: item.dataFieldCodes,
    purpose: item.purpose ?? "",
    status: item.status,
    confirmationStatus: item.confirmationStatus,
    version: item.version,
    updatedAt: item.updatedAt.toISOString(),
    businessProcess: {
      name: item.businessProcess.name,
      department: { name: item.businessProcess.department.name },
    },
    _count: item._count,
  }));

  const serializedCategories = categories.map((c) => ({
    code: c.code,
    name: c.name,
    description: c.description ?? undefined,
    isSensitive: c.isSensitive,
  }));

  const serializedFields = fields.map((f) => ({
    code: f.code,
    name: f.name,
    description: f.description ?? undefined,
    isSensitive: f.isSensitive,
    categoryHint: f.categoryHint ?? undefined,
    isSpecificPerson: f.isSpecificPerson,
  }));

  return (
    <ItemsClient
      initialItems={items}
      initialCategories={serializedCategories}
      initialFields={serializedFields}
      processId={processId ?? null}
    />
  );
}
