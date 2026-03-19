import { getInterviewTemplate } from "./actions";
import { InterviewBuilderView } from "@/components/interview-builder/interview-builder-view";

export default async function InterviewBuilderPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const template = await getInterviewTemplate(clientId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Interview Builder</h2>
        <p className="text-sm text-muted-foreground">
          Generate AI-powered client interview questions. Edit, reorder, and add
          custom questions before conducting the interview.
        </p>
      </div>
      <InterviewBuilderView clientId={clientId} template={template} />
    </div>
  );
}
