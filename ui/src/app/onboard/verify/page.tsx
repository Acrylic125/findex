import { ScrollArea } from "@/components/ui/scroll-area";
import { OnboardVerifyForm } from "@/components/onboard-verify-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function Page() {
  return (
    <main>
      <ScrollArea className="bg-background text-foreground h-screen p-4">
        <div className="flex flex-col items-center">
          <div className="flex flex-col gap-12 py-12 max-w-4xl w-full">
            <div className="flex flex-col gap-2">
              <Button variant="link" className="w-fit px-0">
                <Link href="/onboard" className="flex items-center gap-0.5">
                  <ArrowLeft className="size-4" /> Back
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Verify your email</h1>
              <p className="text-sm text-muted-foreground">
                We have sent a verification code to your email.{" "}
                <span className="text-foreground">
                  Please check your spam/junk folder if you don't see it.{" "}
                </span>
                It may take a few minutes to arrive.
              </p>
            </div>

            <div className="flex flex-col gap-4 items-center">
              <h2 className="text-lg font-bold">Enter the code</h2>
              <OnboardVerifyForm />
            </div>
          </div>
        </div>
      </ScrollArea>
    </main>
  );
}
