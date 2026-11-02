import { useEffect, useState } from "react";
import { isApiError } from "@/services/api/apiError";
import { searchPlaces } from "@/services/api/places.api";
import type { PlaceSearchResult } from "@/types/api.types";
import { useDebounce } from "./useDebounce";

interface PlaceSearchState {
  results: PlaceSearchResult[];
  isSearching: boolean;
  errorMessage: string | null;
}

/** Pencarian lokasi dengan debounce + pembatalan hasil yang sudah basi. */
export function usePlaceSearch(query: string): PlaceSearchState {
  const debouncedQuery = useDebounce(query, 450);
  const [state, setState] = useState<PlaceSearchState>({
    results: [],
    isSearching: false,
    errorMessage: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const trimmedQuery = debouncedQuery.trim();

    if (trimmedQuery.length < 3) {
      setState({ results: [], isSearching: false, errorMessage: null });
      return;
    }

    setState((current) => ({ ...current, isSearching: true, errorMessage: null }));

    searchPlaces(trimmedQuery)
      .then((response) => {
        if (isCancelled) return;
        setState({ results: response.data, isSearching: false, errorMessage: null });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        const message = isApiError(error)
          ? error.message
          : "Pencarian lokasi gagal. Periksa koneksi internet.";

        setState({ results: [], isSearching: false, errorMessage: message });
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery]);

  return state;
}
