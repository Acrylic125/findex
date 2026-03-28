import { env } from "@/lib/env";
import { cookies } from "next/headers";

const MICROSOFT_AUTH_BASE_PATH = "/api/auth/microsoft";
const MICROSOFT_SCOPE = "openid profile email";
const AUTH_STATE_COOKIE = "microsoft_auth_state";
const AUTH_VERIFIER_COOKIE = "microsoft_auth_verifier";
const AUTH_CALLBACK_COOKIE = "microsoft_auth_callback";
const AUTH_SESSION_COOKIE = "microsoft_auth_session";
const TEN_MINUTES_IN_SECONDS = 60 * 10;
const SESSION_MAX_AGE_IN_SECONDS = 60 * 60 * 24 * 7;

type MicrosoftUserInfo = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  picture?: string;
};

export type MicrosoftSession = {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  expiresAt: number;
};

export function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const protocol = forwardedProto ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? request.headers.get("host") ?? url.host;
  return `${protocol}://${host}`;
}

export function getMicrosoftCallbackUrl(request: Request) {
  return `${getBaseUrl(request)}${MICROSOFT_AUTH_BASE_PATH}/callback`;
}

export function getMicrosoftAuthorizeUrl(
  request: Request,
  state: string,
  codeChallenge: string
) {
  const url = new URL(
    `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`
  );
  url.searchParams.set("client_id", env.AZURE_AD_CLIENT_ID);
  url.searchParams.set("redirect_uri", getMicrosoftCallbackUrl(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeMicrosoftCode(
  request: Request,
  code: string,
  verifier: string
) {
  const response = await fetch(
    `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.AZURE_AD_CLIENT_ID,
        client_secret: env.AZURE_AD_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: getMicrosoftCallbackUrl(request),
      }).toString(),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to exchange Microsoft authorization code");
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

export async function fetchMicrosoftUser(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/oidc/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Microsoft user profile");
  }

  const profile = (await response.json()) as MicrosoftUserInfo;
  if (!profile.sub) {
    throw new Error("Microsoft user profile did not include a subject");
  }

  return profile;
}

export function getSafeCallbackUrl(input: string | null | undefined) {
  if (!input) return "/";
  if (input.startsWith("/") && !input.startsWith("//")) return input;

  try {
    const url = new URL(input);
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}

export function getAuthCookies(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return {
    state: cookies[AUTH_STATE_COOKIE] ?? null,
    verifier: cookies[AUTH_VERIFIER_COOKIE] ?? null,
    callback: cookies[AUTH_CALLBACK_COOKIE] ?? null,
    session: cookies[AUTH_SESSION_COOKIE] ?? null,
  };
}

export function getAuthCookiesFromCookies(
  _cookies: Awaited<ReturnType<typeof cookies>>
) {}

export function setAuthFlowCookies(
  headers: Headers,
  request: Request,
  input: { state: string; verifier: string; callbackUrl: string }
) {
  appendCookie(
    headers,
    AUTH_STATE_COOKIE,
    input.state,
    request,
    TEN_MINUTES_IN_SECONDS
  );
  appendCookie(
    headers,
    AUTH_VERIFIER_COOKIE,
    input.verifier,
    request,
    TEN_MINUTES_IN_SECONDS
  );
  appendCookie(
    headers,
    AUTH_CALLBACK_COOKIE,
    input.callbackUrl,
    request,
    TEN_MINUTES_IN_SECONDS
  );
}

export function clearAuthFlowCookies(headers: Headers, request: Request) {
  appendCookie(headers, AUTH_STATE_COOKIE, "", request, 0);
  appendCookie(headers, AUTH_VERIFIER_COOKIE, "", request, 0);
  appendCookie(headers, AUTH_CALLBACK_COOKIE, "", request, 0);
}

export async function setSessionCookie(
  headers: Headers,
  request: Request,
  session: MicrosoftSession
) {
  const signed = await signSession(session);
  appendCookie(
    headers,
    AUTH_SESSION_COOKIE,
    signed,
    request,
    SESSION_MAX_AGE_IN_SECONDS
  );
}

export function clearSessionCookie(headers: Headers, request: Request) {
  appendCookie(headers, AUTH_SESSION_COOKIE, "", request, 0);
}

export async function readSession(request: Request) {
  const raw = getAuthCookies(request).session;
  if (!raw) return null;
  return await verifySession(raw);
}

export async function buildSession(
  profile: MicrosoftUserInfo,
  expiresIn: number
) {
  return {
    sub: profile.sub!,
    email: profile.email ?? profile.preferred_username ?? null,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    expiresAt: Date.now() + expiresIn * 1000,
  } satisfies MicrosoftSession;
}

export async function createOAuthState() {
  return crypto.randomUUID();
}

export async function createPkceVerifier() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(new Uint8Array(digest));
}

async function signSession(session: MicrosoftSession) {
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(session))
  );
  const signature = await signValue(payload);
  return `${payload}.${signature}`;
}

export async function verifySession(raw: string) {
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = await signValue(payload);
  if (expected !== signature) return null;

  try {
    const parsed = JSON.parse(
      base64UrlDecodeToString(payload)
    ) as MicrosoftSession;
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ENCRYPTION_KEY),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function parseCookies(cookieHeader: string | null) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
}

function appendCookie(
  headers: Headers,
  name: string,
  value: string,
  request: Request,
  maxAge: number
) {
  const secure = isSecureRequest(request);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  headers.append("Set-Cookie", parts.join("; "));
}

function isSecureRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return new URL(request.url).protocol === "https:";
}

function base64UrlEncode(input: Uint8Array) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToString(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const withPadding =
    remainder === 0 ? padded : padded + "=".repeat(4 - remainder);
  return Buffer.from(withPadding, "base64").toString("utf8");
}
