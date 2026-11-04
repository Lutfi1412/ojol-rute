import { describe, expect, it } from "vitest";
import {
  DRIVER_FIX_MAX_AGE_MS,
  isDriverFixStale,
  resolvePlanOrigin,
  toGeoPoint,
  type DriverFix,
} from "@/features/routes/location/planOrigin";
import type { GeoPoint } from "@/types/route.types";

const driverFix: DriverFix = {
  latitude: -6.175392,
  longitude: 106.827153,
  accuracyMeters: 12.4,
  capturedAt: "2026-11-04T09:15:00.000Z",
};

const routeStartPoint: GeoPoint = {
  label: "Basecamp",
  address: "Jl. Merdeka 1",
  latitude: -6.2,
  longitude: 106.8,
};

describe("toGeoPoint", () => {
  it("mengubah posisi GPS jadi titik rute berlabel Lokasi saya", () => {
    const point = toGeoPoint(driverFix);

    expect(point.label).toBe("Lokasi saya");
    expect(point.latitude).toBe(-6.175392);
    expect(point.longitude).toBe(106.827153);
    expect(point.address).toBe("-6.17539, 106.82715");
  });
});

describe("resolvePlanOrigin", () => {
  it("memakai posisi driver sebagai titik 0 kalau GPS terbaca", () => {
    const origin = resolvePlanOrigin(routeStartPoint, driverFix);

    expect(origin.source).toBe("driver");
    expect(origin.point?.label).toBe("Lokasi saya");
    expect(origin.point?.latitude).toBe(-6.175392);
  });

  it("kembali ke titik awal rute kalau GPS belum terbaca", () => {
    const origin = resolvePlanOrigin(routeStartPoint, null);

    expect(origin.source).toBe("route-start");
    expect(origin.point).toEqual(routeStartPoint);
  });

  it("mulai dari stop pertama kalau GPS dan titik awal rute sama-sama kosong", () => {
    const origin = resolvePlanOrigin(null, null);

    expect(origin.source).toBe("first-stop");
    expect(origin.point).toBeNull();
  });
});

describe("isDriverFixStale", () => {
  const capturedAt = Date.parse(driverFix.capturedAt);

  it("posisi baru dianggap masih berlaku", () => {
    expect(isDriverFixStale(driverFix, capturedAt + 30_000)).toBe(false);
  });

  it("posisi lewat batas umur dianggap kedaluwarsa", () => {
    expect(isDriverFixStale(driverFix, capturedAt + DRIVER_FIX_MAX_AGE_MS + 1)).toBe(true);
  });

  it("tanpa posisi atau tanggal rusak dianggap kedaluwarsa", () => {
    expect(isDriverFixStale(null)).toBe(true);
    expect(isDriverFixStale({ ...driverFix, capturedAt: "bukan-tanggal" })).toBe(true);
  });
});
