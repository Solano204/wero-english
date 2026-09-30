/**
 * Reglas de capas de Wero (ver docs/ARQUITECTURA.md). `npm run check:capas`.
 *
 * Cada capa solo importa lo de su lista; theme, config y types los importa cualquiera. Una feature no
 * importa archivos internos de otra (lo que se comparte sube a shared o a domain). domain es puro.
 * Mismas reglas que scripts/check-imports.mjs, que corre sin dependencias.
 */
const capa = (c) => `^src/${c}/`;
const noPuede = (desde, hacia, comentario) => ({
  name: `${desde}-no-importa-${hacia.join('-')}`,
  comment: comentario,
  severity: 'error',
  from: { path: capa(desde) },
  to: { path: `^src/(${hacia.join('|')})/` },
});

module.exports = {
  forbidden: [
    {
      name: 'sin-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
    noPuede('domain', ['app', 'features', 'estado', 'shared', 'data', 'services', 'theme', 'config', 'assets'], 'domain solo importa domain y types.'),
    {
      name: 'domain-sin-paquetes',
      comment: 'domain es puro: sin React, React Native, Expo ni base de datos (se prueba con Node).',
      severity: 'error',
      from: { path: capa('domain') },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'core'], dependencyTypesNot: ['type-only'] },
    },
    noPuede('data', ['app', 'features', 'estado', 'shared', 'services', 'theme'], 'data solo importa domain, config y types.'),
    noPuede('services', ['app', 'features', 'estado', 'shared'], 'services: domain, data, theme, config, types y el mapa de medios.'),
    noPuede('estado', ['app', 'features', 'shared'], 'estado: data, services, domain, theme, config y types.'),
    noPuede('shared', ['app', 'features', 'estado', 'data'], 'shared: services sin estado de pantalla, domain, theme, config y types.'),
    noPuede('features', ['app'], 'features nunca importa app.'),
    noPuede('theme', ['app', 'features', 'estado', 'shared', 'data', 'services', 'domain', 'config'], 'theme solo importa types.'),
    noPuede('config', ['app', 'features', 'estado', 'shared', 'data', 'services', 'domain', 'theme'], 'config solo importa types.'),
    noPuede('types', ['app', 'features', 'estado', 'shared', 'data', 'services', 'domain', 'theme', 'config'], 'types solo importa types.'),
    {
      name: 'features-sin-internos-de-otra',
      comment: 'Una feature no importa archivos internos de otra: lo compartido sube a shared o domain.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/([^/]+)/', pathNot: '^src/features/$1/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '^src/assets/bundled\\.ts$' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
  },
};
