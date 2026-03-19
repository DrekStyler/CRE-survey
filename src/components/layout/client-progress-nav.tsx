"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  MessageSquare,
  Search,
  ListChecks,
  Users,
  Lightbulb,
  Check,
} from "lucide-react";

const steps = [
  {
    id: "overview",
    label: "Overview",
    href: "",
    icon: Building2,
  },
  {
    id: "broker-interview",
    label: "Broker Interview",
    href: "/broker-interview",
    icon: MessageSquare,
  },
  {
    id: "research",
    label: "Research",
    href: "/research",
    icon: Search,
  },
  {
    id: "interview-builder",
    label: "Interview Builder",
    href: "/interview-builder",
    icon: ListChecks,
  },
  {
    id: "client-interview",
    label: "Client Interview",
    href: "/client-interview",
    icon: Users,
  },
  {
    id: "insights",
    label: "Insights",
    href: "/insights",
    icon: Lightbulb,
  },
];

interface ClientProgressNavProps {
  clientId: string;
  completedSteps?: string[];
}

export function ClientProgressNav({
  clientId,
  completedSteps = [],
}: ClientProgressNavProps) {
  const pathname = usePathname();
  const basePath = `/clients/${clientId}`;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
      {steps.map((step, index) => {
        const fullHref = `${basePath}${step.href}`;
        const isActive = step.href === ""
          ? pathname === basePath
          : pathname.startsWith(fullHref);
        const isCompleted = completedSteps.includes(step.id);

        return (
          <Link
            key={step.id}
            href={fullHref}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span className="relative">
              {isCompleted ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <step.icon className="h-4 w-4" />
              )}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
            {index < steps.length - 1 && (
              <span className="ml-1 hidden text-muted-foreground/50 lg:inline">
                /
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
