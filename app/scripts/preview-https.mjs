// Builds the app and serves it over HTTPS on the local network (WebGPU needs a secure context on phones).
// Certificates come from mkcert; nothing is exposed outside the local network.
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';

const certs = new URL('../.certs/', import.meta.url).pathname;
const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
if (!existsSync(`${certs}cert.pem`) || !existsSync(`${certs}key.pem`)) {
  console.error(`Certificat local absent. Une seule fois (la première commande demande votre mot de passe) :

  mkcert -install
  mkdir -p app/.certs && mkcert -cert-file app/.certs/cert.pem -key-file app/.certs/key.pem ${ips.join(' ')} localhost

Sur le téléphone, installez aussi l'autorité mkcert (fichier rootCA.pem de \`mkcert -CAROOT\`) pour que le certificat soit accepté.`);
  process.exit(1);
}
const run = (args, env = {}) => spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, ...env } });
if (run(['vite', 'build']).status !== 0) process.exit(1);
console.log(`\nSur le téléphone (même Wi-Fi) : ${ips.map((ip) => `https://${ip}:5174/`).join('  ou  ')}\nMesure : ajoutez ?bench=1 (et &backend=webgl pour le repli WebGL2).\n`);
run(['vite', 'preview', '--host'], { HAAC_HTTPS: '1' });
