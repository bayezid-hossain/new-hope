import { auth } from "@/lib/auth";
import { FeedOrdersPage } from "@/modules/feed-orders/ui/pages/feed-orders-page";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function FeedOrdersRoute() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) redirect("/sign-in");

    if (!session.session.activeOrganizationId) return null;

    return <FeedOrdersPage orgId={session.session.activeOrganizationId} />;
}
