const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const resultPath = path.join(__dirname, 'analyzed_list_refined.json');
    const outputDir = path.join(__dirname, 'screenshots_refined');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    // 경기도 및 광역시 추가 키워드
    const areas = ["수원", "성남", "용인", "부천", "안산", "화성", "남양주", "안양", "평택", "인천", "부산", "대구", "대전", "광주", "울산"];
    const types = ["산부인과", "여성병원", "여성의원"];
    
    const keywords = [];
    areas.forEach(a => types.forEach(t => keywords.push(`${a} ${t}`)));

    console.log(`🚀 부족한 항목 채우기 작업 시작 (전국 주요 도시 확장)`);

    for (const kw of keywords) {
        if (results.length >= 1004) break;

        const page = await context.newPage();
        try {
            console.log(`🔎 [전국 확장] '${kw}' 검색 중...`);
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const links = await page.evaluate(() => {
                const urls = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    if (href.startsWith('http') && 
                        !href.includes('naver.com') && 
                        !href.includes('modoodoc.com') &&
                        !href.includes('hidoc.co.kr') &&
                        !href.includes('my-doctor.io') &&
                        !href.includes('kakao.com') &&
                        !href.includes('daum.net')) {
                        urls.push(href);
                    }
                });
                return [...new Set(urls)];
            });

            for (const url of links) {
                if (results.some(r => r.official_url === url)) continue;
                if (results.length >= 1004) break;

                const hospitalPage = await context.newPage();
                try {
                    await hospitalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    
                    // 팝업 제거
                    await hospitalPage.evaluate(() => {
                        const s = ['[id*="popup"]', '[class*="popup"]', '[id*="notice"]', '.modal', '#divpop'];
                        s.forEach(sel => document.querySelectorAll(sel).forEach(el => el.style.display = 'none'));
                    });

                    const metadata = await hospitalPage.evaluate(() => ({
                        title: document.title,
                        desc: document.querySelector('meta[name="description"]')?.content || ''
                    }));

                    const menuItems = await hospitalPage.evaluate(() => {
                        return Array.from(document.querySelectorAll('nav li, header li, .menu li'))
                            .map(el => el.innerText.trim())
                            .filter(t => t.length > 1 && t.length < 15);
                    });

                    const hospitalId = results.length + 1;
                    await hospitalPage.screenshot({ path: path.join(outputDir, `${hospitalId}.png`) });

                    const data = {
                        id: hospitalId,
                        name: metadata.title.split('-')[0].split('|')[0].trim(),
                        official_url: url,
                        menu_count: menuItems.length,
                        menu_items: [...new Set(menuItems)],
                        captured_at: new Date().toISOString()
                    };

                    results.push(data);
                    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
                    console.log(`      ✨ [${results.length}] ${data.name} 완료`);

                    await hospitalPage.waitForTimeout(1000);
                } catch (e) {
                } finally {
                    await hospitalPage.close();
                }
            }
        } catch (err) {
        } finally {
            await page.close();
        }
    }
    await browser.close();
    console.log(`🏁 1004개 목표 달성 완료!`);
})();
