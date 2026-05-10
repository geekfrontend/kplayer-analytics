"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type NavItem = {
  href: string;
  label: string;
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

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/", label: "Dashboard" },
      { href: "/seasons", label: "Seasons" },
      { href: "/clubs", label: "Clubs" },
      { href: "/players", label: "Players" },
      { href: "/season-clubs", label: "Season Clubs" },
      { href: "/assignments", label: "Assignments" },
      { href: "/player-stats", label: "Player Stats" },
    ];

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

  function isActiveNav(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
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
      <header className="sticky top-0 z-30 border-b border-separator bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/85">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-(--radius-md) bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                KPA
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-none">
                  KPlayer Analytics
                </span>
                <span className="text-xs text-muted">Admin Workspace</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted md:block">
                {user.email}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isLoggingOut}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{`${user.name} (${user.role})`}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleLogout();
                    }}
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <nav className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-3">
            {navItems.map((item) => {
              const isActive = isActiveNav(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "rounded-(--radius-md) border border-border bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                      : "rounded-(--radius-md) border border-transparent bg-transparent px-3 py-1.5 text-sm text-muted transition-colors hover:border-border hover:bg-surface hover:text-foreground"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
