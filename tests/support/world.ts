import fs from 'node:fs';
import path from 'node:path';
import { World, setWorldConstructor } from '@cucumber/cucumber';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import type { ApiCall, CatalogueApi } from '../api/CatalogueApi';
import type { BrittleEmiCalculatorPage } from '../pages/BrittleEmiCalculatorPage';
import type { LoanInput, LoanProduct } from '../pages/components/LoanForm';
import type { EmiCalculatorPage } from '../pages/EmiCalculatorPage';
import type { SelfHealing } from '../self-healing/SelfHealing';
import type { QueryResult, SqlRunner } from './sql';

export interface WorldParameters {
  /** Folder for screenshots and other evidence, set per profile in cucumber.js. */
  reportDir: string;
  /** Self-healing demo only: lets broken locators be repaired while the test runs. */
  healing?: boolean;
  /** Self-healing demo only: "heuristic" (offline) or "claude". */
  healer?: 'heuristic' | 'claude';
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export class TestWorld extends World<WorldParameters> {
  scenarioName = '';

  api!: CatalogueApi;
  response?: ApiCall;
  collected?: unknown[];

  context!: BrowserContext;
  page!: Page;
  emiCalculator!: EmiCalculatorPage;
  product?: LoanProduct;
  loan?: LoanInput;
  scheduleStart?: { year: number; month: number };

  healing!: SelfHealing;
  brittlePage!: BrittleEmiCalculatorPage;
  brittleLoan: Partial<LoanInput> = {};

  sql!: SqlRunner;
  queryResult?: QueryResult;
  correctResult?: QueryResult;

  get lastResponse(): ApiCall {
    if (!this.response) throw new Error('No request has been sent in this scenario yet');
    return this.response;
  }

  /** Saves a PNG under reports/<suite>/screenshots and embeds it in the HTML report. */
  async screenshot(label: string, target: Page | Locator = this.page): Promise<void> {
    const image = await target.screenshot();
    const file = path.join(this.parameters.reportDir, 'screenshots', `${slug(this.scenarioName)}--${slug(label)}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, image);
    this.attach(image, { mediaType: 'image/png', fileName: path.basename(file) });
  }
}

setWorldConstructor(TestWorld);
