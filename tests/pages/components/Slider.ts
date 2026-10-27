import type { Locator, Page } from '@playwright/test';
import { parseIndianAmount } from '../../support/money';

/**
 * A jQuery UI slider under one of the calculator's text boxes. The widget has
 * no ARIA role or name, so it is found through the text box it controls: the
 * site names the slider "<input id>slider" and its scale "<input id>steps".
 */
export class Slider {
  constructor(
    private readonly page: Page,
    private readonly input: Locator,
  ) {}

  private async parts() {
    const id = await this.input.getAttribute('id');
    return {
      track: this.page.locator(`#${id}slider`),
      handle: this.page.locator(`#${id}slider .ui-slider-handle`),
      scale: this.page.locator(`#${id}steps .marker`),
    };
  }

  /** The current value, read from the text box the slider writes to. */
  async value(): Promise<number> {
    return parseIndianAmount(await this.input.inputValue());
  }

  /**
   * Drags the handle to where `target` sits on the printed scale, then taps the
   * arrow keys until the text box shows exactly `target`. The keyboard step is
   * needed because one pixel of track can cover more than one slider step.
   */
  async dragTo(target: number): Promise<void> {
    const { track, handle, scale } = await this.parts();
    const marks = (await scale.allTextContents()).map(parseIndianAmount);
    const [min, max] = [marks[0], marks[marks.length - 1]];
    if (target < min || target > max) throw new Error(`${target} is outside the slider's range ${min}-${max}`);

    await handle.scrollIntoViewIfNeeded();
    const trackBox = (await track.boundingBox())!;
    const handleBox = (await handle.boundingBox())!;
    await this.page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(trackBox.x + (trackBox.width * (target - min)) / (max - min), trackBox.y + trackBox.height / 2, {
      steps: 10,
    });
    await this.page.mouse.up();

    let previous: number | undefined;
    for (let attempt = 0; attempt < 50; attempt++) {
      const current = await this.value();
      if (current === target) return;
      if (previous !== undefined && Math.sign(target - current) !== Math.sign(target - previous)) {
        throw new Error(`The slider steps over ${target}: it moved from ${previous} to ${current}`);
      }
      previous = current;
      await handle.press(current < target ? 'ArrowRight' : 'ArrowLeft');
    }
    throw new Error(`The slider did not reach ${target}; it shows ${await this.value()}`);
  }
}
