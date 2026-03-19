"use client";

import { useState } from "react";
import { ExternalLink, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_COLORS: Record<string, string> = {
  broker_interview: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  research: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  client_interview: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  ai: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  user: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const SOURCE_LABELS: Record<string, string> = {
  broker_interview: "Broker Interview",
  research: "Research",
  client_interview: "Client Interview",
  ai: "AI Generated",
  user: "User Override",
};

interface SourceLinkProps {
  sourceName: string;
  sourceUrl?: string | null;
  confidence?: number | null;
  className?: string;
}

export function SourceLink({ sourceName, sourceUrl, confidence, className }: SourceLinkProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {sourceName}
        </a>
      ) : (
        <span>{sourceName}</span>
      )}
      {confidence != null && (
        <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium">
          {confidence}%
        </span>
      )}
    </span>
  );
}

interface ReasoningTextProps {
  text: string;
  className?: string;
}

export function ReasoningText({ text, className }: ReasoningTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 120;

  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        <Info className="h-3 w-3" />
        Reasoning
        {isLong && (expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
      <p className={cn("mt-1", !expanded && isLong && "line-clamp-2")}>
        {text}
      </p>
    </div>
  );
}

interface OriginPillProps {
  source: string;
  className?: string;
}

export function OriginPill({ source, className }: OriginPillProps) {
  const colorClass = SOURCE_COLORS[source] || "bg-muted text-muted-foreground";
  const label = SOURCE_LABELS[source] || source;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleSection({ title, children, defaultOpen = false, className }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-t pt-3", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {title}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
