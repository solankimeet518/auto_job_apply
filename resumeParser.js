import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

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

  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    try {
      if (typeof pdf === 'function') {
        const data = await pdf(dataBuffer);
        return data.text;
      } else if (pdf && typeof pdf.PDFParse === 'function') {
        const parser = new pdf.PDFParse({ data: dataBuffer });
        await parser.load();
        const result = await parser.getText();
        return result.text;
      } else {
        throw new Error('Neither default function nor PDFParse class was found in pdf-parse module');
      }
    } catch (error) {
      throw new Error(`Failed to parse PDF resume: ${error.message}`);
    }
  } else {
    throw new Error(`Unsupported resume file format: ${ext}. Only .pdf is supported.`);
  }
}
