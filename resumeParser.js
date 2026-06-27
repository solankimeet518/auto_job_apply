import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

/**
 * Parses and extracts text from a PDF or TXT resume file.
 * @param {string} filePath - Absolute or relative path to the resume file.
 * @returns {Promise<string>} - Extracted plain text content.
 */
export async function parseResume(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Resume file not found at path: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  } else if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    try {
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to parse PDF resume: ${error.message}`);
    }
  } else {
    throw new Error(`Unsupported resume file format: ${ext}. Only .pdf and .txt are supported.`);
  }
}
