let activeLocale = "en";
let catalogs = {};

export function configureAnyLang(options = {}) {
  activeLocale = options.locale || activeLocale;
  catalogs = options.catalogs || catalogs;
}

export function setAnyLangLocale(locale) {
  activeLocale = locale;
}

export function $tr(key, sourceOrLocale, locale) {
  const { source, selectedLocale } = resolveArgs(key, sourceOrLocale, locale);
  const entry = catalogs[selectedLocale]?.[key];

  if (typeof entry === "string") return entry || source;
  if (entry && typeof entry.text === "string") return entry.text || source;

  return source;
}

function resolveArgs(key, sourceOrLocale, locale) {
  if (locale !== undefined) {
    return {
      source: typeof sourceOrLocale === "string" ? sourceOrLocale : key,
      selectedLocale: locale
    };
  }

  if (typeof sourceOrLocale === "string" && catalogs[sourceOrLocale]) {
    return { source: key, selectedLocale: sourceOrLocale };
  }

  return {
    source: typeof sourceOrLocale === "string" ? sourceOrLocale : key,
    selectedLocale: activeLocale
  };
}
