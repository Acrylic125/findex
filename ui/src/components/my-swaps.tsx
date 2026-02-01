"use client";

import { trpc } from "@/server/client";
import { Skeleton } from "./ui/skeleton";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import Link from "next/link";

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
    <div className="w-full flex flex-col gap-8">
      {requestsAndMatchesQuery.data.map((request) => (
        <div key={request.course.id} className="flex flex-col gap-2">
          <div className="flex flex-row gap-4 items-end justify-between">
            <h2 className="text-base text-muted-foreground font-bold">
              {request.course.code} {request.course.name}
            </h2>

            <Link href={`/app/swap/${request.course.code}`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
          </div>
          <div className="flex flex-col rounded-md bg-card py-0.5 border border-border">
            {request.matches.length > 0 ? (
              request.matches.map((match) => (
                <div
                  key={match.id}
                  className={cn(
                    "flex flex-row gap-2 px-2.5 py-2 items-center justify-between",
                    {
                      "bg-primary/10": match.isPerfectMatch,
                    }
                  )}
                >
                  <div className="flex flex-row gap-2 items-center justify-between">
                    <p className="text-sm text-foreground">{match.index}</p>
                  </div>
                  <div className="flex flex-row gap-2 items-center">
                    <p className="text-sm text-primary">@{match.by}</p>
                    {/* <div className="flex flex-row gap-2 items-center">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div> */}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground w-full text-center py-2">
                No matches yet {"):"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
