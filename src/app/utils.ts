export const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^а-яa-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();