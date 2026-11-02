import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/services/api/apiError";
import { clearDatabase } from "@/services/api/localDatabase";
import {
  addGroup,
  addStop,
  createRoute,
  deleteRoute,
  getRouteById,
  listRoutes,
  removeGroup,
  removeStop,
  reorderStops,
  toggleStopComplete,
  updateRoute,
} from "@/services/api/routes.repository";

const sampleStops = [
  {
    label: "Toko A",
    address: "Jl. A no. 1",
    latitude: -6.2,
    longitude: 106.8,
    note: "",
  },
  {
    label: "Toko B",
    address: "Jl. B no. 2",
    latitude: -6.21,
    longitude: 106.81,
    note: "",
  },
];

describe("routes.repository", () => {
  beforeEach(() => {
    clearDatabase();
  });

  it("membuat rute dengan urutan stop dan sequence yang benar", () => {
    const route = createRoute({
      name: "Rute uji",
      groups: [{ provider: "grab", stops: sampleStops }],
    });

    expect(route.groups).toHaveLength(1);
    expect(route.groups[0]?.stops.map((stop) => stop.sequence)).toEqual([1, 2]);
    expect(route.status).toBe("draft");
    expect(getRouteById(route.id)?.name).toBe("Rute uji");
    expect(listRoutes()).toHaveLength(1);
  });

  it("menolak payload tanpa grup", () => {
    expect(() => createRoute({ groups: [] })).toThrowError(ApiError);
  });

  it("menambah titik di posisi tengah (order susulan nyelip)", () => {
    const route = createRoute({
      groups: [{ provider: "shopee", stops: sampleStops }],
    });
    const groupId = route.groups[0]?.id ?? "";

    const updated = addStop(
      route.id,
      groupId,
      {
        label: "Toko Baru",
        address: "Jl. C no. 3",
        latitude: -6.22,
        longitude: 106.82,
        note: "",
      },
      1,
    );

    expect(updated.groups[0]?.stops.map((stop) => stop.label)).toEqual([
      "Toko A",
      "Toko Baru",
      "Toko B",
    ]);
    expect(updated.groups[0]?.stops.map((stop) => stop.sequence)).toEqual([1, 2, 3]);
  });

  it("mengubah urutan titik sesuai payload stopIds", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });
    const group = route.groups[0];
    const stopIds = group?.stops.map((stop) => stop.id) ?? [];

    const reordered = reorderStops(route.id, group?.id ?? "", [stopIds[1] ?? "", stopIds[0] ?? ""]);

    expect(reordered.groups[0]?.stops.map((stop) => stop.label)).toEqual(["Toko B", "Toko A"]);
  });

  it("menolak reorder dengan titik yang bukan anggota grup", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });
    const group = route.groups[0];

    expect(() => reorderStops(route.id, group?.id ?? "", ["stop-asing"])).toThrowError(ApiError);
  });

  it("status berubah mengikuti progres titik selesai", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });
    const group = route.groups[0];
    const firstStopId = group?.stops[0]?.id ?? "";
    const secondStopId = group?.stops[1]?.id ?? "";

    const partiallyDone = toggleStopComplete(route.id, group?.id ?? "", firstStopId);
    expect(partiallyDone.status).toBe("active");

    const fullyDone = toggleStopComplete(route.id, group?.id ?? "", secondStopId);
    expect(fullyDone.status).toBe("completed");
    expect(fullyDone.completedAt).not.toBeNull();

    const reopened = toggleStopComplete(route.id, group?.id ?? "", secondStopId);
    expect(reopened.status).toBe("active");
    expect(reopened.completedAt).toBeNull();
  });

  it("menolak menghapus titik terakhir di grup", () => {
    const route = createRoute({
      groups: [{ provider: "grab", stops: [sampleStops[0]!] }],
    });
    const group = route.groups[0];

    expect(() => removeStop(route.id, group?.id ?? "", group?.stops[0]?.id ?? "")).toThrowError(
      ApiError,
    );
  });

  it("menambah grup baru ke rute yang sedang berjalan", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });

    const updated = addGroup(route.id, {
      provider: "shopee",
      stops: [sampleStops[0]!],
    });

    expect(updated.groups).toHaveLength(2);
    expect(updated.groups[1]?.name).toBe("Shopee");
    expect(updated.groups[1]?.stops).toHaveLength(1);
  });

  it("menolak menghapus grup terakhir", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });

    expect(() => removeGroup(route.id, route.groups[0]?.id ?? "")).toThrowError(ApiError);
  });

  it("mengubah nama rute lewat update", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });

    const updated = updateRoute(route.id, { name: "Rute Siang" });

    expect(updated.name).toBe("Rute Siang");
    expect(updated.id).toBe(route.id);
  });

  it("menghapus rute beserta isinya", () => {
    const route = createRoute({ groups: [{ provider: "grab", stops: sampleStops }] });

    deleteRoute(route.id);

    expect(getRouteById(route.id)).toBeNull();
    expect(listRoutes()).toHaveLength(0);
  });

  it("mengembalikan 404 saat rute tidak ada", () => {
    expect(() => updateRoute("rte-tidak-ada", { name: "X" })).toThrowError(ApiError);
  });
});
