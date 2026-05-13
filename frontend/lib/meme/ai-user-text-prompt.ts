/** Stille Rechtschreibkorrektur für Nutzertexte in KI-Vollbild-Prompts. */
export const AI_USER_TEXT_SPELLING_RULE =
  "Wenn der Nutzer Stichworte oder eine Meme-Idee mitliefert: korrigiere erkennbare Rechtschreibfehler still auf der Grundlage des gemeinten Worts, ohne Ton, Pointe oder Inhalt zu verändern; der korrigierte Nutzertext gilt für die Ausarbeitung.";

export function memeIdeaFromUserClause(userText: string): string {
  const trimmed = userText.trim();
  if (!trimmed) return "";
  return ` ${AI_USER_TEXT_SPELLING_RULE} Meme-Idee vom Nutzer: ${trimmed}`;
}
