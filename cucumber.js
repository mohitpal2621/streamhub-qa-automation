// Cucumber profiles. Each suite writes its own reports under reports/<suite>/:
// an HTML report, Cucumber JSON, JUnit XML and the console output.

const common = {
  requireModule: ['tsx/cjs'],
  require: ['tests/support/**/*.ts', 'tests/steps/**/*.ts'],
  formatOptions: { snippetInterface: 'async-await' },
};

function suite(name, features, extra = {}) {
  const dir = `reports/${name}`;
  return {
    ...common,
    paths: [`tests/features/${features}`],
    format: [
      'progress-bar',
      `html:${dir}/cucumber-report.html`,
      `json:${dir}/cucumber-report.json`,
      `junit:${dir}/junit.xml`,
      `pretty:${dir}/console.txt`,
    ],
    ...extra,
    worldParameters: { reportDir: dir, ...extra.worldParameters },
  };
}

module.exports = {
  default: suite('all', '**/*.feature', { tags: 'not @self-healing' }),
  api: suite('api', 'api/**/*.feature'),
  sql: suite('sql', 'sql/**/*.feature'),
  // emicalculator.net is a live third-party site, so a scenario that fails on a
  // network hiccup gets one more attempt. The retry is visible in the report.
  ui: suite('ui', 'ui/**/*.feature', { retry: 1 }),
  // The self-healing demo: as written (the brittle locators fail), then with
  // run-time healing by the offline heuristic healer or by Claude.
  healing_off: suite('self-healing/healing-off', 'self-healing/**/*.feature', { worldParameters: { healing: false } }),
  healing: suite('self-healing/healing-on', 'self-healing/**/*.feature', {
    worldParameters: { healing: true, healer: 'heuristic' },
  }),
  healing_claude: suite('self-healing/healing-on-claude', 'self-healing/**/*.feature', {
    worldParameters: { healing: true, healer: 'claude' },
  }),
};
