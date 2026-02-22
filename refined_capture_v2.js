const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const listPath = path.join(__dirname, 'list.json');
    const resultPath = path.join(__dirname, 'analyzed_list.json');
    const hospitals = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    
    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    const outputDir = path.join(__dirname, 'screenshots_refined');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    console.log(`🚀 고도화 분석 v2 시작 (총 ${hospitals.length}개 대상)`);

    for (const hospital of hospitals) {
        if (results.some(r => r.id === hospital.id)) continue;

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            console.log(`🔍 [ID:${hospital.id}] ${hospital.name} 검색 중...`);
            
            // 네이버 통합검색 결과 페이지
            await page.goto(hospital.url, { waitUntil: 'networkidle', timeout: 30000 });
            
            // 1. 플레이스 정보에서 URL 추출 시도 (가장 정확)
            let officialUrl = await page.evaluate(() => {
                // 플레이스 '홈페이지' 버튼 또는 링크 찾기
                const placeLink = document.querySelector('a[href*="entry/place"]')?.closest('.cnt_place')?.querySelector('a.link_item[href*="http"]');
                if (placeLink) return placeLink.href;
                
                // 검색결과 상단 웹사이트 섹션
                const siteLink = document.querySelector('.main_pack a.link_tit');
                if (siteLink && !siteLink.href.includes('search.naver.com')) return siteLink.href;
                
                return null;
            });

            // 2. 만약 못 찾았다면 플레이스 상세 페이지 진입 시도 (V2 핵심)
            if (!officialUrl) {
                const placeDetailLink = await page.evaluate(() => {
                    const link = document.querySelector('a[href*="entry/place"]');
                    return link ? link.href : null;
                });
                
                if (placeDetailLink) {
                    await page.goto(placeDetailLink, { waitUntil: 'networkidle', timeout: 20000 });
                    officialUrl = await page.evaluate(() => {
                        const link = document.querySelector('a[href*="external_link"]'); // 플레이스 내 홈페이지 버튼
                        return link ? link.href : null;
                    });
                }
            }

            if (!officialUrl) {
                console.log(`   ⚠️ 공식 홈페이지 URL 추출 실패`);
                continue;
            }

            console.log(`   🌐 공식 홈페이지 발견: ${officialUrl}`);

            // 3. 실제 홈페이지 접속 및 분석 (동일 로직)
            await page.goto(officialUrl, { waitUntil: 'networkidle', timeout: 40000 });
            
            // 공지 제거
            await page.evaluate(() => {
                const selectors = ['[class*="popup"]', '[id*="popup"]', '[class*="modal"]', '[id*="layer"]', '.close', '#divpop'];
                selectors.forEach(s => document.querySelectorAll(s).forEach(el => el.style.display = 'none'));
            });

            const metadata = await page.evaluate(() => ({
                title: document.title,
                description: document.querySelector('meta[name="description"]')?.content || '',
                og_title: document.querySelector('meta[property="og:title"]')?.content || ''
            }));

            const menuStructure = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('nav li, #menu li, .menu li'))
                    .map(el => el.innerText.trim())
                    .filter(t => t.length > 1 && t.length < 15);
                return [...new Set(items)];
            });

            const screenshotPath = path.join(outputDir, `${hospital.id}.png`);
            await page.screenshot({ path: screenshotPath });

            const analysisResult = {
                id: hospital.id,
                name: hospital.name,
                official_url: officialUrl,
                metadata: metadata,
                menu_count: menuStructure.length,
                menu_items: menuStructure,
                captured_at: new Date().toISOString()
            };

            results.push(analysisResult);
            fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
            console.log(`   ✅ 분석 완료 (메뉴 ${menuStructure.length}개)`);

            await page.waitForTimeout(500); // 팀장님 요청: 텀을 두어 중지되지 않은 것처럼 보이게

        } catch (error) {
            console.error(`   ❌ 에러: ${error.message}`);
        } finally {
            await context.close();
        }
    }
    await browser.close();
})();
