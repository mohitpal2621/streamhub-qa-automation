import type { Server } from 'node:http';
import { createApp } from '../../api/src/app';

let server: Server | undefined;
let starting: Promise<void> | undefined;

async function isUp(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('health', `${baseUrl}/`), { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Starts the catalogue API in this process on the port of `baseUrl`, once per
 * run. If an API is already answering there (for example `npm run api` in
 * another terminal), that one is used instead.
 */
export function ensureApiServer(baseUrl: string): Promise<void> {
  starting ??= (async () => {
    if (await isUp(baseUrl)) return;
    // No host argument: listen on every local address, so "localhost" works
    // whether it resolves to 127.0.0.1 or ::1.
    const port = Number(new URL(baseUrl).port);
    await new Promise<void>((resolve, reject) => {
      server = createApp()
        .listen(port, () => resolve())
        .on('error', reject);
    });
  })();
  return starting;
}

export async function stopApiServer(): Promise<void> {
  if (!server) return;
  await new Promise((resolve) => server!.close(resolve));
  server = undefined;
}
