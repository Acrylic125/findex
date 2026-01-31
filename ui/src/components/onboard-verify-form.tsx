"use client";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "./ui/button";
import { trpc } from "@/server/client";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export function OnboardVerifyForm() {
  const router = useRouter();
  const verifyMut = trpc.onboard.verifyEmailCode.useMutation({
    onSuccess: () => {
      router.push("/app");
    },
  });
  const resendMut = trpc.onboard.resendEmailCode.useMutation({});
  return (
    <div className="flex flex-col gap-4 items-center">
      <InputOTP
        maxLength={6}
        onComplete={(code) => {
          console.log(code);
          verifyMut.mutate({ code });
        }}
        disabled={verifyMut.isPending}
      >
        <InputOTPGroup aria-invalid={verifyMut.isError}>
          <InputOTPSlot
            index={0}
            className="h-10"
            aria-invalid={verifyMut.isError}
          />
          <InputOTPSlot
            index={1}
            className="h-10"
            aria-invalid={verifyMut.isError}
          />
          <InputOTPSlot
            index={2}
            className="h-10"
            aria-invalid={verifyMut.isError}
          />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup aria-invalid={verifyMut.isError}>
          <InputOTPSlot
            index={3}
            className="h-10"
            aria-invalid={verifyMut.isError}
          />
          <InputOTPSlot
            index={4}
            className="h-10"
            aria-invalid={verifyMut.isError}
          />
          <InputOTPSlot
            index={5}
            className="h-10"
            aria-invalid={verifyMut.isError}
          />
        </InputOTPGroup>
      </InputOTP>
      <Button
        className="h-10 w-fit"
        variant="link"
        disabled={resendMut.isPending}
        onClick={() => {
          resendMut.mutate();
        }}
      >
        Resend Code
      </Button>
      {resendMut.error && (
        <Alert variant="destructive" className="w-full">
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{resendMut.error.message}</AlertDescription>
        </Alert>
      )}

      {resendMut.isSuccess && (
        <Alert variant="default" className="w-full">
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            A new code has been sent to your email.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
