import { NextResponse } from "next/server";
import {
  clearAuthFlowCookies,
  clearSessionCookie,
  getBaseUrl,
  getSafeCallbackUrl,
} from "@/lib/microsoft-auth";

function createLogoutResponse(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = getSafeCallbackUrl(url.searchParams.get("callbackUrl"));
  const response = NextResponse.redirect(new URL(callbackUrl, getBaseUrl(request)));
  clearAuthFlowCookies(response.headers, request);
  clearSessionCookie(response.headers, request);
  return response;
}

export async function GET(request: Request) {
  return createLogoutResponse(request);
}

export async function POST(request: Request) {
  return createLogoutResponse(request);
}
