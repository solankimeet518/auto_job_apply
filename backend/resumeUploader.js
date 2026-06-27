import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// HTML content for the modern upload page
const htmlPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Resume PDF</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: rgba(20, 22, 33, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #8b5cf6;
      --primary-hover: #7c3aed;
      --glow: rgba(139, 92, 246, 0.15);
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      font-family: 'Outfit', sans-serif;
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
      position: relative;
    }

    /* Ambient background glows */
    body::before, body::after {
      content: '';
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: var(--glow);
      filter: blur(100px);
      z-index: -1;
    }
    body::before { top: -10%; left: -10%; }
    body::after { bottom: -10%; right: -10%; }

    .container {
      width: 100%;
      max-width: 500px;
      padding: 24px;
      z-index: 1;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 40px;
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      text-align: center;
      transition: transform 0.3s ease, border-color 0.3s ease;
    }

    .card:hover {
      border-color: rgba(139, 92, 246, 0.3);
    }

    h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #fff 0%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p {
      color: var(--text-muted);
      font-size: 15px;
      margin-bottom: 32px;
      font-weight: 300;
    }

    .drop-zone {
      border: 2px dashed var(--border);
      border-radius: 16px;
      padding: 40px 20px;
      cursor: pointer;
      position: relative;
      background: rgba(255, 255, 255, 0.02);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .drop-zone.dragover {
      border-color: var(--primary);
      background: rgba(139, 92, 246, 0.05);
      box-shadow: inset 0 0 12px rgba(139, 92, 246, 0.1);
      transform: scale(1.02);
    }

    .drop-zone-icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: inline-block;
      transition: transform 0.3s ease;
    }

    .drop-zone.dragover .drop-zone-icon {
      transform: translateY(-8px);
    }

    .drop-zone-text {
      font-size: 14px;
      color: var(--text-muted);
      font-weight: 400;
    }

    .drop-zone-text span {
      color: var(--primary);
      font-weight: 600;
    }

    input[type="file"] {
      display: none;
    }

    .btn {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      border: none;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 24px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.25);
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(139, 92, 246, 0.4);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      background: #374151;
      box-shadow: none;
      color: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }

    .file-name {
      margin-top: 16px;
      font-size: 14px;
      color: var(--primary);
      font-weight: 600;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Resume Uploader</h1>
      <p>Please upload your resume PDF to configure the bot.</p>
      
      <form action="/upload" method="POST" enctype="multipart/form-data" id="uploadForm">
        <label class="drop-zone" id="dropZone">
          <span class="drop-zone-icon">📄</span>
          <div class="drop-zone-text">Drag and drop your PDF resume here, or <span>browse files</span></div>
          <input type="file" name="resume" accept=".pdf" id="fileInput" required>
        </label>
        <div class="file-name" id="fileName"></div>
        <button type="submit" class="btn" id="submitBtn" disabled>Upload & Parse</button>
      </form>
    </div>
  </div>

  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const submitBtn = document.getElementById('submitBtn');

    // Drag and drop handlers
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        fileInput.files = files;
        updateFileInfo(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        updateFileInfo(fileInput.files[0]);
      }
    });

    function updateFileInfo(file) {
      fileName.textContent = 'Selected: ' + file.name;
      fileName.style.display = 'block';
      submitBtn.removeAttribute('disabled');
    }
  </script>
</body>
</html>
`;

// Success HTML page
const successPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Success</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #090a0f;
      color: #f3f4f6;
      font-family: 'Outfit', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(20, 22, 33, 0.6);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 24px;
      padding: 40px;
      backdrop-filter: blur(16px);
      text-align: center;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 24px;
      display: inline-block;
      animation: scaleUp 0.5s ease;
    }
    h1 {
      color: #10b981;
      font-size: 26px;
      margin-bottom: 8px;
    }
    p {
      color: #9ca3af;
      font-size: 14px;
    }
    @keyframes scaleUp {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="card" id="successCard">
    <div class="icon">✅</div>
    <h1>Upload Complete!</h1>
    <p>Your resume was successfully saved as <b>resume.pdf</b>. You can close this window now.</p>
  </div>
</body>
</html>
`;

/**
 * Starts a local server, opens Chromium via Playwright, and waits for the user to upload a resume PDF.
 * @returns {Promise<string>} - The local path of the saved resume PDF.
 */
export async function runResumeUploadFlow() {
  return new Promise(async (resolve, reject) => {
    let server;
    let browser;
    let serverClosed = false;

    const cleanup = async () => {
      if (server && !serverClosed) {
        server.stop();
        serverClosed = true;
      }
      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
    };

    try {
      const port = 3000;

      // 1. Start the Bun.serve web server
      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          if (url.pathname === '/') {
            return new Response(htmlPage, {
              headers: { 'Content-Type': 'text/html' }
            });
          }

          if (url.pathname === '/upload' && req.method === 'POST') {
            try {
              const formData = await req.formData();
              const file = formData.get('resume');
              
              if (!file || !(file instanceof File)) {
                return new Response('No file provided', { status: 400 });
              }

              const buffer = await file.arrayBuffer();
              const targetPath = path.join(process.cwd(), 'resume.pdf');
              
              // Write file locally
              fs.writeFileSync(targetPath, Buffer.from(buffer));
              
              // Resolve promise with the saved path after a small delay to let page render
              setTimeout(async () => {
                await cleanup();
                resolve(targetPath);
              }, 1500);

              return new Response(successPage, {
                headers: { 'Content-Type': 'text/html' }
              });
            } catch (err) {
              return new Response(`Upload failed: ${err.message}`, { status: 500 });
            }
          }

          return new Response('Not Found', { status: 404 });
        }
      });

      console.log(`\n🌐 Started local upload server at http://localhost:${port}`);
      console.log('🖥️  Launching browser window for resume upload...');

      // 2. Launch Chromium browser to let the user upload
      browser = await chromium.launch({
        headless: false,
      });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`http://localhost:${port}`);

      // Handle window close event
      page.on('close', async () => {
        setTimeout(async () => {
          await cleanup();
          if (fs.existsSync(path.join(process.cwd(), 'resume.pdf'))) {
            resolve(path.join(process.cwd(), 'resume.pdf'));
          } else {
            reject(new Error('User closed upload window without completing upload.'));
          }
        }, 500);
      });

    } catch (err) {
      await cleanup();
      reject(err);
    }
  });
}
