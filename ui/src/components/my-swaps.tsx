"use client";

import { trpc } from "@/server/client";
import { Skeleton } from "./ui/skeleton";
import { ArrowRight, BadgeCheck, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import Link from "next/link";
import { type AppRouter } from "@/server/router";
import { type inferRouterOutputs } from "@trpc/server";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export function SwapItemMatch({
  id,
  course,
  match,
}: {
  id: string;
  course: inferRouterOutputs<AppRouter>["swaps"]["getAllRequestsAndMatches"][number]["course"];
  match: inferRouterOutputs<AppRouter>["swaps"]["getAllRequestsAndMatches"][number]["matches"][number];
}) {
  const requestSwapMut = trpc.swaps.requestSwap.useMutation();

  let statusElement = null;
  if (match.status === "pending") {
    statusElement = (
      <Badge variant="default" className="text-yellow-500 bg-yellow-700/30">
        Pending
      </Badge>
    );
  } else if (match.status === "completed") {
    statusElement = (
      <Badge variant="default" className="text-green-500 bg-green-700/30">
        Completed
      </Badge>
    );
  } else if (match.status === "cancelled") {
    statusElement = (
      <Badge variant="default" className="text-gray-400 bg-gray-600/30">
        Cancelled
      </Badge>
    );
  } else {
    statusElement = <span className="text-sm text-primary">Request</span>;
  }

  return (
    <Sheet>
      <SheetTrigger>
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
            <div className="flex flex-row items-center">
              {match.isVerified && (
                <BadgeCheck className="size-4 text-green-500" />
              )}
              {match.numberOfRequests > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {match.numberOfRequests} Requested
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-row gap-2 items-center">
            {/* <p className="text-sm text-primary">@{match.by}</p> */}
            <div className="flex flex-row gap-1 items-center">
              {statusElement}
              <ArrowRight className="size-4 text-primary" />
              {/* <ChevronRight className="size-4 text-muted-foreground" /> */}
            </div>
          </div>
        </div>
      </SheetTrigger>
      <SheetContent side="bottom">
        <div className="max-h-[calc(100vh-120px)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Request Swap</SheetTitle>
            {match.isPerfectMatch && (
              <SheetDescription>
                Perfect Match! 🎉 You have what they want and they have what you
                want.
              </SheetDescription>
            )}
            {match.status !== undefined && (
              <div className="pt-1">{statusElement}</div>
            )}
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <p>Details</p>
              </div>
              <div className="border border-collapse border-muted rounded-xl">
                <Table className="w-full">
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Course
                      </TableCell>
                      <TableCell className="text-foreground text-right text-wrap whitespace-normal">
                        {course.code} {course.name}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Your Index
                      </TableCell>
                      <TableCell className="text-foreground text-right">
                        {course.haveIndex}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Their Index
                      </TableCell>
                      <TableCell className="text-primary text-right">
                        {match.index}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Is Verified Student
                      </TableCell>
                      <TableCell
                        className={cn("text-primary text-right", {
                          "text-green-500": match.isVerified,
                          "text-red-500": !match.isVerified,
                        })}
                      >
                        {match.isVerified ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Total Requests
                      </TableCell>
                      <TableCell
                        className={cn("text-right", {
                          "text-muted-foreground": match.numberOfRequests > 0,
                          "text-green-500": match.numberOfRequests === 0,
                        })}
                      >
                        {match.numberOfRequests}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
            {/* {(match.status === undefined || match.status === "pending") && (
              <div className="flex flex-col gap-2">
                <p>How it works</p>
                <div className="flex flex-row gap-2 items-center text-sm bg-card border-border border rounded-md p-1">
                  <div className="flex items-center justify-center w-5 h-5 rounded-sm bg-primary/10 text-xs">
                    1
                  </div>{" "}
                  <p className="flex-1 text-muted-foreground">
                    Click <span className="text-primary">Request Swap</span> to
                    send a request.
                  </p>
                </div>
                <div className="flex flex-row gap-2 text-sm bg-card border-border border rounded-md p-1">
                  <div className="flex items-center justify-center w-5 h-5 rounded-sm bg-primary/10 text-xs">
                    2
                  </div>{" "}
                  <p className="flex-1 text-muted-foreground">
                    They will receive the request. If they accept, your current
                    request will be marked as{" "}
                    <span className="text-primary">Completed</span>.
                  </p>
                </div>
                <div className="flex flex-row gap-2 text-sm bg-card border-border border rounded-md p-1">
                  <div className="flex items-center justify-center w-5 h-5 rounded-sm bg-primary/10 text-xs">
                    3
                  </div>{" "}
                  <p className="flex-1 text-muted-foreground">
                    They will reach out to you to confirm the swap.{" "}
                    <span className="text-primary">Keep your DMs open</span>.
                  </p>
                </div>
              </div>
            )} */}
          </div>
        </div>
        <SheetFooter className="flex flex-col gap-4 border-t border-border">
          {requestSwapMut.error && (
            <Alert variant="destructive">
              <AlertTitle>Error!</AlertTitle>
              <p className="text-muted-foreground max-w-none">
                {requestSwapMut.error.message}
              </p>
            </Alert>
          )}
          {requestSwapMut.isSuccess && (
            <Alert variant="success">
              <AlertTitle>Success!</AlertTitle>
              <p className="text-muted-foreground max-w-none">
                We will notify the swapper of your request. They will reach out
                to you to confirm the swap.{" "}
                <span className="text-foreground">Keep your DMs open!</span>
              </p>
            </Alert>
          )}
          <div className="flex flex-row gap-2 pb-8">
            <Button className="flex-1" variant="outline">
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => requestSwapMut.mutate({ id })}
              disabled={requestSwapMut.isPending}
            >
              {requestSwapMut.isPending && (
                <Loader2 className="text-primary size-4 animate-spin" />
              )}
              Request Swap
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

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
                <SwapItemMatch
                  id={match.id}
                  key={match.id}
                  course={request.course}
                  match={match}
                />
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
