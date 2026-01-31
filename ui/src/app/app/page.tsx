import { ScrollArea } from "@/components/ui/scroll-area";

export default function AppPage() {
  return (
    <main>
      <ScrollArea className="bg-background text-foreground h-screen p-4">
        <div className="flex flex-col items-center">
          <div className="flex flex-col gap-12 py-8 max-w-4xl w-full">
            <div className="flex flex-col gap-2">
              <p className="text-xl font-bold">My Swaps</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </main>
  );
}
