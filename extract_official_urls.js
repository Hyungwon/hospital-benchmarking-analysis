const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const listPath = path.join(__dirname, 'list.json');
    const resultPath = path.join(__dirname, 'official_urls_1000.json');
    const listData = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    
    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    console.log(`🚀 병원 1000개 진짜 홈페이지 주소 수집 시작 (현재 진행: ${results.length}/1000)`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    // 뉴스, 티스토리, 블로그 등 제외할 패턴
    const skipPatterns = [
        'naver.com', 'pstatic.net', 'tistory.com', 'blog.me', 'daum.net', 
        'news', 'article', 'view.php', 'youtube.com', 'wikipedia.org',
        'facebook.com', 'instagram.com', 'twitter.com', 'modoo.at'
    ];

    for (let i = results.length; i < listData.length; i++) {
        const item = listData[i];
        const page = await context.newPage();
        try {
            console.log(`\n🔎 [${item.id}/1000] ${item.name} 분석 중...`);
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1500);

            const officialUrl = await page.evaluate((patterns) => {
                const isSkip = (url) => patterns.some(p => url.includes(p));
                
                // 1. 플레이스 공식 홈 버튼이나 핵심 링크 탐색
                const candidateLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
                
                // 검색결과에서 가장 신뢰도 높은 링크 순서대로 탐색
                // 우선순위: 특정 클래스를 가진 사이트 링크 -> 일반 외부 링크
                const selectors = [
                    'a.api_txt_lines.total_tit', 
                    'a.biz_name', 
                    'a.sp_nthe_link_info',
                    'a.lnk_site'
                ];

                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.href && !isSkip(el.href)) return el.href;
                }

                // 2. 모든 링크 중 필터링을 거친 첫 번째 외부 링크
                const filtered = candidateLinks
                    .map(a => a.href)
                    .filter(href => !isSkip(href));
                
                return filtered.length > 0 ? filtered[0] : null;
            }, skipPatterns);

            results.push({
                id: item.id,
                name: item.name,
                official_url: officialUrl || "NOT_FOUND",
                captured_at: new Date().toISOString()
            });

            // 주기적으로 저장
            if (results.length % 10 === 0) {
                fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
                console.log(`   💾 중간 저장 완료 (${results.length}개)`);
            }

            console.log(`   ✅ 결과: ${officialUrl || "찾지 못함"}`);

        } catch (err) {
            console.error(`   ❌ 에러: ${err.message}`);
            results.push({ id: item.id, name: item.name, official_url: "ERROR" });
        } finally {
            await page.close();
        }
    }

    await browser.close();
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`\n🏁 전체 작업 완료! 'official_urls_1000.json' 확인 부탁드립니다.`);
})();
