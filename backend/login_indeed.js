import { launchBrowser } from './browserLauncher.js';

async function main() {
  try {
    const { context, page } = await launchBrowser();
    console.log('✅ Browser launched successfully!');
    
    console.log('🌐 Navigating to Indeed Login...');
    await page.goto('https://in.indeed.com/secure/login');
    
    console.log('🔑 Please enter your credentials and sign in directly inside the browser window.');
    console.log('⏳ Keeping this browser session active for 5 minutes so you can log in...');
    console.log('ℹ️ All session cookies will be persistently cached in: backend/user_data/');
    
    // Wait for 5 minutes (300,000 ms)
    await new Promise(resolve => setTimeout(resolve, 300000));
    
    await context.close();
    console.log('✅ Browser closed. Indeed session saved successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during Indeed login session:', err);
    process.exit(1);
  }
}

main();
