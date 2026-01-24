// src/app/(dashboard)/farmers/page.tsx
import { auth } from "@/lib/auth"; // or your auth provider
import { CycleHistoryView } from "@/modules/cycles/ui/views/cycle-history-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function FarmersPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return <CycleHistoryView />;
}