import clsx, { type ClassValue } from "clsx";

/** Gabung class Tailwind dengan aman (clsx). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
