"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteClient } from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${clientName}"? This will permanently remove all associated data (interviews, research, projections). This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteClient(clientId);
      toast.success(`"${clientName}" deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete client");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={isDeleting}
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
