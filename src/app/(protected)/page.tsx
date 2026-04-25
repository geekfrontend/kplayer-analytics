"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@heroui/react";
import { type AuthUser, me, toUserFacingError } from "@/lib/auth";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadUser() {
      try {
        const currentUser = await me();
        if (isActive) {
          setUser(currentUser);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(toUserFacingError(error));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadUser();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>Dashboard</Card.Title>
          <Card.Description>Ringkasan cepat fase awal KPlayer Analytics.</Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted">
              <Spinner size="sm" />
              <span>Mengambil profil pengguna...</span>
            </div>
          ) : null}

          {errorMessage ? <p className="text-danger">{errorMessage}</p> : null}

          {!isLoading && user ? (
            <div className="space-y-1">
              <p>
                <span className="font-medium">Nama:</span> {user.name}
              </p>
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-medium">Role:</span> {user.role}
              </p>
            </div>
          ) : null}
        </Card.Content>
      </Card>
    </section>
  );
}
