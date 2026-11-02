import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardPaste, Copy, ExternalLink, Link2, Loader2, MapPin } from "lucide-react";
import { reverseGeocode } from "@/services/api/places.api";
import type { PlaceSearchResult } from "@/types/api.types";
import { cn } from "@/utils/cn";
import {
  GOOGLE_MAPS_HOME_URL,
  LOCATION_INPUT_HINT,
  parseLocationInput,
} from "@/utils/mapsLink";
import { inputBaseClasses } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

interface LinkLocationFieldProps {
  onSelect: (place: PlaceSearchResult) => void;
  disabled?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  mapsUrl: "dari link",
  coordinates: "dari koordinat",
  plusCode: "dari kode plus",
};

function formatCoordinate(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Jalur kedua untuk menambah titik: tempel link Google Maps (atau koordinat /
 * kode plus). Dipakai kalau nama tempatnya tidak ketemu di mesin pencarian.
 */
export function LinkLocationField({ onSelect, disabled = false }: LinkLocationFieldProps) {
  const [rawInput, setRawInput] = useState("");
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [resolvedPlace, setResolvedPlace] = useState<PlaceSearchResult | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const parsedResult = useMemo(() => parseLocationInput(rawInput), [rawInput]);
  const coordinates =
    parsedResult.status === "parsed"
      ? { latitude: parsedResult.latitude, longitude: parsedResult.longitude }
      : null;

  useEffect(() => {
    if (!coordinates) {
      setResolvedPlace(null);
      return;
    }

    let isCancelled = false;
    setIsResolvingAddress(true);

    reverseGeocode(coordinates.latitude, coordinates.longitude)
      .then((place) => {
        if (!isCancelled) setResolvedPlace(place);
      })
      .catch(() => {
        if (!isCancelled) setResolvedPlace(null);
      })
      .finally(() => {
        if (!isCancelled) setIsResolvingAddress(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [coordinates?.latitude, coordinates?.longitude]);

  const handlePasteFromClipboard = async () => {
    setPasteMessage(null);

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setPasteMessage("Clipboard kosong. Salin link dari Google Maps dulu.");
        return;
      }
      setRawInput(clipboardText.trim());
    } catch {
      setPasteMessage("Browser menolak akses clipboard. Tempel manual dengan Ctrl+V / tekan lama.");
    }
  };

  const handleCopyCoordinate = async () => {
    if (!coordinates) return;

    try {
      await navigator.clipboard.writeText(formatCoordinate(coordinates.latitude, coordinates.longitude));
      setCopyFeedback("Koordinat tersalin");
    } catch {
      setCopyFeedback("Clipboard diblokir browser");
    }

    setTimeout(() => setCopyFeedback(null), 2200);
  };

  const handleUsePoint = () => {
    if (parsedResult.status !== "parsed") return;

    onSelect({
      placeId: `manual-${parsedResult.latitude.toFixed(6)}-${parsedResult.longitude.toFixed(6)}`,
      label: resolvedPlace?.label ?? parsedResult.label,
      address: resolvedPlace?.address ?? formatCoordinate(parsedResult.latitude, parsedResult.longitude),
      latitude: parsedResult.latitude,
      longitude: parsedResult.longitude,
    });

    setRawInput("");
    setResolvedPlace(null);
  };

  return (
    <div>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={rawInput}
          disabled={disabled}
          placeholder="Tempel link Google Maps / koordinat"
          onChange={(event) => {
            setRawInput(event.target.value);
            setPasteMessage(null);
          }}
          className={cn(inputBaseClasses, "h-11 border-line pl-9 pr-20 text-[13px]")}
          aria-label="Link Google Maps atau koordinat"
        />

        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            disabled={disabled}
            title="Tempel dari clipboard"
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-soft px-2 text-[11.5px] font-bold text-brand hover:bg-indigo-100 disabled:opacity-60"
          >
            <ClipboardPaste className="size-3.5" />
            Tempel
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">{LOCATION_INPUT_HINT}</p>

      {pasteMessage ? (
        <p className="mt-1.5 text-[12px] font-medium text-amber-600">{pasteMessage}</p>
      ) : null}

      {parsedResult.status === "parsed" ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>
                Terbaca {SOURCE_LABEL[parsedResult.source] ?? ""} ·{" "}
                {formatCoordinate(parsedResult.latitude, parsedResult.longitude)}
              </span>
            </p>

            <button
              type="button"
              onClick={handleCopyCoordinate}
              title="Salin koordinat"
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
            >
              <Copy className="size-3" />
              Salin
            </button>
          </div>

          {copyFeedback ? (
            <p className="mt-1 text-[11px] font-semibold text-emerald-700">{copyFeedback}</p>
          ) : null}

          <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-ink-soft">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            {isResolvingAddress ? (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Loader2 className="size-3 animate-spin" /> mencari alamat…
              </span>
            ) : (
              <span>
                {resolvedPlace
                  ? `${resolvedPlace.label} · ${resolvedPlace.address}`
                  : "Alamat tidak diketahui, titik tetap dipakai."}
              </span>
            )}
          </p>

          <Button
            type="button"
            size="sm"
            variant="primary"
            className="mt-2 w-full"
            onClick={handleUsePoint}
            disabled={disabled}
          >
            Pakai titik ini
          </Button>
        </div>
      ) : null}

      {parsedResult.status === "shortLink" ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-[12px] leading-snug text-amber-800">{parsedResult.message}</p>
          <a
            href={parsedResult.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-amber-900 hover:underline"
          >
            Buka link <ExternalLink className="size-3" />
          </a>
        </div>
      ) : null}

      {parsedResult.status === "invalid" && rawInput.trim().length > 6 ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">{parsedResult.message}</p>
      ) : null}

      <a
        href={GOOGLE_MAPS_HOME_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-brand hover:underline"
      >
        Buka Google Maps <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
