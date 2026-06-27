import { parseResume } from './resumeParser.js';
import { extractProfile } from './profileExtractor.js';
import { config } from './config.js';

async function test() {
  console.log("Reading resume.pdf...");
  const text = await parseResume('resume.pdf');
  console.log("Calling Ollama (gemma3:latest)...");
  const profile = await extractProfile(text, config.job.targetJob);
  console.log("\n--- RAW OLLAMA JSON RESPONSE ---");
  console.log(JSON.stringify(profile, null, 2));
  console.log("--------------------------------");
}

test().catch(console.error);
