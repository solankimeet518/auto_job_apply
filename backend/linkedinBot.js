import { launchBrowser } from './browserLauncher.js';
import { generateLinkedInNote } from './queryEngine.js';
import fs from 'fs';
import path from 'path';

// Global state for LinkedIn Bot
export let linkedinBotState = {
  status: 'idle', // 'idle' | 'running' | 'paused_login' | 'completed' | 'error'
  logs: [],
  stats: {
    visited: 0,
    sent: 0,
    skipped: 0,
    currentPage: 1,
  },
  config: {
    keywords: 'Software Engineer Recruiter',
    location: '',
    network2nd: true,
    network3rd: true,
    verifiedOnly: false,
    maxInvites: 25,
    customTemplate: '',
  },
};

let isLinkedInLoopActive = false;
let activeBrowserContext = null;

export function logLinkedInActivity(message) {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = `[${timestamp}] ${message}`;
  console.log(formattedLog);
  linkedinBotState.logs.push(formattedLog);
  if (linkedinBotState.logs.length > 500) {
    linkedinBotState.logs.shift();
  }
}

/**
 * Checks if the user is currently authenticated on LinkedIn.
 * If not, pauses and waits for user to log in via the Chromium window.
 */
async function checkLinkedInLogin(page) {
  logLinkedInActivity('🔍 Verifying LinkedIn authentication session...');
  
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);

  let isPaused = false;
  while (true) {
    if (linkedinBotState.status === 'idle') return false;

    const isLoggedIn = await page.evaluate(() => {
      const globalNav = document.querySelector('#global-nav, .global-nav__me, .feed-identity-module, a[href*="/in/me"]');
      const isLoginOrAuth = window.location.href.includes('/login') || 
                            window.location.href.includes('/checkpoint') || 
                            window.location.href.includes('/authwall') ||
                            window.location.href.includes('/signup');
      return !!globalNav && !isLoginOrAuth;
    }).catch(() => false);

    if (isLoggedIn) {
      if (isPaused) {
        logLinkedInActivity('🔓 LinkedIn login verified! Resuming automation loop.');
        linkedinBotState.status = 'running';
      } else {
        logLinkedInActivity('✅ LinkedIn session active.');
      }
      return true;
    }

    if (!isPaused) {
      logLinkedInActivity('⚠️ Not logged into LinkedIn!');
      logLinkedInActivity('🔒 Bot is PAUSED. Please log in to LinkedIn in the Chromium browser window.');
      linkedinBotState.status = 'paused_login';
      isPaused = true;
    }

    await page.waitForTimeout(3000);
  }
}

/**
 * Simple "Show results" click: strictly triggers React in-page filter update without full href redirect.
 */
async function clickShowResults(page, contextLabel = '') {
  try {
    const link = await page.$(
      'div.artdeco-dropdown__content--is-open a:has-text("Show results"), ' +
      'div.artdeco-dropdown__content--is-open button:has-text("Show results"), ' +
      'a:has-text("Show results"):visible, button:has-text("Show results"):visible'
    );

    if (link) {
      logLinkedInActivity(`👉 Clicking "Show results"${contextLabel ? ` (${contextLabel})` : ''}...`);
      await link.scrollIntoViewIfNeeded().catch(() => {});
      
      // Use Playwright genuine user click so React's onClick handler intercepts with preventDefault()
      await link.click({ timeout: 5000 }).catch(async () => {
        // Fallback: dispatch MouseEvent with bubbles: true so React catches it without anchor navigation
        await link.evaluate(node => {
          const event = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          node.dispatchEvent(event);
        }).catch(() => {});
      });

      logLinkedInActivity('⏳ Waiting for in-page filtered results to update...');
      await page.waitForTimeout(6000);
      return true;
    } else {
      logLinkedInActivity(`⚠️ Notice: "Show results" element not found.`);
    }
  } catch (err) {
    logLinkedInActivity(`⚠️ Notice: Click "Show results" error: ${err.message}`);
  }
  return false;
}

/**
 * Performs interactive search from home feed and applies People, Location, Connections, and Verified filters.
 */
async function applySearchAndFilters(page, config, profileData = {}) {
  const keywords = config.keywords || 'Software Engineer Recruiter';
  logLinkedInActivity(`🌐 Navigating to LinkedIn Home Feed...`);

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);

  // 1. Search input on top nav bar
  logLinkedInActivity(`✍️ Typing search query: "${keywords}" into search input...`);
  const searchInput = await page.$('input[data-testid="typeahead-input"], input.search-global-typeahead__input, input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.click().catch(() => {});
    await searchInput.fill(keywords);
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter');
    logLinkedInActivity('🔍 Pressed Enter on search input. Waiting for results...');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    // Fallback direct search if top nav input is not found
    logLinkedInActivity(`ℹ️ Typeahead input not found directly. Navigating to search results...`);
    await page.goto(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(keywords)}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // 2. Click on label/button with text 'People'
  logLinkedInActivity(`👥 Selecting "People" filter button/label...`);
  await page.waitForSelector('button:has-text("People"), label:has-text("People"), a:has-text("People"), ul.search-reusables__pill-filter-list li button:has-text("People")', { timeout: 8000 }).catch(() => {});
  const peopleFilter = await page.$('button:has-text("People"), label:has-text("People"), a:has-text("People"), ul.search-reusables__pill-filter-list li button:has-text("People")');
  if (peopleFilter) {
    await peopleFilter.click().catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForSelector('div[role="list"], ul[role="list"], .search-results-container, button:has-text("Locations")', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    logLinkedInActivity('✅ Switched to "People" search view.');
  }

  // 3. Apply Location Filter from config or profile targetLocations
  const targetLocation = (config.location && config.location.trim().length > 0)
    ? config.location.trim()
    : (profileData?.targetLocations?.[0] || profileData?.targetLocation || '');

  if (targetLocation && targetLocation.length > 0) {
    try {
      logLinkedInActivity(`📍 Opening Location filter for target location: "${targetLocation}"...`);
      const locBtn = await page.$(
        'button:has-text("Locations"), button:has-text("Location"), ' +
        'label:has-text("Locations"), label:has-text("Location"), ' +
        'button[aria-label*="Locations filter"], button[aria-label*="Location filter"]'
      );

      if (locBtn) {
        await locBtn.click().catch(() => {});
        await page.waitForTimeout(1500);

        // Search location in input with placeholder="Add a location"
        const locInput = await page.$(
          'input[data-testid="typeahead-input"][placeholder*="Add a location"], ' +
          'input[placeholder*="Add a location"], input[aria-label*="Add a location"], ' +
          'div.artdeco-dropdown__content--is-open input'
        );

        if (locInput) {
          await locInput.click().catch(() => {});
          await locInput.fill(targetLocation);
          await page.waitForTimeout(1500);

          // Select first suggestion option
          const firstOption = await page.$(
            'div[role="listbox"] div[role="option"], ' +
            '.basic-typeahead__selectable-list li, ' +
            'div.basic-typeahead__selectable, ' +
            '.search-typeahead-v2__hit, ' +
            'div.artdeco-dropdown__content--is-open [role="option"]'
          );

          if (firstOption) {
            logLinkedInActivity(`👉 Selecting location suggestion option...`);
            await firstOption.click().catch(() => {});
            await page.waitForTimeout(1500);
          } else {
            await page.keyboard.press('ArrowDown').catch(() => {});
            await page.keyboard.press('Enter').catch(() => {});
            await page.waitForTimeout(1500);
          }
        }

        // Click strictly the "Show results" link/button
        await clickShowResults(page, 'Location filter');
      }
    } catch (locErr) {
      logLinkedInActivity(`⚠️ Notice: Location filter step bypassed: ${locErr.message}`);
    }
  }

  // 4. Connections Network Filter (click label '2nd' and label '3rd+')
  try {
    const apply2nd = config.network2nd !== false;
    const apply3rd = config.network3rd !== false;

    if (apply2nd || apply3rd) {
      logLinkedInActivity(`🔗 Applying Connection filters (${apply2nd ? '"2nd" ' : ''}${apply3rd ? '"3rd+"' : ''})...`);
      
      // Check if Connections dropdown button needs to be opened
      const connBtn = await page.$('button:has-text("Connections"), button[aria-label*="Connections filter"]');
      if (connBtn) {
        await connBtn.click().catch(() => {});
        await page.waitForTimeout(1200);
      }

      // Click label with text '2nd'
      if (apply2nd) {
        const label2nd = await page.$('label:has-text("2nd"), span:has-text("2nd"), button:has-text("2nd")');
        if (label2nd) {
          logLinkedInActivity('👉 Clicking label "2nd"...');
          await label2nd.click().catch(() => {});
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForTimeout(1500);
        }
      }

      // Click label with text '3rd+' or '3rd'
      if (apply3rd) {
        const label3rd = await page.$(
          'label:has-text("3rd+"), label:has-text("3rd"), ' +
          'span:has-text("3rd+"), span:has-text("3rd"), ' +
          'button:has-text("3rd+"), button:has-text("3rd")'
        );
        if (label3rd) {
          logLinkedInActivity('👉 Clicking label "3rd+" / "3rd"...');
          await label3rd.click().catch(() => {});
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForTimeout(1500);
        }
      }

      // If dropdown opened with "Show results", click it
      await clickShowResults(page, 'Connections filter');
    }
  } catch (connErr) {
    logLinkedInActivity(`⚠️ Notice: Connections filter step bypassed: ${connErr.message}`);
  }

  // 5. Verified Filter (click label/button with text 'Verified')
  try {
    logLinkedInActivity('🛡️ Checking for "Verified" filter...');
    let verifiedEl = await page.$('label:has-text("Verified"), button:has-text("Verified"), span:has-text("Verified")');
    
    if (!verifiedEl) {
      // Check inside "All filters" if not visible directly in top filter pills
      const allFiltersBtn = await page.$('button:has-text("All filters"), button[aria-label*="all filters"]');
      if (allFiltersBtn) {
        await allFiltersBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
        verifiedEl = await page.$('label:has-text("Verified"), span:has-text("Verified")');
      }
    }

    if (verifiedEl) {
      logLinkedInActivity('👉 Clicking "Verified" filter...');
      await verifiedEl.click().catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1500);

      // Click "Show results" if inside modal or dropdown
      await clickShowResults(page, 'Verified filter');
    }
  } catch (verErr) {
    logLinkedInActivity(`⚠️ Notice: Verified filter step bypassed: ${verErr.message}`);
  }

  // 6. Wait for skeleton loading state to resolve and real search result cards to render
  logLinkedInActivity('⏳ Waiting for search results to load and skeleton animations to complete...');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForSelector('div[role="list"] [role="listitem"], [role="listitem"], .reusable-search__result-container, .entity-result', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Scroll down slightly to trigger lazy card rendering
  await page.evaluate(() => window.scrollBy(0, 400)).catch(() => {});
  await page.waitForTimeout(1500);
  logLinkedInActivity('📋 Filters applied successfully. Ready to extract people profiles.');
}

/**
 * Scans the current search results page for people profiles using [role="list"] and [role="listitem"].
 */
async function getPeopleFromSearchPage(page) {
  return await page.evaluate(() => {
    const results = [];

    // 1. Locate the people list container with role="list"
    const listContainer = document.querySelector('div[role="list"], ul[role="list"], .search-results-container [role="list"]');

    // 2. Query all items with role="listitem"
    let items = [];
    if (listContainer) {
      items = Array.from(listContainer.querySelectorAll('[role="listitem"]'));
    }
    if (items.length === 0) {
      items = Array.from(document.querySelectorAll('[role="listitem"], .entity-result, li.reusable-search__result-container'));
    }

    items.forEach(card => {
      // Find profile link
      const linkEl = card.querySelector('a.app-aware-link[href*="/in/"], a[href*="/in/"]');
      if (!linkEl) return;

      let href = linkEl.getAttribute('href') || '';
      if (href.includes('?')) {
        href = href.split('?')[0];
      }

      // Extract Name
      const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"], .entity-result__title-text a, a.app-aware-link span[aria-hidden="true"]');
      let name = nameEl ? nameEl.innerText.trim() : '';
      if (!name && linkEl) {
        name = linkEl.innerText.split('\n')[0].trim();
      }

      // Extract Headline/Role
      const headlineEl = card.querySelector('.entity-result__primary-subtitle, div.t-14.t-black');
      const headline = headlineEl ? headlineEl.innerText.trim() : '';

      // Extract Location
      const locationEl = card.querySelector('.entity-result__secondary-subtitle, div.t-14.t-black--light');
      const location = locationEl ? locationEl.innerText.trim() : '';

      // Check if action button on card already indicates Pending invitation
      const actionBtn = card.querySelector('button, a.artdeco-button, a');
      const actionText = actionBtn ? (actionBtn.innerText || '').trim().toLowerCase() : '';
      const actionAria = actionBtn ? (actionBtn.getAttribute('aria-label') || '').toLowerCase() : '';
      const isCardPending = actionText === 'pending' || actionAria.includes('withdraw') || actionAria.includes('pending');

      if (name && name !== 'LinkedIn Member' && href) {
        results.push({
          url: href,
          name,
          headline,
          location,
          isPending: isCardPending,
        });
      }
    });

    return results;
  });
}

/**
 * Opens a profile in a new tab, locates the Connect button (checking More dropdown if needed),
 * opens the note modal, fills in the generated note, and sends the connection request.
 */
async function processProfileConnection(context, person, config, profileData) {
  logLinkedInActivity(`👤 Processing: ${person.name} (${person.headline || 'Professional'})`);

  if (person.isPending) {
    logLinkedInActivity(`ℹ️ Connection request is already sent / pending for ${person.name} ("Pending, click to withdraw invitation"). Skipping.`);
    linkedinBotState.stats.skipped++;
    return false;
  }

  let profilePage = null;
  try {
    profilePage = await context.newPage();
    profilePage.setDefaultTimeout(20000);

    await profilePage.goto(person.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await profilePage.waitForTimeout(3000);

    // 0. Check if connection request is already pending ("Pending, click to withdraw invitation")
    const pendingEl = await profilePage.$(
      'main a[aria-label*="Pending"], main button[aria-label*="Pending"], ' +
      'main a:has-text("Pending"), main button:has-text("Pending"), ' +
      'div.ph5 [aria-label*="withdraw invitation"], .pv-top-card [aria-label*="withdraw invitation"], ' +
      '[aria-label*="click to withdraw"], [aria-label*="Pending"]'
    );

    const isPending = pendingEl ? await pendingEl.evaluate(el => {
      const text = (el.innerText || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      return isVisible && (text.includes('pending') || aria.includes('withdraw') || aria.includes('pending'));
    }).catch(() => false) : false;

    if (isPending) {
      logLinkedInActivity(`ℹ️ Connection request is already sent / pending for ${person.name} ("Pending, click to withdraw invitation"). Skipping.`);
      linkedinBotState.stats.skipped++;
      await profilePage.close().catch(() => {});
      return false;
    }

    // 1. Check for primary Connect button/link on profile top card (strictly excluding mutual and pending links)
    let connectBtn = null;
    const candidates = await profilePage.$$(
      'main a.artdeco-button, main button.artdeco-button, ' +
      '.pv-top-card a, .pv-top-card button, ' +
      '.pvs-profile-actions a, .pvs-profile-actions button, ' +
      'div.ph5 a.artdeco-button, div.ph5 button.artdeco-button, ' +
      'a[aria-label*="Invite"], button[aria-label*="Invite"]'
    );

    for (const el of candidates) {
      const match = await el.evaluate(node => {
        const text = (node.innerText || '').trim();
        const ariaLabel = (node.getAttribute('aria-label') || '').trim().toLowerCase();
        const textLower = text.toLowerCase();
        
        // Strict exclusion of mutual connection text links or connection count links
        if (textLower.includes('mutual') || textLower.includes('connections') || ariaLabel.includes('mutual')) {
          return false;
        }

        // Strict exclusion of pending / withdraw invitation links
        if (textLower.includes('pending') || textLower.includes('withdraw') || ariaLabel.includes('withdraw') || ariaLabel.includes('pending')) {
          return false;
        }

        // Must be an action button/link with "Connect" or "Invite ... to connect"
        const isActionConnect = text === 'Connect' || 
                                (textLower.startsWith('connect') && !textLower.includes('connection')) ||
                                (ariaLabel.includes('invite') && ariaLabel.includes('connect')) ||
                                (ariaLabel.includes('to connect') && !ariaLabel.includes('mutual'));

        const isVisible = node.offsetWidth > 0 && node.offsetHeight > 0;
        return isActionConnect && isVisible;
      }).catch(() => false);

      if (match) {
        connectBtn = el;
        break;
      }
    }
    
    // 2. If not found directly, check the "More" dropdown
    if (!connectBtn) {
      logLinkedInActivity(`🔍 Direct Connect button/link not visible for ${person.name}. Checking "More" dropdown...`);
      const moreBtn = await profilePage.$(
        'main button[aria-label*="More actions"], main button:has-text("More"), ' +
        'div.ph5 button:has-text("More"), .pv-top-card button:has-text("More"), ' +
        '.pvs-profile-actions button:has-text("More"), button[aria-label*="More"]'
      );
      
      if (moreBtn) {
        await moreBtn.scrollIntoViewIfNeeded().catch(() => {});
        await moreBtn.click().catch(() => {});
        await profilePage.waitForTimeout(1200);

        // Find "Connect" inside the opened dropdown menu (excluding mutual links)
        const dropdownCandidates = await profilePage.$$(
          '.artdeco-dropdown__content--is-open a, ' +
          '.artdeco-dropdown__content--is-open div[role="button"], ' +
          '.artdeco-dropdown__content--is-open div.artdeco-dropdown__item, ' +
          '.artdeco-dropdown__content--is-open li, ' +
          'div[role="menu"] a, div[role="menu"] div[role="menuitem"], div[role="menu"] [role="button"]'
        );

        for (const item of dropdownCandidates) {
          const isItemConnect = await item.evaluate(node => {
            const text = (node.innerText || '').trim();
            const ariaLabel = (node.getAttribute('aria-label') || '').trim().toLowerCase();
            const textLower = text.toLowerCase();
            
            if (textLower.includes('mutual') || textLower.includes('connections') || ariaLabel.includes('mutual')) {
              return false;
            }

            const isActionConnect = text === 'Connect' || 
                                    (textLower.startsWith('connect') && !textLower.includes('connection')) ||
                                    (ariaLabel.includes('invite') && ariaLabel.includes('connect')) ||
                                    (ariaLabel.includes('to connect') && !ariaLabel.includes('mutual'));

            const isVisible = node.offsetWidth > 0 && node.offsetHeight > 0;
            return isActionConnect && isVisible;
          }).catch(() => false);

          if (isItemConnect) {
            connectBtn = item;
            break;
          }
        }
      }
    }

    if (!connectBtn) {
      logLinkedInActivity(`⏩ "Connect" option not available for ${person.name} (only Follow/InMail or already pending). Skipping.`);
      linkedinBotState.stats.skipped++;
      await profilePage.close().catch(() => {});
      return false;
    }

    // 3. Click Connect button or link (with parent link fallback)
    logLinkedInActivity(`👉 Clicking "Connect" for ${person.name}...`);
    await connectBtn.scrollIntoViewIfNeeded().catch(() => {});
    await connectBtn.click({ timeout: 5000 }).catch(async () => {
      await profilePage.evaluate((el) => {
        const target = el.closest('a, button, [role="button"]') || el;
        target.click();
      }, connectBtn).catch(() => {});
    });
    await profilePage.waitForTimeout(1500);

    // 4. Handle "Add a note" invitation modal dialog
    const modal = await profilePage.waitForSelector('div[role="dialog"], .artdeco-modal', { timeout: 4000 }).catch(() => null);
    if (modal) {
      const addNoteBtn = await profilePage.$(
        'div[role="dialog"] button:has-text("Add a note"), ' +
        'div[role="dialog"] a:has-text("Add a note"), ' +
        'div[role="dialog"] button[aria-label*="Add a note"], ' +
        'div[role="dialog"] [aria-label*="Add a note"]'
      );
      
      if (addNoteBtn) {
        await addNoteBtn.click().catch(() => {});
        await profilePage.waitForTimeout(1000);

        // 5. Generate personalized connection note with user fine-tuning & custom samples
        const note = await generateLinkedInNote({
          personName: person.name,
          personRole: person.headline,
          personCompany: person.location,
          targetJob: config.keywords,
          customTemplate: config.customTemplate,
          tone: config.tone,
          customInstructions: config.customInstructions,
          temperature: config.temperature,
          sampleExamples: config.sampleExamples || profileData.sampleExamples || [],
        });

        logLinkedInActivity(`✍️ Generated Note (${note.length} chars): "${note}"`);

        const textarea = await profilePage.$('textarea[name="message"], textarea#custom-message');
        if (textarea) {
          await textarea.fill(note);
          await profilePage.waitForTimeout(1000);
        }

        // 6. Click "Send" / "Send invitation"
        const sendBtn = await profilePage.$('div[role="dialog"] button:has-text("Send"), div[role="dialog"] button[aria-label*="Send invitation"], div[role="dialog"] button[aria-label*="Send now"]');
        if (sendBtn) {
          await sendBtn.click().catch(() => {});
          await profilePage.waitForTimeout(2000);
          logLinkedInActivity(`✉️ ✅ Successfully sent connection request with note to: ${person.name}!`);
          linkedinBotState.stats.sent++;
        }
      } else {
        // In case modal allows direct Send without note button
        const directSend = await profilePage.$('div[role="dialog"] button:has-text("Send")');
        if (directSend) {
          await directSend.click().catch(() => {});
          await profilePage.waitForTimeout(1500);
          logLinkedInActivity(`✉️ ✅ Sent connection request directly to: ${person.name}`);
          linkedinBotState.stats.sent++;
        }
      }
    }

    linkedinBotState.stats.visited++;
    await profilePage.close().catch(() => {});

    // Add randomized delay (3 to 6 seconds) between profiles for organic human pacing
    const randomDelay = Math.floor(Math.random() * 3000) + 3000;
    await new Promise(r => setTimeout(r, randomDelay));
    return true;

  } catch (err) {
    if (err.message.includes('Target page, context or browser has been closed') || err.message.includes('browser has been closed')) {
      logLinkedInActivity('🛑 Browser window was closed. Halting LinkedIn outreach.');
      linkedinBotState.status = 'idle';
      return false;
    }
    logLinkedInActivity(`⚠️ Error processing profile ${person.name}: ${err.message}`);
    linkedinBotState.stats.skipped++;
    if (profilePage) {
      await profilePage.close().catch(() => {});
    }
    return false;
  }
}

/**
 * Main LinkedIn outreach automation loop.
 */
export async function startLinkedInLoop(customConfig = {}) {
  if (isLinkedInLoopActive) {
    logLinkedInActivity('⚠️ LinkedIn outreach loop is already running.');
    return;
  }

  isLinkedInLoopActive = true;
  linkedinBotState.status = 'running';
  linkedinBotState.stats = { visited: 0, sent: 0, skipped: 0, currentPage: 1 };
  
  if (customConfig && typeof customConfig === 'object') {
    linkedinBotState.config = { ...linkedinBotState.config, ...customConfig };
  }

  const config = linkedinBotState.config;
  const maxInvites = Number(config.maxInvites) || 25;

  logLinkedInActivity('🚀 Starting LinkedIn Connection Outreach Bot...');
  logLinkedInActivity(`🎯 Target: "${config.keywords}" | Max Invitations: ${maxInvites}`);

  let context = null;

  try {
    if (activeBrowserContext) {
      logLinkedInActivity('🔄 Closing previous test browser session before launching new instance...');
      await activeBrowserContext.close().catch(() => {});
      activeBrowserContext = null;
      await new Promise(r => setTimeout(r, 1000));
    }

    const launcher = await launchBrowser();
    context = launcher.context;
    activeBrowserContext = context;
    const page = launcher.page;

    // 1. Verify LinkedIn login state
    const loggedIn = await checkLinkedInLogin(page);
    if (!loggedIn) {
      logLinkedInActivity('🛑 Bot stopped before authentication was completed.');
      linkedinBotState.status = 'idle';
      return;
    }

    // 2. Load candidate profile context
    const profilePath = path.join(process.cwd(), 'profile.json');
    let profileData = {};
    if (fs.existsSync(profilePath)) {
      try {
        profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      } catch (_) {}
    }

    // 3. Search and apply filters
    await applySearchAndFilters(page, config, profileData);

    let pageNum = 1;
    let hasNextPage = true;

    while (hasNextPage && linkedinBotState.status === 'running') {
      if (linkedinBotState.stats.sent >= maxInvites) {
        logLinkedInActivity(`🎉 Target quota of ${maxInvites} invitations reached for this session!`);
        break;
      }

      // 1. Detect current page from DOM pagination button with aria-current="true"
      const currentPageFromDOM = await page.evaluate(() => {
        const activeBtn = document.querySelector('button[aria-current="true"], button[aria-current="page"], li.artdeco-pagination__indicator--number.selected button');
        if (activeBtn) {
          const num = parseInt(activeBtn.innerText.trim(), 10);
          return isNaN(num) ? null : num;
        }
        return null;
      }).catch(() => null);

      if (currentPageFromDOM) {
        pageNum = currentPageFromDOM;
      }
      linkedinBotState.stats.currentPage = pageNum;
      logLinkedInActivity(`📄 Scanning Search Results Page ${pageNum}...`);

      // Scroll down to load all search cards
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(() => {});
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(1500);

      const people = await getPeopleFromSearchPage(page);
      logLinkedInActivity(`📋 Found ${people.length} profiles on Page ${pageNum}.`);

      if (people.length === 0) {
        logLinkedInActivity('⚠️ No profiles found on this page. Ending search.');
        break;
      }

      for (const person of people) {
        if (linkedinBotState.status !== 'running') break;
        if (linkedinBotState.stats.sent >= maxInvites) break;

        await processProfileConnection(context, person, config, profileData);
      }

      if (linkedinBotState.status !== 'running' || linkedinBotState.stats.sent >= maxInvites) {
        break;
      }

      // 2. Locate and click "Next" pagination button using data-testid="pagination-controls-next-button-visible"
      const nextBtn = await page.$('button[data-testid="pagination-controls-next-button-visible"], button[aria-label="Next"], button:has-text("Next"), .artdeco-pagination__button--next');
      const isNextDisabled = nextBtn ? await nextBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true').catch(() => true) : true;

      if (nextBtn && !isNextDisabled) {
        logLinkedInActivity(`⏭️ Clicking Next button (Page ${pageNum} -> ${pageNum + 1})...`);
        await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
        await nextBtn.click().catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(3000);
        pageNum++;
      } else {
        logLinkedInActivity('🏁 Reached the final page of search results.');
        hasNextPage = false;
      }
    }

    logLinkedInActivity(`🎉 Outreach session completed! Sent: ${linkedinBotState.stats.sent} | Skipped: ${linkedinBotState.stats.skipped} | Visited: ${linkedinBotState.stats.visited}`);
    linkedinBotState.status = 'completed';

  } catch (error) {
    logLinkedInActivity(`🚨 Critical LinkedIn bot error: ${error.message}`);
    linkedinBotState.status = 'error';
  } finally {
    isLinkedInLoopActive = false;
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

/**
 * Gracefully stops the active LinkedIn outreach loop.
 */
export async function stopLinkedInLoop() {
  logLinkedInActivity('🛑 Stopping LinkedIn outreach loop...');
  linkedinBotState.status = 'idle';
  isLinkedInLoopActive = false;
  if (activeBrowserContext) {
    await activeBrowserContext.close().catch(() => {});
    activeBrowserContext = null;
  }
}
