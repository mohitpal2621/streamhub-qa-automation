import { expect, type Locator, type Page } from '@playwright/test';

/** The "Schedule showing EMI payments starting from" field and its month calendar. */
export class MonthPicker {
  readonly input: Locator;
  private readonly calendar: Locator;

  constructor(page: Page) {
    this.input = page.getByLabel('Schedule showing EMI payments starting from');
    // The bootstrap-datepicker widget has no roles; its month grid is the visible .datepicker-months panel.
    this.calendar = page.locator('.datepicker-months');
  }

  /** Opens the calendar, steps to `year` with the « » arrows and clicks `month` ("Jan" to "Dec"). */
  async choose(month: string, year: number): Promise<void> {
    await this.input.click();
    await expect(this.calendar).toBeVisible();
    const shownYear = this.calendar.locator('.datepicker-switch');

    for (let clicks = 0; clicks < 30; clicks++) {
      const shown = Number(await shownYear.textContent());
      if (shown === year) break;
      await this.calendar.getByText(shown < year ? '»' : '«', { exact: true }).click();
      await expect(shownYear).not.toHaveText(String(shown));
    }
    await expect(shownYear).toHaveText(String(year));
    await this.calendar.getByText(month, { exact: true }).click();
    await expect(this.input).toHaveValue(`${month} ${year}`);
  }
}
