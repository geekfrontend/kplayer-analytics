"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { z } from "zod";
import {
  clearAccessToken,
  getAccessToken,
  login,
  me,
  toUserFacingError,
} from "@/lib/auth";

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .regex(EMAIL_REGEX, "Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(
    null,
  );
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      const token = getAccessToken();
      if (!token) {
        return;
      }

      try {
        await me();
        if (isActive) {
          router.replace("/");
        }
      } catch {
        clearAccessToken();
      }
    }

    bootstrap();
    return () => {
      isActive = false;
    };
  }, [router]);

  async function handleLoginSubmit(values: LoginFormValues) {
    setServerErrorMessage(null);
    try {
      await login({
        email: values.email,
        password: values.password,
      });
      await me();
      router.replace("/");
    } catch (error) {
      clearAccessToken();
      setServerErrorMessage(toUserFacingError(error));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <Card.Header className="flex flex-col items-start gap-1">
          <Card.Title className="text-xl">KPlayer Analytics</Card.Title>
          <Card.Description>
            Masuk untuk melanjutkan ke dashboard
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(handleLoginSubmit)}
          >
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <TextField isRequired name={field.name} type="email">
                  <Label>Email</Label>
                  <Input
                    placeholder="admin@example.com"
                    autoComplete="email"
                    value={field.value}
                    onChange={(event) => {
                      setServerErrorMessage(null);
                      field.onChange(event.target.value);
                    }}
                    onBlur={field.onBlur}
                  />
                  {errors.email?.message ? (
                    <p className="text-sm text-danger" role="alert">
                      {errors.email.message}
                    </p>
                  ) : (
                    <FieldError />
                  )}
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextField isRequired name={field.name} type="password">
                  <Label>Password</Label>
                  <Input
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    value={field.value}
                    onChange={(event) => {
                      setServerErrorMessage(null);
                      field.onChange(event.target.value);
                    }}
                    onBlur={field.onBlur}
                  />
                  <Description>Gunakan password akun Anda</Description>
                  {errors.password?.message ? (
                    <p className="text-sm text-danger" role="alert">
                      {errors.password.message}
                    </p>
                  ) : (
                    <FieldError />
                  )}
                </TextField>
              )}
            />
            {serverErrorMessage ? (
              <p className="text-sm text-danger" role="alert">
                {serverErrorMessage}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              isDisabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? <Spinner size="sm" /> : "Login"}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </main>
  );
}
