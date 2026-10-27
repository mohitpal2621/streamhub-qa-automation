// Empties reports/<suite> before a run so screenshots and traces from an
// earlier run cannot be mistaken for the current one.
import fs from 'node:fs';
import path from 'node:path';

for (const suite of process.argv.slice(2)) {
  fs.rmSync(path.join('reports', suite), { recursive: true, force: true });
}
