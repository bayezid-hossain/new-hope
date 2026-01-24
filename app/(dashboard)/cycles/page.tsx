import { auth } from "@/lib/auth";
import { CyclesView } from "@/modules/cycles/ui/views/cycles-view";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

const Page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }
  return <CyclesView/> 
};

export default Page;
