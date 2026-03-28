"use client";

import { Suspense, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const { data: session, update, status } = useSession();
  useEffect(() => {
    void update();
  }, [update]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      <h1 className="text-2xl font-bold">Sign in w/ user</h1>
      <Button
        type="button"
        onClick={() => {
          localStorage.setItem("abc", "123");
        }}
      >
        Add to local storage
      </Button>
      <p>{localStorage.getItem("abc")}</p>
      {status}
      {session?.user && JSON.stringify(session.user)}
      <Button
        type="button"
        onClick={() =>
          void signIn("azure-ad", {
            callbackUrl,
          })
        }
        className="min-w-[220px]"
      >
        Sign in with Azure AD
      </Button>
      <Button
        type="button"
        onClick={() => void signOut()}
        className="min-w-[220px]"
      >
        Sign out
      </Button>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
