"use client";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <Button
      type="button"
      onClick={() => {
        window.location.href = `/api/auth/microsoft/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }}
    >
      Sign in with Microsoft
    </Button>
  );
}
