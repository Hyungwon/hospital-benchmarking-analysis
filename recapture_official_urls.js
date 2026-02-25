const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 텔레그램 알림 함수 (환경변수 또는 설정값 사용 가정)
async function sendTelegram(message) {
    console.log(`[Telegram Alert]: ${message}`);
    // 실제 message tool을 통해 보낼 것이므로 여기서는 로그만 남깁니다.
}

(async () => {
    const resultPath = path.join(__dirname, 'official_urls_1000.json');
    let results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

    // 재수집 대상 선정 (navercorp.com 또는 NOT_FOUND, ERROR 등)
    const targets = results.filter(r => r.official_url.includes('navercorp.com') || r.official_url === 'NOT_FOUND' || r.official_url === 'ERROR');
    
    console.log(`🚀 재수집 시작: 총 ${targets.length}개 대상`);
    await sendTelegram(`🚀 병원 주소 재수집 시작: 총 ${targets.length}개 대상 분석에 들어갑니다.`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const skipPatterns = ['navercorp.com', 'search.naver.com', 'pstatic.net', 'naver.com'];

    let count = 0;
    for (const target of targets) {
        const page = await context.newPage();
        try {
            // 네이버 검색 결과 링크 (기존 list.json의 검색 URL이 필요하므로 list.json 참조)
            const listData = JSON.parse(fs.readFileSync(path.join(__dirname, 'list.json'), 'utf8'));
            const original = listData.find(l => l.id === target.id);

            if (!original) continue;

            await page.goto(original.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1000);

            // 네이버 플레이스 공식 홈페이지 버튼을 최우선으로 찾음
            const officialUrl = await page.evaluate((patterns) => {
                // 1. 플레이스 "홈페이지" 버튼 (가장 확실함)
                const placeHomeBtn = document.querySelector('a[role="button"].P_S66, a._sp_each_url, a.biz_url');
                if (placeHomeBtn && placeHomeBtn.href && !patterns.some(p => placeHomeBtn.href.includes(p))) {
                    return placeHomeBtn.href;
                }

                // 2. 통합검색 결과 내 '사이트' 섹션의 링크
                const siteLinks = Array.from(document.querySelectorAll('a.lnk_site, a.api_txt_lines.total_tit'));
                for (const link of siteLinks) {
                    if (link.href && !patterns.some(p => link.href.includes(p))) {
                        return link.href;
                    }
                }
                return null;
            }, skipPatterns);

            // 결과 업데이트
            const idx = results.findIndex(r => r.id === target.id);
            results[idx].official_url = officialUrl || "NOT_FOUND";
            results[idx].captured_at = new Date().toISOString();
            
            count++;
            if (count % 50 === 0) {
                fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
                await sendTelegram(`📊 재수집 진행 중: ${count}/${targets.length} 완료`);
            }
            console.log(`[${count}/${targets.length}] ${target.name} -> ${officialUrl || 'FAILED'}`);

        } catch (e) {
            console.error(`Error ${target.name}: ${e.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    await sendTelegram(`✅ 재수집 최종 완료: 총 ${targets.length}개 처리되었습니다.`);
})();
