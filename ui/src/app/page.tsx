"use client";
import { Redirector } from "@/components/auth-guard";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function Page() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  if (status === "loading") return <div>Loading...</div>;

  if (!session) {
    return (
      <button
        onClick={async () => {
          setIsLoading(true);
          try {
            await signIn("azure-ad", {
              callbackUrl: window.location.href,
              redirect: true,
            });
          } catch (error) {
            console.error("Sign in error:", error);
            setIsLoading(false);
          }
        }}
        disabled={isLoading}
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
    );
  }

  return (
    <>
      <div>Logged in as {session.user?.email}</div>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  );
  // return (
  //   // <Redirector>
  //   //   <></>
  //   // </Redirector>
  // );
}
