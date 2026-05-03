export const BASELINE_WPM = 150;

export function wordCount(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function readTimeSeconds(words, speed) {
  if (words <= 0) return 0;
  const wpm = BASELINE_WPM * speed;
  return Math.round((words / wpm) * 60);
}
