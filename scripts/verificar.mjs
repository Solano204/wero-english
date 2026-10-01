/**
 * El paso obligatorio antes de cada build (docs/CHECKLIST_RELEASE.md): corre en orden typecheck, lint, todos los
 * `check:*` (incluido check:perf), la verificación de dominio y la auditoría de diseño. Se detiene en el primero que
 * falla y dice cuál.
 *
 *   npm run verificar
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

// React Native 0.86 pide Node 20.19.4 o más nuevo. Con Node 22.13+ además se puede rearmar catalogo.db (node:sqlite);
// con Node 20 se usa la de Git mientras catalogo.json no cambie.
const [mayor, menor, parche] = process.versions.node.split('.').map(Number);
if (mayor < 20 || (mayor === 20 && (menor < 19 || (menor === 19 && parche < 4)))) {
  console.error(
    `verificar: necesitas Node 20.19.4 o más nuevo (recomendado 22 LTS); tienes ${process.version}.\n` +
      '  Windows: instala Node 22 LTS de https://nodejs.org (o con nvm-windows: nvm install 22 && nvm use 22).',
  );
  process.exit(1);
}

const { scripts } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = Object.keys(scripts)
  .filter((s) => s.startsWith('check:'))
  // check:perf al final de los checks: sus avisos se leen mejor después de los de cada pantalla.
  .sort((a, b) => (a === 'check:perf') - (b === 'check:perf') || a.localeCompare(b));
const pasos = ['typecheck', 'lint', ...checks, 'verify', 'audit:diseno'];

const inicio = Date.now();
for (const [i, paso] of pasos.entries()) {
  process.stdout.write(`[${String(i + 1).padStart(2)}/${pasos.length}] ${paso} … `);
  const t = Date.now();
  const r = spawnSync('npm', ['run', '-s', paso], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.log('FALLA\n');
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
    console.error(`\nverificar: falló «${paso}». Arréglalo antes de armar el build.`);
    process.exit(1);
  }
  console.log(`ok (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
console.log(`\nverificar: ${pasos.length} pasos en verde (${Math.round((Date.now() - inicio) / 1000)} s). La auditoría de diseño quedó en DESIGN-AUDIT.md.`);
