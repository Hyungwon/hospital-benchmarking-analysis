const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 1. 어떤 프로세스를 스케쥴로 관리할때는 loop 중간에 텀을 둬서 시스템이 중지된 것처럼 보이지 않도록 해줘
 * 2. 공지가 많은 병원의 특성 상 어떤 병원 홈페이지 메인 페이지는 4개의 공지사항으로 화면을 덮는 경우가 있어.
 *    공지를 제거하고 캡쳐하는 방안을 찾아줘.
 * 3. 나의 목적은 "병원 홈페이지 개발 프로젝트"에서 참고할 'UI / UX / IA(정보구조) / 산부인과용 전문용어 / 레이아웃구성 / SEO,AEO,GEO를 위한 메타데이터구성'이 필요해.
 * 4. 수집된 1000개의 병원 데이터를 패턴화 해서 내가 원하는 기준으로 정렬/검색 되어야 해. 
 */

(async () => {
    const listPath = path.join(__dirname, 'list.json');
    const resultPath = path.join(__dirname, 'analyzed_list.json');
    const hospitals = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    
    // 이전에 분석된 결과가 있다면 불러오기 (이어하기)
    let results = [];
    if (fs.existsSync(resultPath)) {
        results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }

    const browser = await chromium.launch({ headless: true });
    const outputDir = path.join(__dirname, 'screenshots_refined');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    console.log(`🚀 고도화 분석 및 클린 캡처 시작 (총 ${hospitals.length}개 대상)`);

    for (const hospital of hospitals) {
        // 이미 분석된 병원은 스킵 (ID 기준)
        if (results.some(r => r.id === hospital.id)) continue;

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            console.log(`\n🔍 [ID:${hospital.id}] ${hospital.name} 분석 중...`);
            
            // 1. 네이버 검색 결과에서 실제 홈페이지 URL 추출
            await page.goto(hospital.url, { waitUntil: 'networkidle', timeout: 30000 });
            
            const officialUrl = await page.evaluate(() => {
                // 네이버 통합검색 내 사이트 섹션에서 실제 URL 추출 시도
                const siteLink = document.querySelector('.main_pack a.link_tit');
                return siteLink ? siteLink.href : null;
            });

            if (!officialUrl || officialUrl.includes('search.naver.com')) {
                console.log(`   ⚠️ 공식 홈페이지 URL을 찾을 수 없습니다. (스킵)`);
                continue;
            }

            console.log(`   🌐 공식 홈페이지 발견: ${officialUrl}`);

            // 2. 실제 홈페이지 접속
            await page.goto(officialUrl, { waitUntil: 'networkidle', timeout: 40000 });
            
            // 3. 공지사항 및 팝업 제거 스크립트 실행
            await page.evaluate(() => {
                const selectors = [
                    '[class*="popup"]', '[id*="popup"]',
                    '[class*="modal"]', '[id*="modal"]',
                    '[class*="layer"]', '[id*="layer"]',
                    '[class*="notice"]', '[id*="notice"]',
                    '.close', '#close', '[class*="close_btn"]',
                    '#divpop', '.divpop', '[id*="notice_wrap"]'
                ];
                
                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        // 실제로 화면을 덮고 있는 요소인지 대략적으로 판단 (z-index가 높거나 fixed인 경우)
                        const style = window.getComputedStyle(el);
                        if (style.position === 'fixed' || style.position === 'absolute' || parseInt(style.zIndex) > 10) {
                            el.style.display = 'none';
                        }
                    });
                });
                // 특정 병원 솔루션에서 흔히 쓰는 '오늘 하루 보지 않기' 버튼 등의 부모 제거
                document.querySelectorAll('div').forEach(div => {
                    if (div.innerText.includes('오늘 하루') || div.innerText.includes('하루 동안')) {
                        div.style.display = 'none';
                    }
                });
            });

            await page.waitForTimeout(1000); // 정리된 화면 안정화 대기

            // 4. 메타데이터 및 SEO 정보 추출
            const metadata = await page.evaluate(() => {
                return {
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                    og_title: document.querySelector('meta[property="og:title"]')?.content || '',
                    og_description: document.querySelector('meta[property="og:description"]')?.content || ''
                };
            });

            // 5. IA (메인 메뉴 구조) 추출
            const menuStructure = await page.evaluate(() => {
                const menuItems = Array.from(document.querySelectorAll('nav li, #menu li, .menu li, header li'))
                    .map(el => el.innerText.trim())
                    .filter(txt => txt.length > 1 && txt.length < 20);
                return [...new Set(menuItems)]; // 중복 제거
            });

            // 6. 클린 스크린샷 캡처
            const screenshotPath = path.join(outputDir, `${hospital.id}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            // 7. 결과 저장 객체 생성
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

            console.log(`   ✅ 분석 완료 (메뉴 ${menuStructure.length}개 추출)`);

            // 8. 요구사항 1번: 랜덤 텀을 두어 시스템 부하 및 차단 방지
            const delay = Math.floor(Math.random() * 3000) + 2000; // 2~5초
            console.log(`   ⏳ 다음 작업을 위해 ${delay}ms 대기...`);
            await page.waitForTimeout(delay);

        } catch (error) {
            console.error(`   ❌ [ID:${hospital.id}] 에러 발생: ${error.message}`);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    console.log('\n🏁 모든 고도화 분석 작업이 완료되었습니다.');
})();
