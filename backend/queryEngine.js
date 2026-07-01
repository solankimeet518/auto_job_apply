import { ChatOllama } from "@langchain/ollama";
import { config } from "./config.js";
import fs from 'fs';
import path from 'path';

const PROFILE_PATH = path.join(process.cwd(), 'profile.json');
const QA_MEMORY_PATH = path.join(process.cwd(), 'qa_memory.json');

/**
 * Normalizes question text to facilitate lookups in the local cache.
 * Removes punctuation, normalizes spacing, and converts to lowercase.
 * @param {string} qText - Raw question text.
 * @returns {string} - Normalized question text.
 */
export function normalizeQuestion(qText) {
  if (!qText) return '';
  return qText
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Loads the local Q&A cache from qa_memory.json.
 * @returns {object} - Cached Q&A map.
 */
function loadQAMemory() {
  if (fs.existsSync(QA_MEMORY_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(QA_MEMORY_PATH, 'utf8'));
    } catch (_) {
      return {};
    }
  }
  return {};
}

/**
 * Saves a Q&A pair to the local qa_memory.json cache.
 * @param {string} rawQuestion - The original question text.
 * @param {string} answer - The user's or AI's answer.
 */
export function saveToQAMemory(rawQuestion, answer) {
  const normalizedKey = normalizeQuestion(rawQuestion);
  if (!normalizedKey) return;

  const memory = loadQAMemory();
  memory[normalizedKey] = {
    originalQuestion: rawQuestion,
    answer: answer,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(QA_MEMORY_PATH, JSON.stringify(memory, null, 2));
}

/**
 * Queries Ollama to answer a job application question based on the user's profile.
 * Checks the local cache first.
 * @param {string} questionText - The question text from the Indeed form.
 * @returns {Promise<{ answer?: string, outOfContext: boolean }>} - Answering results.
 */
export async function generateAnswer(questionText) {
  if (!questionText) {
    return { outOfContext: true };
  }

  // 1. Check Q&A Memory Cache first
  const normalizedKey = normalizeQuestion(questionText);
  const memory = loadQAMemory();
  if (memory[normalizedKey]) {
    console.log(`[Cache Hit] Normalised key: "${normalizedKey}"`);
    return { answer: memory[normalizedKey].answer, outOfContext: false };
  }

  // 2. Load profile data as context
  if (!fs.existsSync(PROFILE_PATH)) {
    console.log('⚠️ No profile.json found, flagging question as out of context.');
    return { outOfContext: true };
  }

  let profileData;
  try {
    profileData = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to parse profile.json:', err);
    return { outOfContext: true };
  }

  // 3. Initialize Ollama model
  const model = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0.2, // Keep it relatively deterministic
  });

  // Construct context-rich system prompt
  const prompt = `You are an AI assistant applying for a job on behalf of the candidate. 
Your task is to answer a specific application form question using ONLY the provided profile details.

Candidate Profile (JSON):
---
${JSON.stringify(profileData, null, 2)}
---

Form Question:
"${questionText}"

Instructions:
1. If the profile details contain enough factual information to answer the question, write a concise, professional, and factual answer in the first person (I, my, me). 
2. Keep the answer brief (usually 1-3 sentences or just a number if the question asks for years/count) suitable for a job application text field.
3. If the profile does not contain enough information to answer the question (e.g. it asks for target salary, current CTC, or custom reasons not matching the candidate's history), output exactly: "OUT_OF_CONTEXT"
4. Do not invent or assume any details. If a fact is missing, output "OUT_OF_CONTEXT".
5. Output ONLY the answer or "OUT_OF_CONTEXT". Do not include conversational prefix/suffix, explanations, or markdown code blocks.`;

  try {
    const response = await model.invoke(prompt);
    let answerText = response.content.trim();

    // Clean markdown blocks
    if (answerText.startsWith("```")) {
      answerText = answerText.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
    }
    answerText = answerText.trim();

    if (answerText === 'OUT_OF_CONTEXT') {
      return { outOfContext: true };
    }

    // Cache the successfully generated answer
    saveToQAMemory(questionText, answerText);

    return { answer: answerText, outOfContext: false };
  } catch (error) {
    console.error(`Ollama answering query error: ${error.message}`);
    return { outOfContext: true };
  }
}
