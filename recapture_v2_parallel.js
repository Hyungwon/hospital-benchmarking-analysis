const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function sendTelegram(message) {
    console.log(`[Telegram Alert]: ${message}`);
}

(async () => {
    const resultPath = path.join(__dirname, 'official_urls_1000.json');
    let results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

    const targets = results.filter(r => r.official_url.includes('navercorp.com') || r.official_url === 'NOT_FOUND' || r.official_url === 'FAILED' || r.official_url === 'ERROR');
    
    console.log(`🚀 고속 재수집 v2 시작: 총 ${targets.length}개 대상`);
    await sendTelegram(`🚀 고속 재수집 v2 시작: 로직을 강화하여 ${targets.length}개 재분석에 들어갑니다.`);

    const browser = await chromium.launch({ headless: true });
    
    // 5개의 병렬 워커 사용
    const workerCount = 5;
    const chunkSize = Math.ceil(targets.length / workerCount);
    
    const workers = Array.from({ length: workerCount }, (_, i) => {
        const chunk = targets.slice(i * chunkSize, (i + 1) * chunkSize);
        return runWorker(i, chunk, browser, resultPath);
    });

    await Promise.all(workers);
    await browser.close();
    
    // 최종 결과 로드 및 저장
    results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    await sendTelegram(`✅ 고속 재수집 v2 최종 완료! 결과 파일을 확인해주세요.`);
})();

async function runWorker(id, chunk, browser, resultPath) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    
    const skipPatterns = ['navercorp.com', 'search.naver.com', 'pstatic.net', 'naver.com', 'blog.me', 'tistory.com', 'daum.net'];

    for (let i = 0; i < chunk.length; i++) {
        const target = chunk[i];
        const page = await context.newPage();
        try {
            const listData = JSON.parse(fs.readFileSync(path.join(__dirname, 'list.json'), 'utf8'));
            const original = listData.find(l => l.id === target.id);
            if (!original) continue;

            await page.goto(original.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1500);

            const officialUrl = await page.evaluate((patterns) => {
                // 더 광범위한 추출 로직
                const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
                
                // 1. 플레이스 "홈페이지" 버튼 (다양한 선택자)
                const homeBtn = document.querySelector('a._sp_each_url, a.biz_url, a[href*="visit"], a.api_txt_lines.total_tit');
                if (homeBtn && homeBtn.href && !patterns.some(p => homeBtn.href.includes(p))) {
                    return homeBtn.href;
                }

                // 2. 검색 결과 리스트 상단 사이트 링크
                const siteSection = document.querySelector('.section._sp_nthe_site, .sp_nthe_site');
                if (siteSection) {
                    const link = siteSection.querySelector('a.api_txt_lines, a.lnk_site');
                    if (link && link.href && !patterns.some(p => link.href.includes(p))) return link.href;
                }

                // 3. 필터링된 모든 외부 링크 중 첫 번째 (가장 유력함)
                const filtered = allLinks.map(a => a.href).filter(href => 
                    !patterns.some(p => href.includes(p)) && 
                    !href.includes('map.naver') && 
                    !href.includes('kin.naver')
                );
                
                return filtered.length > 0 ? filtered[0] : null;
            }, skipPatterns);

            // 실시간 파일 업데이트 (Race condition 방지를 위해 동기식 처리 권장되나 여기선 덮어쓰기)
            const currentResults = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
            const idx = currentResults.findIndex(r => r.id === target.id);
            if (idx !== -1) {
                currentResults[idx].official_url = officialUrl || "NOT_FOUND";
                currentResults[idx].captured_at = new Date().toISOString();
                fs.writeFileSync(resultPath, JSON.stringify(currentResults, null, 2));
            }

            console.log(`Worker ${id}: [${i+1}/${chunk.length}] ${target.name} -> ${officialUrl || 'FAILED'}`);
        } catch (e) {
            console.error(`Worker ${id} Error: ${e.message}`);
        } finally {
            await page.close();
        }
    }
    await context.close();
}
