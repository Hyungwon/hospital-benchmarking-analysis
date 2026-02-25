const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const WORK_DIR = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking';
const FILE1 = path.join(WORK_DIR, 'official_urls_1000.json');
const FILE2 = path.join(WORK_DIR, 'hospital_urls_expanded.json');
const OUTPUT_FILE = path.join(WORK_DIR, 'analyzed_list_refined.json');
const SCREENSHOT_DIR = path.join(WORK_DIR, 'screenshots_new');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
    let data1 = JSON.parse(fs.readFileSync(FILE1, 'utf8'));
    let data2 = [];
    if (fs.existsSync(FILE2)) {
        data2 = JSON.parse(fs.readFileSync(FILE2, 'utf8'));
    }

    // Combine and deduplicate by name
    let combined = [...data1];
    data2.forEach(h2 => {
        if (!combined.some(h1 => h1.name.includes(h2.name.split('\n')[0]))) {
            combined.push({
                id: h2.id,
                name: h2.name.split('\n')[0],
                official_url: h2.official_url
            });
        }
    });

    console.log(`Total hospitals to process: ${combined.length}`);

    let existingData = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        } catch (e) {
            console.error("Error reading existing output file, starting fresh.");
        }
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    let count = 0;
    let newProcessed = 0;

    for (const hospital of combined) {
        if (!hospital.official_url || hospital.official_url.includes('naver.com') || hospital.official_url.includes('openstreetmap.org')) {
            continue;
        }

        // Skip if already has a screenshot in existingData
        if (existingData.some(h => h.name === hospital.name && h.screenshot)) {
            continue;
        }

        console.log(`[${++newProcessed}] Capturing: ${hospital.name} - ${hospital.official_url}`);
        
        const page = await context.newPage();
        try {
            await page.goto(hospital.official_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Wait 3 seconds
            await page.waitForTimeout(3000);

            // Popup removal
            await page.evaluate(() => {
                const selectors = [
                    '.modal', '.popup', '#popup', '.layer-popup', '[id*="pop"]', '[class*="pop"]',
                    '.close', '#close', '[class*="close"]'
                ];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        try {
                            const style = window.getComputedStyle(el);
                            if (style.position === 'fixed' || style.position === 'absolute' || parseInt(style.zIndex) > 100) {
                                el.style.display = 'none';
                            }
                        } catch(e) {}
                    });
                });
            });

            const safeName = hospital.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
            const screenshotPath = path.join(SCREENSHOT_DIR, `${hospital.id}_${safeName}.png`);
            await page.screenshot({ path: screenshotPath });

            const analyzed = {
                ...hospital,
                screenshot: screenshotPath,
                captured_at: new Date().toISOString()
            };
            
            // Update or add
            const idx = existingData.findIndex(h => h.name === hospital.name);
            if (idx > -1) {
                existingData[idx] = analyzed;
            } else {
                existingData.push(analyzed);
            }

            // Save progress
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));

            if (existingData.length % 100 === 0) {
                console.log(`>>> PROGRESS: ${existingData.length} hospitals analyzed in total. <<<`);
            }
        } catch (err) {
            console.error(`Failed ${hospital.name}: ${err.message}`);
        } finally {
            await page.close();
        }

        if (existingData.length >= 1200) {
            // Check if we reached the goal
        }
    }

    await browser.close();
    console.log(`Task finished. Total analyzed: ${existingData.length}`);
}

run().catch(console.error);
