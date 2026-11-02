# Rute Ojol

Aplikasi web untuk driver ojol **barang/paket** yang narik di **Grab** dan **Shopee Xpress** sekaligus.

Masalahnya sederhana: kalau dapat order di satu aplikasi, biasanya aplikasi lain dimatikan supaya tidak
keteteran. Padahal order dari dua provider itu sering **searah**. Rute Ojol menyimpan rute yang sedang
jalan, menghitung urutan kunjungan terbaik antar grup provider, dan menunjukkan **jarak + waktu nyata di
jalan** (bukan garis lurus) supaya keputusan terima/tolak order susulan bisa diambil cepat.

---

## Daftar isi

1. [Cara kerja singkat](#1-cara-kerja-singkat)
2. [Menjalankan di lokal](#2-menjalankan-di-lokal)
3. [Environment variable](#3-environment-variable)
4. [Struktur folder](#4-struktur-folder)
5. [Alur pemakaian](#5-alur-pemakaian)
6. [Model data](#6-model-data)
7. [Kontrak API](#7-kontrak-api)
8. [Bentuk respons & kode error](#8-bentuk-respons--kode-error)
9. [Penyimpanan lokal (localStorage)](#9-penyimpanan-lokal-localstorage)
10. [Peta & mesin perhitungan rute](#10-peta--mesin-perhitungan-rute)
11. [Cara sistem menghitung rekomendasi](#11-cara-sistem-menghitung-rekomendasi)
12. [Migrasi ke backend sungguhan](#12-migrasi-ke-backend-sungguhan)
13. [Deploy ke Vercel](#13-deploy-ke-vercel)
14. [Test](#14-test)
15. [Batasan versi ini](#15-batasan-versi-ini)

---

## 1. Cara kerja singkat

Satu **rute** berisi 1–3 **grup**, satu grup = satu batch order dari **satu** provider
(`grab` atau `shopee`).

Aturan yang dipegang sistem:

1. **Urutan stop di dalam grup tidak boleh diubah** oleh optimizer. Kalau aplikasi provider memberi
   order 1→8, urutannya tetap 1→8, termasuk kalau rutenya melingkar.
2. Yang dicari adalah **cara menyelang-seling antar grup**, contoh `g1 → g2 → s1 → g3 → s2`
   (g = Grab, s = Shopee), dengan total jarak tempuh paling kecil.
3. Biaya setiap perpindahan memakai **jarak jalan** dari matriks jarak Google Distance Matrix atau OSRM,
   bukan jarak garis lurus. Total akhir dan garis di peta memakai Directions/Route API.
4. Sebagai pembanding, sistem juga menghitung skenario "selesaikan tiap provider terpisah" lalu
   menampilkan selisihnya (hemat berapa km / menit).

Batas teknis:

| Batas | Nilai | Alasan |
| --- | --- | --- |
| Stop per rute | 25 | batas waypoint Google Directions API |
| Stop per grup | 15 | menjaga penyelang-seling tetap cepat dihitung |
| Grup per rute | 3 | 2 provider + 1 grup order susulan; di atas itu pakai rute baru |

---

## 2. Menjalankan di lokal

Butuh **Bun** (disarankan) atau Node 20+.

```bash
bun install
bun run dev          # http://localhost:5173
```

Perintah lain:

```bash
bun run build        # typecheck (tsc --noEmit) + build produksi ke dist/
bun run preview      # cek hasil build
bun run typecheck    # cek tipe saja
bun run test         # unit test (vitest, jsdom)
```

Tanpa `.env` pun jalan: pencarian lokasi memakai **Photon + Nominatim (OpenStreetMap)**, perhitungan
rute memakai **OSRM**, tile peta memakai CARTO. Kalau mau hasil yang lebih akurat, isi key di `.env`
(lihat bagian 3).

---

## 3. Environment variable

Semua variabel frontend harus berawalan `VITE_` (aturan Vite). Salin `.env.example` menjadi `.env`,
isi key yang kamu punya, lalu **hentikan dan jalankan ulang** `bun run dev` (Vite hanya membaca `.env`
saat start).

```env
# Pencarian lokasi & jarak (opsional, pilih salah satu atau isi semua)
VITE_GOOGLE_MAPS_API_KEY=
VITE_LOCATIONIQ_KEY=
VITE_MAPTILER_KEY=

# Opsional: tile peta manual (kalau tidak pakai MapTiler)
VITE_MAP_TILE_URL=
VITE_MAP_TILE_ATTRIBUTION=

# Server gratis (boleh dibiarkan)
VITE_OSRM_BASE_URL=https://router.project-osrm.org
VITE_PHOTON_BASE_URL=https://photon.komoot.io
VITE_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org

VITE_APP_NAME=Rute Ojol
```

| Variabel | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | tidak | kosong | Paling akurat. Dipakai untuk pencarian (Places), jarak (Distance Matrix), rute (Directions). |
| `VITE_LOCATIONIQ_KEY` | tidak | kosong | Autocomplete alamat Indonesia, gratis 5.000 request/hari. Pencarian saja. |
| `VITE_MAPTILER_KEY` | tidak | kosong | Satu key untuk **tile peta + pencarian**. Gratis 100.000 request/bulan. |
| `VITE_MAP_TILE_URL` | tidak | tile MapTiler / CARTO | Override URL tile Leaflet secara manual. |
| `VITE_MAP_TILE_ATTRIBUTION` | tidak | atribusi MapTiler / CARTO | Teks atribusi tile. |
| `VITE_OSRM_BASE_URL` | tidak | `https://router.project-osrm.org` | Server jarak/polyline kalau tanpa Google. |
| `VITE_PHOTON_BASE_URL` | tidak | `https://photon.komoot.io` | Pencarian OSM (tanpa key). |
| `VITE_NOMINATIM_BASE_URL` | tidak | `https://nominatim.openstreetmap.org` | Pencarian & reverse geocode OSM (tanpa key). |
| `VITE_APP_NAME` | tidak | `Rute Ojol` | Dipakai di `<title>` dan header. |

### 3.1 Urutan mesin pencarian lokasi

Aplikasi mencoba provider satu per satu, berhenti di provider pertama yang memberi hasil,
dan otomatis turun ke provider berikutnya kalau error atau kosong:

```
Google Places  →  LocationIQ  →  MapTiler  →  Photon + Nominatim (gabungan, tanpa key)
```

Artinya: **isi key apa pun yang paling gampang kamu dapat**, sisanya tetap jalan. Tanpa key pun
aplikasi tidak error, hanya kualitas teks pencariannya di bawah Google.

### 3.2 Mau yang mana?

| Kebutuhan | Pakai | Daftar di |
| --- | --- | --- |
| Akurasi terbaik + nama populer/singkatan ("monas", "grandindo") | Google Maps Platform | <https://console.cloud.google.com/apis/credentials> |
| Gratis, khusus alamat Indonesia, tanpa kartu kredit | LocationIQ | <https://locationiq.com/> |
| Satu key untuk peta **dan** pencarian, tile lebih rapi | MapTiler | <https://cloud.maptiler.com/> |
| Tidak mau daftar apa pun | (kosongkan saja) | Photon + Nominatim + tile CARTO |

Kalau memakai Google, aktifkan di **APIs & Services → Library**:

- **Places API** (autocomplete + detail alamat)
- **Distance Matrix API** (matriks jarak antar titik)
- **Directions API** (polyline & total perjalanan)

**Maps JavaScript API tidak perlu** — peta memakai Leaflet + tile raster, bukan Google Maps JS.

> **Penting:** key `VITE_*` ikut terkirim ke browser (siapa pun bisa melihatnya di DevTools).
> Batasi key dengan *HTTP referrer restriction* (domain Vercel + `localhost`) dan, khusus Google,
> batasi juga ke 3 API di atas. Jangan pakai key yang punya akses billing luas.

Badge di header menunjukkan mesin jarak yang aktif: `Google Maps` atau `OSRM · OSM`.

---

## 4. Struktur folder

```
src/
├── components/
│   ├── common/          # ProviderBadge, StopSearchField, LinkLocationField, RouteMap, RouteSummary, PlanTimeline
│   ├── layout/          # AppShell (header + bottom nav), BottomNav, PageHeader
│   ├── routes/          # RouteCard, DraftGroupCard, GroupEditor, StopRow, AddGroupPanel
│   └── ui/              # Button, Card, Badge, Modal, ConfirmDialog, SegmentedControl, dst.
├── config/env.ts        # baca import.meta.env + flag isGoogleEnabled
├── constants/
│   ├── app.ts           # metadata provider (warna), label status, batas 25/15/3
│   └── api.ts           # daftar path endpoint + jeda simulasi API lokal
├── features/routes/planning/optimizeRoute.ts   # mesin urutan kunjungan (DP)
├── hooks/               # useDebounce, useLocalStorage, usePlaceSearch, useGeolocation
├── pages/
│   ├── dashboard/RoutesListPage.tsx
│   ├── routes/CreateRoutePage.tsx
│   ├── routes/RouteDetailPage.tsx
│   └── not-found/NotFoundPage.tsx
├── routes/AppRoutes.tsx
├── services/
│   ├── api/             # "backend" lokal: apiError, localDatabase, routes.repository, routes.api, places.api
│   └── routing/         # routingClient (Google/OSRM) + routing.service (susun RoutePlan)
├── stores/routes.store.ts   # Zustand: state daftar rute, detail, plan, error
├── types/               # route.types.ts, api.types.ts
├── utils/               # format tanggal/jarak, zod schema, polyline, geo, id, cn,
│                        # mapsLink (parser link Google Maps), plusCode (decoder kode plus)
└── tests/               # unit test optimizer + repository
```

Tidak ada folder yang dipakai "biar kelihatan lengkap": komponen UI hanya dibuat kalau dipakai,
dan tidak ada layer auth karena aplikasi ini tidak butuh login.

---

## 5. Alur pemakaian

**Buat rute**

1. Buka tab **Tambah** (atau tombol **Buat rute pertama**).
2. (Opsional) isi nama rute dan titik mulai — misal posisi kamu sekarang.
3. Pilih provider di segmented control, tekan **Tambah grup Grab / Shopee**.
4. Cari titik lewat kolom pencarian (mirip Google Maps), pilih hasilnya. Titik langsung masuk urutan 1, 2, 3 …
5. Ulangi untuk provider kedua kalau ordernya searah.
6. **Simpan rute** → langsung masuk halaman detail dan rute dihitung.

**Saat di jalan**

- Halaman rute menampilkan peta, total jarak/waktu, dan **urutan kunjungan rekomendasi** (1..N).
- Tombol centang di setiap titik = **tandai selesai**. Progres dihitung otomatis (`x/y`, persen), status
  berubah `Draft → Berjalan → Selesai` sendiri.
- **Tambah titik** di dalam grup untuk order baru dari batch yang sama, atau **Tambah grup / order baru**
  kalau order datang dari provider lain/ batch lain.
- Titik bisa **digeser (drag & drop)** untuk menyisipkan order baru di posisi tertentu, misal order
  ke-9 harus dikerjakan setelah titik 4.
- **Hapus** tersedia per titik, per grup, dan per rute (pakai konfirmasi).
- Tombol **Buka seluruh rute di Google Maps** mengirim urutan rekomendasi ke aplikasi Google Maps
  (maksimal 9 waypoint di URL; rute lebih panjang tetap tampil lengkap di aplikasi ini).

### 5.1 Dua cara menambah titik: **Cari nama** atau **Link Maps**

Setiap kolom titik punya dua tab, jadi kalau alamat tidak ketemu lewat pencarian, tidak perlu
berhenti:

**Tab "Cari nama"** — ketik nama tempat/alamat, pilih dari daftar hasil (bisa pakai panah atas/bawah
dan Enter). Tombol **Saya** mengisi titik dengan lokasi GPS sekarang.

**Tab "Link Maps"** — untuk alamat yang tidak ada di OpenStreetMap atau namanya susah ditebak:

1. Tekan **Buka Google Maps**, cari titiknya di sana.
2. Salin link/koordinat: di aplikasi Google Maps → **Bagikan → Salin link**, atau salin angka
   koordinat dari halaman tempat.
3. Kembali ke sini, tekan **Tempel** (baca clipboard) atau tempel manual.
4. Kalau terbaca, muncul kotak hijau berisi koordinat + alamat hasil reverse geocode.
   Tekan **Pakai titik ini**.

| Yang bisa ditempel | Contoh |
| --- | --- |
| Link Google Maps lengkap | `https://www.google.com/maps/place/Monas/@-6.1753924,106.8271528,17z/data=!3d-6.1753924!4d106.8271528` |
| Link dengan parameter `q` | `https://maps.google.com/?q=-6.9147,107.6098` |
| Koordinat polos | `-6.175392, 106.827153` |
| Koordinat koma desimal | `-6,175392 106,827153` |
| Derajat-menit-detik | `6°10'31.4"S 106°49'37.6"E` |
| Kode plus Google Maps | `849VCWC8+R9` |

Catatan penting:

- Dari link lengkap, yang diambil adalah koordinat **titik tempat** (`!3d..!4d..`) kalau ada;
  kalau tidak ada, dipakai koordinat posisi peta (`@lat,lng`).
- **Link pendek `maps.app.goo.gl` tidak bisa dibaca otomatis** — isi link itu hanya bisa diketahui
  setelah dibuka, dan browser memblokir pembacaannya (CORS). UI akan menampilkan tombol **Buka link**
  plus petunjuk: salin koordinat atau kode plus dari halaman tempat.
- **Kode plus pendek** (mis. `CWC8+R9 Jakarta`) butuh titik acuan, jadi tidak didukung — pakai kode
  plus lengkap 10 karakter.
- Tombol **Salin** di kotak hijau menyalin koordinat (`-6.175392, 106.827153`) untuk dikirim ke
  orang lain lewat WhatsApp atau catatan.
- Titik hasil link disimpan sama seperti titik hasil pencarian: bisa digeser, ditandai selesai,
  atau dihapus.

Kode terkait: `src/utils/mapsLink.ts` (parser link/koordinat), `src/utils/plusCode.ts`
(decoder kode plus), `src/components/common/LinkLocationField.tsx` (UI tab Link Maps).

---

## 6. Model data

Tipe lengkap ada di `src/types/route.types.ts`.

### 6.1 `RouteRecord`

```json
{
  "id": "rte_8d34e36d57ad",
  "name": "Pagi — Grab + Shopee",
  "status": "active",
  "startPoint": {
    "label": "Kos Melati",
    "address": "Jl. Melati No. 5, Jakarta Pusat",
    "latitude": -6.1861,
    "longitude": 106.8345
  },
  "groups": [
    {
      "id": "grp_9f2a1c",
      "provider": "grab",
      "name": "Grab",
      "stops": [
        {
          "id": "stop_a13",
          "sequence": 1,
          "label": "Monumen Nasional",
          "address": "Gambir, Jakarta Pusat",
          "latitude": -6.1754,
          "longitude": 106.8272,
          "note": "",
          "completedAt": null
        },
        {
          "id": "stop_b27",
          "sequence": 2,
          "label": "Sarinah",
          "address": "Jl. M.H. Thamrin, Jakarta Pusat",
          "latitude": -6.1889,
          "longitude": 106.8231,
          "note": "Lantai 3, titip resepsionis",
          "completedAt": "2026-11-02T03:12:44.000Z"
        }
      ]
    },
    {
      "id": "grp_5b71e0",
      "provider": "shopee",
      "name": "Shopee",
      "stops": [
        {
          "id": "stop_c44",
          "sequence": 1,
          "label": "Pasar Baru",
          "address": "Sawah Besar, Jakarta Pusat",
          "latitude": -6.1664,
          "longitude": 106.8317,
          "note": "",
          "completedAt": null
        }
      ]
    }
  ],
  "createdAt": "2026-11-02T02:40:10.000Z",
  "updatedAt": "2026-11-02T03:12:44.000Z",
  "completedAt": null
}
```

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string | `rte_` + 12 hex |
| `name` | string | 1–80 karakter |
| `status` | `draft` \| `active` \| `completed` | dihitung ulang otomatis dari progres stop |
| `startPoint` | `GeoPoint` \| `null` | titik mulai; kalau `null`, rute mulai dari stop pertama |
| `groups` | array | 1–3 grup |
| `groups[].provider` | `grab` \| `shopee` | |
| `groups[].stops[].sequence` | number | 1..n, urutan **tetap** di grup |
| `groups[].stops[].completedAt` | ISO string \| null | penanda selesai |
| `createdAt` / `updatedAt` / `completedAt` | ISO string \| null | |

`GeoPoint` = `{ label, address, latitude, longitude }`.

### 6.2 `RoutePlan`

Dihitung ulang setiap kali rute berubah (`GET /routes/:id/plan`).

```json
{
  "routeId": "rte_8d34e36d57ad",
  "engine": "osrm",
  "generatedAt": "2026-11-02T03:13:02.000Z",
  "totalDistanceMeters": 8642,
  "totalDurationSeconds": 842,
  "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "bounds": { "south": -6.21, "west": 106.81, "north": -6.16, "east": 106.84 },
  "startPoint": { "label": "Kos Melati", "address": "Jl. Melati No. 5", "latitude": -6.1861, "longitude": 106.8345 },
  "steps": [
    {
      "stopId": "stop_c44",
      "groupId": "grp_5b71e0",
      "provider": "shopee",
      "visitOrder": 1,
      "label": "Pasar Baru",
      "address": "Sawah Besar, Jakarta Pusat",
      "latitude": -6.1664,
      "longitude": 106.8317,
      "legDistanceMeters": 2087,
      "legDurationSeconds": 302,
      "cumulativeDistanceMeters": 2087,
      "cumulativeDurationSeconds": 302,
      "completedAt": null
    },
    {
      "stopId": "stop_a13",
      "groupId": "grp_9f2a1c",
      "provider": "grab",
      "visitOrder": 2,
      "label": "Monumen Nasional",
      "address": "Gambir, Jakarta Pusat",
      "latitude": -6.1754,
      "longitude": 106.8272,
      "legDistanceMeters": 1843,
      "legDurationSeconds": 233,
      "cumulativeDistanceMeters": 3930,
      "cumulativeDurationSeconds": 535,
      "completedAt": null
    }
  ],
  "comparison": {
    "interleavedDistanceMeters": 8642,
    "interleavedDurationSeconds": 842,
    "separateDistanceMeters": 9310,
    "separateDurationSeconds": 973,
    "savedDistanceMeters": 668,
    "savedDurationSeconds": 131
  },
  "notes": ["Jarak & waktu memakai OSRM (data OpenStreetMap), bukan Google Maps."]
}
```

- `engine`: `google` atau `osrm` — mesin yang benar-benar dipakai.
- `steps[].visitOrder`: urutan rekomendasi pada rute gabungan (bukan `sequence` grup).
- `legDistanceMeters` / `legDurationSeconds`: etape **menuju** titik tersebut.
- `comparison`: pembanding "kalau tiap provider dikerjakan terpisah".
- `notes`: catatan kondisi data (mis. fallback ke OSRM, garis lurus karena Directions gagal).

---

## 7. Kontrak API

Versi ini memakai **localStorage**, tetapi semua akses data lewat lapisan API dengan path REST dan bentuk
payload/ respons yang sama seperti backend sungguhan. Implementasinya ada di:

- `src/services/api/routes.api.ts` (fungsi publik yang dipanggil UI)
- `src/services/api/routes.repository.ts` (aturan bisnis + validasi)
- `src/services/api/localDatabase.ts` (penyimpanan)
- `src/services/api/places.api.ts` (pencarian lokasi)

Daftar path juga ditulis di `src/constants/api.ts`.

### 7.0 Ringkasan endpoint

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/routes` | daftar rute (urut `updatedAt` terbaru) |
| `POST` | `/routes` | buat rute + grup + stop sekaligus |
| `GET` | `/routes/:routeId` | detail satu rute |
| `PUT` | `/routes/:routeId` | ubah nama/status/titik mulai (bisa juga ganti seluruh grup) |
| `DELETE` | `/routes/:routeId` | hapus rute |
| `GET` | `/routes/:routeId/plan` | hitung rencana rute (urutan + jarak nyata) |
| `POST` | `/routes/:routeId/groups` | tambah grup (order susulan provider lain) |
| `PUT` | `/routes/:routeId/groups/:groupId` | ubah nama/provider grup |
| `DELETE` | `/routes/:routeId/groups/:groupId` | hapus grup |
| `POST` | `/routes/:routeId/groups/:groupId/stops` | tambah titik (opsional sisip di posisi tertentu) |
| `PUT` | `/routes/:routeId/groups/:groupId/stops/:stopId` | ubah data titik |
| `DELETE` | `/routes/:routeId/groups/:groupId/stops/:stopId` | hapus titik |
| `POST` | `/routes/:routeId/groups/:groupId/stops/:stopId/complete` | toggle selesai |
| `PUT` | `/routes/:routeId/groups/:groupId/stops/reorder` | ubah urutan titik dalam grup |
| `GET` | `/places/search?q=` | cari lokasi (Google Places / Nominatim) |

### 7.1 `GET /routes`

Tanpa payload. Respons `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Daftar rute berhasil diambil",
  "data": [ { "id": "rte_8d34e36d57ad", "name": "Pagi — Grab + Shopee", "status": "active", "...": "..." } ]
}
```

### 7.2 `POST /routes`

Payload:

```json
{
  "name": "Pagi — Grab + Shopee",
  "startPoint": { "label": "Kos Melati", "address": "Jl. Melati No. 5", "latitude": -6.1861, "longitude": 106.8345 },
  "groups": [
    {
      "provider": "grab",
      "name": "Grab",
      "stops": [
        { "label": "Monumen Nasional", "address": "Gambir", "latitude": -6.1754, "longitude": 106.8272, "note": "" },
        { "label": "Sarinah", "address": "Thamrin", "latitude": -6.1889, "longitude": 106.8231, "note": "" }
      ]
    }
  ]
}
```

Aturan validasi:

- `groups` minimal 1, maksimal 3.
- tiap grup minimal 1 stop, maksimal 15.
- total stop maksimal 25.
- `provider` hanya `grab` atau `shopee`.
- `label` wajib; `latitude` −90..90; `longitude` −180..180.
- `name` rute opsional → default `Rute Grab`, `Rute Grab + Shopee`, dst.
- `name` grup opsional → default `Grab`, `Shopee`, `Grab 2`, `Shopee 2`, …

Respons `201` berisi objek rute lengkap (seperti contoh 6.1) dengan `id`, `sequence`, dan `completedAt: null`
yang dibuat server.

### 7.3 `GET /routes/:routeId`

Respons `200` dengan `data` = satu `RouteRecord`. Kalau tidak ada → `404`.

### 7.4 `PUT /routes/:routeId`

Semua field opsional, hanya yang dikirim yang diubah:

```json
{ "name": "Siang — Grab + Shopee", "status": "active" }
```

Boleh juga mengirim `startPoint` (`null` untuk menghapus) atau `groups` (mengganti **seluruh** grup; id grup
dan stop dibuat ulang). Respons `200` + rute terbaru.

### 7.5 `DELETE /routes/:routeId`

Respons `200`:

```json
{ "success": true, "statusCode": 200, "message": "Rute berhasil dihapus", "data": { "id": "rte_8d34e36d57ad" } }
```

### 7.6 `GET /routes/:routeId/plan`

Menghitung ulang rencana rute. Tidak ada payload. Respons `200` dengan `data` = `RoutePlan` (contoh 6.2).

Bisa gagal `422` kalau rute belum punya titik (`"Rute belum punya titik..."`) atau `504` kalau layanan
rute tidak merespons.

### 7.7 `POST /routes/:routeId/groups`

```json
{
  "provider": "shopee",
  "name": "Shopee 2",
  "stops": [
    { "label": "Pasar Baru", "address": "Sawah Besar", "latitude": -6.1664, "longitude": 106.8317, "note": "" }
  ]
}
```

Respons `201` + rute terbaru. `422` kalau grup sudah 3 atau total stop akan melebihi 25.

### 7.8 `PUT /routes/:routeId/groups/:groupId`

```json
{ "name": "Shopee Siang", "provider": "shopee" }
```

### 7.9 `DELETE /routes/:routeId/groups/:groupId`

`422` kalau grup tersisa satu-satunya (`"Rute harus punya minimal satu grup..."`).

### 7.10 `POST /routes/:routeId/groups/:groupId/stops`

```json
{
  "label": "Juanda",
  "address": "Jl. Ir. H. Juanda, Jakarta Pusat",
  "latitude": -6.1698,
  "longitude": 106.8306,
  "note": "Ambil paket besar"
}
```

Sisip di posisi tertentu (0 = paling awal):

```
POST /routes/:routeId/groups/:groupId/stops?position=3
```

Respons `201`. `sequence` seluruh grup dirapikan ulang (1..n). `422` kalau grup penuh (15) atau total rute
melebihi 25.

### 7.11 `PUT /routes/:routeId/groups/:groupId/stops/:stopId`

Semua field opsional (`label`, `address`, `latitude`, `longitude`, `note`).

### 7.12 `DELETE /routes/:routeId/groups/:groupId/stops/:stopId`

`422` kalau stop itu satu-satunya di grup (`"Grup harus punya minimal satu titik"`).

### 7.13 `POST /routes/:routeId/groups/:groupId/stops/:stopId/complete`

Tanpa payload. Toggle:

- belum selesai → `completedAt` diisi waktu sekarang;
- sudah selesai → `completedAt` dikembalikan `null`.

Efek samping: `status` rute ikut berubah — semua selesai → `completed`, sebagian → `active`, belum ada →
`draft`.

### 7.14 `PUT /routes/:routeId/groups/:groupId/stops/reorder`

```json
{ "stopIds": ["stop_b27", "stop_a13", "stop_c44"] }
```

`stopIds` harus berisi **semua** stop grup itu (jumlah & anggotanya sama, hanya urutannya berubah).
Respons `200` + rute dengan `sequence` baru. `422` kalau jumlah/anggota tidak cocok.

### 7.15 `GET /places/search?q=monas`

Respons `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lokasi ditemukan",
  "data": [
    {
      "placeId": "osm-123456",
      "label": "Monumen Nasional",
      "address": "Gambir, Jakarta Pusat, DKI Jakarta, Indonesia",
      "latitude": -6.175392,
      "longitude": 106.827153
    }
  ]
}
```

Query minimal 2 karakter, debounce 450 ms, maksimal 8 hasil. Provider dicoba berurutan:
Google Places → LocationIQ → MapTiler → Photon + Nominatim. Error `502`/`504` hanya kalau
semua provider gagal; hasil kosong tetap `200` dengan `data: []`.

## 8. Bentuk respons & kode error

Semua respons memakai envelope yang sama.

**Sukses**

```json
{ "success": true, "statusCode": 200, "message": "…", "data": {} }
```

**Gagal**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Payload tidak valid",
  "errors": [{ "field": "groups.0.stops.0.label", "message": "Nama lokasi wajib diisi" }]
}
```

| Kode | Arti di aplikasi ini |
| --- | --- |
| `400` | payload tidak valid (zod) / nama kosong |
| `404` | rute / grup / titik tidak ditemukan |
| `409` | konflik data (disiapkan untuk backend, mis. nama rute duplikat) |
| `422` | aturan bisnis dilanggar (batas grup/stop, hapus grup terakhir, rute tanpa titik) |
| `500` | error tak terduga |
| `502` | layanan peta (Places/Directions/Distance Matrix) menolak permintaan |
| `504` | layanan peta tidak merespons |

Di UI, error dilempar sebagai `ApiError` (`src/services/api/apiError.ts`) sehingga bisa ditangkap:

```ts
import { isApiError } from "@/services/api/apiError";

try {
  await useRoutesStore.getState().createRoute(payload);
} catch (error) {
  if (isApiError(error)) {
    console.log(error.statusCode, error.message, error.fieldErrors);
  }
}
```

---

## 9. Penyimpanan lokal (localStorage)

| Item | Nilai |
| --- | --- |
| Key | `ojol-rute.database.v1` |
| Isi | `{ "version": 1, "routes": [ RouteRecord, … ] }` |
| Ditulis | setiap create/update/delete (satu key, overwrite penuh) |

Contoh isi:

```json
{
  "version": 1,
  "routes": [
    { "id": "rte_8d34e36d57ad", "name": "Pagi — Grab + Shopee", "status": "active", "groups": [] }
  ]
}
```

Catatan:

- Data **per browser/perangkat**. Ganti HP atau clear site data = data hilang.
- Backup manual: buka DevTools → Application → Local Storage → copy `ojol-rute.database.v1`.
- Kalau JSON rusak, aplikasi tidak crash: database dianggap kosong (`readDatabase` menangkap error).
- Key diberi versi supaya migrasi format nanti bisa dilakukan tanpa menimpa data lama.

---

## 10. Peta & mesin perhitungan rute

| Bagian | Tanpa key Google | Dengan key Google |
| --- | --- | --- |
| Pencarian lokasi | Photon + Nominatim (`/search`, digabung & diurutkan) | Places Autocomplete + Details |
| Lokasi sekarang → alamat | Nominatim / LocationIQ (`/reverse`) | Geocoding API |
| Matriks jarak antar titik | OSRM `/table` | Distance Matrix API |
| Garis rute + total akhir | OSRM `/route` (polyline penuh) | Directions API |
| Tile peta | CARTO/OpenStreetMap via Leaflet | sama |

Detail teknis:

- Timeout tiap request rute: **15 detik** (`routingClient.ts`).
- Kalau Distance Matrix gagal → otomatis fallback ke OSRM dan `notes` diisi alasannya.
- Kalau Directions gagal → total tetap dihitung dari matriks, peta menggambar garis lurus antar titik,
  dan `notes` memberi tahu bahwa garisnya bukan jalan asli.
- Polyline disimpan ter-encode (precision 5) dan didekode di klien (`decodePolyline`).
- Pencarian alamat di-debounce 450 ms dan minimal 2 karakter supaya tidak melanggar rate limit Nominatim/Photon.

---

## 11. Cara sistem menghitung rekomendasi

1. Semua stop dari semua grup diberi index pada matriks jarak (opsional +1 untuk titik mulai).
2. Optimizer (`features/routes/planning/optimizeRoute.ts`) melakukan **dynamic programming** atas
   state "sudah mengambil berapa stop dari tiap grup" + "grup terakhir yang dikunjungi".
   Hanya stop berikutnya dari suatu grup yang boleh diambil — jadi urutan di dalam grup dijamin tetap.
3. Total jarak tiap kandidat dihitung dari matriks jarak (bukan haversine).
4. Sebagai pembanding, dihitung semua permutasi urutan grup (maksimal 6 untuk 3 grup) dengan aturan
   "selesaikan grup satu per satu" → diambil yang paling kecil sebagai `comparison.separate*`.
5. `savedDistanceMeters` = selisih keduanya. Kalau selisih < 300 m dan < 2 menit, UI menyebut keduanya
   "hampir sama" alih-alih memaksa klaim hemat.
6. Kalau kombinasi state terlalu besar (> 300.000), optimizer memakai heuristik urutan grup terbaik
   supaya tetap cepat.

Contoh: Grab (g1, g2) + Shopee (s1, s2) → hasil bisa `g1 → s1 → s2 → g1... ` dst, tergantung jarak nyata.
Yang tidak pernah terjadi: `g2` sebelum `g1`.

---

## 12. Migrasi ke backend sungguhan

Karena UI hanya memanggil `src/services/api/routes.api.ts`, migrasinya cuma mengganti isi file itu:

```ts
// sebelum: panggilan lokal
const routes = listRoutes();

// sesudah: HTTP
const response = await fetch(`${API_BASE_URL}/routes`);
const body: ApiResponse<RouteRecord[]> = await response.json();
if (!body.success) throw new ApiError(body.statusCode, body.message);
return body;
```

Yang perlu disiapkan di backend:

1. Endpoint sesuai tabel 7.0 dengan envelope sukses/gagal yang sama.
2. Validasi memakai skema yang sama (`src/utils/validators.ts`, zod) — bisa disalin apa adanya.
3. Aturan status otomatis (`completed`/`active`/`draft`) dan batas 25/15/3.
4. Endpoint `plan` memanggil Google Distance Matrix + Directions (key disimpan di server, bukan di klien)
   lalu mengembalikan `RoutePlan`.

Sampai backend siap, semua endpoint tetap berjalan di browser dengan jeda buatan 120 ms (baca) dan
220 ms (tulis) supaya perilaku loading/error realistis.

---

## 13. Deploy ke Vercel

Repo: `https://github.com/Lutfi1412/ojol-rute.git`

`vercel.json` sudah menyetel build Vite + rewrite SPA (semua path ke `index.html`, supaya
`/rute/:id` tidak 404 saat di-refresh).

```bash
bunx vercel link                 # hubungkan folder ke project
bunx vercel env add VITE_APP_NAME production
bunx vercel env add VITE_GOOGLE_MAPS_API_KEY production   # opsional
bunx vercel env add VITE_LOCATIONIQ_KEY production        # opsional
bunx vercel env add VITE_MAPTILER_KEY production          # opsional
bunx vercel deploy --prod
```

Atau lewat dashboard: import repo GitHub → framework **Vite** → build `bun run build` → output `dist` →
tambahkan environment variable yang sama untuk Production/Preview/Development.

Setelah live, tambahkan domain Vercel ke *HTTP referrer restriction* key Google (kalau dipakai).

---

## 14. Test

```bash
bun run test
```

Yang diuji (`src/tests/`):

- `optimizeRoute.test.ts` — penyelang-seling lebih dekat, urutan dalam grup tidak berubah, tidak lebih buruk
  dari per-provider, titik awal dihormati, 1 grup, 3 grup tanpa duplikat/hilang.
- `routes.repository.test.ts` — create + sequence, validasi payload, sisip titik di tengah, reorder,
  tolak anggota asing, status otomatis dari progres, tolak hapus stop/grup terakhir, tambah grup, rename,
  delete, 404.

Terakhir dijalankan: **18 test lulus**, `tsc --noEmit` bersih, `vite build` sukses.

---

## 15. Batasan versi ini

- **Input manual.** Aplikasi tidak membaca order langsung dari Grab/Shopee (tidak ada API driver publik,
  dan token sesi terikat device). Semua titik diisi lewat pencarian alamat.
- **Data lokal.** Belum ada sinkronisasi antar perangkat / login.
- **Belum ada jam order (SLA).** Rekomendasi hanya berbasis jarak & waktu tempuh; belum mempertimbangkan
  deadline pickup/delivery, kapasitas box, atau jam operasional toko.
- **Google Maps deep link** dibatasi 9 waypoint oleh Google; rute lebih panjang tetap bisa dilihat penuh
  di peta aplikasi.
- Nama jalan/titik bergantung kualitas data OpenStreetMap kalau tidak memakai key Google.

Rencana lanjutan yang masuk akal: input jam deadline per order, skor "searah/tidak" saat order baru masuk,
PWA + share rute, lalu backend (bagian 12) supaya rute bisa dibuka di perangkat lain.

---

Data peta: © OpenStreetMap contributors, tile © CARTO, perhitungan OSRM.
