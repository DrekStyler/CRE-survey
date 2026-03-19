import { getResearchFindings, getHypotheses } from "./actions";
import { ResearchView } from "@/components/research/research-view";

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const [findings, hypothesesList] = await Promise.all([
    getResearchFindings(clientId),
    getHypotheses(clientId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Client Research</h2>
        <p className="text-sm text-muted-foreground">
          AI-powered research on hiring trends, industry benchmarks, workforce
          patterns, and market data. Findings are based on AI analysis, not live
          web data.
        </p>
      </div>
      <ResearchView
        clientId={clientId}
        findings={findings}
        hypotheses={hypothesesList}
      />
    </div>
  );
}
