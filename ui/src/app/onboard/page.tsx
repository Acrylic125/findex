import { ScrollArea } from "@/components/ui/scroll-area";
import { OnboardForm } from "@/components/onboard-form";

export default function Page() {
  return (
    <main>
      <ScrollArea className="bg-background text-foreground h-screen p-4">
        <div className="flex flex-col items-center">
          <div className="flex flex-col gap-12 py-12 max-w-4xl w-full">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold">Hey! 👋</h1>
              <p className="text-sm text-muted-foreground">
                Let's get you onboarded!
              </p>
            </div>

            <OnboardForm />
          </div>
        </div>
      </ScrollArea>
    </main>
  );
}
