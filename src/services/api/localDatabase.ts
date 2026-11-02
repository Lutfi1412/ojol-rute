import type { RouteRecord } from "@/types/route.types";

/**
 * "Database" lokal. Semua data rute disimpan di satu key localStorage supaya
 * gampang di-backup/inspeksi dan gampang dipindah ke backend nanti.
 */
export const DATABASE_STORAGE_KEY = "ojol-rute.database.v1";
export const DATABASE_VERSION = 1;

export interface LocalDatabaseShape {
  version: number;
  routes: RouteRecord[];
}

/** Selalu objek + array baru — jangan sampai state kosong dipakai bersama antar panggilan. */
function createEmptyDatabase(): LocalDatabaseShape {
  return { version: DATABASE_VERSION, routes: [] };
}

export function readDatabase(): LocalDatabaseShape {
  if (typeof localStorage === "undefined") return createEmptyDatabase();

  const rawValue = localStorage.getItem(DATABASE_STORAGE_KEY);
  if (!rawValue) return createEmptyDatabase();

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalDatabaseShape>;

    if (!Array.isArray(parsed.routes)) return createEmptyDatabase();

    return {
      version: parsed.version ?? DATABASE_VERSION,
      routes: parsed.routes,
    };
  } catch {
    // Data rusak: jangan sampai aplikasi mati total, mulai dari kosong.
    return createEmptyDatabase();
  }
}

export function writeDatabase(database: LocalDatabaseShape): void {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(
    DATABASE_STORAGE_KEY,
    JSON.stringify({ ...database, version: DATABASE_VERSION }),
  );
}

export function clearDatabase(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DATABASE_STORAGE_KEY);
}
