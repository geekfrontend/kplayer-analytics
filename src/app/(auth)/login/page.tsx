"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    register,
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
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle className="text-xl">KPlayer Analytics</CardTitle>
          <CardDescription>
            Masuk untuk melanjutkan ke dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(handleLoginSubmit)}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                {...register("email", {
                  onChange: () => setServerErrorMessage(null),
                })}
              />
              {errors.email?.message ? (
                <p className="text-sm text-danger" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan password"
                autoComplete="current-password"
                {...register("password", {
                  onChange: () => setServerErrorMessage(null),
                })}
              />
              <p className="text-xs text-muted">Gunakan password akun Anda</p>
              {errors.password?.message ? (
                <p className="text-sm text-danger" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            {serverErrorMessage ? (
              <p className="text-sm text-danger" role="alert">
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
                "Login"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
