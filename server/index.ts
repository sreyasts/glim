import 'dotenv/config';
import { buildApp } from './app';

const { app } = await buildApp({ logger: true });
try { await app.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1' }); }
catch (error) { app.log.error(error); await app.close(); process.exitCode = 1; }
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => { process.exitCode = 0; }));
}
