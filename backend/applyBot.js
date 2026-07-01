import { launchBrowser } from './browserLauncher.js';
import { generateAnswer, saveToQAMemory } from './queryEngine.js';
import { botState, logBotActivity } from './index.js';
import { ChatOllama } from "@langchain/ollama";
import { config } from "./config.js";
import path from 'path';
import fs from 'fs';

// Global concurrency lock to prevent multiple loop instances from running simultaneously
let isLoopActive = false;

/**
 * Busy-waits and pauses the bot thread, prompting the user in the React UI
 * for clarification. Returns the user's submitted answer.
 */
async function askUserAndWait(questionText, jobUrl) {
  const questionId = Math.random().toString(36).substring(2, 9);
  
  botState.pendingQuestions.push({
    id: questionId,
    text: questionText,
    jobUrl: jobUrl
  });

  botState.status = 'paused_input';
  logBotActivity(`⚠️ PAUSED: Question requires your input: "${questionText}"`);

  while (botState.status === 'paused_input') {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const answer = botState.answers[questionText] || '';
  return answer;
}

/**
 * Scans the page for Cloudflare or Indeed security challenge frames/walls and pauses.
 */
async function checkSecurityChallenges(page) {
  let isChallenged = false;
  
  while (true) {
    const title = await page.title().catch(() => '');
    const hasCfContainer = await page.$('#cf-challenge-running, .cf-browser-verification, #challenge-running').catch(() => null);
    const hasIndeedVerification = await page.$('iframe[src*="cloudflare"], #challenge-form').catch(() => null);

    if (title.includes('Cloudflare') || title.includes('Verify you are human') || hasCfContainer || hasIndeedVerification) {
      if (!isChallenged) {
        logBotActivity('⚠️ SECURITY CHALLENGE: Cloudflare / Indeed human verification wall detected!');
        logBotActivity('🔒 Bot is temporarily PAUSED. Please solve the captcha directly in the browser window.');
        isChallenged = true;
      }
      await page.waitForTimeout(2500); // Block loop until solved
    } else {
      if (isChallenged) {
        logBotActivity('🔓 Security challenge resolved! Resuming automation loop.');
      }
      break;
    }
  }
}

/**
 * Simulates human-like mouse movement in a zig-zag curve to an element and clicks it.
 */
async function humanClick(page, elementOrLocator) {
  let element;
  if (typeof elementOrLocator === 'string') {
    element = await page.$(elementOrLocator);
  } else {
    if (elementOrLocator.elementHandle) {
      element = await elementOrLocator.elementHandle().catch(() => null);
    } else {
      element = elementOrLocator;
    }
  }

  if (!element) return;

  // Ensure element is scrolled into view first
  await element.scrollIntoViewIfNeeded().catch(() => {});

  const box = await element.boundingBox();
  if (!box) {
    await element.click();
    return;
  }

  const targetX = box.x + box.width / 2 + (Math.random() * 4 - 2);
  const targetY = box.y + box.height / 2 + (Math.random() * 4 - 2);

  const startX = targetX + (Math.random() * 200 - 100);
  const startY = targetY + (Math.random() * 200 - 100);

  const steps = 4; // Slightly reduced steps for faster mouse moves
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    let x = startX + (targetX - startX) * t;
    let y = startY + (targetY - startY) * t;

    if (i > 0 && i < steps) {
      const wave = Math.sin(t * Math.PI) * 12 * (Math.random() > 0.5 ? 1 : -1);
      x += wave;
      y += wave * 0.5;
    }

    x += (Math.random() * 2 - 1);
    y += (Math.random() * 2 - 1);

    await page.mouse.move(x, y).catch(() => {});
    await page.waitForTimeout(30 + Math.random() * 30);
  }

  await page.mouse.move(targetX, targetY).catch(() => {});
  await page.waitForTimeout(50 + Math.random() * 50);

  await page.mouse.down().catch(() => {});
  await page.waitForTimeout(40 + Math.random() * 50);
  await page.mouse.up().catch(() => {});
  await page.waitForTimeout(100);
}

/**
 * Uses Ollama to compare job details with candidate profile to filter out mismatches.
 */
async function isJobSuitable(jobTitle, jobDescription, profileData) {
  const model = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0.1,
  });

  const prompt = `You are a career assistant. Compare the candidate's profile against the job details to determine if this job is suitable and a good match for the candidate.

Candidate Profile:
---
Target Job Title: ${profileData.targetJob || ''}
Skills:
- Programming Languages: ${profileData.skills?.languages?.join(', ') || ''}
- Frameworks: ${profileData.skills?.frameworks?.join(', ') || ''}
- Databases: ${profileData.skills?.databases?.join(', ') || ''}
- DevOps: ${profileData.skills?.devops?.join(', ') || ''}
- Tools: ${profileData.skills?.tools?.join(', ') || ''}
Projects: ${JSON.stringify(profileData.projects || [])}
Achievements: ${JSON.stringify(profileData.keyAchievements || [])}
Experience Summary: ${profileData.summary || ''}
---

Job Details:
- Job Title: ${jobTitle}
- Job Description:
${jobDescription.substring(0, 3000)}

Determine if the candidate is qualified for this job. For example, if the job description requires technologies, experience years, or a role that is completely mismatched, answer false.
You must output a valid JSON object ONLY. Do not include any other markdown, text, or wrapper:
{
  "eligible": true or false,
  "reason": "Brief explanation of match or mismatch"
}`;

  try {
    const response = await model.invoke(prompt);
    const resultText = response.content.trim();
    const startIdx = resultText.indexOf('{');
    const endIdx = resultText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = resultText.substring(startIdx, endIdx + 1);
      return JSON.parse(jsonStr);
    }
    return { eligible: true, reason: 'Implicit match' };
  } catch (err) {
    console.error('Suitability check failed:', err);
    return { eligible: true, reason: 'Error checking suitability, defaulting to eligible.' };
  }
}

/**
 * Uses Ollama to pick the best option from a list for radio buttons or dropdowns.
 */
async function chooseBestOption(question, options) {
  const profilePath = path.join(process.cwd(), 'profile.json');
  if (!fs.existsSync(profilePath)) return options[0] || '';

  let profileData = {};
  try {
    profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  } catch (_) {}

  const model = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0.1,
  });

  const prompt = `You are a job application assistant. Based on the candidate profile:
---
${JSON.stringify(profileData, null, 2)}
---

Question: "${question}"
Options available: ${JSON.stringify(options)}

Select the best matching option from the list. 
You must output ONLY the exact text of the chosen option from the options list. Do not include quotes, extra spaces, explanations, or punctuation.`;

  try {
    const response = await model.invoke(prompt);
    const chosen = response.content.trim();
    const matched = options.find(opt => opt.toLowerCase() === chosen.toLowerCase());
    return matched || chosen || options[0];
  } catch (err) {
    console.error('Failed to choose radio/dropdown option via LLM:', err);
    return options[0] || '';
  }
}

/**
 * Extracts the label text associated with an input element.
 */
async function getFieldLabel(page, inputElement) {
  return await inputElement.evaluate(el => {
    let label = el.getAttribute('aria-label');
    if (label) return label.trim();

    const id = el.getAttribute('id');
    if (id) {
      const lblNode = document.querySelector(`label[for="${id}"]`);
      if (lblNode && lblNode.innerText) return lblNode.innerText.trim();
    }

    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText) return parentLabel.innerText.trim();

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();

    const container = el.closest('div');
    if (container) {
      const heading = container.querySelector('h1, h2, h3, h4, span, p');
      if (heading && heading.innerText) return heading.innerText.trim();
    }

    return '';
  });
}

/**
 * Core form filling automation flow for Indeed.
 */
async function handleApplicationForm(page, jobUrl) {
  let isDone = false;

  const profilePath = path.join(process.cwd(), 'profile.json');
  const profileData = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : {};

  // Wait for the initial application form page to load completely (network idle)
  logBotActivity('⏳ Waiting for application page load state to complete...');
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);

  while (!isDone) {
    if (botState.status === 'idle') {
      logBotActivity('🛑 Bot execution stopped during form fill.');
      return false;
    }

    await checkSecurityChallenges(page);

    const submitBtn = await page.$('button:has-text("Submit application"), button:has-text("Submit your application"), button:has-text("Apply")');
    if (submitBtn) {
      logBotActivity('🎯 Final review step reached. Submitting application...');
      await humanClick(page, submitBtn);
      await page.waitForTimeout(4000);
      logBotActivity('✅ Application successfully submitted!');
      isDone = true;
      return true;
    }

    const textInputs = await page.$$('input[type="text"], input[type="number"], textarea');
    const selectInputs = await page.$$('select');
    const radioInputs = await page.$$('input[type="radio"]');
    const fileInputs = await page.$$('input[type="file"]');

    for (const fileInput of fileInputs) {
      const isVisible = await fileInput.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0);
      if (isVisible) {
        const resumePath = path.join(process.cwd(), 'resume.pdf');
        if (fs.existsSync(resumePath)) {
          logBotActivity('📤 Uploading resume.pdf...');
          await fileInput.setInputFiles(resumePath);
          await page.waitForTimeout(1500);
        } else {
          logBotActivity('⚠️ Warning: resume.pdf not found in project workspace. Skipping upload.');
        }
      }
    }

    for (const input of textInputs) {
      const isVisible = await input.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && !el.readOnly);
      if (isVisible) {
        const label = await getFieldLabel(page, input);
        const nameAttr = (await input.getAttribute('name')) || '';
        const idAttr = (await input.getAttribute('id')) || '';
        const labelLower = label.toLowerCase();

        let valueToFill = '';
        if (labelLower.includes('first name') || nameAttr.includes('firstName')) {
          valueToFill = profileData.firstName || '';
        } else if (labelLower.includes('last name') || nameAttr.includes('lastName')) {
          valueToFill = profileData.lastName || '';
        } else if (labelLower.includes('email') || nameAttr.includes('email')) {
          valueToFill = profileData.email || '';
        } else if (labelLower.includes('phone') || labelLower.includes('mobile') || nameAttr.includes('phone')) {
          valueToFill = profileData.phone || '';
        } else if (labelLower.includes('city') || labelLower.includes('state') || labelLower.includes('country') || labelLower.includes('address')) {
          valueToFill = profileData.location || '';
        } else {
          const res = await generateAnswer(label);
          if (res.outOfContext) {
            valueToFill = await askUserAndWait(label, jobUrl);
          } else {
            valueToFill = res.answer;
          }
        }

        logBotActivity(`✍️ Filling field: "${label}" -> "${valueToFill}"`);
        await input.fill(valueToFill);
        await page.waitForTimeout(300);
      }
    }

    for (const select of selectInputs) {
      const isVisible = await select.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
      if (isVisible) {
        const label = await getFieldLabel(page, select);
        const options = await select.evaluate(el => {
          return Array.from(el.options)
            .map(opt => opt.text.trim())
            .filter(text => text !== '');
        });

        if (options.length > 0) {
          const chosenOption = await chooseBestOption(label, options);
          logBotActivity(`🗂️ Selecting dropdown: "${label}" -> "${chosenOption}"`);
          
          const optionValue = await select.evaluate((el, text) => {
            const opt = Array.from(el.options).find(o => o.text.trim() === text);
            return opt ? opt.value : '';
          }, chosenOption);

          await select.selectOption(optionValue);
          await page.waitForTimeout(300);
        }
      }
    }

    const radioGroups = {};
    for (const radio of radioInputs) {
      const name = await radio.getAttribute('name');
      if (name) {
        if (!radioGroups[name]) radioGroups[name] = [];
        radioGroups[name].push(radio);
      }
    }

    for (const groupName of Object.keys(radioGroups)) {
      const group = radioGroups[groupName];
      let isVisible = false;
      let alreadyChecked = false;
      for (const radio of group) {
        const state = await radio.evaluate(el => ({
          visible: el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled,
          checked: el.checked
        }));
        if (state.visible) isVisible = true;
        if (state.checked) alreadyChecked = true;
      }

      if (isVisible && !alreadyChecked) {
        const firstRadio = group[0];
        const label = await getFieldLabel(page, firstRadio);
        
        const options = [];
        for (const radio of group) {
          const id = await radio.getAttribute('id');
          const optionText = await page.evaluate(id => {
            const lbl = document.querySelector(`label[for="${id}"]`);
            return lbl ? lbl.innerText.trim() : '';
          }, id);
          if (optionText) {
            options.push({ element: radio, text: optionText });
          }
        }

        if (options.length > 0) {
          const optionTexts = options.map(o => o.text);
          const chosenText = await chooseBestOption(label, optionTexts);
          logBotActivity(`🔘 Selecting radio option: "${label}" -> "${chosenText}"`);
          
          const target = options.find(o => o.text === chosenText);
          if (target) {
            await humanClick(page, target.element);
            await page.waitForTimeout(300);
          }
        }
      }
    }

    const nextBtn = await page.$('button:has-text("Continue"), button:has-text("Next"), button.ia-continueButton, button[type="submit"]');
    if (nextBtn) {
      logBotActivity('⏭️ Clicking continue...');
      await humanClick(page, nextBtn);
      // Wait for next section network requests to finish, then wait 1 second for DOM reaction
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } else {
      logBotActivity('⚠️ Navigation button not found. Assuming application form is stuck or complete.');
      isDone = true;
    }
  }
  return true;
}

/**
 * Main loop running in the background.
 */
export async function startAutomationLoop() {
  if (isLoopActive) {
    logBotActivity('⚠️ Concurrency warning: A search loop is already active or shutting down. Aborting duplicate launch.');
    return;
  }
  isLoopActive = true;

  let context, page;
  try {
    const launcher = await launchBrowser();
    context = launcher.context;
    page = launcher.page;

    const profilePath = path.join(process.cwd(), 'profile.json');
    const profileData = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : {};

    logBotActivity(`🔍 Target job: "${botState.targetJob}"`);
    logBotActivity(`📍 Locations list: ${JSON.stringify(botState.targetLocations)}`);

    for (const location of botState.targetLocations) {
      if (botState.status === 'idle') break;

      logBotActivity(`🌐 Visiting Indeed India: https://in.indeed.com/`);
      await page.goto('https://in.indeed.com/');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);

      await checkSecurityChallenges(page);

      // 1. Search Job Title
      logBotActivity(`✍️ Searching job title: "${botState.targetJob}"...`);
      const titleInput = await page.$('input[id="text-input-what"], input[placeholder*="Job title"], input[aria-label*="job title"]');
      if (titleInput) {
        await humanClick(page, titleInput);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await titleInput.type(botState.targetJob, { delay: 100 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Escape');
      }

      // 2. Search Location
      logBotActivity(`✍️ Searching location: "${location}"...`);
      const locInput = await page.$('input[id="text-input-where"], input[placeholder*="Location"], input[aria-label*="location"]');
      if (locInput) {
        await humanClick(page, locInput);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await locInput.type(location, { delay: 100 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Escape');
      }

      // 3. Click "Find jobs"
      logBotActivity('🔍 Clicking "Find jobs" button...');
      const searchBtn = await page.$('button[type="submit"], button:has-text("Find jobs")');
      if (searchBtn) {
        await humanClick(page, searchBtn);
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1000);
      }

      await checkSecurityChallenges(page);

      let pageNum = 1;
      const maxPages = 5;

      while (pageNum <= maxPages) {
        if (botState.status === 'idle') break;
        logBotActivity(`📄 Scanning search page ${pageNum} in "${location}"...`);

        const leftPane = await page.waitForSelector('.jobsearch-LeftPane, #mosaic-provider-jobcards, #mosaic-jobResults, .jobsearch-ResultsList', { timeout: 15000 }).catch(() => null);
        if (!leftPane) {
          logBotActivity('⚠️ Search Left Pane not found (timed out waiting for elements). Skipping location...');
          break;
        }

        const jobElements = await leftPane.$$('a[data-jk]');
        const uniqueKeys = [];
        for (const el of jobElements) {
          const jk = await el.getAttribute('data-jk');
          if (jk && !uniqueKeys.some(item => item.jk === jk)) {
            uniqueKeys.push({ element: el, jk });
          }
        }

        logBotActivity(`📋 Found ${uniqueKeys.length} potential job listings in Left Pane (Page ${pageNum})`);

        for (const item of uniqueKeys) {
          if (botState.status === 'idle') break;

          const jobUrl = `https://in.indeed.com/viewjob?jk=${item.jk}`;
          logBotActivity(`👉 Clicking card for Job ID: ${item.jk}...`);
          
          try {
            await humanClick(page, item.element);
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            await page.waitForTimeout(600);

            await checkSecurityChallenges(page);

            const rightPaneSelector = '#vjs-container, .jobsearch-RightPane, #jobsearch-ViewjobPaneWrapper';
            const hasRightPane = await page.locator(rightPaneSelector).count() > 0;
            const detailLocator = hasRightPane ? page.locator(rightPaneSelector) : page;

            // FIRST: Check if the "Apply with Indeed" / "Apply now" button exists and is NOT external
            const applyBtnLocator = detailLocator.locator('button.ia-IndeedApplyButton, button:has-text("Apply now"), button:has-text("Apply with Indeed"), .jobsearch-IndeedApplyButton-button').first();
            const externalBtnLocator = detailLocator.locator('button:has-text("Apply on company site"), button:has-text("Apply on company website"), a:has-text("Apply on company site"), a:has-text("Apply on company website")').first();

            const hasExternal = (await externalBtnLocator.count() > 0) && (await externalBtnLocator.isVisible().catch(() => false));
            if (hasExternal) {
              logBotActivity('➡️ External job posting (requires redirect). Skipping...');
              continue;
            }

            const hasApply = (await applyBtnLocator.count() > 0) && (await applyBtnLocator.isVisible().catch(() => false));
            if (!hasApply) {
              logBotActivity('🔍 "Apply with Indeed" or "Apply now" button not found. Skipping...');
              continue;
            }

            // ONLY IF IT IS AN EASY APPLY JOB, we load description and evaluate suitability!
            const jobTitle = await detailLocator.locator('h1, .jobsearch-JobInfoHeader-title').first().innerText().catch(() => 'Unknown Title');
            const jobDescription = await detailLocator.locator('#jobDescriptionText').first().innerText().catch(() => '');

            logBotActivity(`🧠 Analyzing suitability for: "${jobTitle}"...`);
            const suitability = await isJobSuitable(jobTitle, jobDescription, profileData);
            if (!suitability.eligible) {
              logBotActivity(`❌ Skipped: Job is not suitable. Reason: ${suitability.reason}`);
              continue;
            }
            logBotActivity(`✅ Job matches profile! Reason: ${suitability.reason}`);

            logBotActivity('🚀 "Apply with Indeed" found! Triggering new application tab...');
            
            let applicationPage = page;
            let isNewTab = false;

            try {
              const popupPromise = context.waitForEvent('page', { timeout: 5000 });
              await humanClick(page, applyBtnLocator);
              const popup = await popupPromise;
              applicationPage = popup;
              isNewTab = true;
              logBotActivity('📥 Application opened in new tab/popup. Attaching form filler...');
            } catch (err) {
              logBotActivity('ℹ️ No new tab opened. Running form filler in main window or modal.');
            }

            await applicationPage.waitForLoadState().catch(() => {});

            const success = await handleApplicationForm(applicationPage, jobUrl);
            if (success) {
              logBotActivity(`🎉 Successfully completed application for job: ${item.jk}`);
            }

            if (isNewTab) {
              await applicationPage.close();
              logBotActivity('🔒 Application tab closed. Returning to search pane.');
            }
          } catch (jobErr) {
            logBotActivity(`❌ Error processing job ${item.jk}: ${jobErr.message}`);
          }
        }

        const nextLink = await page.$('a[aria-label="Next Page"], a[data-testid="pagination-page-next"], button[aria-label="Next Page"]');
        if (nextLink) {
          logBotActivity(`⏭️ Clicking next page link (Page ${pageNum} -> ${pageNum + 1})...`);
          await humanClick(page, nextLink);
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          pageNum++;
          await page.waitForTimeout(1500);
        } else {
          logBotActivity('🏁 No more pages available. Finished pagination.');
          break;
        }
      }
    }

    logBotActivity('🏁 Indeed apply loop finished all targets.');
    botState.status = 'completed';

  } catch (err) {
    logBotActivity(`🚨 Critical bot error: ${err.message}`);
    botState.status = 'error';
  } finally {
    isLoopActive = false; // Release lock
    if (context) {
      try {
        await context.close();
      } catch (closeErr) {
        console.log('Browser context clean-up info:', closeErr.message);
      }
    }
  }
}
