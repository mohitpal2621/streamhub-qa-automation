import fs from 'node:fs';
import path from 'node:path';
import { After, AfterAll, Before, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, request, type Browser } from '@playwright/test';
import { CatalogueApi } from '../api/CatalogueApi';
import { EmiCalculatorPage } from '../pages/EmiCalculatorPage';
import { ensureApiServer, stopApiServer } from './api-server';
import { config } from './config';
import { SqlRunner } from './sql';
import type { TestWorld } from './world';

setDefaultTimeout(config.timeouts.step);

// Ad, analytics and consent hosts that emicalculator.net loads. Blocking them
// keeps the page light and stops late-loading ads from moving the sliders.
const NOISE = /googlesyndication|doubleclick|googletagservices|google-analytics|googletagmanager|adservice|amazon-adsystem|facebook|criteo|taboola|outbrain|pubmatic|adnxs|rubiconproject|quantserve|scorecardresearch|fundingchoices/;

let browser: Browser | undefined;

Before(function (this: TestWorld, { pickle }) {
  this.scenarioName = pickle.name;
});

Before({ tags: '@api' }, async function (this: TestWorld) {
  if (config.api.startServer) await ensureApiServer(config.api.baseUrl);
  const context = await request.newContext({
    baseURL: `${config.api.baseUrl.replace(/\/$/, '')}/`,
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  this.api = new CatalogueApi(context);
});

After({ tags: '@api' }, async function (this: TestWorld, { result }) {
  if (result?.status === Status.FAILED && this.response) {
    this.attach(JSON.stringify(this.response, null, 2), 'application/json');
  }
  await this.api.dispose();
});

Before({ tags: '@ui' }, async function (this: TestWorld) {
  browser ??= await chromium.launch({ headless: config.browser.headless });
  this.context = await browser.newContext({ viewport: config.browser.viewport, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  // tsx compiles with esbuild's keepNames, which wraps inner functions in
  // __name(). Functions passed to page.evaluate run in the browser, where
  // __name does not exist, so give the page a no-op one.
  await this.context.addInitScript({ content: 'window.__name = (fn) => fn;' });
  if (config.browser.blockAds) await this.context.route(NOISE, (route) => route.abort());
  await this.context.tracing.start({ screenshots: true, snapshots: true });
  this.page = await this.context.newPage();
  this.page.setDefaultTimeout(config.timeouts.action);
  this.page.setDefaultNavigationTimeout(config.timeouts.navigation);
  this.emiCalculator = new EmiCalculatorPage(this.page);
});

After({ tags: '@ui' }, async function (this: TestWorld, { result }) {
  const failed = result?.status === Status.FAILED;
  if (failed) {
    await this.screenshot('failure').catch(() => undefined);
    const tracePath = path.join(this.parameters.reportDir, 'traces', `${this.scenarioName.replace(/[^\w-]+/g, '_')}.zip`);
    fs.mkdirSync(path.dirname(tracePath), { recursive: true });
    await this.context.tracing.stop({ path: tracePath });
    this.attach(`Playwright trace: ${tracePath} (open with: npx playwright show-trace ${tracePath})`);
  } else {
    await this.context.tracing.stop();
  }
  await this.context.close();
});

Before({ tags: '@sql' }, async function (this: TestWorld) {
  this.sql = await SqlRunner.start();
});

After({ tags: '@sql' }, async function (this: TestWorld) {
  await this.sql.close();
});

AfterAll(async function () {
  await browser?.close();
  await stopApiServer();
});
