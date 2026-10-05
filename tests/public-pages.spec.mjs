import { test, expect } from '@playwright/test';

test('Help Center opens on the current page and closes accessibly', async ({ page }, info) => {
  for (const [index, path] of ['index','join','about','events','projects','team','privacy','cookies','terms'].entries()) {
    await page.setViewportSize(index % 2 ? {width:375,height:812} : {width:1440,height:1000});
    await page.goto(`/${path}.html`);
    const url = page.url();
    const trigger = page.getByRole('button', {name:'Help Center',exact:true});
    await trigger.click();
    const banner = page.getByRole('dialog', {name:'Contact Team SAC'});
    await expect(banner).toBeVisible();
    await expect(banner.getByText('info@saclub.tech', {exact:true})).toBeVisible();
    await expect(banner.getByRole('link', {name:'info@saclub.tech',exact:true})).toHaveAttribute('href', 'mailto:info@saclub.tech');
    await expect(page).toHaveURL(url);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const box = await banner.boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    if (path==='index' || path==='join') await page.screenshot({path:info.outputPath(`help-${path}.png`)});
    if (index % 2) await banner.getByRole('button', {name:'Close Help Center'}).click();
    else await page.keyboard.press('Escape');
    await expect(banner).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await page.mouse.click(5,5);
    await expect(banner).not.toBeVisible();
    await expect(page).toHaveURL(url);
  }
});

test('policy links work and policy pages fit mobile screens', async ({ page }) => {
  await page.goto('/index.html');
  const footer = page.locator('footer.site-footer');
  await expect(footer.getByRole('button', { name: 'Help Center', exact: true })).toBeVisible();
  for (const [label, path] of [['Privacy Policy','privacy'],['Cookie Policy','cookies'],['Terms of Service','terms']]) {
    await expect(footer.getByRole('link', { name: label })).toHaveAttribute('href', `${path}.html`);
  }
  await page.setViewportSize({width:375,height:812});
  for (const [label, path] of [['Privacy Policy','privacy'],['Cookie Policy','cookies'],['Terms of Service','terms']]) {
    const response = await page.goto(`/${path}.html`);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', {level:1})).toHaveText(label);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://saclub.tech/${path}.html`);
  }
});

test('public SEO assets identify the club in Dwarahat and exclude member portals from sitemap', async ({ page, request }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle('Sensing and Automation Club, Dwarahat');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://saclub.tech/index.html');
  const club = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(club.url).toBe('https://saclub.tech/index.html');
  expect(club.alternateName).toContain('SAC Dwarahat');
  expect(club.address.addressLocality).toBe('Dwarahat');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('https://saclub.tech/privacy.html');
  expect(await sitemap.text()).toContain('<loc>https://saclub.tech/index.html</loc>');
  expect(await sitemap.text()).not.toMatch(/account|admin/);
  for(const path of ['account','admin']){
    await page.goto(`/${path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
});
