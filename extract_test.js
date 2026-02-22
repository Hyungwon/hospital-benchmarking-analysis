const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const listPath = path.join(__dirname, 'list.json');
    const listData = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    const results = [];
    const sampleSize = 10; // 먼저 10개만 테스트

    console.log(`🚀 진짜 홈페이지 주소 추출 테스트 시작 (대상: 상위 ${sampleSize}개)`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    for (let i = 0; i < sampleSize; i++) {
        const item = listData[i];
        const page = await context.newPage();
        try {
            console.log(`\n🔎 [${item.id}] ${item.name} 검색 결과 분석 중...`);
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            // 네이버 검색 결과에서 공식 홈페이지 링크 추출 시도
            // 주로 'visit', 'site_link', 'sp_nthe_title' 등의 클래스나 특정 패턴을 찾음
            const officialUrl = await page.evaluate(() => {
                // 1. 플레이스 상단 링크 또는 공식 홈 버튼 탐색
                const selectors = [
                    'a.api_txt_lines.total_tit', // 통합검색 제목
                    'a.biz_name', // 플레이스 이름
                    'a.sp_nthe_link_info', // 사이트 링크
                    'a[href*="http"]:not([href*="naver.com"]):not([href*="pstatic.net"])' // 외부 사이트 첫 번째 링크
                ];
                
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.href && !el.href.includes('naver.com') && !el.href.includes('search.naver')) {
                        return el.href;
                    }
                }
                
                // 2. 검색결과 내 모든 링크 중 가장 유력한 것 (광고 제외 등은 향후 고도화)
                const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
                const filtered = allLinks.map(a => a.href).filter(href => 
                    !href.includes('naver.com') && 
                    !href.includes('search.naver') && 
                    !href.includes('pstatic.net') &&
                    !href.includes('blog.me')
                );
                
                return filtered.length > 0 ? filtered[0] : null;
            });

            results.push({
                id: item.id,
                name: item.name,
                search_url: item.url,
                official_url: officialUrl || "NOT_FOUND"
            });

            console.log(`   ✅ 추출 결과: ${officialUrl || "찾지 못함"}`);

        } catch (err) {
            console.error(`   ❌ 에러 발생 (${item.name}): ${err.message}`);
            results.push({ id: item.id, name: item.name, search_url: item.url, official_url: "ERROR" });
        } finally {
            await page.close();
        }
    }

    await browser.close();
    fs.writeFileSync(path.join(__dirname, 'test_official_urls.json'), JSON.stringify(results, null, 2));
    console.log(`\n🏁 테스트 완료. 'test_official_urls.json' 파일을 확인해 주세요.`);
})();
