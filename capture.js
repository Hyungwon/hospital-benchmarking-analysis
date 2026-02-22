const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
    // 1. list.json 로드
    const listPath = path.join(__dirname, 'list.json');
    if (!fs.existsSync(listPath)) {
        console.error('Error: list.json not found');
        process.exit(1);
    }
    const hospitals = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    console.log(`Starting capture for ${hospitals.length} hospitals...`);

    const browser = await chromium.launch();
    const outputDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    let count = 0;
    const batchSize = 5;

    for (let i = 0; i < hospitals.length; i += batchSize) {
        const batch = hospitals.slice(i, i + batchSize);
        await Promise.all(batch.map(async (hospital) => {
            const context = await browser.newContext();
            const page = await context.newPage();
            try {
                process.stdout.write(`[${++count}/${hospitals.length}] Attempting ${hospital.name}...\n`);
                try {
                    await page.goto(hospital.url, { timeout: 10000, waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(1000);
                    await page.screenshot({ path: path.join(outputDir, `${hospital.id}.png`) });
                    // console.log(`Successfully captured ${hospital.name}`);
                } catch (e) {
                    // console.log(`Failed/Timeout: ${hospital.name}`);
                }
            } catch (error) {
                console.error(`Error processing ${hospital.name}: ${error.message}`);
            } finally {
                await context.close();
            }
        }));

        // 20개 단위로 Git Push (너무 잦은 푸시 방지)
        if (count % 20 === 0) {
            try {
                execSync('git add screenshots/*.png list.json');
                execSync(`git commit -m "Progress: ${count}/${hospitals.length} captured"`);
                execSync('git push');
                console.log(`--- Pushed progress up to ${count} items ---`);
            } catch (gitError) {
                // ignore git errors and continue
            }
        }
    }

    await browser.close();
    console.log('Total batch process completed.');
})();
