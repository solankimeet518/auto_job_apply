import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { parseResume } from './resumeParser.js';
import { extractProfile } from './profileExtractor.js';
import { editProfile } from './profileEditor.js';

async function main() {
  console.log("🚀 Starting Indeed Job Application Bot...");

  let resumePath = config.job.resumePath;

  // If resume path not specified in .env, prompt the user for it
  if (!resumePath) {
    const response = await prompts({
      type: 'text',
      name: 'resumePath',
      message: 'Enter path to your resume (PDF or TXT):',
      validate: value => fs.existsSync(value) ? true : 'File does not exist!'
    });
    resumePath = response.resumePath;
  }

  if (!resumePath) {
    console.log("No resume path provided. Exiting.");
    process.exit(1);
  }

  console.log(`📄 Reading and parsing resume from: ${resumePath}...`);
  const rawText = await parseResume(resumePath);

  console.log(`🤖 Analyzing resume with Ollama model "${config.ollama.model}" at ${config.ollama.baseUrl}...`);
  console.log("Note: Please make sure Ollama is running and the model is pulled.");
  
  const extracted = await extractProfile(rawText, config.job.targetJob);

  // Set the target location from config into the extracted profile
  extracted.targetLocation = config.job.targetLocation;

  console.log("✨ Profile extraction completed.");
  
  // Launch the interactive CLI editor
  const finalProfile = await editProfile(extracted);

  console.log("✅ Module 2 flow completed. Verified profile is saved to profile.json!");
}

main().catch(err => {
  console.error("❌ Error running application:", err);
  process.exit(1);
});