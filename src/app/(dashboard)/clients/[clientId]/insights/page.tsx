import { InsightsView } from "@/components/insights/insights-view";
import { getDrivers, getHypotheses, getScenarioProjections, getFindings } from "./actions";

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const [driversList, hypothesesList, projections, findingsList] = await Promise.all([
    getDrivers(clientId),
    getHypotheses(clientId),
    getScenarioProjections(clientId),
    getFindings(clientId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Insight Generation</h2>
        <p className="text-sm text-muted-foreground">
          AI analyzes all collected data to identify key revenue, cost,
          operational, and space drivers. Review and confirm hypotheses.
        </p>
      </div>
      <InsightsView
        clientId={clientId}
        drivers={driversList}
        hypotheses={hypothesesList}
        scenarioProjections={projections}
        findings={findingsList}
      />
    </div>
  );
}
