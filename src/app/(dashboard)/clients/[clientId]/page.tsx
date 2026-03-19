import { getClient } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  ListChecks,
  Users,
  Lightbulb,
  ArrowRight,
  Globe,
  MapPin,
  Building2,
  UsersRound,
} from "lucide-react";

const workflowSteps = [
  {
    id: "broker-interview",
    title: "Broker Discovery Interview",
    description: "Capture your hypothesis, known issues, and market context.",
    icon: MessageSquare,
    href: "/broker-interview",
    step: 2,
  },
  {
    id: "research",
    title: "Client Research",
    description:
      "AI-powered research on hiring trends, benchmarks, and market data.",
    icon: Search,
    href: "/research",
    step: 3,
  },
  {
    id: "interview-builder",
    title: "Interview Builder",
    description: "Generate targeted client interview questions with AI.",
    icon: ListChecks,
    href: "/interview-builder",
    step: 4,
  },
  {
    id: "client-interview",
    title: "Client Interview",
    description:
      "Conduct the interview with real-time AI augmentation.",
    icon: Users,
    href: "/client-interview",
    step: 5,
  },
  {
    id: "insights",
    title: "Insight Generation",
    description:
      "Identify revenue, cost, operational, and space drivers.",
    icon: Lightbulb,
    href: "/insights",
    step: 6,
  },
];

export default async function ClientHubPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClient(clientId);

  return (
    <div className="space-y-6">
      {/* Client Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Client Overview</CardTitle>
            <Badge
              variant={
                client.confirmedByBroker ? "default" : "outline"
              }
            >
              {client.confirmedByBroker
                ? "Confirmed"
                : "Pending Confirmation"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Industry</p>
                <p className="font-medium">{client.industry || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">HQ Location</p>
                <p className="font-medium">{client.hqLocation || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="font-medium">
                  {client.employeeEstimate?.toLocaleString() || "Not set"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <p className="font-medium">
                  {client.website ? (
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {new URL(client.website).hostname}
                    </a>
                  ) : (
                    "Not set"
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Discovery Workflow</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflowSteps.map((step) => (
            <Card key={step.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Step {step.step}
                    </p>
                    <h3 className="font-medium">{step.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
                <Link href={`/clients/${clientId}${step.href}`}>
                  <Button variant="outline" size="sm" className="mt-auto w-full">
                    Open
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
