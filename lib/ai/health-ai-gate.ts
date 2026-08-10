export function isHealthAiEnabled(
  environment: Record<string, string | undefined> = process.env
): boolean {
  return environment.HEALTH_AI_ENABLED === 'true';
}
