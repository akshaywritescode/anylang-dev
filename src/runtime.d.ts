export function configureAnyLang(options?: {
  locale?: string;
  catalogs?: Record<string, Record<string, string | {
    source?: string;
    text: string;
    variables?: string[];
  }>>;
}): void;

export function setAnyLangLocale(locale: string): void;

export function $tr(key: string, sourceOrLocale?: string, locale?: string): string;
