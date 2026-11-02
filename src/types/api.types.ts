/**
 * Bentuk amplop respons API. Sengaja dibuat sama persis dengan yang nanti
 * dipakai backend sungguhan, supaya saat penyimpanan dipindah dari
 * localStorage ke server, kontrak di sisi UI tidak berubah.
 */

export interface ApiSuccess<TData> {
  success: true;
  statusCode: number;
  message: string;
  data: TData;
}

export interface ApiFailure {
  success: false;
  statusCode: number;
  message: string;
  errors: ApiFieldError[];
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export interface ApiFieldError {
  field: string;
  message: string;
}

export type ApiErrorCode =
  | 400 // payload tidak valid
  | 404 // rute / grup / stop tidak ditemukan
  | 409 // konflik (mis. nama grup duplikat)
  | 422 // aturan bisnis dilanggar
  | 500; // kegagalan tak terduga

export interface PlaceSearchResult {
  placeId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}
