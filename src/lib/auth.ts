import {
  ACCESS_TOKEN_STORAGE_KEY,
  apiRequest,
  ApiClientError,
  isApiClientError,
} from "@/lib/api-client";

export type UserRole = "admin" | "analyst";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active_season_id: string | null;
  active_league_id: string | null;
};

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponseData = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: AuthUser;
};

type MeResponseData = {
  user: AuthUser;
};

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export async function login(payload: LoginPayload) {
  const result = await apiRequest<LoginResponseData>("/api/auth/login", {
    method: "POST",
    body: payload,
  });

  const accessToken = result.envelope.data?.access_token;
  if (!accessToken) {
    throw new ApiClientError(
      "Token login tidak ditemukan",
      500,
      result.requestId,
    );
  }

  setAccessToken(accessToken);
  return result.envelope.data;
}

export async function me() {
  const result = await apiRequest<MeResponseData>("/api/auth/me", {
    method: "GET",
    auth: true,
  });

  const user = result.envelope.data?.user;
  if (!user) {
    throw new ApiClientError(
      "Data user tidak ditemukan",
      500,
      result.requestId,
    );
  }

  return user;
}

export async function logout() {
  return apiRequest<null>("/api/auth/logout", {
    method: "POST",
    auth: true,
  });
}

export async function setActiveSeason(seasonId: string) {
  const result = await apiRequest<{
    active_season_id: string;
    active_season_name: string;
    active_league_id: string | null;
    active_league_name: string | null;
  }>("/api/auth/active-season", {
    method: "PATCH",
    auth: true,
    body: { season_id: seasonId },
  });

  return result.envelope.data;
}

export async function setActiveLeague(leagueId: string) {
  const result = await apiRequest<{
    active_league_id: string;
    active_league_name: string;
    active_league_country: string;
  }>("/api/auth/active-league", {
    method: "PATCH",
    auth: true,
    body: { league_id: leagueId },
  });

  return result.envelope.data;
}

export async function clearActiveLeague() {
  return apiRequest<null>("/api/auth/active-league", {
    method: "DELETE",
    auth: true,
  });
}

function logAuthDebugInfo(error: ApiClientError) {
  if (process.env.NODE_ENV !== "production" && error.requestId) {
    console.debug("auth_request_failed", {
      statusCode: error.statusCode,
      requestId: error.requestId,
      message: error.message,
    });
  }
}

export function toUserFacingError(error: unknown) {
  if (isApiClientError(error)) {
    logAuthDebugInfo(error);

    if (error.statusCode === 0) {
      return "Unable to connect. Please check your internet connection.";
    }

    if (error.statusCode === 401) {
      return "Invalid email or password. Please try again.";
    }

    if (error.statusCode === 403) {
      return "You do not have permission to access this resource.";
    }

    if (error.statusCode >= 500) {
      return "Server is currently unavailable. Please try again shortly.";
    }

    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}
