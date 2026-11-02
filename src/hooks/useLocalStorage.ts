import { useCallback, useState } from "react";

type SetValue<TValue> = (value: TValue | ((current: TValue) => TValue)) => void;

/** State yang otomatis tersimpan di localStorage (dipakai untuk tema & draft form). */
export function useLocalStorage<TValue>(
  key: string,
  initialValue: TValue,
): [TValue, SetValue<TValue>] {
  const [storedValue, setStoredValue] = useState<TValue>(() => {
    if (typeof localStorage === "undefined") return initialValue;

    try {
      const rawValue = localStorage.getItem(key);
      return rawValue === null ? initialValue : (JSON.parse(rawValue) as TValue);
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback<SetValue<TValue>>(
    (value) => {
      setStoredValue((current) => {
        const nextValue = value instanceof Function ? value(current) : value;

        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Kuota penuh / mode privat: state tetap jalan walau tidak tersimpan.
        }

        return nextValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
