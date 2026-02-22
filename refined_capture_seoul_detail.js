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

    // 팀장님 요청: 서울 한정, 구/동별 상세 검색 키워드 생성
    const seoulDistricts = ["강남구", "서초구", "송파구", "강서구", "양천구", "마포구", "영등포구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "용산구", "중구", "종로구", "동작구", "관악구", "서초구", "강동구", "구로구", "금천구"];
    const hospitalTypes = ["산부인과", "여성병원", "여성의원"];
    
    const keywords = [];
    seoulDistricts.forEach(district => {
        hospitalTypes.forEach(type => {
            keywords.push(`${district} ${type}`);
        });
    });

    console.log(`🚀 서울 지역 상세 벤치마킹 분석 시작 (키워드 ${keywords.length}개)`);

    for (const kw of keywords) {
        if (results.length >= 1004) break;

        const page = await context.newPage();
        try {
            console.log(`\n🔎 [서울 상세] '${kw}' 검색 중...`);
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // 외부 공식 홈페이지 링크 추출 로직
            const links = await page.evaluate(() => {
                const urls = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    if (href.startsWith('http') && 
                        !href.includes('naver.com') && 
                        !href.includes('google') &&
                        !href.includes('daum.net') &&
                        !href.includes('facebook') &&
                        !href.includes('instagram') &&
                        !href.includes('youtube') &&
                        !href.includes('wikipedia')) {
                        urls.push(href);
                    }
                });
                return [...new Set(urls)];
            });

            console.log(`   ✅ 발견된 후보지: ${links.length}개`);

            for (const url of links) {
                if (results.some(r => r.official_url === url)) continue;
                if (results.length >= 1004) break;

                const hospitalPage = await context.newPage();
                try {
                    console.log(`   🔗 분석 및 클린 캡처: ${url}`);
                    await hospitalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await hospitalPage.waitForTimeout(2000);

                    // 1. 공지사항 및 팝업 자동 제거 (팀장님 인사이트 반영)
                    await hospitalPage.evaluate(() => {
                        const selectors = ['[id*="popup"]', '[class*="popup"]', '[id*="notice"]', '.modal', '#divpop', '[class*="layer"]', '.notice_layer'];
                        selectors.forEach(s => document.querySelectorAll(s).forEach(el => el.style.display = 'none'));
                        // '오늘 하루 보지 않기' 텍스트 포함 요소 제거
                        document.querySelectorAll('div, span, a').forEach(el => {
                            if (el.innerText.includes('오늘 하루') || el.innerText.includes('하루 동안')) {
                                let parent = el.parentElement;
                                while(parent && parent.tagName !== 'BODY') {
                                    const style = window.getComputedStyle(parent);
                                    if (style.position === 'fixed' || style.position === 'absolute') {
                                        parent.style.display = 'none';
                                        break;
                                    }
                                    parent = parent.parentElement;
                                }
                            }
                        });
                    });

                    // 2. 메타데이터 및 IA(정보구조) 수집
                    const analysis = await hospitalPage.evaluate(() => {
                        const title = document.title;
                        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
                        const menus = Array.from(document.querySelectorAll('nav li, header li, .menu li, #gnb li'))
                            .map(el => el.innerText.trim())
                            .filter(t => t.length > 1 && t.length < 15);
                        
                        return {
                            title: title,
                            description: metaDesc,
                            menu_items: [...new Set(menus)]
                        };
                    });

                    // 3. 캡처 및 저장
                    const hospitalId = results.length + 1;
                    const screenshotPath = path.join(outputDir, `${hospitalId}.png`);
                    await hospitalPage.screenshot({ path: screenshotPath });

                    const finalData = {
                        id: hospitalId,
                        name: analysis.title.split('-')[0].split('|')[0].trim(),
                        official_url: url,
                        search_keyword: kw,
                        menu_count: analysis.menu_items.length,
                        menu_items: analysis.menu_items,
                        metadata: { title: analysis.title, description: analysis.description },
                        captured_at: new Date().toISOString()
                    };

                    results.push(finalData);
                    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
                    console.log(`      ✨ [${results.length}] ${finalData.name} 완료 (메뉴: ${finalData.menu_count}개)`);

                    // 4. 요구사항: 랜덤 텀을 두어 자연스러운 흐름 유지
                    await hospitalPage.waitForTimeout(Math.random() * 1000 + 800);

                } catch (e) {
                    // console.log(`      ❌ 접속 오류: ${url}`);
                } finally {
                    await hospitalPage.close();
                }
            }
        } catch (err) {
            console.error(`❌ 키워드 '${kw}' 처리 중 오류: ${err.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log(`🏁 서울 지역 정밀 분석 완료! 총 ${results.length}개 수집됨.`);
})();
