"use client";

import { trpc } from "@/server/client";
import { Skeleton } from "./ui/skeleton";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MySwaps() {
  const requestsAndMatchesQuery =
    trpc.swaps.getAllRequestsAndMatches.useQuery();

  if (requestsAndMatchesQuery.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!requestsAndMatchesQuery.data) {
    return (
      <div className="text-center text-sm text-muted-foreground">No data</div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {requestsAndMatchesQuery.data.map((request) => (
        <div key={request.course.id} className="flex flex-col gap-2">
          <h2 className="text-base text-muted-foreground font-bold">
            {request.course.code} {request.course.name}
          </h2>
          <div className="flex flex-col rounded-md bg-card py-0.5 border border-border">
            {request.matches.map((match) => (
              <div
                key={match.id}
                className={cn(
                  "flex flex-row gap-2 px-4 py-2 items-center justify-between",
                  {
                    "bg-primary/10": match.isPerfectMatch,
                  }
                )}
              >
                <p className="text-sm text-foreground">{match.index}</p>
                <div className="flex flex-row gap-2 items-center">
                  <p className="text-sm text-primary">{match.by}</p>
                  <div className="flex flex-row gap-2 items-center">
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
