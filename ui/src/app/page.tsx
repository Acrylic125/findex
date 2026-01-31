import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/db";
import { programsTable } from "@/db/schema";

// https://www.ntu.edu.sg/education/colleges-schools
const schools = [
  "NBS",
  "CCDS",
  "CCEB",
  "EEE",
  "CEE",
  "MSE",
  "MAE",
  "ADM",
  "SCH",
  "SSS",
  "WKWSCI",
  "LCKM",
  "SPMS",
  "SBS",
  "ASE",
  "NIE",
];

export default async function Page() {
  // const programs = await db.select().from(programsTable);

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
