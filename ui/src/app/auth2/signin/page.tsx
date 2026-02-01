"use client";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return <button onClick={() => signIn("azure-ad")}>Sign in</button>;
}
