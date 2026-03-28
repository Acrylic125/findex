import { NextResponse } from "next/server";
import {
  buildSession,
  clearAuthFlowCookies,
  clearSessionCookie,
  exchangeMicrosoftCode,
  fetchMicrosoftUser,
  getAuthCookies,
  getBaseUrl,
  getSafeCallbackUrl,
  setSessionCookie,
} from "@/lib/microsoft-auth";

export async function GET(request: Request) {
  console.log("callback");
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");
  const cookies = getAuthCookies(request);

  if (error) {
    const response = NextResponse.redirect(
      new URL(
        `/auth/signin?error=${encodeURIComponent(error)}`,
        getBaseUrl(request)
      )
    );
    clearAuthFlowCookies(response.headers, request);
    clearSessionCookie(response.headers, request);
    return response;
  }

  if (
    !code ||
    !state ||
    !cookies.state ||
    !cookies.verifier ||
    state !== cookies.state
  ) {
    const response = NextResponse.redirect(
      new URL("/auth/signin?error=invalid_state", getBaseUrl(request))
    );
    clearAuthFlowCookies(response.headers, request);
    clearSessionCookie(response.headers, request);
    return response;
  }

  try {
    const exchanged = await exchangeMicrosoftCode(
      request,
      code,
      cookies.verifier
    );
    const profile = await fetchMicrosoftUser(exchanged.access_token);
    const session = await buildSession(profile, exchanged.expires_in);
    const callbackUrl = getSafeCallbackUrl(cookies.callback);

    const response = NextResponse.redirect(
      new URL(callbackUrl, getBaseUrl(request))
    );
    clearAuthFlowCookies(response.headers, request);
    await setSessionCookie(response.headers, request, session);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/auth/signin?error=auth_failed", getBaseUrl(request))
    );
    clearAuthFlowCookies(response.headers, request);
    clearSessionCookie(response.headers, request);
    return response;
  }
}
