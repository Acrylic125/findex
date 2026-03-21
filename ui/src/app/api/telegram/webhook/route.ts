export async function POST(request: Request) {
  return Response.json(
    {
      ok: false,
      error:
        "Telegram webhook has moved to Convex HTTP action at /telegram/webhook",
    },
    { status: 410 }
  );
}
