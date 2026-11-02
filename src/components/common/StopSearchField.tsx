import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
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

interface DropdownPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

const MIN_QUERY_LENGTH = 2;
const DROPDOWN_MAX_HEIGHT = 448;
const VIEWPORT_MARGIN = 12;
const COMFORTABLE_HEIGHT = 320;

/**
 * Hitung posisi dropdown terhadap viewport.
 *
 * Aturan: kalau ruang di bawah input kurang lega (butuh ~6 baris hasil),
 * dropdown dibuka ke ATAS asal ruang atasnya lebih besar. Dengan begitu daftar
 * hasil selalu kelihatan banyak dan tidak perlu scroll cuma untuk lihat 2 item.
 */
function measureDropdown(input: HTMLInputElement): DropdownPosition {
  const rect = input.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;

  const shouldOpenUp = spaceBelow < COMFORTABLE_HEIGHT && spaceAbove > spaceBelow;
  const chosenSpace = shouldOpenUp ? spaceAbove : spaceBelow;

  return {
    left: Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN),
    ),
    width: rect.width,
    maxHeight: Math.max(160, Math.min(DROPDOWN_MAX_HEIGHT, chosenSpace)),
    ...(shouldOpenUp
      ? { bottom: window.innerHeight - rect.top + 8 }
      : { top: rect.bottom + 8 }),
  };
}

/**
 * Input titik ala Google Maps: ketik, pilih dari hasil pencarian, atau pakai
 * lokasi sekarang. Dropdown hasil dirender lewat portal supaya tidak pernah
 * terpotong card di bawahnya.
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
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { results, isSearching, errorMessage } = usePlaceSearch(query);
  const { isLocating, errorMessage: locationError, requestCurrentPosition } = useGeolocation();

  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!showDropdown) {
      setDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!inputRef.current) return;
      setDropdownPosition(measureDropdown(inputRef.current));
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showDropdown, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node;

      if (dropdownRef.current?.contains(targetNode)) return;
      if (inputRef.current?.parentElement?.contains(targetNode)) return;

      setIsOpen(false);
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
    if (!showDropdown || results.length === 0) return;

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

  const dropdown =
    showDropdown && dropdownPosition
      ? createPortal(
          <div
            ref={dropdownRef}
            id="place-search-results"
            role="listbox"
            aria-label="Hasil pencarian lokasi"
            style={{
              position: "fixed",
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight,
              top: dropdownPosition.top,
              bottom: dropdownPosition.bottom,
            }}
            className="z-[1200] flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
          >
            {isSearching ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-ink-soft">
                <Loader2 className="size-4 animate-spin" /> Mencari lokasi…
              </div>
            ) : errorMessage ? (
              <p className="px-3 py-3 text-[13px] text-danger">{errorMessage}</p>
            ) : results.length === 0 ? (
              <div className="px-3 py-3">
                <p className="text-[13px] leading-relaxed text-ink-soft">
                  Tidak ada hasil untuk “{query.trim()}”. Coba nama tempat + kota, atau buka di
                  Google Maps:
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-brand hover:underline"
                >
                  Cari di Google Maps <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-line bg-slate-50 px-3 py-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                    {results.length} hasil
                  </span>
                  <span className="hidden text-[10.5px] text-slate-400 sm:inline">
                    klik atau tekan ⏎
                  </span>
                </div>

                <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {results.map((place, index) => (
                    <li key={place.placeId}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectPlace(place)}
                        className={cn(
                          "flex w-full items-start gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition-colors last:border-b-0",
                          index === activeIndex ? "bg-brand-soft/60" : "bg-white hover:bg-slate-50",
                        )}
                      >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {place.label}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-soft">
                            {place.address}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
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
          className={cn(inputBaseClasses, "h-11 border-line pl-9 pr-24")}
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

      {dropdown}
    </div>
  );
}
