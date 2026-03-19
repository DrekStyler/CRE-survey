"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  brokerInterviewSchema,
  type BrokerInterviewInput,
} from "@/lib/validators/broker-interview";
import {
  saveBrokerInterview,
  completeBrokerInterview,
} from "@/app/(dashboard)/clients/[clientId]/broker-interview/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { BrokerInterview } from "@/lib/db/schema/broker-interviews";

interface BrokerInterviewFormProps {
  clientId: string;
  existingInterview: BrokerInterview | null;
}

const SECTIONS = [
  {
    key: "brokerHypothesis" as const,
    title: "Broker Hypothesis",
    description:
      "What is your initial thesis about this client's space needs?",
    placeholder:
      "e.g., Client is growing rapidly and needs 20% more space within 18 months to support expansion...",
  },
  {
    key: "knownClientIssues" as const,
    title: "Known Client Issues",
    description: "What problems or challenges has the client communicated?",
    placeholder:
      "e.g., Current space is over-crowded, lease expiring in 12 months, remote work policy creating utilization gaps...",
  },
  {
    key: "marketConstraints" as const,
    title: "Market Constraints",
    description: "What market conditions affect this engagement?",
    placeholder:
      "e.g., Tight Class A availability in downtown, rising lease rates, limited options near transit...",
  },
  {
    key: "budgetSignals" as const,
    title: "Budget Signals",
    description: "What do you know about the client's budget or financial position?",
    placeholder:
      "e.g., Recently raised Series C, looking to reduce real estate costs as % of revenue...",
  },
  {
    key: "growthExpectations" as const,
    title: "Growth Expectations",
    description: "Known or anticipated growth/contraction plans?",
    placeholder:
      "e.g., Plans to hire 200 people in next 2 years, mostly engineering and clinical staff...",
  },
  {
    key: "timing" as const,
    title: "Timing Constraints",
    description: "Are there deadlines or timing considerations?",
    placeholder:
      "e.g., Current lease expires March 2027, need to make decision by Q4 this year...",
  },
  {
    key: "painPoints" as const,
    title: "Workplace Pain Points",
    description: "Known issues with the current workspace?",
    placeholder:
      "e.g., No collaboration spaces, outdated HVAC, parking issues, lack of natural light...",
  },
  {
    key: "additionalNotes" as const,
    title: "Additional Notes",
    description: "Anything else relevant to this engagement.",
    placeholder: "Any other context, relationships, or considerations...",
  },
];

export function BrokerInterviewForm({
  clientId,
  existingInterview,
}: BrokerInterviewFormProps) {
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();
  const [isCompleting, setIsCompleting] = useState(false);

  const { register, handleSubmit, getValues } =
    useForm<BrokerInterviewInput>({
      resolver: zodResolver(brokerInterviewSchema),
      defaultValues: {
        brokerHypothesis: existingInterview?.brokerHypothesis || "",
        knownClientIssues: existingInterview?.knownClientIssues || "",
        marketConstraints: existingInterview?.marketConstraints || "",
        budgetSignals: existingInterview?.budgetSignals || "",
        growthExpectations: existingInterview?.growthExpectations || "",
        timing: existingInterview?.timing || "",
        painPoints: existingInterview?.painPoints || "",
        additionalNotes: existingInterview?.additionalNotes || "",
      },
    });

  const autoSave = useCallback(() => {
    const data = getValues();
    startSaveTransition(async () => {
      try {
        await saveBrokerInterview(clientId, data);
      } catch {
        // Silent fail for auto-save
      }
    });
  }, [clientId, getValues]);

  function onSave(data: BrokerInterviewInput) {
    startSaveTransition(async () => {
      try {
        await saveBrokerInterview(clientId, data);
        toast.success("Interview saved");
      } catch {
        toast.error("Failed to save");
      }
    });
  }

  async function onComplete() {
    // Save first
    const data = getValues();
    await saveBrokerInterview(clientId, data);

    setIsCompleting(true);
    try {
      const result = await completeBrokerInterview(clientId);
      toast.success(
        `Extracted ${result.insights.length} insights and ${result.hypotheses.length} hypotheses`
      );
      router.refresh();
    } catch {
      toast.error("Failed to generate insights");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      {SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{section.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {section.description}
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register(section.key)}
              placeholder={section.placeholder}
              rows={4}
              onBlur={autoSave}
              className="resize-y"
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {isSaving ? "Saving..." : "Changes auto-saved on blur"}
        </p>
        <div className="flex gap-3">
          <Button type="submit" variant="outline" disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button
            type="button"
            onClick={onComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isCompleting
              ? "Generating Insights..."
              : "Complete & Generate Insights"}
          </Button>
        </div>
      </div>
    </form>
  );
}
