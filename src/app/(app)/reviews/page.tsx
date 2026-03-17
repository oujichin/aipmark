import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ReviewsClient from "./reviews-client";

export default async function ReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [reviews, users] = await Promise.all([
    prisma.managementReview.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        _count: { select: { agendas: true, decisions: true, participants: true } },
        chairperson: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Date -> string にシリアライズ
  const serializedReviews = JSON.parse(JSON.stringify(reviews));
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <ReviewsClient
      initialReviews={serializedReviews}
      initialUsers={serializedUsers}
    />
  );
}
