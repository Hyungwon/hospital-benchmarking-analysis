const fs = require('fs');
const { chromium } = require('playwright');

const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '대전', '대구', '부산', '광주', '울산', '세종'];
const types = ['산부인과', '소아과'];
const OUTPUT_FILE = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking/hospital_list_expanded_v2.json';

async function scrape() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let allHospitals = [];
    let idCounter = 3000;

    for (const region of regions) {
        for (const type of types) {
            const query = `${region} ${type}`;
            console.log(`Searching for: ${query}`);
            
            try {
                // Naver Search - focusing on the Place section
                await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle' });
                
                // Click "More" or just extract from initial list
                const hospitals = await page.evaluate(() => {
                    const results = [];
                    // This selector targets the title links in Naver's smart place results
                    const items = document.querySelectorAll('span.Y_uD4, a.tzvAD, .place_bluelink');
                    items.forEach(el => {
                        const name = el.innerText.trim();
                        if (name && name.length > 1) {
                            results.push({ name });
                        }
                    });
                    return results;
                });

                for (const h of hospitals) {
                    const cleanName = h.name.split('\n')[0].trim();
                    if (cleanName && !allHospitals.some(existing => existing.name === cleanName)) {
                        allHospitals.push({
                            id: idCounter++,
                            name: cleanName,
                            search_query: query
                        });
                    }
                }
                
                console.log(`Found ${hospitals.length} items. Current total: ${allHospitals.length}`);
                if (allHospitals.length >= 1500) break;
            } catch (err) {
                console.error(`Error searching ${query}: ${err.message}`);
            }
            await page.waitForTimeout(1000); // Respectful delay
        }
        if (allHospitals.length >= 1500) break;
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allHospitals, null, 2));
    console.log(`Saved ${allHospitals.length} hospitals to ${OUTPUT_FILE}`);
    await browser.close();
}

scrape();
