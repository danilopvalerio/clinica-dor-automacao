export const SHEET_ENV_NAMES = {
  combined: ['SHEET_PCS_PROMIS_URL', 'VITE_COMBINED_SHEET_URL'],
  sf36: ['SHEET_SF36_URL', 'VITE_SF36_SHEET_URL'],
  initial: ['SHEET_INITIAL_URL', 'VITE_INITIAL_SHEET_URL'],
} as const;

export function configuredSourceUrl(env: Record<string, string | undefined>, source: keyof typeof SHEET_ENV_NAMES): string {
  return SHEET_ENV_NAMES[source].map(name => env[name]?.trim()).find(Boolean) ?? '';
}
