import { InterviewConductor } from "@/components/client-interview/interview-conductor";
import { getClientInterview } from "./actions";
import { getInterviewTemplate } from "../interview-builder/actions";

export default async function ClientInterviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const [template, interview] = await Promise.all([
    getInterviewTemplate(clientId),
    getClientInterview(clientId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Client Interview</h2>
        <p className="text-sm text-muted-foreground">
          Conduct the interview in presentation mode. AI will suggest follow-up
          questions based on responses.
        </p>
      </div>
      <InterviewConductor
        clientId={clientId}
        template={template}
        interview={interview}
      />
    </div>
  );
}
