import { ClientForm } from "@/components/clients/client-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New Client</h1>
        <p className="text-sm text-muted-foreground">
          Enter client details to start a new discovery engagement.
        </p>
      </div>
      <ClientForm />
    </div>
  );
}
