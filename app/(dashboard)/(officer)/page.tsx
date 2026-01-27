import { auth } from "@/lib/auth";
import HomeView from "@/modules/home/ui/views/home-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Check if user is in Management mode
  const { db } = await import("@/db");
  const { member } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const membership = await db.query.member.findFirst({
    where: eq(member.userId, session.user.id),
  });

  // If in Management mode, redirect to management dashboard
  if (membership && (membership.role === "OWNER" || membership.role === "MANAGER") && membership.activeMode === "MANAGEMENT") {
    redirect("/management");
  }

  // Note: Admin mode redirect is handled in layout.tsx

  return <HomeView />;
};

export default page;

