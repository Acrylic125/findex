import { NextResponse } from "next/server";
import { isValid } from "@tma.js/init-data-node";

export async function GET(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    console.error("No authorization 1");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const _isValid = isValid(authorization, process.env.BOT_KEY!);
  if (!_isValid) {
    console.error("Invalid authorization");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ message: "Hello, world!" });
}
