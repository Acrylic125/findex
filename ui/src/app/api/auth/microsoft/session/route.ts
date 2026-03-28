import { NextResponse } from "next/server";
import { readSession } from "@/lib/microsoft-auth";

export async function GET(request: Request) {
  const session = await readSession(request);

  return NextResponse.json({
    authenticated: session !== null,
    user: session,
  });
}
