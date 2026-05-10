"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/components/app/auth-user-context";

type UseAdminGuardOptions = {
  redirectTo?: string;
};

export function useAdminGuard(options?: UseAdminGuardOptions) {
  const redirectTo = options?.redirectTo ?? "/";
  const router = useRouter();
  const { user } = useAuthUser();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user && !isAdmin) {
      router.replace(redirectTo);
    }
  }, [isAdmin, redirectTo, router, user]);

  return {
    isAdmin,
    user,
  };
}
