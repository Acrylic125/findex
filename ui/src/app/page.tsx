import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/db";
import { programsTable } from "@/db/schema";
import { schools } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function Page() {
  redirect("/onboard");
  return (
    <main>
      <ScrollArea className="bg-background text-foreground h-screen">
        <h1>Hello World</h1>
        {schools.map((school) => (
          <div key={school}>{school}</div>
        ))}
      </ScrollArea>
    </main>
  );
}
