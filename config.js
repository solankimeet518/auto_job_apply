import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'gemma',
  },
  indeed: {
    username: process.env.INDEED_USERNAME || '',
    password: process.env.INDEED_PASSWORD || '',
  },
  browser: {
    headless: process.env.HEADLESS === 'true',
  },
  job: {
    resumePath: process.env.RESUME_PATH || '',
    targetJob: process.env.TARGET_JOB || 'Software Engineer',
    targetLocation: process.env.TARGET_LOCATION || 'Remote',
  },
};
