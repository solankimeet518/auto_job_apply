import { ChatOllama } from "@langchain/ollama";
import { config } from "./config.js";

/**
 * Uses Ollama with Gemma to extract structured JSON data from raw resume text.
 * @param {string} resumeText - Raw text extracted from the resume file.
 * @param {string} targetJob - Target job title to include in the context.
 * @returns {Promise<object>} - Structured profile object.
 */
export async function extractProfile(resumeText, targetJob) {
  const model = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0.1, // Low temperature for factual extraction
  });

  const prompt = `You are an expert resume parsing assistant. Your task is to parse the resume text and format it into a clean JSON structure.
Context target job: "${targetJob}"

Here is the resume text:
---
${resumeText}
---

You must return ONLY a valid JSON object matching the following structure:
{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "location": "",
  "links": {
    "github": "",
    "linkedin": "",
    "twitter": "",
    "portfolio": ""
  },
  "summary": "",
  "education": [
    {
      "school": "",
      "degree": "",
      "fieldOfStudy": "",
      "graduationYear": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "role": "",
      "startDate": "",
      "endDate": "",
      "description": ""
    }
  ],
  "skills": {
    "languages": [],
    "frameworks": [],
    "databases": [],
    "devops": [],
    "tools": []
  },
  "targetJob": "${targetJob}",
  "targetLocations": [],
  "jobTypes": [],
  "workModes": [],
  "projects": [
    {
      "title": "",
      "role": "",
      "technologies": [],
      "description": "",
      "link": ""
    }
  ],
  "keyAchievements": [],
  "additionalInfo": ""
}

Rules:
1. Extract the facts exactly as described in the resume.
2. If any field is not found in the resume, leave it as an empty string "" or an empty array [].
3. Do not invent any details.
4. Output ONLY the JSON object. Do not include markdown code block syntax (like \`\`\`json or \`\`\`), conversational explanations, or extra text.`;

  try {
    const response = await model.invoke(prompt);
    let content = response.content;

    // Clean up LLM response in case it outputs markdown code blocks
    content = content.trim();
    if (content.startsWith("```json")) {
      content = content.substring(7);
    } else if (content.startsWith("```")) {
      content = content.substring(3);
    }
    if (content.endsWith("```")) {
      content = content.substring(0, content.length - 3);
    }
    content = content.trim();

    const profileData = JSON.parse(content);
    return profileData;
  } catch (error) {
    throw new Error(`Ollama failed to extract structured profile: ${error.message}`);
  }
}
