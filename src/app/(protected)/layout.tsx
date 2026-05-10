"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthUserProvider } from "@/components/app/auth-user-context";
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

function getRoleLabel(role: AuthUser["role"]) {
  return role === "admin" ? "Admin" : "Analis";
}

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
      { href: "/", label: "Dasbor" },
      { href: "/seasons", label: "Musim" },
      { href: "/clubs", label: "Klub" },
      { href: "/players", label: "Pemain" },
      { href: "/season-clubs", label: "Relasi Musim Klub" },
      { href: "/assignments", label: "Penugasan" },
      { href: "/player-stats", label: "Statistik Pemain" },
    ];

    if (user?.role === "admin") {
      items.push({ href: "/users", label: "Pengguna" });
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
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)] backdrop-blur supports-backdrop-filter:bg-background/90">
        <div className="mx-auto w-full max-w-300 px-4">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-(--radius-md) bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                KPA
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-none">
                  KPlayer Analytics
                </span>
                <span className="text-xs text-muted-foreground">
                  Ruang Kerja Analitik
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground md:block">
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
                  <DropdownMenuLabel>
                    {`${user.name} (${getRoleLabel(user.role)})`}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleLogout();
                    }}
                  >
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <nav className="no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto rounded-(--radius-md) border border-border/80 bg-muted/50 p-1">
            {navItems.map((item) => {
              const isActive = isActiveNav(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "rounded-(--radius-md) border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(2,8,23,0.04)]"
                      : "rounded-(--radius-md) border border-transparent bg-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <AuthUserProvider user={user}>
        <main className="mx-auto w-full max-w-300 px-4 py-6">{children}</main>
      </AuthUserProvider>
    </div>
  );
}
