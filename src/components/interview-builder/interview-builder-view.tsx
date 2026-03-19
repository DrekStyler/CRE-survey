"use client";

import { useState, useCallback } from "react";
import {
  generateInterviewQuestions,
  updateTemplateSections,
  finalizeTemplate,
} from "@/app/(dashboard)/clients/[clientId]/interview-builder/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Sparkles,
  Trash2,
  GripVertical,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { InterviewSection, InterviewQuestion } from "@/types";
import type { InterviewTemplate } from "@/lib/db/schema/interview-templates";

interface InterviewBuilderViewProps {
  clientId: string;
  template: InterviewTemplate | null;
}

export function InterviewBuilderView({
  clientId,
  template,
}: InterviewBuilderViewProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sections, setSections] = useState<InterviewSection[]>(
    (template?.sections as InterviewSection[]) || []
  );

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const newSections = await generateInterviewQuestions(clientId);
      setSections(newSections);
      toast.success("Questions generated");
      router.refresh();
    } catch {
      toast.error("Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
  }

  const saveChanges = useCallback(
    async (updatedSections: InterviewSection[]) => {
      setIsSaving(true);
      try {
        await updateTemplateSections(clientId, updatedSections);
      } catch {
        toast.error("Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    [clientId]
  );

  function updateQuestion(
    sectionId: string,
    questionId: string,
    text: string
  ) {
    const updated = sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            questions: s.questions.map((q) =>
              q.id === questionId ? { ...q, text } : q
            ),
          }
        : s
    );
    setSections(updated);
  }

  function deleteQuestion(sectionId: string, questionId: string) {
    const updated = sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            questions: s.questions.filter((q) => q.id !== questionId),
          }
        : s
    );
    setSections(updated);
    saveChanges(updated);
  }

  function addQuestion(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    const newQuestion: InterviewQuestion = {
      id: `${sectionId}-custom-${Date.now()}`,
      text: "",
      type: "open_ended",
      purpose: "Custom question added by broker",
      order: (section?.questions.length || 0) + 1,
    };

    const updated = sections.map((s) =>
      s.id === sectionId
        ? { ...s, questions: [...s.questions, newQuestion] }
        : s
    );
    setSections(updated);
  }

  async function handleFinalize() {
    await saveChanges(sections);
    await finalizeTemplate(clientId);
    toast.success("Interview template finalized");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {template && (
            <Badge variant="outline">
              {template.status === "finalized" ? "Finalized" : "Draft"}
            </Badge>
          )}
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {sections.length > 0 ? "Regenerate" : "Generate Questions"}
          </Button>
          {sections.length > 0 && template?.status !== "finalized" && (
            <Button onClick={handleFinalize}>
              <Check className="mr-2 h-4 w-4" />
              Finalize
            </Button>
          )}
        </div>
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="font-medium">No questions yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate AI-powered interview questions based on your research
                and broker insights.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={sections[0]?.id}>
          <TabsList className="flex-wrap">
            {sections.map((section) => (
              <TabsTrigger key={section.id} value={section.id}>
                {section.title} ({section.questions.length})
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {section.questions.map((question, idx) => (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <GripVertical className="mt-2.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Q{idx + 1}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {question.type}
                          </Badge>
                        </div>
                        <Input
                          value={question.text}
                          onChange={(e) =>
                            updateQuestion(
                              section.id,
                              question.id,
                              e.target.value
                            )
                          }
                          onBlur={() => saveChanges(sections)}
                          className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                        />
                        {question.purpose && (
                          <p className="text-xs text-muted-foreground">
                            Purpose: {question.purpose}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          deleteQuestion(section.id, question.id)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addQuestion(section.id)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
