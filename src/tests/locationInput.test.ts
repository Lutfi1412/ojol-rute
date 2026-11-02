import { describe, expect, it } from "vitest";
import { parseLocationInput } from "@/utils/mapsLink";
import { decodePlusCode } from "@/utils/plusCode";

describe("parseLocationInput", () => {
  it("mengosongkan input dianggap empty", () => {
    expect(parseLocationInput("   ").status).toBe("empty");
  });

  it("membaca koordinat polos", () => {
    const result = parseLocationInput("-6.175392, 106.827153");
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.175392, 5);
    expect(result.longitude).toBeCloseTo(106.827153, 5);
    expect(result.source).toBe("coordinates");
  });

  it("membaca koordinat dengan koma desimal", () => {
    const result = parseLocationInput("-6,175392 106,827153");
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.175392, 5);
    expect(result.longitude).toBeCloseTo(106.827153, 5);
  });

  it("membaca derajat menit detik", () => {
    const result = parseLocationInput(`6°10'31.4"S 106°49'37.6"E`);
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.1754, 3);
    expect(result.longitude).toBeCloseTo(106.8271, 3);
  });

  it("membaca koordinat dari /@lat,lng di link", () => {
    const result = parseLocationInput("https://www.google.com/maps/@-6.1753924,106.8271528,17z");
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.1753924, 5);
    expect(result.longitude).toBeCloseTo(106.8271528, 5);
    expect(result.source).toBe("mapsUrl");
  });

  it("mengutamakan koordinat tempat (!3d!4d) dibanding posisi peta (@)", () => {
    const url =
      "https://www.google.com/maps/place/Monas/@-6.2,106.8,15z/data=!4m6!3m5!1s0x0:0x0!8m2!3d-6.1753924!4d106.8271528";
    const result = parseLocationInput(url);
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.1753924, 5);
    expect(result.longitude).toBeCloseTo(106.8271528, 5);
  });

  it("membaca link dengan parameter query", () => {
    const result = parseLocationInput("https://maps.google.com/?q=-6.9147,107.6098");
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.9147, 4);
    expect(result.longitude).toBeCloseTo(107.6098, 4);
  });

  it("membaca link yang ter-encode (%2C)", () => {
    const result = parseLocationInput(
      "https://www.google.com/maps/search/?api=1&query=-6.175392%2C106.827153",
    );
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.latitude).toBeCloseTo(-6.175392, 5);
  });

  it("mendeteksi link pendek maps.app.goo.gl", () => {
    const result = parseLocationInput("https://maps.app.goo.gl/abc123XYZ");
    expect(result.status).toBe("shortLink");
  });

  it("menolak link yang tidak punya koordinat", () => {
    const result = parseLocationInput("https://www.google.com/maps/place/Monumen+Nasional");
    expect(result.status).toBe("invalid");
  });

  it("menolak teks acak", () => {
    expect(parseLocationInput("jalan mawar no 5").status).toBe("invalid");
  });

  it("menolak koordinat di luar jangkauan", () => {
    expect(parseLocationInput("120.5, 200.1").status).toBe("invalid");
  });
});

describe("decodePlusCode", () => {
  it("mendekode kode plus Googleplex (vektor uji umum)", () => {
    const result = decodePlusCode("849VCWC8+R9");
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.latitude).toBeCloseTo(37.422, 2);
    expect(result.longitude).toBeCloseTo(-122.084, 2);
  });

  it("mendekode kode plus Zurich sesuai referensi resmi", () => {
    const result = decodePlusCode("8FVC9G8F+6W");
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.latitude).toBeCloseTo(47.3655, 2);
    expect(result.longitude).toBeCloseTo(8.5249, 2);
  });

  it("menolak kode pendek yang butuh titik acuan", () => {
    expect(decodePlusCode("CWC8+R9")).toBeNull();
  });

  it("menolak teks yang bukan kode plus", () => {
    expect(decodePlusCode("halo dunia")).toBeNull();
  });

  it("parseLocationInput memakai jalur kode plus", () => {
    const result = parseLocationInput("849VCWC8+R9");
    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") return;
    expect(result.source).toBe("plusCode");
  });
});
