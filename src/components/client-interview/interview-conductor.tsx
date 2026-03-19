"use client";

import { useState, useCallback } from "react";
import {
  startClientInterview,
  saveResponse,
  completeInterview,
  suggestFollowUp,
} from "@/app/(dashboard)/clients/[clientId]/client-interview/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Check,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type {
  InterviewSection,
  InterviewQuestion,
  InterviewResponse,
  FollowUp,
} from "@/types";
import type { ClientInterview } from "@/lib/db/schema/client-interviews";
import type { InterviewTemplate } from "@/lib/db/schema/interview-templates";

interface InterviewConductorProps {
  clientId: string;
  template: InterviewTemplate | null;
  interview: ClientInterview | null;
}

export function InterviewConductor({
  clientId,
  template,
  interview,
}: InterviewConductorProps) {
  const router = useRouter();
  const [activeInterview, setActiveInterview] = useState(interview);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responseText, setResponseText] = useState("");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!template) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-muted-foreground">
            No interview template found. Please create one in the Interview
            Builder first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sections = (template.sections as InterviewSection[]) || [];
  const allQuestions = sections.flatMap((s) =>
    s.questions.map((q) => ({ ...q, sectionTitle: s.title, sectionId: s.id }))
  );

  const currentQuestion = allQuestions[currentIndex] as
    | (InterviewQuestion & { sectionTitle: string; sectionId: string })
    | undefined;

  const existingResponses =
    (activeInterview?.responses as InterviewResponse[]) || [];
  const progress = (existingResponses.length / allQuestions.length) * 100;

  async function handleStart() {
    try {
      const result = await startClientInterview(clientId);
      setActiveInterview(result);
    } catch {
      toast.error("Failed to start interview");
    }
  }

  async function handleSaveResponse() {
    if (!currentQuestion || !responseText.trim()) return;

    setIsSaving(true);
    try {
      const response: InterviewResponse = {
        questionId: currentQuestion.id,
        sectionId: currentQuestion.sectionId,
        response: responseText,
        followUps: followUps.filter((f) => f.response),
      };
      await saveResponse(clientId, response);

      // Move to next
      if (currentIndex < allQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setResponseText("");
        setFollowUps([]);
      }
    } catch {
      toast.error("Failed to save response");
    } finally {
      setIsSaving(false);
    }
  }

  const handleFollowUp = useCallback(async () => {
    if (!currentQuestion || !responseText.trim()) return;

    setIsLoadingFollowUp(true);
    try {
      const result = await suggestFollowUp(
        clientId,
        currentQuestion.text,
        responseText
      );
      setFollowUps(result.followUps || []);
    } catch {
      toast.error("Failed to generate follow-ups");
    } finally {
      setIsLoadingFollowUp(false);
    }
  }, [clientId, currentQuestion, responseText]);

  async function handleComplete() {
    await completeInterview(clientId);
    toast.success("Interview completed");
    router.refresh();
  }

  if (!activeInterview) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <Play className="h-8 w-8 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Ready to start the interview</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {allQuestions.length} questions across {sections.length} sections
            </p>
          </div>
          <Button onClick={handleStart}>
            <Play className="mr-2 h-4 w-4" />
            Start Interview
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activeInterview.status === "completed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <Check className="h-8 w-8 text-green-500" />
          <div>
            <h3 className="font-medium">Interview Complete</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {existingResponses.length} responses captured
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {allQuestions.length}
          </span>
          <span className="text-muted-foreground">
            {Math.round(progress)}% complete
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Current Question - Presentation Mode */}
      <Card className="border-2">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{currentQuestion.sectionTitle}</Badge>
            <Badge variant="secondary">{currentQuestion.type}</Badge>
          </div>

          <h2 className="text-2xl font-medium leading-relaxed">
            {currentQuestion.text}
          </h2>

          {currentQuestion.purpose && (
            <p className="text-sm text-muted-foreground italic">
              Purpose: {currentQuestion.purpose}
            </p>
          )}

          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Capture the client's response..."
            rows={6}
            className="text-base"
          />

          {/* Follow-up suggestions */}
          {followUps.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/50 p-4">
              <p className="text-sm font-medium">Suggested Follow-ups:</p>
              {followUps.map((fu, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm font-medium">{fu.question}</p>
                  <p className="text-xs text-muted-foreground">
                    {fu.reasoning}
                  </p>
                  <Textarea
                    placeholder="Capture follow-up response..."
                    rows={2}
                    className="text-sm"
                    value={fu.response || ""}
                    onChange={(e) => {
                      const updated = [...followUps];
                      updated[i] = { ...fu, response: e.target.value };
                      setFollowUps(updated);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => {
            setCurrentIndex(Math.max(0, currentIndex - 1));
            setResponseText("");
            setFollowUps([]);
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleFollowUp}
            disabled={!responseText.trim() || isLoadingFollowUp}
          >
            {isLoadingFollowUp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Suggest Follow-up
          </Button>

          {currentIndex === allQuestions.length - 1 ? (
            <Button onClick={handleComplete} disabled={isSaving}>
              <Check className="mr-2 h-4 w-4" />
              Complete Interview
            </Button>
          ) : (
            <Button onClick={handleSaveResponse} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
