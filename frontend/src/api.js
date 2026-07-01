const API_BASE = 'http://localhost:3000';

/**
 * Fetch helper for JSON responses.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMsg = 'API request failed';
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || errorMsg;
    } catch (_) {
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  /**
   * Check if a profile exists and retrieve it.
   */
  async getProfile() {
    return apiFetch('/api/profile');
  },

  /**
   * Upload and extract resume PDF.
   * @param {File} file 
   */
  async uploadResume(file) {
    const formData = new FormData();
    formData.append('resume', file);
    return apiFetch('/api/upload-resume', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Save the confirmed/edited profile data.
   * @param {object} profileData 
   */
  async saveProfile(profileData) {
    return apiFetch('/api/save-profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  /**
   * Poll bot running status and logs.
   */
  async getStatus() {
    return apiFetch('/api/status');
  },

  /**
   * Trigger Indeed job search and apply process.
   */
  async startBot(targetJob, targetLocations, jobTypes, workModes) {
    return apiFetch('/api/start', {
      method: 'POST',
      body: JSON.stringify({ targetJob, targetLocations, jobTypes, workModes }),
    });
  },

  /**
   * Stop the running bot.
   */
  async stopBot() {
    return apiFetch('/api/stop', {
      method: 'POST',
    });
  },

  /**
   * Submit an answer to a pending question.
   */
  async answerQuestion(questionId, answer) {
    return apiFetch('/api/answer-question', {
      method: 'POST',
      body: JSON.stringify({ questionId, answer }),
    });
  },

  /**
   * Test the query answering engine.
   */
  async queryTest(question) {
    return apiFetch('/api/query-test', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },
};
