import { STATUS_CODES, StatusCode } from "../constants/status-codes";

export class ApiError extends Error {
  public readonly statusCode: StatusCode;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;

  constructor(
    statusCode: StatusCode,
    message: string,
    errors?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Permintaan tidak valid", errors?: unknown) {
    return new ApiError(STATUS_CODES.BAD_REQUEST, message, errors);
  }

  static unauthorized(message = "Tidak terautentikasi") {
    return new ApiError(STATUS_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = "Akses ditolak") {
    return new ApiError(STATUS_CODES.FORBIDDEN, message);
  }

  static notFound(message = "Data tidak ditemukan") {
    return new ApiError(STATUS_CODES.NOT_FOUND, message);
  }

  static conflict(message = "Konflik data") {
    return new ApiError(STATUS_CODES.CONFLICT, message);
  }

  static server(message = "Terjadi kesalahan pada server") {
    return new ApiError(STATUS_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
