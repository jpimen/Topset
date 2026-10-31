import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceRoot = resolve('src');
const colorLiteral = /#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/i;

export async function findColorLiteralViolations(root = sourceRoot) {
  const violations = [];
  const allowedTokenFile = resolve(root, 'theme/tokens.css');
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (path === allowedTokenFile || !/\.(?:css|tsx?|html)$/i.test(entry.name)) continue;
      const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
      lines.forEach((line, index) => {
        if (colorLiteral.test(line)) violations.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`);
      });
    }
  }
  await visit(root);
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const violations = await findColorLiteralViolations();
  if (violations.length) {
    console.error('Raw color values belong in src/theme/tokens.css.');
    violations.forEach((violation) => console.error(violation));
    process.exitCode = 1;
  } else {
    console.log('Color token check passed.');
  }
}
