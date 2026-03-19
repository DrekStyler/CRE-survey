import Link from "next/link";
import { getClients } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default async function ClientsPage() {
  const clientList = await getClients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage your CRE discovery engagements
          </p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </Link>
      </div>

      {clientList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No clients yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first client engagement.
          </p>
          <Link href="/clients/new" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Client
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientList.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {client.legalName}
                    </Link>
                    {client.commonName && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({client.commonName})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{client.industry || "—"}</TableCell>
                  <TableCell>{client.hqLocation || "—"}</TableCell>
                  <TableCell>
                    {client.employeeEstimate?.toLocaleString() || "—"}
                  </TableCell>
                  <TableCell>
                    <EnrichmentBadge status={client.enrichmentStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(client.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EnrichmentBadge({
  status,
}: {
  status: string | null;
}) {
  switch (status) {
    case "completed":
      return <Badge variant="default">Enriched</Badge>;
    case "in_progress":
      return <Badge variant="secondary">Enriching...</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}
