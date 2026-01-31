import { ScrollArea } from "@/components/ui/scroll-area";

export default async function RequestPage({
  params,
}: {
  params: Promise<{
    courseCode: string;
  }>;
}) {
  const { courseCode } = await params;
  return (
    <main>
      <ScrollArea className="bg-background text-foreground h-screen p-4">
        <div className="flex flex-col items-center">
          <div className="flex flex-col gap-12 py-8 max-w-4xl w-full">
            <div className="flex flex-col gap-2">
              <p className="text-xl font-bold">Request {courseCode}</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </main>
  );
}
