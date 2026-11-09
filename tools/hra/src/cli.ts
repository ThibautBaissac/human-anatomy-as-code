#!/usr/bin/env node
import { hraFetch } from './fetch.ts';
import { registerFile } from './register-file.ts';

const USAGE = `usage:
  hra fetch <hra-files.yaml> <outDir>
  hra register <hra-registration.yaml>`;

async function main([cmd, ...args]: string[]): Promise<number> {
  if (cmd === 'fetch' && args.length === 2) {
    await hraFetch({ listPath: args[0], outDir: args[1] });
    console.log(`fichiers HRA à jour dans ${args[1]}`);
    return 0;
  }
  if (cmd === 'register' && args.length === 1) {
    const { ok, summary } = registerFile(args[0]);
    for (const line of summary) console.log(line);
    return ok ? 0 : 1;
  }
  console.error(USAGE);
  return 2;
}

main(process.argv.slice(2)).then((code) => (process.exitCode = code), (e) => { console.error(`erreur : ${(e as Error).message}`); process.exitCode = 1; });
