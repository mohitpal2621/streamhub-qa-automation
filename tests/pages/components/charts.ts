import type { Locator, Page } from '@playwright/test';

export interface ChartPoint {
  name: string;
  value: number;
  percentage?: number;
}

/**
 * Reads the series behind a Highcharts chart through the page's Highcharts
 * object. The SVG only shows rounded labels; this returns the numbers they were
 * drawn from, which the steps use as a second source next to the visible text.
 */
async function seriesData(container: Locator, seriesName?: string): Promise<ChartPoint[]> {
  return container.evaluate((element, name) => {
    type Point = { name?: string; category?: string | number; y: number; percentage?: number };
    type Chart = { renderTo: Element; series: { name: string; points: Point[] }[] };
    const charts = (window as unknown as { Highcharts: { charts: (Chart | undefined)[] } }).Highcharts.charts;
    const chart = charts.find((c) => c?.renderTo === element);
    if (!chart) throw new Error('No Highcharts chart is drawn in this container');
    const series = name ? chart.series.find((s) => s.name === name) : chart.series[0];
    if (!series) throw new Error(`The chart has no series named ${name}`);
    return series.points.map((p) => ({ name: String(p.name ?? p.category), value: p.y, percentage: p.percentage }));
  }, seriesName);
}

/**
 * Highcharts animates every redraw: bars grow, the pie sweeps round and labels
 * fade in. This resolves once the chart's SVG has been unchanged for ten
 * animation frames in a row, so screenshots and reads see the final chart.
 */
function settled(container: Locator): Promise<void> {
  return container.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        let last = '';
        let stillFrames = 0;
        let frames = 0;
        const check = () => {
          const now = element.querySelector('svg')?.innerHTML ?? '';
          stillFrames = now === last ? stillFrames + 1 : 0;
          last = now;
          if (stillFrames >= 10 || ++frames > 600) resolve();
          else requestAnimationFrame(check);
        };
        check();
      }),
  );
}

export class PieChart {
  readonly container: Locator;

  constructor(page: Page) {
    this.container = page.locator('#emipiechart');
  }

  settled(): Promise<void> {
    return settled(this.container);
  }

  get title(): Locator {
    return this.container.locator('.highcharts-title');
  }

  /** The drawn slices, scoped to the plot so the legend's colour swatches are not counted. */
  get slices(): Locator {
    return this.container.locator('.highcharts-series-group .highcharts-point');
  }

  /** Each slice with its visible percentage label and the value behind it. */
  async sections(): Promise<(ChartPoint & { label: string })[]> {
    const points = await seriesData(this.container);
    return Promise.all(
      points.map(async (point, index) => ({
        ...point,
        label: (await this.container.locator(`.highcharts-data-label-color-${index}`).textContent()) ?? '',
      })),
    );
  }
}

export interface Tooltip {
  heading: string;
  values: Record<string, string>;
}

export class BarChart {
  readonly container: Locator;

  constructor(page: Page) {
    this.container = page.locator('#emibarchart');
  }

  settled(): Promise<void> {
    return settled(this.container);
  }

  get yearLabels(): Locator {
    return this.container.locator('.highcharts-xaxis-labels text');
  }

  get tooltip(): Locator {
    return this.container.locator('.highcharts-tooltip');
  }

  /**
   * Bars of one series ("Principal" or "Interest"). The series is found by its
   * legend entry rather than by assuming an order. The selector is scoped to
   * the plot area: the legend swatch carries the same classes as the bars and
   * would otherwise be counted as one more bar.
   */
  async bars(seriesName: string): Promise<Locator> {
    const legendEntry = this.container.locator('.highcharts-legend-item').filter({ hasText: seriesName });
    const classes = (await legendEntry.getAttribute('class')) ?? '';
    const index = /highcharts-series-(\d+)/.exec(classes)?.[1];
    if (index === undefined) throw new Error(`No legend entry for the ${seriesName} series`);
    return this.container.locator(`.highcharts-series-group .highcharts-series-${index} .highcharts-point`);
  }

  async values(seriesName: string): Promise<ChartPoint[]> {
    return seriesData(this.container, seriesName);
  }

  /**
   * Hovers the bar segment of `seriesName` for `year` and returns the tooltip.
   * The balance line has a wide invisible hover band that covers parts of some
   * bars, so this tries a few heights on the bar until it finds a spot where the
   * bar itself receives the mouse.
   */
  async hover(seriesName: string, year: number): Promise<Tooltip> {
    const years = (await this.yearLabels.allTextContents()).map(Number);
    const index = years.indexOf(year);
    if (index < 0) throw new Error(`The chart has no bar for ${year}; it shows ${years.join(', ')}`);
    const bar = (await this.bars(seriesName)).nth(index);
    await bar.scrollIntoViewIfNeeded();
    await this.settled();
    const box = (await bar.boundingBox())!;

    for (const height of [0.5, 0.25, 0.75, 0.1, 0.9]) {
      const position = { x: box.width / 2, y: box.height * height };
      try {
        await bar.hover({ position, trial: true, timeout: 500 });
      } catch {
        continue;
      }
      await bar.hover({ position });
      await this.tooltip.filter({ hasText: `Year : ${year}` }).filter({ hasText: seriesName }).waitFor();
      return this.readTooltip();
    }
    throw new Error(`Another chart element covers the whole ${seriesName} bar for ${year}`);
  }

  /** Splits lines such as "Principal : ₹ 1,66,492" into { Principal: "₹ 1,66,492" }. */
  private async readTooltip(): Promise<Tooltip> {
    const [heading, ...lines] = await this.tooltip.locator('tspan').allTextContents();
    const values = Object.fromEntries(lines.map((line) => line.split(' : ').map((part) => part.trim())));
    return { heading: heading.trim(), values };
  }
}
