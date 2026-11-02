import { useEffect, useState } from "react";

/** Tunda nilai sampai user berhenti mengetik, supaya pencarian tidak spam API. */
export function useDebounce<TValue>(value: TValue, delayMilliseconds = 400): TValue {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMilliseconds);

    return () => clearTimeout(timeoutId);
  }, [value, delayMilliseconds]);

  return debouncedValue;
}
