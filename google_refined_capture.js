const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const keywords = ["산부인과", "여성병원", "여성의원"];
    const resultPath = path.join(__dirname, 'google_analyzed_list.json');
    const outputDir = path.join(__dirname, 'screenshots_google');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    
    for (const kw of keywords) {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            console.log(`\n🔎 키워드 [${kw}] 구글 검색 시도...`);
            // 구글 검색 결과 페이지
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(kw)}`, { waitUntil: 'networkidle' });

            // 검색 결과 추출 (더 넓은 선택자 사용)
            const links = await page.evaluate(() => {
                const results = [];
                // 구글 검색 결과의 링크들을 더 광범위하게 수집
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    if (href.startsWith('http') && 
                        !href.includes('google.com') && 
                        !href.includes('gstatic.com') && 
                        !href.includes('youtube.com') &&
                        !href.includes('naver.com') &&
                        !href.includes('daum.net') &&
                        !href.includes('tistory.com') &&
                        !href.includes('blogspot.com')) {
                        results.push(href);
                    }
                });
                return results;
            });

            const uniqueLinks = [...new Set(links)].slice(0, 30); // 한 키워드당 상위 30개 정도만
            console.log(`   ✅ 발견된 후보 링크: ${uniqueLinks.length}개`);

            for (const url of uniqueLinks) {
                if (results.some(r => r.official_url === url)) continue;
                if (results.length >= 1004) break;

                const hospitalPage = await context.newPage();
                try {
                    await hospitalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    
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
                    console.log(`      ✨ [${results.length}] 완료: ${data.name}`);

                    await hospitalPage.waitForTimeout(500);
                } catch (e) {} finally {
                    await hospitalPage.close();
                }
            }

        } catch (error) {
            console.error(`❌ 오류: ${error.message}`);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    console.log(`🏁 수집 완료: 총 ${results.length}개`);
})();
