export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options, credentials: 'same-origin',
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...options?.headers },
    signal: options?.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? 'Unable to reach Glim. Please try again.');
  }
  return response.json() as Promise<T>;
}
