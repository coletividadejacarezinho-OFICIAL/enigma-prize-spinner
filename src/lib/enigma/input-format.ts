const locale = "pt-BR";
const particles = new Set(["da", "das", "de", "do", "dos", "e", "d"]);

function compact(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function capitalize(value: string): string {
  return value.replace(/^\p{L}/u, (initial) => initial.toLocaleUpperCase(locale));
}

/** Standardize names while preserving intentional mixed case and initials. */
export function formatPersonName(value: string): string {
  let words = 0;
  return compact(value).replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
    const lower = word.toLocaleLowerCase(locale);
    if (words++ > 0 && particles.has(lower)) return lower;
    if (word === word.toLocaleUpperCase(locale) && Array.from(word).length === 1) return word;
    return word === word.toLocaleUpperCase(locale) || word === lower ? capitalize(lower) : word;
  });
}

/** Preserve a shop's spelling, including acronyms and stylized brands. */
export function formatShopName(value: string): string {
  let words = 0;
  return compact(value).replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
    const first = words++ === 0;
    if (word !== word.toLocaleLowerCase(locale)) return word;
    return !first && particles.has(word) ? word : capitalize(word);
  });
}

/** Clean spacing and capitalize the start of the description, keeping its line breaks. */
export function formatDescription(value: string): string {
  return value
    .normalize("NFC")
    .split(/\r\n?|\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .join("\n")
    .trim()
    .replace(
      /^([^\p{L}\p{N}\n]*)([\p{L}\p{M}]+)/u,
      (_, lead: string, word: string) =>
        lead + (word === word.toLocaleLowerCase(locale) ? capitalize(word) : word),
    );
}
