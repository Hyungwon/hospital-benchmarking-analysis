const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // 샘플 병원 리스트 (우선 테스트용 5개)
    const hospitals = [
        { name: '로즈마리병원', url: 'http://www.rosemary.co.kr' },
        { name: '지앤유산부인과', url: 'http://www.gnuw.co.kr' },
        { name: '미즈메디병원', url: 'https://www.mizmedi.com' },
        { name: '효성병원', url: 'http://www.hshospital.co.kr' },
        { name: '미래아이산부인과', url: 'http://www.miraeye.co.kr' }
    ];

    const outputDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    console.log('Starting screenshot capture...');

    for (const hospital of hospitals) {
        try {
            console.log(`Capturing ${hospital.name}...`);
            // 타임아웃을 늘리고 에러 처리를 강화합니다.
            await page.goto(hospital.url, { timeout: 60000, waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000); // 렌더링을 위해 잠시 대기
            await page.screenshot({ path: path.join(outputDir, `${hospital.name}.png`) });
            console.log(`Successfully captured ${hospital.name}`);
        } catch (error) {
            console.error(`Failed to capture ${hospital.name}: ${error.message}`);
        }
    }

    await browser.close();
    console.log('Batch job completed.');
})();
