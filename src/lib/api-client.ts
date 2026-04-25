export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  statusCode: number;
  data?: T;
  errors?: unknown;
};

export const ACCESS_TOKEN_STORAGE_KEY = "kplayer_access_token";

export type ApiRequestConfig = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

export type ApiResult<T> = {
  envelope: ApiEnvelope<T>;
  requestId: string | null;
};

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly errors?: unknown;
  public readonly requestId: string | null;

  constructor(
    message: string,
    statusCode: number,
    requestId: string | null,
    errors?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.errors = errors;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Terjadi kesalahan jaringan";
}

export async function apiRequest<T>(
  path: string,
  config: ApiRequestConfig = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, auth = false, headers = {} } = config;

  let requestHeaders: HeadersInit = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders = {
      ...requestHeaders,
      "Content-Type": "application/json",
    };
  }

  if (auth) {
    const token = getStoredToken();
    if (!token) {
      throw new ApiClientError("Token tidak ditemukan", 401, null);
    }

    requestHeaders = {
      ...requestHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiClientError(toErrorMessage(error), 0, null);
  }

  const requestId = response.headers.get("x-request-id");

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      "Response API tidak valid",
      response.status || 500,
      requestId,
    );
  }

  if (!response.ok || !envelope.success) {
    throw new ApiClientError(
      envelope.message || "Request gagal",
      envelope.statusCode || response.status || 500,
      requestId,
      envelope.errors,
    );
  }

  return { envelope, requestId };
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
