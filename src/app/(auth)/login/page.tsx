"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  clearAccessToken,
  getAccessToken,
  login,
  me,
  toUserFacingError,
} from "@/lib/auth";

const formSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email wajib diisi." })
    .email({ message: "Format email tidak valid." }),
  password: z
    .string()
    .min(8, { message: "Kata sandi minimal 8 karakter." }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { formState: { isSubmitting } } = form;

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      const token = getAccessToken();
      if (!token) return;

      try {
        await me();
        if (isActive) router.replace("/");
      } catch {
        clearAccessToken();
      }
    }

    bootstrap();
    return () => {
      isActive = false;
    };
  }, [router]);

  async function onSubmit(values: LoginFormValues) {
    setServerErrorMessage(null);
    try {
      await login({ email: values.email, password: values.password });
      await me();
      router.replace("/");
    } catch (error) {
      clearAccessToken();
      setServerErrorMessage(toUserFacingError(error));
    }
  }

  return (
    <div className="m-auto w-full max-w-sm px-4">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Selamat datang kembali 👋</h1>
        <p className="text-sm text-muted-foreground">
          Masuk untuk melanjutkan memantau performa pemain dan tim Anda.
        </p>
      </div>

      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">Alamat Email</FieldLabel>
                <Input
                  {...field}
                  id="login-email"
                  type="email"
                  placeholder="nama@klubmu.com"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  onChange={(e) => {
                    field.onChange(e);
                    setServerErrorMessage(null);
                  }}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-password">Kata Sandi</FieldLabel>
                <Input
                  {...field}
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  onChange={(e) => {
                    field.onChange(e);
                    setServerErrorMessage(null);
                  }}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>

        {serverErrorMessage ? (
          <p
            className="rounded-(--radius-md) border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {serverErrorMessage}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            "Masuk"
          )}
        </Button>
      </form>
    </div>
  );
}
