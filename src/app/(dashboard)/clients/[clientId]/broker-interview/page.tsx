import { BrokerInterviewForm } from "@/components/broker-interview/broker-interview-form";
import { getBrokerInterview } from "./actions";
import { EnrichmentReview } from "@/components/clients/enrichment-review";
import { getClient } from "../../actions";

export default async function BrokerInterviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const [client, interview] = await Promise.all([
    getClient(clientId),
    getBrokerInterview(clientId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Broker Discovery Interview</h2>
        <p className="text-sm text-muted-foreground">
          Capture your hypothesis, known client issues, and market context. This
          data feeds into AI-generated research and interview questions.
        </p>
      </div>

      {!client.confirmedByBroker && (
        <EnrichmentReview client={client} />
      )}

      <BrokerInterviewForm clientId={clientId} existingInterview={interview} />
    </div>
  );
}
