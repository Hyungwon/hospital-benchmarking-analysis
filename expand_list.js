const fs = require('fs');
const { chromium } = require('playwright');

const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '대전', '대구', '부산', '광주', '울산', '세종'];
const types = ['산부인과', '소아과'];
const OUTPUT_FILE = '/Volumes/Macintosh HD EX/elohim4/workspace/hospital_benchmarking/hospital_list_expanded.json';

async function scrape() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let allHospitals = [];
    let idCounter = 2000; // Start high to avoid overlap

    for (const region of regions) {
        for (const type of types) {
            const query = `${region} ${type}`;
            console.log(`Searching for: ${query}`);
            
            try {
                // Using Naver Place or Search
                await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle' });
                
                // Extract hospital names and their websites if available
                const hospitals = await page.evaluate(() => {
                    const results = [];
                    // Naver Smart Place results often have these classes
                    const items = document.querySelectorAll('.C6_Yn, .place_bluelink, .TYp7W');
                    items.forEach(el => {
                        const name = el.innerText.trim();
                        if (name.length > 2) {
                            results.push({ name });
                        }
                    });
                    return results;
                });

                for (const h of hospitals) {
                    if (!allHospitals.some(existing => existing.name === h.name)) {
                        allHospitals.push({
                            id: idCounter++,
                            name: h.name,
                            search_query: query
                        });
                    }
                }
                
                console.log(`Found ${hospitals.length} items for ${query}. Total: ${allHospitals.length}`);
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
