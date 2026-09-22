import {test as base, expect} from '@playwright/test';

export const FINALE_DISMISSAL_KEY = 'htlgi:festival-finale:2026:dismissed';

// Programme tests begin after the visitor has dismissed the festival message.
// finale.spec.js uses the unextended fixture to cover that first-visit experience.
export const test = base.extend({
  page: async ({page}, use) => {
    await page.addInitScript(key => sessionStorage.setItem(key, '1'), FINALE_DISMISSAL_KEY);
    await use(page);
  },
});

export {expect};
