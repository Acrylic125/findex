"use client";
import { schools } from "@/lib/types";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldError, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Button } from "./ui/button";
import { trpc } from "@/server/client";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

const FormSchema = z.object({
  school: z.enum(schools, { message: "School is required" }),
  // Email must end in @e.ntu.edu.sg
  email: z.email().refine((email) => email.endsWith("@e.ntu.edu.sg"), {
    message: "Email must end in @e.ntu.edu.sg",
  }),
});

export function OnboardForm() {
  const verifyMut = trpc.onboard.verifyEmail.useMutation({
    onSuccess: () => {
      console.log("Email verified successfully");
    },
    onError: (error) => {},
  });
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      school: schools[0],
      email: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    // Do something with the form values.
    verifyMut.mutate(data);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-8"
    >
      <Controller
        name="school"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="form-rhf-school">
              Which School are you from?
            </FieldLabel>
            {/* <Input
              {...field}
              id="form-rhf-school"
              aria-invalid={fieldState.invalid}
              placeholder="Select your school"
              autoComplete="off"
              className="h-10"
            /> */}
            <Combobox
              items={schools}
              onValueChange={field.onChange}
              value={field.value}
            >
              <ComboboxInput
                className="h-10"
                placeholder="Select your school"
              />
              <ComboboxContent>
                <ComboboxEmpty>No schools found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="form-rhf-email">
              What's your @e.ntu.edu.sg email?
            </FieldLabel>
            <Input
              {...field}
              id="form-rhf-email"
              aria-invalid={fieldState.invalid}
              placeholder="E.g. ABC001@e.ntu.edu.sg"
              autoComplete="off"
              className="h-10"
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <div className="flex flex-col gap-2">
        {verifyMut.error && (
          <Alert variant="destructive">
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{verifyMut.error.message}</AlertDescription>
          </Alert>
        )}

        {verifyMut.isSuccess && (
          <Alert variant="default">
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Redirecting to verification page...
            </AlertDescription>
          </Alert>
        )}

        <div className="w-full flex justify-end">
          <Button
            type="submit"
            className="h-10 w-fit"
            disabled={verifyMut.isPending}
          >
            Verify Email
          </Button>
        </div>
      </div>
    </form>
  );
}
