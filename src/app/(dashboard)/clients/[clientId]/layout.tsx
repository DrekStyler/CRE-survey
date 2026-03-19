import { getClient } from "../actions";
import { ClientProgressNav } from "@/components/layout/client-progress-nav";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClient(clientId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Clients
        </Link>
        <h1 className="text-xl font-semibold">{client.legalName}</h1>
      </div>
      <ClientProgressNav clientId={clientId} />
      {children}
    </div>
  );
}
