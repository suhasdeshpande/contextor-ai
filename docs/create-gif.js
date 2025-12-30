/**
 * Script to create GIF from HTML visualization
 * Requires: puppeteer, gifencoder, canvas
 * 
 * Run: node docs/create-gif.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function createGIF() {
    console.log('🎬 Starting GIF creation...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    const htmlPath = path.join(__dirname, 'create-gif.html');
    await page.goto(`file://${htmlPath}`);
    
    // Wait for animations to complete (20 steps * 200ms + buffer)
    await page.waitForTimeout(15000);
    
    // Take screenshot
    const screenshotPath = path.join(__dirname, 'context-problem-demo.png');
    await page.screenshot({
        path: screenshotPath,
        fullPage: true
    });
    
    await browser.close();
    
    console.log(`✅ Screenshot saved to ${screenshotPath}`);
    console.log('💡 To create GIF, use:');
    console.log('   - Online tool: https://ezgif.com/video-to-gif');
    console.log('   - Or: ffmpeg -i input.mp4 -vf "fps=10,scale=1200:-1" output.gif');
    console.log('   - Or: Use screen recording software to record the HTML page');
}

createGIF().catch(console.error);

