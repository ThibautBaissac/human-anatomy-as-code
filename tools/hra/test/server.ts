import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Static file server with HTTP Range support; counts requests per path. */
export async function serve(root: string): Promise<{ url: string; hits: Map<string, number>; close(): Promise<void> }> {
  const hits = new Map<string, number>();
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    hits.set(path, (hits.get(path) ?? 0) + 1);
    const file = join(root, path);
    if (!existsSync(file)) { res.statusCode = 404; res.end(); return; }
    const body = readFileSync(file);
    const range = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? '');
    if (range) {
      const [a, b] = [Number(range[1]), Math.min(Number(range[2]), body.length - 1)];
      res.writeHead(206, { 'Content-Range': `bytes ${a}-${b}/${body.length}`, 'Content-Length': b - a + 1 });
      res.end(body.subarray(a, b + 1));
    } else res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, hits, close: () => new Promise((r) => server.close(() => r())) };
}
