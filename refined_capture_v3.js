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

    // 검색 노이즈를 줄이기 위해 더 구체적인 키워드 사용
    const keywords = [
        "강남 산부인과 추천", "서울 산부인과 병원", "대구 여성병원", "부산 산부인과 의원",
        "인천 산부인과 추천", "광주 여성의원", "대전 산부인과 병원", "경기 산부인과 의원",
        "유명 산부인과 홈페이지", "산후조리원 있는 산부인과"
    ];
    
    for (const kw of keywords) {
        const page = await context.newPage();
        try {
            console.log(`🔎 키워드 [${kw}] 네이버 통합검색 시도...`);
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(kw)}`, { waitUntil: 'networkidle' });

            // 1. 플레이스 광고 및 리스트 섹션에서 URL 추출
            const links = await page.evaluate(() => {
                const urls = [];
                // 플레이스 '홈페이지' 링크들 타겟팅
                document.querySelectorAll('a[href*="entry/place"], a.link_item, a.link_tit').forEach(a => {
                    const href = a.href;
                    if (href.startsWith('http') && 
                        !href.includes('naver.com') && 
                        !href.includes('google') &&
                        !href.includes('daum.net') &&
                        !href.includes('namu.wiki') &&
                        !href.includes('map.naver') &&
                        !href.includes('openstreetmap')) {
                        urls.push(href);
                    }
                });
                return [...new Set(urls)];
            });

            console.log(`   ✅ 병원 후보 사이트 ${links.length}개 발견`);

            for (const url of links) {
                if (results.some(r => r.official_url === url)) continue;
                if (results.length >= 1004) break;

                const hospitalPage = await context.newPage();
                try {
                    console.log(`   🔗 분석 중: ${url}`);
                    // 타임아웃 15초로 단축 (빠른 회전)
                    await hospitalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await hospitalPage.waitForTimeout(2000);

                    // 팝업/공지 제거
                    await hospitalPage.evaluate(() => {
                        const s = ['[id*="popup"]', '[class*="popup"]', '[id*="notice"]', '.modal', '#divpop', '[class*="layer"]', '.notice_layer'];
                        s.forEach(sel => document.querySelectorAll(sel).forEach(el => el.style.display = 'none'));
                        document.querySelectorAll('div').forEach(el => {
                            if (el.innerText.includes('오늘 하루')) el.style.display = 'none';
                        });
                    });

                    const metadata = await hospitalPage.evaluate(() => ({
                        title: document.title,
                        desc: document.querySelector('meta[name="description"]')?.content || ''
                    }));

                    // 산부인과 관련 키워드가 제목에 있는지 확인 (노이즈 필터링)
                    if (!metadata.title.includes('산부인과') && !metadata.title.includes('여성') && !metadata.title.includes('병원') && !metadata.title.includes('의원')) {
                        console.log(`      ⏩ 스킵 (병원 사이트 아님)`);
                        continue;
                    }

                    const menuItems = await hospitalPage.evaluate(() => {
                        const items = Array.from(document.querySelectorAll('nav li, header li, .menu li, #gnb li'))
                            .map(el => el.innerText.trim())
                            .filter(t => t.length > 1 && t.length < 15);
                        return [...new Set(items)];
                    });

                    const hospitalId = results.length + 1;
                    await hospitalPage.screenshot({ path: path.join(outputDir, `${hospitalId}.png`), fullPage: false });

                    const data = {
                        id: hospitalId,
                        name: metadata.title.split('-')[0].split('|')[0].split(':')[0].trim(),
                        official_url: url,
                        menu_count: menuItems.length,
                        menu_items: menuItems,
                        metadata: metadata,
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
    console.log(`🏁 수집 완료: 총 ${results.length}개`);
})();
