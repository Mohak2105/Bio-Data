const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function transliterate(word: string): Promise<string[]> {
  if (!word.trim()) return [];

  try {
    const response = await fetch(
      `${API_BASE}/api/transliterate?text=${encodeURIComponent(word)}`
    );
    if (!response.ok) return [word];

    const data = await response.json();
    return data.suggestions?.length ? data.suggestions : [word];
  } catch {
    return [word];
  }
}
