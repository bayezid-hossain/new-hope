import { auth } from "@/lib/auth";
// import { HistoryView } from "@/modules/cycles/ui/views/history-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const Page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }
  return <p>Dashboard History</p>;
};

export default Page;
