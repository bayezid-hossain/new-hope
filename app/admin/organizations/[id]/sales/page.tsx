import { OrgSalesList } from "@/modules/admin/components/org-sales-list";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Organization Sales | Admin",
    description: "View all sales transactions for this organization.",
};

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function Page({ params }: PageProps) {
    const { id } = await params;

    return (
        <div className="flex-1 overflow-auto bg-background/50">
            <OrgSalesList orgId={id} />
        </div>
    );
}
