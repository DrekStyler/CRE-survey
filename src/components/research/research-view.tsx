"use client";

import { useState } from "react";
import { runResearch } from "@/app/(dashboard)/clients/[clientId]/research/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { OriginPill } from "@/components/ui/citation-badge";
import type { ResearchFinding } from "@/lib/db/schema/research-findings";
import type { Hypothesis } from "@/lib/db/schema/hypotheses";

interface ResearchViewProps {
  clientId: string;
  findings: ResearchFinding[];
  hypotheses: Hypothesis[];
}

const CATEGORY_LABELS: Record<string, string> = {
  hiring_trends: "Hiring Trends",
  industry_benchmarks: "Industry Benchmarks",
  workforce_growth: "Workforce Growth",
  office_density: "Office Density",
  talent_geography: "Talent Geography",
  financial: "Financial",
  general: "General",
};

function confidenceColor(confidence: number) {
  if (confidence >= 75) return "default";
  if (confidence >= 50) return "secondary";
  if (confidence >= 25) return "outline";
  return "destructive";
}

export function ResearchView({
  clientId,
  findings,
  hypotheses,
}: ResearchViewProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  async function handleRunResearch() {
    setIsRunning(true);
    try {
      const result = await runResearch(clientId);
      toast.success(
        `Generated ${result.findingsCount} findings and ${result.hypothesesCount} hypotheses`
      );
      router.refresh();
    } catch {
      toast.error("Research generation failed");
    } finally {
      setIsRunning(false);
    }
  }

  const categories = [...new Set(findings.map((f) => f.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{findings.length} findings</Badge>
          <Badge variant="outline">{hypotheses.length} hypotheses</Badge>
        </div>
        <Button onClick={handleRunResearch} disabled={isRunning}>
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {isRunning ? "Researching..." : "Run Research"}
        </Button>
      </div>

      {findings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="font-medium">No research yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Click &quot;Run Research&quot; to generate AI-powered findings
                about this client.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={categories[0] || "all"}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All ({findings.length})</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat} (
                {findings.filter((f) => f.category === cat).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          </TabsContent>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {findings
                  .filter((f) => f.category === cat)
                  .map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {hypotheses.length > 0 && (
        <div>
          <h3 className="mb-3 text-base font-semibold">Hypotheses</h3>
          <div className="grid gap-3">
            {hypotheses.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{h.type}</Badge>
                      {h.source && <OriginPill source={h.source} />}
                      <Badge
                        variant={
                          h.status === "confirmed"
                            ? "default"
                            : h.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {h.status}
                      </Badge>
                      {h.confidenceScore != null && (
                        <Badge variant={confidenceColor(h.confidenceScore) as "default" | "secondary" | "outline" | "destructive"}>
                          {h.confidenceScore}%
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{h.statement}</p>
                    {h.scoringReasoning && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {h.scoringReasoning}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <ScoreChip label="EBITDA" value={h.dimensionScoreEbitda} />
                    <ScoreChip label="NPV" value={h.dimensionScoreNpv} />
                    <ScoreChip label="Cost" value={h.dimensionScoreCost} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: ResearchFinding }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            {finding.title}
          </CardTitle>
          <Badge variant={confidenceColor(finding.confidence) as "default" | "secondary" | "outline" | "destructive"}>
            {finding.confidence}%
          </Badge>
        </div>
        <Badge variant="outline" className="w-fit text-xs">
          {CATEGORY_LABELS[finding.category] || finding.category}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{finding.summary}</p>
        {finding.sourceName && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {finding.sourceUrl ? (
              <a
                href={finding.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {finding.sourceName}
              </a>
            ) : (
              <span>{finding.sourceName}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreChip({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null || value === undefined) return null;

  let color = "bg-red-100 text-red-800";
  if (value >= 76) color = "bg-blue-100 text-blue-800";
  else if (value >= 51) color = "bg-green-100 text-green-800";
  else if (value >= 26) color = "bg-yellow-100 text-yellow-800";

  return (
    <div className={`rounded px-2 py-1 ${color}`}>
      <div className="text-[10px] font-medium">{label}</div>
      <div className="text-center font-semibold">{value}</div>
    </div>
  );
}
