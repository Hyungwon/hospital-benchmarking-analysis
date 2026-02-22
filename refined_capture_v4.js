const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const resultPath = path.join(__dirname, 'google_analyzed_list.json');
    const outputDir = path.join(__dirname, 'screenshots_google');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    // 1004개를 채우기 위한 다양한 지역별 키워드 리스트 생성
    const regions = ["서울", "강남", "서초", "송파", "강서", "강북", "노원", "영등포", "부산", "해운대", "대구", "인천", "광주", "대전", "울산", "수원", "성남", "고양", "용인", "부천", "안산", "청주", "천안", "전주", "창원", "포항", "제주"];
    const keywords = [];
    regions.forEach(r => {
        keywords.push(`${r} 산부인과`);
        keywords.push(`${r} 여성병원`);
        keywords.push(`${r} 소아과`);
    });

    console.log(`🚀 고도화 분석 v4 (다중 키워드 전략) 시작`);

    for (const kw of keywords) {
        if (results.length >= 1004) break;

        const page = await context.newPage();
        try {
            console.log(`\n🔎 키워드 [${kw}] 검색 중...`);
            // 네이버 검색 (더 단순한 로직으로 URL 추출)
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const links = await page.evaluate(() => {
                const urls = [];
                // 모든 링크를 훑어서 naver가 아닌 외부 사이트 주소 수집
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    if (href.startsWith('http') && 
                        !href.includes('naver.com') && 
                        !href.includes('google') &&
                        !href.includes('search.naver') &&
                        !href.includes('map.naver') &&
                        !href.includes('entry/place') &&
                        !href.includes('.pstatic.net') &&
                        !href.includes('daum.net') &&
                        !href.includes('youtube.com') &&
                        !href.includes('wikipedia.org')) {
                        urls.push(href);
                    }
                });
                return [...new Set(urls)];
            });

            console.log(`   ✅ 유효 후보 ${links.length}개 발견`);

            for (const url of links) {
                if (results.some(r => r.official_url === url)) continue;
                if (results.length >= 1004) break;

                const hospitalPage = await context.newPage();
                try {
                    console.log(`   🔗 분석 중: ${url}`);
                    await hospitalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await hospitalPage.waitForTimeout(1500);

                    // 공지/팝업 제거 스크립트
                    await hospitalPage.evaluate(() => {
                        const s = ['[id*="popup"]', '[class*="popup"]', '[id*="notice"]', '.modal', '#divpop', '[class*="layer"]'];
                        s.forEach(sel => document.querySelectorAll(sel).forEach(el => el.style.display = 'none'));
                        document.querySelectorAll('div').forEach(el => {
                            if (el.innerText.includes('오늘 하루')) el.style.display = 'none';
                        });
                    });

                    const metadata = await hospitalPage.evaluate(() => ({
                        title: document.title,
                        desc: document.querySelector('meta[name="description"]')?.content || ''
                    }));

                    // 텍스트 기반 IA 추출
                    const menuItems = await hospitalPage.evaluate(() => {
                        return Array.from(document.querySelectorAll('nav li, header li, .menu li'))
                            .map(el => el.innerText.trim())
                            .filter(t => t.length > 1 && t.length < 12);
                    });

                    const hospitalId = results.length + 1;
                    await hospitalPage.screenshot({ path: path.join(outputDir, `${hospitalId}.png`), fullPage: false });

                    const data = {
                        id: hospitalId,
                        name: metadata.title.split('-')[0].split('|')[0].trim() || "Unknown",
                        official_url: url,
                        layout_type: menuItems.length > 8 ? "복합형" : "표준형",
                        menu_count: menuItems.length,
                        menu_items: [...new Set(menuItems)],
                        captured_at: new Date().toISOString()
                    };

                    results.push(data);
                    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
                    console.log(`      ✨ [${results.length}] 완료: ${data.name}`);

                    await hospitalPage.waitForTimeout(500); // 텀
                } catch (e) {
                } finally {
                    await hospitalPage.close();
                }
            }
        } catch (err) {
            console.error(`❌ 오류: ${err.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log(`🏁 작업 완료: 총 ${results.length}개 수집됨`);
})();
