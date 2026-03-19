"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createClientSchema, type CreateClientInput } from "@/lib/validators/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getClients() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(clients)
    .where(eq(clients.createdBy, userId))
    .orderBy(desc(clients.updatedAt));
}

export async function getClient(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const client = result[0];
  if (!client || client.createdBy !== userId) {
    throw new Error("Client not found");
  }

  return client;
}

export async function createClient(input: CreateClientInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = createClientSchema.parse(input);

  const [newClient] = await db
    .insert(clients)
    .values({
      ...validated,
      website: validated.website || null,
      createdBy: userId,
    })
    .returning();

  revalidatePath("/clients");
  redirect(`/clients/${newClient.id}`);
}

export async function updateClient(
  clientId: string,
  data: Partial<CreateClientInput> & {
    confirmedByBroker?: boolean;
    enrichmentStatus?: "pending" | "in_progress" | "completed" | "failed";
    enrichmentData?: string;
    entityMatchConfidence?: number;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await getClient(clientId);
  if (existing.createdBy !== userId) throw new Error("Unauthorized");

  await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clients.id, clientId));

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}
