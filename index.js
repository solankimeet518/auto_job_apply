import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { parseResume } from './resumeParser.js';
import { extractProfile } from './profileExtractor.js';
import { editProfile } from './profileEditor.js';
import { runResumeUploadFlow } from './resumeUploader.js';

async function main() {
  console.log("🚀 Starting Indeed Job Application Bot...");

  let resumePath = config.job.resumePath || 'resume.pdf';
  let fullPath = path.isAbsolute(resumePath) ? resumePath : path.join(process.cwd(), resumePath);

  // If resume path does not exist, open the browser upload flow
  if (!fs.existsSync(fullPath)) {
    console.log(`\n⚠️  Resume PDF not found at: ${fullPath}`);
    console.log("👉 Opening browser for resume upload. Please select your resume PDF in the window...");
    try {
      fullPath = await runResumeUploadFlow();
      console.log(`✅ Resume successfully uploaded and saved to: ${fullPath}`);
    } catch (error) {
      console.error(`❌ Failed to obtain resume: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`📄 Reading and parsing resume from: ${fullPath}...`);
  const rawText = await parseResume(fullPath);

  console.log(`🤖 Analyzing resume with Ollama model "${config.ollama.model}" at ${config.ollama.baseUrl}...`);
  console.log("Note: Please make sure Ollama is running and the model is pulled.");
  
  let extracted = await extractProfile(rawText, config.job.targetJob);
  extracted.targetLocation = config.job.targetLocation;

  console.log("✨ Profile extraction completed.");
  
  let finalProfile = null;
  let exitMenu = false;

  while (!exitMenu) {
    const editorResult = await editProfile(extracted);
    
    if (editorResult && editorResult.action === 'reupload') {
      console.log("\n🔄 Re-launching browser for new resume upload...");
      try {
        fullPath = await runResumeUploadFlow();
        console.log(`✅ New resume successfully uploaded: ${fullPath}`);
        console.log(`🤖 Re-analyzing new resume with Ollama...`);
        const newRawText = await parseResume(fullPath);
        extracted = await extractProfile(newRawText, config.job.targetJob);
        extracted.targetLocation = config.job.targetLocation;
      } catch (err) {
        console.error(`❌ Failed to update and parse new resume: ${err.message}`);
      }
    } else {
      finalProfile = editorResult;
      exitMenu = true;
    }
  }

  console.log("✅ Module 2 flow completed. Verified profile is saved to profile.json!");
}

main().catch(err => {
  console.error("❌ Error running application:", err);
  process.exit(1);
});