const fs = require('fs');
const { chromium } = require('playwright');

const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '대전', '대구', '부산', '광주', '울산', '세종'];
const types = ['산부인과', '소아과'];
const OUTPUT_FILE = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking/hospital_list_expanded_v3.json';

async function scrape() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let allHospitals = [];
    let idCounter = 4000;

    for (const region of regions) {
        for (const type of types) {
            const query = `${region} ${type}`;
            console.log(`Searching for: ${query}`);
            
            try {
                // Naver Search
                await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle' });
                
                // Extract names AND urls from the place result
                const hospitals = await page.evaluate(() => {
                    const results = [];
                    // Target the smart place section items
                    const items = document.querySelectorAll('li.bx._list_item, .C6_Yn, .place_bluelink');
                    items.forEach(el => {
                        const nameEl = el.querySelector('span.Y_uD4, .name, .place_bluelink');
                        const name = nameEl ? nameEl.innerText.trim() : el.innerText.trim();
                        
                        // Try to find a website link if present in the item
                        const linkEl = el.querySelector('a[href*="http"]:not([href*="naver.com"])');
                        const url = linkEl ? linkEl.href : null;

                        if (name && name.length > 1) {
                            results.push({ name, url });
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
                            official_url: h.url,
                            search_query: query
                        });
                    }
                }
                
                console.log(`Found ${hospitals.length} items. Total: ${allHospitals.length}`);
                
                // If we don't have enough, try page 2? No, let's just use more specific queries
                if (allHospitals.length < 1500) {
                    const subDistricts = ['강남구', '서초구', '송파구', '수원시', '성남시', '용인시'];
                    // ... this could be a lot of queries.
                }
            } catch (err) {
                console.error(`Error searching ${query}: ${err.message}`);
            }
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allHospitals, null, 2));
    console.log(`Saved ${allHospitals.length} hospitals to ${OUTPUT_FILE}`);
    await browser.close();
}

scrape();
