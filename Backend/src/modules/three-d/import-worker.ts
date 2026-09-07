import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from '../../lib/prisma';
import { keeriConfigured, threeDImportBatches } from './runtime';

async function main() {
  if (!keeriConfigured) throw new Error('Configure the Keeri integration before starting the 3D import worker');
  const stop = new AbortController();
  process.once('SIGINT', () => stop.abort());
  process.once('SIGTERM', () => stop.abort());
  const once = process.argv.includes('--once');
  console.info('Maple 3D import worker started');
  do {
    try {
      const worked = await threeDImportBatches.runNext(stop.signal);
      if (once || stop.signal.aborted) break;
      if (!worked) await delay(3000, undefined, { signal: stop.signal });
    } catch {
      if (stop.signal.aborted) break;
      // Do not print source URLs, credentials or raw database errors.
      console.error('3D import worker could not read its queue. Check database connectivity.');
      if (once) { process.exitCode = 1; break; }
      await delay(5000, undefined, { signal: stop.signal }).catch(() => undefined);
    }
  } while (!stop.signal.aborted);
}
main().catch(error => { console.error(error.message === 'Configure the Keeri integration before starting the 3D import worker' ? error.message : '3D import worker stopped unexpectedly'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
