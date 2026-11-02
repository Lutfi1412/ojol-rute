import type { ApiFieldError } from "@/types/api.types";

/**
 * Error yang dilempar lapisan API. Bentuknya meniru respons error HTTP
 * (statusCode + message + errors[]) supaya saat backend nyata dipakai,
 * penanganan error di UI tidak perlu diubah.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly fieldErrors: ApiFieldError[];

  constructor(statusCode: number, message: string, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
