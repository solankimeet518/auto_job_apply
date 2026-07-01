import { launchBrowser } from './browserLauncher.js';
import { generateAnswer, saveToQAMemory } from './queryEngine.js';
import { botState, logBotActivity } from './index.js';
import { ChatOllama } from "@langchain/ollama";
import { config } from "./config.js";
import path from 'path';
import fs from 'fs';

/**
 * Busy-waits and pauses the bot thread, prompting the user in the React UI
 * for clarification. Returns the user's submitted answer.
 * @param {string} questionText - Raw question text.
 * @param {string} jobUrl - URL of the job page.
 * @returns {Promise<string>} - User-provided answer.
 */
async function askUserAndWait(questionText, jobUrl) {
  const questionId = Math.random().toString(36).substring(2, 9);
  
  // 1. Queue question in global state
  botState.pendingQuestions.push({
    id: questionId,
    text: questionText,
    jobUrl: jobUrl
  });

  // 2. Set status to paused_input
  botState.status = 'paused_input';
  logBotActivity(`⚠️ PAUSED: Question requires your input: "${questionText}"`);

  // 3. Busy-wait/poll until user submits answer in React
  while (botState.status === 'paused_input') {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 4. Retrieve answer
  const answer = botState.answers[questionText] || '';
  return answer;
}

/**
 * Uses Ollama to pick the best option from a list for radio buttons or dropdowns.
 * @param {string} question - The field label/question.
 * @param {string[]} options - The list of available options.
 * @returns {Promise<string>} - The chosen option.
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
    // Validate if LLM returned a valid option
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
    // 1. Check aria-label
    let label = el.getAttribute('aria-label');
    if (label) return label.trim();

    // 2. Check associated label tag via id
    const id = el.getAttribute('id');
    if (id) {
      const lblNode = document.querySelector(`label[for="${id}"]`);
      if (lblNode && lblNode.innerText) return lblNode.innerText.trim();
    }

    // 3. Check parent label tag
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText) return parentLabel.innerText.trim();

    // 4. Check placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();

    // 5. Check sibling or preceding text element
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
  let pageTitle = '';

  const profilePath = path.join(process.cwd(), 'profile.json');
  const profileData = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : {};

  while (!isDone) {
    // Check if bot was stopped
    if (botState.status === 'idle') {
      logBotActivity('🛑 Bot execution stopped during form fill.');
      return false;
    }

    // Check if we reached the final submit page
    const submitBtn = await page.$('button:has-text("Submit application"), button:has-text("Submit your application"), button:has-text("Apply")');
    if (submitBtn) {
      logBotActivity('🎯 Final review step reached. Submitting application...');
      await submitBtn.click();
      await page.waitForTimeout(4000); // Wait for submission success
      logBotActivity('✅ Application successfully submitted!');
      isDone = true;
      return true;
    }

    // Identify standard inputs on the current page
    const textInputs = await page.$$('input[type="text"], input[type="number"], textarea');
    const selectInputs = await page.$$('select');
    const radioInputs = await page.$$('input[type="radio"]');
    const fileInputs = await page.$$('input[type="file"]');

    // 1. Handle File Uploads (Resume)
    for (const fileInput of fileInputs) {
      const isVisible = await fileInput.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0);
      if (isVisible) {
        const resumePath = path.join(process.cwd(), 'resume.pdf');
        if (fs.existsSync(resumePath)) {
          logBotActivity('📤 Uploading resume.pdf...');
          await fileInput.setInputFiles(resumePath);
          await page.waitForTimeout(2000);
        } else {
          logBotActivity('⚠️ Warning: resume.pdf not found in project workspace. Skipping upload.');
        }
      }
    }

    // 2. Handle Text and Number inputs
    for (const input of textInputs) {
      const isVisible = await input.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && !el.readOnly);
      if (isVisible) {
        const label = await getFieldLabel(page, input);
        const nameAttr = (await input.getAttribute('name')) || '';
        const idAttr = (await input.getAttribute('id')) || '';
        const labelLower = label.toLowerCase();

        // Autofill standard candidate information directly
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
          // Call the LLM Answering Engine
          const res = await generateAnswer(label);
          if (res.outOfContext) {
            valueToFill = await askUserAndWait(label, jobUrl);
          } else {
            valueToFill = res.answer;
          }
        }

        logBotActivity(`✍️ Filling field: "${label}" -> "${valueToFill}"`);
        await input.fill(valueToFill);
        await page.waitForTimeout(500);
      }
    }

    // 3. Handle Select Dropdowns
    for (const select of selectInputs) {
      const isVisible = await select.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
      if (isVisible) {
        const label = await getFieldLabel(page, select);
        
        // Extract dropdown options
        const options = await select.evaluate(el => {
          return Array.from(el.options)
            .map(opt => opt.text.trim())
            .filter(text => text !== '');
        });

        if (options.length > 0) {
          const chosenOption = await chooseBestOption(label, options);
          logBotActivity(`🗂️ Selecting dropdown: "${label}" -> "${chosenOption}"`);
          
          // Locate option value
          const optionValue = await select.evaluate((el, text) => {
            const opt = Array.from(el.options).find(o => o.text.trim() === text);
            return opt ? opt.value : '';
          }, chosenOption);

          await select.selectOption(optionValue);
          await page.waitForTimeout(500);
        }
      }
    }

    // 4. Handle Radio Buttons
    // Group radios by name attribute
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
      // Check if group is visible and none is already checked
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
        // Find question label for the radio group
        const firstRadio = group[0];
        const label = await getFieldLabel(page, firstRadio);
        
        // Extract options
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
            await target.element.click();
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // 5. Navigate to Next Step
    const nextBtn = await page.$('button:has-text("Continue"), button:has-text("Next"), button.ia-continueButton');
    if (nextBtn) {
      logBotActivity('⏭️ Clicking continue...');
      await nextBtn.click();
      await page.waitForTimeout(3000); // Wait for transition
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
  let context, page;
  try {
    const launcher = await launchBrowser();
    context = launcher.context;
    page = launcher.page;

    logBotActivity(`🔍 Target job: "${botState.targetJob}"`);
    logBotActivity(`📍 Locations list: ${JSON.stringify(botState.targetLocations)}`);

    for (const location of botState.targetLocations) {
      if (botState.status === 'idle') break;

      logBotActivity(`🌐 Searching Indeed for jobs in "${location}"...`);
      const searchUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(botState.targetJob)}&l=${encodeURIComponent(location)}`;
      await page.goto(searchUrl);
      await page.waitForTimeout(4000); // Wait for job cards loading

      // Extract Job Keys
      const jobKeys = await page.$$eval('a[data-jk]', links => {
        return links
          .map(a => a.getAttribute('data-jk'))
          .filter(Boolean);
      });

      const uniqueKeys = [...new Set(jobKeys)];
      logBotActivity(`📋 Found ${uniqueKeys.length} potential job listings in "${location}"`);

      for (const jk of uniqueKeys) {
        if (botState.status === 'idle') break;

        const jobUrl = `https://www.indeed.com/viewjob?jk=${jk}`;
        logBotActivity(`🔗 Examining job: ${jobUrl}`);
        
        try {
          await page.goto(jobUrl);
          await page.waitForTimeout(3000);

          // Check if "Apply now" (Easy Apply) exists
          // Note: Indeed uses "Apply now" button for indeed apply, and "Apply on company site" for external redirect.
          const applyBtn = await page.$('button.ia-IndeedApplyButton, button:has-text("Apply now"), .jobsearch-IndeedApplyButton-button');
          const externalBtn = await page.$('button:has-text("Apply on company site"), button:has-text("Apply on company website")');

          if (externalBtn) {
            logBotActivity('➡️ External job posting (requires redirect). Skipping...');
            continue;
          }

          if (!applyBtn) {
            logBotActivity('🔍 "Apply now" button not found. Skipping...');
            continue;
          }

          logBotActivity('🚀 "Apply now" found! Initializing indeed application modal...');
          await applyBtn.click();
          await page.waitForTimeout(4000); // Wait for apply overlay loading

          // Handle form filling steps
          const success = await handleApplicationForm(page, jobUrl);
          if (success) {
            logBotActivity(`🎉 Successfully completed application for job: ${jk}`);
          }
        } catch (jobErr) {
          logBotActivity(`❌ Error processing job ${jk}: ${jobErr.message}`);
        }
      }
    }

    logBotActivity('🏁 Indeed apply loop finished all targets.');
    botState.status = 'completed';

  } catch (err) {
    logBotActivity(`🚨 Critical bot error: ${err.message}`);
    botState.status = 'error';
  } finally {
    if (context) {
      await context.close();
    }
  }
}
