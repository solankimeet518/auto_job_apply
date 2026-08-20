import { launchBrowser } from './browserLauncher.js';

async function main() {
  try {
    const { context, page } = await launchBrowser();
    console.log('✅ Browser launched successfully!');

    const targetUrl = 'https://smartapply.indeed.com/beta/indeedapply/applybyapplyablejobid?indeedApplyableJobId=7c106752-35e1-4ba9-96a8-fe0d8fc5d908-ZnJhcHJvZDE&iaUid=1jsednulehmet800';
    console.log(`🌐 Navigating directly to: ${targetUrl}`);
    await page.goto(targetUrl);

    // Wait for page load
    console.log('⏳ Waiting for page to load (networkidle)...');
    await page.waitForLoadState('networkidle').catch(() => { });
    await page.waitForTimeout(4000);

    console.log('👀 Scanning and extracting all button elements on page...');
    const buttons = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"]'));
      return items.map(el => ({
        tagName: el.tagName,
        outerHTML: el.outerHTML.substring(0, 400),
        text: el.innerText.trim(),
        id: el.id,
        testid: el.getAttribute('data-testid'),
        className: el.className,
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true'
      }));
    });

    console.log('\n📋 --- BUTTONS DETECTED ---');
    console.log(JSON.stringify(buttons, null, 2));
    console.log('---------------------------\n');

    console.log('⏳ Browser is kept OPEN for 5 minutes in UI mode.');
    console.log('👉 Please inspect the page or check the button directly in the browser window!');

    // Hold open for 5 minutes
    await new Promise(resolve => setTimeout(resolve, 300000));

    await context.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
