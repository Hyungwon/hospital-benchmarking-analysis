const fs = require('fs');
const { chromium } = require('playwright');

const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '대전', '대구', '부산', '광주', '울산', '세종'];
const types = ['산부인과', '소아과'];
const OUTPUT_FILE = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking/hospital_list_expanded_v4.json';

async function scrape() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let allHospitals = [];
    let idCounter = 5000;

    for (const region of regions) {
        for (const type of types) {
            const query = `${region} ${type}`;
            console.log(`Searching for: ${query}`);
            
            try {
                // Use Naver Map Search for more results
                await page.goto(`https://map.naver.com/v5/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle' });
                
                // Switch to search result iframe
                const frame = page.frameLocator('#searchIframe');
                
                // Wait for results
                await frame.locator('.entry_gate').first().waitFor({ timeout: 10000 }).catch(() => {});
                
                // Extract from the list
                const hospitals = await frame.locator('.ue96s, .O69Y1').evaluateAll(items => {
                    return items.map(el => {
                        const name = el.querySelector('.place_bluelink, .TYp7W')?.innerText.trim();
                        return { name };
                    });
                });

                for (const h of hospitals) {
                    if (h.name && !allHospitals.some(existing => existing.name === h.name)) {
                        allHospitals.push({
                            id: idCounter++,
                            name: h.name,
                            search_query: query
                        });
                    }
                }
                
                console.log(`Found ${hospitals.length} items. Total: ${allHospitals.length}`);
                if (allHospitals.length >= 1500) break;
            } catch (err) {
                console.error(`Error searching ${query}: ${err.message}`);
            }
        }
        if (allHospitals.length >= 1500) break;
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allHospitals, null, 2));
    console.log(`Saved ${allHospitals.length} hospitals to ${OUTPUT_FILE}`);
    await browser.close();
}

scrape();
