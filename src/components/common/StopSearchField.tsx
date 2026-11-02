import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import type { PlaceSearchResult } from "@/types/api.types";
import { cn } from "@/utils/cn";
import { inputBaseClasses } from "@/components/ui/TextField";

interface StopSearchFieldProps {
  onSelect: (place: PlaceSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Input titik ala Google Maps: ketik, pilih dari hasil pencarian, atau pakai
 * lokasi sekarang. Tidak ada input koordinat manual supaya tidak salah orang.
 */
export function StopSearchField({
  onSelect,
  placeholder = "Cari alamat atau nama tempat",
  autoFocus = false,
  disabled = false,
}: StopSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const { results, isSearching, errorMessage } = usePlaceSearch(query);
  const { isLocating, errorMessage: locationError, requestCurrentPosition } = useGeolocation();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  const selectPlace = (place: PlaceSearchResult) => {
    onSelect(place);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleUseCurrentLocation = async () => {
    const place = await requestCurrentPosition();
    if (place) selectPlace(place);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const pickedResult = results[activeIndex] ?? results[0];
      if (pickedResult) selectPlace(pickedResult);
    }

    if (event.key === "Escape") setIsOpen(false);
  };

  const showDropdown = isOpen && query.trim().length >= 3;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="place-search-results"
          aria-autocomplete="list"
          className={cn(
            inputBaseClasses,
            "h-11 border-line pl-9 pr-24",
          )}
        />

        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveIndex(-1);
              }}
              aria-label="Bersihkan pencarian"
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            title="Pakai lokasi saya sekarang"
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-soft px-2 text-[11.5px] font-bold text-brand hover:bg-indigo-100 disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LocateFixed className="size-3.5" />
            )}
            Saya
          </button>
        </div>
      </div>

      {locationError ? (
        <p className="mt-1.5 text-[12px] font-medium text-danger">{locationError}</p>
      ) : null}

      {showDropdown ? (
        <div
          id="place-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%-4px)] z-50 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg"
        >
          {isSearching ? (
            <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-ink-soft">
              <Loader2 className="size-4 animate-spin" /> Mencari lokasi…
            </div>
          ) : errorMessage ? (
            <p className="px-3 py-3 text-[13px] text-danger">{errorMessage}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-soft">
              Lokasi tidak ditemukan. Coba kata kunci lain (contoh: nama jalan + kota).
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((place, index) => (
                <li key={place.placeId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectPlace(place)}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                      index === activeIndex ? "bg-slate-50" : "bg-white",
                    )}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {place.label}
                      </span>
                      <span className="block truncate text-[12px] text-ink-soft">
                        {place.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
