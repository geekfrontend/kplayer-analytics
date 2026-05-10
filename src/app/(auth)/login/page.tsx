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
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
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
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-300 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-xl border border-border bg-muted/50 p-8 shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)] sm:p-10">
          <div className="absolute -top-20 -left-20 h-52 w-52 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -right-24 -bottom-24 h-56 w-56 rounded-full bg-accent/60 blur-3xl" />
          <div className="relative space-y-6">
            <span className="inline-flex rounded-(--radius-md) border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
              KPlayer Analytics
            </span>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Pantau performa tim dan pemain dalam satu ruang kerja
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Masuk ke dasbor untuk mengelola musim, klub, pemain, dan
                statistik pertandingan secara lebih terstruktur.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-(--radius-md) border border-border/80 bg-background/85 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Data Operasional
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Terpusat dan rapi
                </p>
              </div>
              <div className="rounded-(--radius-md) border border-border/80 bg-background/85 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Monitoring
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Cepat dibaca tim
                </p>
              </div>
            </div>
          </div>
        </section>

        <Card className="my-auto w-full border-border bg-background shadow-[0_1px_2px_rgba(2,8,23,0.04),0_12px_28px_rgba(2,8,23,0.04)]">
          <CardHeader className="flex flex-col items-start gap-2 pb-2">
            <CardTitle className="text-xl">Masuk ke akun Anda</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Gunakan surel dan kata sandi yang terdaftar untuk melanjutkan.
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
                <Label htmlFor="password">Kata Sandi</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  {...register("password", {
                    onChange: () => setServerErrorMessage(null),
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Gunakan kata sandi akun Anda
                </p>
                {errors.password?.message ? (
                  <p className="text-sm text-danger" role="alert">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>
              {serverErrorMessage ? (
                <p
                  className="rounded-(--radius-md) border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                  role="alert"
                >
                  {serverErrorMessage}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 w-full"
              >
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
