const fs = require('fs');
const { chromium } = require('playwright');

const INPUT_FILE = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking/hospital_list_expanded.json';
const OUTPUT_FILE = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking/hospital_urls_expanded.json';

async function findUrls() {
    const hospitals = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const results = [];
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const h of hospitals) {
        console.log(`Searching URL for: ${h.name}`);
        try {
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(h.name)}`, { waitUntil: 'networkidle' });
            
            const url = await page.evaluate(() => {
                // Look for official website link in the search result
                const websiteLink = document.querySelector('a[href*="http"]:not([href*="naver.com"]):not([href*="search.naver"])');
                return websiteLink ? websiteLink.href : null;
            });

            results.push({
                ...h,
                official_url: url
            });
            
            // Periodically save
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        } catch (err) {
            console.error(`Error finding URL for ${h.name}: ${err.message}`);
        }
    }

    await browser.close();
    console.log(`Finished finding URLs. Saved to ${OUTPUT_FILE}`);
}

findUrls();
