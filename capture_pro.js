const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const WORK_DIR = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking';
const INPUT_FILE = path.join(WORK_DIR, 'official_urls_1000.json');
const OUTPUT_FILE = path.join(WORK_DIR, 'analyzed_list_refined.json');
const SCREENSHOT_DIR = path.join(WORK_DIR, 'screenshots_pro');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
    let inputData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    
    let existingData = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        } catch (e) {}
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });

    let count = 0;
    for (const hospital of inputData) {
        if (!hospital.official_url || hospital.official_url.includes('openstreetmap')) continue;
        
        // Skip if already has a screenshot in this run or existing data
        if (existingData.some(h => h.name === hospital.name && h.screenshot && fs.existsSync(h.screenshot))) {
            continue;
        }

        console.log(`[Processing ${existingData.length + 1}] ${hospital.name}`);
        
        const page = await context.newPage();
        try {
            // Validation & Navigation
            await page.goto(hospital.official_url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            
            // Check if it's a search result page (heuristic)
            const currentUrl = page.url();
            if (currentUrl.includes('search.naver.com') || currentUrl.includes('google.com/search')) {
                // Try to find the real website link on this page
                const realUrl = await page.evaluate(() => {
                    const link = document.querySelector('a[href*="http"]:not([href*="naver.com"]):not([href*="google.com"])');
                    return link ? link.href : null;
                });
                if (realUrl) {
                    console.log(`  Redirecting to real URL: ${realUrl}`);
                    await page.goto(realUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                }
            }

            await page.waitForTimeout(3000);

            // Popup removal
            await page.evaluate(() => {
                const selectors = ['.popup', '.modal', '#pop', '[id*="popup"]', '[class*="popup"]', '.layer'];
                selectors.forEach(s => {
                    document.querySelectorAll(s).forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.position === 'fixed' || style.position === 'absolute') el.remove();
                    });
                });
            });

            const screenshotPath = path.join(SCREENSHOT_DIR, `${hospital.id}_${hospital.name.replace(/\s+/g, '_')}.png`);
            await page.screenshot({ path: screenshotPath });

            const result = {
                ...hospital,
                official_url: page.url(),
                screenshot: screenshotPath,
                processed_at: new Date().toISOString()
            };

            const idx = existingData.findIndex(h => h.name === hospital.name);
            if (idx > -1) existingData[idx] = result;
            else existingData.push(result);

            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));
            
            count++;
            if (existingData.length % 100 === 0) {
                console.log(`\n*** REPORT: ${existingData.length} hospitals processed so far ***\n`);
            }
        } catch (err) {
            console.error(`  Error: ${err.message}`);
        } finally {
            await page.close();
        }
        
        if (existingData.length >= 1200) break;
    }

    await browser.close();
    console.log(`Done. Total analyzed: ${existingData.length}`);
}

run();
