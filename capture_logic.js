const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const WORK_DIR = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking';
const INPUT_FILE = path.join(WORK_DIR, 'official_urls_1000.json');
const OUTPUT_FILE = path.join(WORK_DIR, 'analyzed_list_refined.json');
const SCREENSHOT_DIR = path.join(WORK_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
    let inputData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    let existingData = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });

    let count = 0;
    for (const hospital of inputData) {
        // Skip if already analyzed (by name or official_url)
        if (existingData.some(h => h.name === hospital.name && h.official_url === hospital.official_url)) {
            continue;
        }

        console.log(`[${count + 1}] Processing: ${hospital.name} (${hospital.official_url})`);
        
        const page = await context.newPage();
        try {
            // Logic to handle search results if necessary, or just visit official_url
            // Here we prioritize the official_url
            await page.goto(hospital.official_url, { waitUntil: 'networkidle', timeout: 30000 });
            
            // Wait 3 seconds as requested
            await page.waitForTimeout(3000);

            // Basic popup removal (common selectors)
            await page.evaluate(() => {
                const selectors = [
                    '[class*="popup"]', '[id*="popup"]', '.modal', '.layer-popup', 
                    '[class*="close"]', '[id*="close"]'
                ];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        // Very naive: if it looks like a close button or popup, try to hide/remove
                        if (el.innerText.includes('닫기') || el.innerText.includes('Close') || el.style.position === 'absolute' || el.style.position === 'fixed') {
                            el.style.display = 'none';
                        }
                    });
                });
            });

            const screenshotPath = path.join(SCREENSHOT_DIR, `${hospital.id}_${hospital.name.replace(/\s+/g, '_')}.png`);
            await page.screenshot({ path: screenshotPath });

            const analyzed = {
                ...hospital,
                screenshot: screenshotPath,
                analyzed_at: new Date().toISOString()
            };
            existingData.push(analyzed);
            
            // Save after each success to be safe
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));
            
            count++;
            if (count % 100 === 0) {
                console.log(`--- Progress Report: ${count} hospitals processed ---`);
            }
        } catch (err) {
            console.error(`Failed to capture ${hospital.name}: ${err.message}`);
        } finally {
            await page.close();
        }

        if (existingData.length >= 1200) {
            console.log("Target 1200 reached.");
            // But we might need to find MORE if inputData is only ~1153
        }
    }

    await browser.close();
}

run().catch(console.error);
