"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/app/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

const formSchema = z.object({
  legalName: z.string().min(1, "Company name is required").max(255),
  commonName: z.string().max(255).optional(),
  website: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  emailDomain: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  hqLocation: z.string().max(500).optional(),
  employeeEstimate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const INDUSTRIES = [
  "Healthcare",
  "Technology",
  "Financial Services",
  "Legal",
  "Professional Services",
  "Education",
  "Government",
  "Manufacturing",
  "Retail",
  "Real Estate",
  "Energy",
  "Media & Entertainment",
  "Nonprofit",
  "Other",
];

export function ClientForm() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      industry: "",
    },
  });

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      try {
        await createClient({
          ...data,
          employeeEstimate: data.employeeEstimate
            ? Number(data.employeeEstimate)
            : undefined,
        });
      } catch (error) {
        toast.error("Failed to create client");
        console.error(error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name *</Label>
              <Input
                id="legalName"
                placeholder="e.g., Children's Hospital of Colorado"
                {...register("legalName")}
              />
              {errors.legalName && (
                <p className="text-sm text-destructive">
                  {errors.legalName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="commonName">Common Name</Label>
              <Input
                id="commonName"
                placeholder="e.g., Children's Colorado"
                {...register("commonName")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://example.com"
                {...register("website")}
              />
              {errors.website && (
                <p className="text-sm text-destructive">
                  {errors.website.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailDomain">Email Domain</Label>
              <Input
                id="emailDomain"
                placeholder="e.g., childrenscolorado.org"
                {...register("emailDomain")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("industry")}
              >
                <option value="" disabled>
                  Select industry
                </option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hqLocation">HQ Location</Label>
              <Input
                id="hqLocation"
                placeholder="e.g., Aurora, CO"
                {...register("hqLocation")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employeeEstimate">Employee Estimate</Label>
              <Input
                id="employeeEstimate"
                type="number"
                placeholder="e.g., 5000"
                {...register("employeeEstimate")}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Client
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
