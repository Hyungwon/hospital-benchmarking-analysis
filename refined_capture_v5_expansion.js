const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const resultPath = path.join(__dirname, 'analyzed_list_refined.json');
    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    // 1000개를 확실히 넘기기 위한 중소도시 및 세부 구 단위 키워드
    const subRegions = [
        "분당", "일산", "기흥", "단원", "덕양", "수정", "상록", "영통", "강서구", "사하구", "해운대구", "남구", "북구", 
        "의정부", "남양주", "평택", "시흥", "화성", "광명", "파주", "군포", "오산", "이천", "안성", "김포", "양주", 
        "원주", "춘천", "강릉", "충주", "아산", "익산", "군산", "목포", "여수", "순천", "경주", "김해", "양산", "거제"
    ];
    const keywords = [];
    subRegions.forEach(r => {
        keywords.push(`${r} 산부인과`);
        keywords.push(`${r} 내과`);
        keywords.push(`${r} 안과`);
    });

    console.log(`🚀 1,000개 달성 작전: 2차 정밀 수집 시작`);

    for (const kw of keywords) {
        // 실시간 유효 카운트 체크 (openstreetmap 제외)
        const currentValid = results.filter(h => h.official_url && !h.official_url.toLowerCase().includes('openstreetmap')).length;
        if (currentValid >= 1050) {
            console.log(`✅ 목표 달성! (현재 유효 데이터: ${currentValid}개)`);
            break;
        }

        const page = await context.newPage();
        try {
            console.log(`🔎 [${kw}] 수집 중... (현재 유효: ${currentValid}개)`);
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(1500);

            const links = await page.evaluate(() => {
                const urls = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    if (href.startsWith('http') && 
                        !href.includes('naver.com') && 
                        !href.includes('google') &&
                        !href.includes('search.naver') &&
                        !href.includes('kakaocorp') &&
                        !href.includes('daum.net')) {
                        urls.push({ name: a.innerText.trim(), url: href });
                    }
                });
                return urls;
            });

            for (const item of links) {
                if (!results.some(r => r.official_url === item.url)) {
                    results.push({
                        id: results.length + 1,
                        name: item.name || "Unknown",
                        official_url: item.url,
                        search_keyword: kw,
                        captured_at: new Date().toISOString()
                    });
                }
            }
            fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));

        } catch (e) {
            console.log(`⚠️ [${kw}] 에러 발생: ${e.message}`);
        } finally {
            await page.close();
        }
    }
    await browser.close();
    console.log(\"🏁 모든 수집 작업 종료\");
})();
