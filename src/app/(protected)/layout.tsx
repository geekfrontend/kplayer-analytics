"use client";

import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Button, Dropdown, Header, Spinner } from "@heroui/react";
import {
  type AuthUser,
  clearAccessToken,
  getAccessToken,
  logout,
  me,
} from "@/lib/auth";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      const token = getAccessToken();
      if (!token) {
        router.replace("/login");
        if (isActive) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const currentUser = await me();
        if (isActive) {
          setUser(currentUser);
        }
      } catch {
        clearAccessToken();
        router.replace("/login");
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();
    return () => {
      isActive = false;
    };
  }, [router]);

  const navItems = useMemo(() => {
    const items = [{ href: "/", label: "Dashboard" }];
    if (user?.role === "admin") {
      items.push({ href: "/users", label: "Users" });
    }
    return items;
  }, [user?.role]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Tetap clear token lokal walaupun request logout gagal.
    } finally {
      clearAccessToken();
      setUser(null);
      router.replace("/login");
      setIsLoggingOut(false);
    }
  }

  function handleDropdownAction(key: Key) {
    if (key === "logout") {
      void handleLogout();
    }
  }

  if (isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Spinner size="sm" />
          <span>Memuat sesi login...</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header className="border-b border-separator bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold">KPlayer Analytics</span>
            <nav className="flex items-center gap-3 text-sm">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive ? "font-semibold text-foreground" : "text-muted"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted md:block">
              {user.email}
            </span>
            <Dropdown>
              <Dropdown.Trigger>
                <Button variant="ghost" isDisabled={isLoggingOut}>
                  <Avatar size="sm">
                    <Avatar.Fallback>
                      {user.name.slice(0, 1).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Popover>
                <Dropdown.Menu onAction={handleDropdownAction}>
                  <Dropdown.Item id="identity">{`${user.name} (${user.role})`}</Dropdown.Item>
                  <Dropdown.Item id="logout">Logout</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>
      </Header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
