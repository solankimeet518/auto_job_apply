import { parseResume } from './resumeParser.js';
import { extractProfile } from './profileExtractor.js';
import { config } from './config.js';
import { saveToQAMemory, generateAnswer } from './queryEngine.js';
import { linkedinBotState, startLinkedInLoop, stopLinkedInLoop } from './linkedinBot.js';
import fs from 'fs';
import path from 'path';

const PORT = 3000;

// Global state of the bot
let botState = {
  status: 'idle', // 'idle' | 'running' | 'paused_input' | 'completed' | 'error'
  logs: [],
  pendingQuestions: [], // [{ id, text, jobUrl }]
  answers: {}, // Question cache for the current session
  targetJob: config.job.targetJob,
  targetLocations: [config.job.targetLocation].filter(Boolean),
  jobTypes: [],
  workModes: [],
};

// Helper to log messages inside the server and bot
export function logBotActivity(message) {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = `[${timestamp}] ${message}`;
  console.log(formattedLog);
  botState.logs.push(formattedLog);
  if (botState.logs.length > 500) {
    botState.logs.shift(); // Cap logs
  }
}

// CORS Headers Helper
const getCorsResponse = (body, status = 200, contentType = 'application/json') => {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': contentType,
    },
  });
};

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. CORS Preflight Option Request
    if (req.method === 'OPTIONS') {
      return getCorsResponse('OK');
    }

    try {
      // --- PROFILE API ENDPOINTS ---

      // GET /api/profile -> Get current profile details
      if (url.pathname === '/api/profile' && req.method === 'GET') {
        const profilePath = path.join(process.cwd(), 'profile.json');
        if (fs.existsSync(profilePath)) {
          const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
          return getCorsResponse({ status: 'configured', profile });
        }
        return getCorsResponse({ status: 'not_configured' });
      }

      // POST /api/upload-resume -> Upload & parse PDF resume
      if (url.pathname === '/api/upload-resume' && req.method === 'POST') {
        const formData = await req.formData();
        const file = formData.get('resume');
        
        if (!file || !(file instanceof File)) {
          return getCorsResponse({ error: 'No file provided' }, 400);
        }

        const buffer = await file.arrayBuffer();
        const targetPath = path.join(process.cwd(), 'resume.pdf');
        fs.writeFileSync(targetPath, Buffer.from(buffer));

        logBotActivity('📄 Resume PDF uploaded successfully.');
        
        // Parse the PDF text
        const text = await parseResume(targetPath);
        
        logBotActivity('🤖 Extracting resume profile via Ollama...');
        const extracted = await extractProfile(text, botState.targetJob);
        
        extracted.targetLocations = botState.targetLocations || [config.job.targetLocation].filter(Boolean);
        extracted.jobTypes = [];
        extracted.workModes = [];
        extracted.projects = extracted.projects || [];
        extracted.keyAchievements = extracted.keyAchievements || [];
        extracted.additionalInfo = extracted.additionalInfo || '';
        extracted.currentCTC = extracted.currentCTC || '';
        extracted.expectedCTC = extracted.expectedCTC || '';

        const parsedSkills = extracted.skills || {};
        extracted.skills = {
          languages: parsedSkills.languages || [],
          frameworks: parsedSkills.frameworks || [],
          databases: parsedSkills.databases || [],
          devops: parsedSkills.devops || [],
          tools: parsedSkills.tools || []
        };

        return getCorsResponse({ status: 'extracted', profile: extracted });
      }

      // POST /api/save-profile -> Save verified profile
      if (url.pathname === '/api/save-profile' && req.method === 'POST') {
        const body = await req.json();
        if (!body) {
          return getCorsResponse({ error: 'Invalid profile data' }, 400);
        }

        const profilePath = path.join(process.cwd(), 'profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(body, null, 2));
        logBotActivity('💾 Profile saved successfully.');
        return getCorsResponse({ status: 'saved', profile: body });
      }

      // --- BOT CONTROL & STATUS ENDPOINTS ---

      // GET /api/status -> Polling bot status & logs
      if (url.pathname === '/api/status' && req.method === 'GET') {
        return getCorsResponse(botState);
      }

      // POST /api/start -> Trigger automation apply loop
      if (url.pathname === '/api/start' && req.method === 'POST') {
        const body = await req.json();
        
        if (botState.status === 'running') {
          return getCorsResponse({ error: 'Bot is already running' }, 400);
        }

        botState.targetJob = body.targetJob || config.job.targetJob;
        botState.targetLocations = body.targetLocations || [config.job.targetLocation].filter(Boolean);
        botState.jobTypes = body.jobTypes || [];
        botState.workModes = body.workModes || [];
        botState.status = 'running';
        botState.logs = [];
        botState.pendingQuestions = [];

        logBotActivity(`🚀 Starting job search for "${botState.targetJob}" in ${JSON.stringify(botState.targetLocations)}...`);

        // We run the automation flow in the background
        startAutomationLoop();

        return getCorsResponse({ status: 'started' });
      }

      // POST /api/stop -> Stop/cancel automation
      if (url.pathname === '/api/stop' && req.method === 'POST') {
        botState.status = 'idle';
        logBotActivity('🛑 Bot stopped by user.');
        // We will integrate cancel handlers in the automation modules
        return getCorsResponse({ status: 'stopped' });
      }

      // POST /api/answer-question -> Submit answer for pending out-of-context question
      if (url.pathname === '/api/answer-question' && req.method === 'POST') {
        const { questionId, answer } = await req.json();
        
        const qIndex = botState.pendingQuestions.findIndex(q => q.id === questionId);
        if (qIndex === -1) {
          return getCorsResponse({ error: 'Question not found' }, 404);
        }

        const question = botState.pendingQuestions[qIndex];
        
        // Cache the answer in session memory
        botState.answers[question.text] = answer;
        
        // Persistently cache in qa_memory.json
        saveToQAMemory(question.text, answer);
        
        // Remove from pending list
        botState.pendingQuestions.splice(qIndex, 1);
        
        logBotActivity(`✍️ User answered: "${question.text}" -> "${answer}"`);

        // If no more pending questions, set status back to running
        if (botState.pendingQuestions.length === 0) {
          botState.status = 'running';
        }

        return getCorsResponse({ status: 'success' });
      }

      // POST /api/query-test -> Test answering engine
      if (url.pathname === '/api/query-test' && req.method === 'POST') {
        const { question } = await req.json();
        if (!question) {
          return getCorsResponse({ error: 'Question text is required' }, 400);
        }
        logBotActivity(`🔍 Testing query engine for: "${question}"`);
        const result = await generateAnswer(question);
        return getCorsResponse(result);
      }

      // GET /api/linkedin/status -> Get current LinkedIn outreach state & logs
      if (url.pathname === '/api/linkedin/status' && req.method === 'GET') {
        return getCorsResponse(linkedinBotState);
      }

      // POST /api/linkedin/start -> Start LinkedIn outreach loop
      if (url.pathname === '/api/linkedin/start' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        startLinkedInLoop(body);
        return getCorsResponse({ status: 'started' });
      }

      // POST /api/linkedin/stop -> Stop LinkedIn outreach loop
      if (url.pathname === '/api/linkedin/stop' && req.method === 'POST') {
        await stopLinkedInLoop();
        return getCorsResponse({ status: 'stopped' });
      }

      // POST /api/linkedin/preview-note -> Generate a test note with Ollama or template
      if (url.pathname === '/api/linkedin/preview-note' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { generateLinkedInNote } = await import('./queryEngine.js');
        const note = await generateLinkedInNote({
          personName: body.personName || 'Anshuman Singh',
          personRole: body.personRole || 'Technical Recruiter',
          personCompany: body.personCompany || 'Google',
          targetJob: body.targetJob || body.keywords || 'Software Engineer',
          customTemplate: body.noteMode === 'template' ? (body.customTemplate || '') : '',
        });
        return getCorsResponse({ note, length: note.length });
      }

      return getCorsResponse({ error: 'Endpoint Not Found' }, 404);
    } catch (err) {
      console.error(err);
      return getCorsResponse({ error: err.message }, 500);
    }
  },
});

console.log(`\n🚀 API server is running at http://localhost:${server.port}\n`);

// Mock automation loop for testing the structure in Module 1
function startAutomationLoop() {
  let counter = 0;
  const interval = setInterval(() => {
    if (botState.status !== 'running') {
      clearInterval(interval);
      return;
    }
    
    counter++;
    if (counter === 1) {
      logBotActivity('Searching Indeed postings...');
    } else if (counter === 2) {
      logBotActivity('Found 3 relevant postings.');
    } else if (counter === 3) {
      logBotActivity('Applying to job 1: Senior Software Engineer at TechGlobal...');
    } else if (counter === 4) {
      logBotActivity('Form asks: "How many years of experience do you have with Rust?"');
      logBotActivity('Generating answer from resume context...');
      logBotActivity('Found: "2+ years of full-stack build experience including Rust"');
      logBotActivity('Filled: 2');
    } else if (counter === 5) {
      logBotActivity('⚠️  Form asks: "What is your target salary?" (Out of context)');
      logBotActivity('pausing execution and requesting user input...');
      
      // Pause loop for input
      botState.status = 'paused_input';
      botState.pendingQuestions.push({
        id: 'q_' + Date.now(),
        text: 'What is your expected salary (USD / year)?',
        jobUrl: 'https://indeed.com/viewjob?jk=12345678',
      });
      clearInterval(interval);
    }
  }, 3000);
}