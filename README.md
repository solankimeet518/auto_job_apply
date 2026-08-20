# 🚀 Auto Job Apply & LinkedIn Outreach Automation Bot

An intelligent, AI-powered automation platform for job applications and recruiter networking. Built with **Bun**, **Playwright**, **React (Vite)**, and **Ollama (LangChain)** for fully local, private AI-driven question answering and connection note generation.

---

## 📑 Table of Contents

1. [Features Overview](#-features-overview)
2. [Prerequisites](#-prerequisites)
3. [Step-by-Step Installation](#-step-by-step-installation)
4. [AI Model Setup (Ollama)](#-ai-model-setup-ollama)
5. [Starting the Application](#-starting-the-application)
6. [How to Use Indeed Auto-Apply Bot](#-how-to-use-indeed-auto-apply-bot)
7. [How to Use LinkedIn Outreach Bot](#-how-to-use-linkedin-outreach-bot)
8. [Prompt Tuning & Few-Shot Studio](#-prompt-tuning--few-shot-studio)
9. [Safety & Anti-Ban Recommendations](#-safety--anti-ban-recommendations)
10. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## ✨ Features Overview

### 💼 Indeed Auto-Apply Bot (Modules 1–5)
* **Resume Parsing**: Automatically extracts candidate skills, experience, education, and contact details from PDF resumes using `pdf-parse`.
* **Smart Search & Filters**: Search by Job Title, Location, Date Posted (24h, 3d, 7d, 14d), Job Type (Full-time, Contract, Part-time), and Remote options.
* **Persistent Session**: Keeps your Indeed login authenticated inside a dedicated Chromium user profile (`backend/user_data`).
* **AI-Powered Form Auto-Fill**: Solves employer screening questions, salary expectations, years of experience, and dropdowns dynamically using Ollama LLM.
* **Live Application Tracking**: Real-time status logs and success/skip metrics.

### 🤝 LinkedIn Automated Outreach Bot (Module 6)
* **Targeted Recruiter & Peer Search**: Automates LinkedIn searches for Technical Recruiters, Hiring Managers, or Engineers.
* **Faceted Multi-Filter Automation**:
  * **People View**: Automatically switches from general search to People view.
  * **Location Filter**: Typeahead input search with suggestion selection and in-page update.
  * **Network Connections**: Toggle `2nd` and `3rd+` connection levels.
  * **Verified Filter**: Selects verified profiles.
* **Personalized AI Connection Notes**: Generates concise, custom connection requests under 300 characters tailored to each person's role and location.
* **Few-Shot Fine-Tuning Studio**: Test prompts in real-time, customize templates, and add custom sample input/output pairs (up to 500 characters).
* **Smart Duplicate Detection**: Automatically skips profiles that are already `"Pending"` or invited without withdrawing invitations.
* **Custom Session Limits**: Configure quota anywhere from **1 to 1,000 invitations per session**.
* **Human Pacing**: Randomized organic delays between actions to prevent account flagging.

---

## 🛠️ Prerequisites

Before installing, make sure your system has:

1. **Bun Runtime** (v1.1+ recommended)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Ollama** (for local AI inference)
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
3. **Playwright Chromium Dependencies** (Linux only)
   ```bash
   bunx playwright install chromium --with-deps
   ```
4. **Display Server** (Linux GUI / X11 / Wayland):
   Ensure `DISPLAY=:0` or an active desktop environment is available for headful browser automation.

---

## 📦 Step-by-Step Installation

Clone the repository and install dependencies for both the backend and frontend:

### 1. Clone Repository
```bash
git clone https://github.com/solankimeet518/auto_job_apply.git
cd auto_job_apply
```

### 2. Install Backend Dependencies
```bash
cd backend
bun install
bunx playwright install chromium
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
bun install
```

---

## 🧠 AI Model Setup (Ollama)

The bot utilizes local LLMs via Ollama for zero-cost, private AI inference.

1. **Start the Ollama service**:
   ```bash
   ollama serve
   ```
2. **Pull your preferred model** (e.g. `llama3`, `llama3.2`, `mistral`, or `qwen2.5-coder`):
   ```bash
   ollama pull llama3
   ```
   *(Default model configured in `backend/queryEngine.js` is `llama3`)*

---

## 🚀 Starting the Application

You need both the Backend API server and the Frontend Vite development server running:

### Terminal 1: Backend Server (Port 3000)
```bash
cd backend
DISPLAY=:0 bun start
```

### Terminal 2: Frontend Dashboard (Port 5173)
```bash
cd frontend
bun run dev
```

Open your browser and navigate to: **[http://localhost:5173](http://localhost:5173)**

---

## 🎯 How to Use Indeed Auto-Apply Bot

1. **Upload Resume**:
   * Open the **Dashboard** at `http://localhost:5173/`.
   * Upload your PDF resume in the **Candidate Profile** tab.
   * Review parsed skills, experience, and contact information.
2. **Configure Search Filters**:
   * Set Job Title (e.g., `Full Stack Developer`, `Python Engineer`).
   * Enter Target Location (e.g., `Remote`, `New York, NY`).
   * Select Date Posted and Job Type filters.
3. **First-Time Indeed Login**:
   * When you click **"Start Applying"**, a Chromium browser window will open.
   * If you are not logged in, the bot will pause and prompt you to log into your Indeed account.
   * Once logged in, your session is saved permanently in `backend/user_data`.
4. **Automated Application**:
   * The bot scans search results, identifies "Easily apply" jobs, fills multi-step application forms using AI, attaches your resume, and submits the applications.

---

## 🤝 How to Use LinkedIn Outreach Bot

1. **Navigate to LinkedIn Bot Tab**:
   * Click on the **LinkedIn Outreach** tab in the top navigation bar.
2. **Configure Outreach Criteria**:
   * **Target Keywords**: e.g., `Software Engineer Recruiter`, `Technical Talent Acquisition`.
   * **Target Location**: e.g., `United States`, `London`, `Ahmedabad` (optional).
   * **Connection Degrees**: Check `2nd` and `3rd+` connections.
   * **Max Invitations**: Choose anywhere between **1 to 1,000 invitations per session** (or use quick presets: `10`, `25`, `50`, `100`, `250`, `500`, `1000`).
3. **Configure Connection Note Mode**:
   * **AI Custom Note (Ollama)**: Generates highly tailored notes referencing the contact's name and role.
   * **Custom Template**: Use placeholders like `{name}`, `{role}`, `{company}`, `{job}`:
     ```text
     Hi {name}, I noticed your work as {role}. I am an experienced Software Engineer and would love to connect!
     ```
   * **No Note**: Sends instant direct connection requests.
4. **First-Time LinkedIn Login**:
   * Click **"Start Outreach"**.
   * A Chromium window will open. If you aren't authenticated, log in to your LinkedIn account.
   * Your session is stored in `backend/user_data` so you won't need to log in again.
5. **Monitor Live Console**:
   * Watch live progress, profile visits, sent connection notes, and skip counters directly in the embedded terminal.

---

## 🎨 Prompt Tuning & Few-Shot Studio

Under the **AI Fine-Tuning & Sample Prompts Studio** on the LinkedIn dashboard:

* **Tone Selector**: Professional, Friendly, Casual, Direct, Enthusiastic.
* **Custom Instructions**: Inject custom constraints (e.g., *"Mention 4+ years of React experience"*, *"Keep tone concise and direct"*).
* **Sample Few-Shot Manager**:
  * Add custom training input/output examples (up to 500 characters).
  * Ollama uses these samples as few-shot in-context learning to match your personal writing style.
* **Live Note Tester**: Test note outputs for simulated recruiter profiles before launching your live outreach session.

---

## 🛡️ Safety & Anti-Ban Recommendations

To keep your LinkedIn and Indeed accounts safe:

* **Daily Limits**: We recommend keeping LinkedIn invitations to **20–30 invites per day** for standard free accounts, or **50–80 invites per day** for LinkedIn Premium / Sales Navigator.
* **Organic Delays**: The bot has built-in 3–6 second randomized pauses between profile visits.
* **Pending Protection**: The bot automatically skips profiles marked as `"Pending"` to prevent accidental invitation withdrawal.

---

## ❓ Troubleshooting & FAQ

### Q1: `launchPersistentContext: profile is already in use by another instance`
* **Fix**: Another Chromium browser process is currently using `backend/user_data`. Close open automated browser windows or stop any running bot tasks in the terminal.

### Q2: Bot does not open a visible browser window on Linux
* **Fix**: Ensure your `DISPLAY` environment variable is set when launching the backend:
  ```bash
  DISPLAY=:0 bun start
  ```

### Q3: Ollama fails or notes are blank
* **Fix**: Ensure Ollama is running and the model is downloaded:
  ```bash
  ollama list
  ollama run llama3
  ```

### Q4: How do I clear my saved browser login session?
* **Fix**: Delete the `backend/user_data` folder and re-login:
  ```bash
  rm -rf backend/user_data
  ```

---

## 📄 License
MIT License. Built for educational and productivity automation purposes.
