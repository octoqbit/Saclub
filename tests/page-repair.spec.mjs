import { test, expect } from '@playwright/test';

const triggerName = 'Break the page and let the robot repair it';
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('sac_booted', 'true'));
});

for (const mobile of [false, true]) {
    test(`robot visibly repairs the actual page and restores it on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
        test.setTimeout(100000);
        if (mobile) await page.setViewportSize({ width: 390, height: 844 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/index.html');
        const trigger = page.getByRole('button', { name: triggerName });
        await expect(trigger).toBeVisible();
        await page.evaluate(() => { window.originalPage = document.querySelector('.page-wrapper'); });
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toHaveAttribute('data-phase', 'assessment');
        await expect(dialog.locator('.repair-shard')).toHaveCount(24);
        await expect(dialog.locator('.repair-shards iframe')).toHaveCount(0);
        await expect(dialog.locator('.repair-shards [id]')).toHaveCount(0);
        await page.screenshot({ path: info.outputPath('broken.png') });
        await expect(dialog).toHaveAttribute('data-phase', 'repairing', { timeout: 10000 });
        await expect(dialog.locator('.is-welding').first()).toBeVisible({ timeout: 10000 });
        await expect(dialog.locator('.repair-seam')).toHaveAttribute('visibility', 'visible');
        const bubble = await dialog.locator('.repair-thought').boundingBox();
        expect(bubble.x).toBeGreaterThanOrEqual(0);
        expect(bubble.x + bubble.width).toBeLessThanOrEqual(page.viewportSize().width);
        await page.screenshot({ path: info.outputPath('repairing.png') });
        const mute = dialog.getByRole('button', { name: /Sound:/ });
        await mute.click();
        await expect(mute).toHaveAttribute('aria-pressed', 'true');
        await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '24', { timeout: 75000 });
        await expect(dialog).toHaveAttribute('data-phase', 'complete', { timeout: 6000 });
        await expect(dialog.getByRole('heading')).toHaveText('All fixed. We’re back.');
        await expect(dialog).toHaveCount(0, { timeout: 6000 });
        await expect(trigger).toBeFocused();
        if (!mobile) await expect(page.locator('.cursor-robo')).toBeVisible();
        expect(await page.evaluate(() => window.originalPage === document.querySelector('.page-wrapper'))).toBe(true);
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('.page-wrapper')).visibility)).toBe('visible');
        expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
        expect(errors).toEqual([]);
    });
}

test('skip, Escape, resize, and repeated activation restore usable content', async ({ page }) => {
    await page.goto('/index.html');
    const trigger = page.getByRole('button', { name: triggerName });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Skip & restore ↗' }).click();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await trigger.click();
    await page.setViewportSize({ width: 800, height: 700 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeVisible();
    const menu = page.getByRole('button', { name: 'Open navigation' });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page).toHaveURL(/about\.html$/);
});

test('reduced motion and unavailable WebGL still complete the repair', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
        };
    });
    await page.goto('/index.html');
    await page.getByRole('button', { name: triggerName }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('data-phase', 'repairing');
    await expect(dialog.locator('.repair-fallback')).toBeVisible();
    await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '24', { timeout: 20000 });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: triggerName })).toBeFocused();
});

test('cursor robot waits with a translucent thought and chases again when the cursor returns', async ({ page }, info) => {
    await page.goto('/index.html');
    await page.mouse.move(700, 30);
    const robot = page.locator('.cursor-robo');
    await expect(robot).toBeVisible();
    await expect(robot).toHaveAttribute('data-state', 'waiting', { timeout: 18000 });
    await expect(robot.locator('.cursor-robo-thought')).toHaveText('!!!');
    await expect(robot.locator('.cursor-robo-thought')).toBeVisible();
    await page.screenshot({ path: info.outputPath('waiting-robot.png') });
    const box = await robot.boundingBox();
    await page.mouse.move(Math.min(1350, box.x + 190), box.y + 100);
    await expect(robot.locator('.cursor-robo-thought')).toBeHidden();
    await expect(robot).not.toHaveAttribute('data-state', 'waiting');
});
