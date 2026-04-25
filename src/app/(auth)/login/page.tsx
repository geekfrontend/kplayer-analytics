"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Spinner } from "@heroui/react";
import {
  clearAccessToken,
  getAccessToken,
  login,
  me,
  toUserFacingError,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login({ email, password });
      await me();
      router.replace("/");
    } catch (error) {
      clearAccessToken();
      setErrorMessage(toUserFacingError(error));
    } finally {
      setIsLoading(false);
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
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-foreground">Email</span>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-foreground">Password</span>
              <Input
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {errorMessage ? (
              <p className="text-sm text-danger" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" variant="primary" isDisabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : "Login"}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </main>
  );
}
