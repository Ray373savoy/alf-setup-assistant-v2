import { create } from "zustand";
import type { Locale, Translations } from "./types";
import { ja } from "./ja";
import { ko } from "./ko";
import { en } from "./en";

const translations: Record<Locale, Translations> = { ja, ko, en };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: "ja",
  setLocale: (locale) => set({ locale }),
}));

export function useT(): Translations {
  const locale = useI18nStore((s) => s.locale);
  return translations[locale];
}

export type { Locale, Translations };
