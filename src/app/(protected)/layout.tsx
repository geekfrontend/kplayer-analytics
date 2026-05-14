"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import {
  type ActiveLeague,
  ActiveLeagueProvider,
} from "@/components/app/active-league-context";
import {
  type ActiveSeason,
  ActiveSeasonProvider,
} from "@/components/app/active-season-context";
import { AuthUserProvider } from "@/components/app/auth-user-context";
import { ChooseContextDialog } from "@/components/app/choose-context-dialog";
import { LeagueSwitcher } from "@/components/app/league-switcher";
import { SeasonSwitcher } from "@/components/app/season-switcher";
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
import { apiRequest } from "@/lib/api-client";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
};

type SeasonDetailResponse = {
  season: {
    id: string;
    name: string;
    league_id: string | null;
    league_name: string | null;
  };
};

type LeagueDetailResponse = {
  league: {
    id: string;
    name: string;
    country: string;
  };
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
  const [activeSeason, setActiveSeason] = useState<ActiveSeason | null>(null);  const [activeLeague, setActiveLeague] = useState<ActiveLeague | null>(null);
  const [showChooseContextDialog, setShowChooseContextDialog] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      const token = getAccessToken();
      if (!token) {
        router.replace("/login");
        if (isActive) setIsBootstrapping(false);
        return;
      }

      try {
        const currentUser = await me();
        if (!isActive) return;

        setUser(currentUser);

        // Bootstrap active league dulu
        let bootstrappedLeague: ActiveLeague | null = null;
        if (currentUser.active_league_id) {
          try {
            const result = await apiRequest<LeagueDetailResponse>(
              `/api/leagues/${currentUser.active_league_id}`,
              { auth: true },
            );
            if (isActive && result.envelope.data?.league) {
              bootstrappedLeague = {
                id: result.envelope.data.league.id,
                name: result.envelope.data.league.name,
                country: result.envelope.data.league.country,
              };
              setActiveLeague(bootstrappedLeague);
            }
          } catch {
            // Liga mungkin sudah dihapus
          }
        }

        // Bootstrap active season — hanya jika sudah punya liga
        let hasValidSeason = false;
        if (bootstrappedLeague && currentUser.active_season_id) {
          try {
            const result = await apiRequest<SeasonDetailResponse>(
              `/api/seasons/${currentUser.active_season_id}`,
              { auth: true },
            );
            if (isActive && result.envelope.data?.season) {
              setActiveSeason({
                id: result.envelope.data.season.id,
                name: result.envelope.data.season.name,
                league_id: result.envelope.data.season.league_id,
                league_name: result.envelope.data.season.league_name,
              });
              hasValidSeason = true;
            }
          } catch {
            // Season mungkin sudah dihapus
          }
        }

        // Tampilkan dialog jika belum punya liga atau season
        if (isActive && (!bootstrappedLeague || !hasValidSeason)) {
          setShowChooseContextDialog(true);
        }
      } catch {
        clearAccessToken();
        router.replace("/login");
      } finally {
        if (isActive) setIsBootstrapping(false);
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
      { href: "/clubs", label: "Klub" },
      { href: "/players", label: "Pemain" },
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
      setActiveSeason(null);
      setActiveLeague(null);
      router.replace("/login");
      setIsLoggingOut(false);
    }
  }

  function handleContextChosen(league: ActiveLeague, season: ActiveSeason) {
    setActiveLeague(league);
    setActiveSeason(season);
    setShowChooseContextDialog(false);
  }

  function isActiveNav(href: string) {
    if (href === "/") return pathname === "/";
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
    <ActiveLeagueProvider
      activeLeague={activeLeague}
      setActiveLeague={setActiveLeague}
    >
      <ActiveSeasonProvider
        activeSeason={activeSeason}
        setActiveSeason={setActiveSeason}
      >
        <AuthUserProvider user={user}>
          <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-30 border-b border-border bg-background/95 shadow-[0_1px_2px_rgba(2,8,23,0.04),0_8px_24px_rgba(2,8,23,0.04)] backdrop-blur supports-backdrop-filter:bg-background/90">
              <div className="mx-auto w-full max-w-300 px-4">
                <div className="flex h-16 items-center justify-between gap-3">
                  {/* Brand */}
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

                  {/* Right side */}
                  <div className="flex items-center gap-2">
                    {/* League Switcher */}
                    <LeagueSwitcher />

                    {/* Season Switcher */}
                    <SeasonSwitcher />

                    <span className="hidden text-sm text-muted-foreground md:block">
                      {user.email}
                    </span>

                    {/* User menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isLoggingOut}
                        >
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
                          onSelect={() => setShowChooseContextDialog(true)}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          Ganti Liga &amp; Musim
                        </DropdownMenuItem>
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

                {/* Nav */}
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

            <main className="mx-auto w-full max-w-300 px-4 py-6">
              {showChooseContextDialog ? (
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>Menunggu pemilihan liga dan musim aktif...</span>
                  </div>
                </div>
              ) : (
                children
              )}
            </main>
          </div>

          <ChooseContextDialog
            open={showChooseContextDialog}
            onContextChosen={handleContextChosen}
            initialLeague={activeLeague}
          />
        </AuthUserProvider>
      </ActiveSeasonProvider>
    </ActiveLeagueProvider>
  );
}
