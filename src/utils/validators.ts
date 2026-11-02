import { z } from "zod";
import { MAX_GROUPS_PER_ROUTE, MAX_STOPS_PER_GROUP, MAX_STOPS_PER_ROUTE } from "@/constants/app";

/**
 * Skema payload. Dipakai di dua tempat sekaligus:
 *  - lapisan API lokal (validasi sebelum disimpan), dan
 *  - dokumentasi kontrak (bentuk JSON yang harus dikirim klien).
 * Saat backend nyata dibuat, skema ini bisa dipakai ulang apa adanya.
 */

export const geoPointSchema = z.object({
  label: z.string().trim().min(1, "Nama lokasi wajib diisi").max(160),
  address: z.string().trim().max(300).default(""),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const stopInputSchema = geoPointSchema.extend({
  note: z.string().trim().max(280).default(""),
});

export const groupInputSchema = z.object({
  provider: z.enum(["grab", "shopee"]),
  name: z.string().trim().min(1).max(60).optional(),
  stops: z.array(stopInputSchema).min(1, "Grup minimal punya 1 titik").max(MAX_STOPS_PER_GROUP),
});

export const createRouteSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    startPoint: geoPointSchema.nullable().optional(),
    groups: z
      .array(groupInputSchema)
      .min(1, "Rute minimal punya 1 grup")
      .max(MAX_GROUPS_PER_ROUTE, `Maksimal ${MAX_GROUPS_PER_ROUTE} grup per rute`),
  })
  .superRefine((payload, context) => {
    const totalStops = payload.groups.reduce((total, group) => total + group.stops.length, 0);
    if (totalStops > MAX_STOPS_PER_ROUTE) {
      context.addIssue({
        code: "custom",
        path: ["groups"],
        message: `Total titik maksimal ${MAX_STOPS_PER_ROUTE} per rute`,
      });
    }
  });

export const updateRouteSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    status: z.enum(["draft", "active", "completed"]),
    startPoint: geoPointSchema.nullable(),
    groups: createRouteSchema.shape.groups,
  })
  .partial();

export const addStopSchema = stopInputSchema;

export const updateStopSchema = stopInputSchema.partial();

export const reorderStopsSchema = z.object({
  stopIds: z.array(z.string().trim().min(1)).min(1, "Daftar titik tidak boleh kosong"),
});

export const addGroupSchema = z.object({
  provider: z.enum(["grab", "shopee"]),
  name: z.string().trim().min(1).max(60).optional(),
  stops: z.array(stopInputSchema).min(1).max(MAX_STOPS_PER_GROUP),
});

export type GeoPointInput = z.infer<typeof geoPointSchema>;
export type StopInput = z.infer<typeof stopInputSchema>;
export type GroupInput = z.infer<typeof groupInputSchema>;
export type CreateRoutePayload = z.infer<typeof createRouteSchema>;
export type UpdateRoutePayload = z.infer<typeof updateRouteSchema>;
export type ReorderStopsPayload = z.infer<typeof reorderStopsSchema>;
