const fs = require('fs');
const path = require('path');

// 파일 경로 설정
const metadataPath = path.join(__dirname, 'data', 'metadata.json');
const viewerPath = path.join(__dirname, 'viewer.html');

try {
    // 실제 데이터(data/metadata.json) 로드
    if (!fs.existsSync(metadataPath)) {
        throw new Error(`Metadata file not found at: ${metadataPath}`);
    }
    
    const hospitalData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    let cardsHtml = '';
    hospitalData.forEach(hospital => {
        // 실제 병원 이름과 URL 사용
        const name = hospital.name;
        const url = hospital.url;
        const info = `${hospital.size} | ${hospital.layout} (품질: ${hospital.quality})`;
        
        cardsHtml += `
        <div class="card">
            <img src="screenshots/${hospital.id}.png" onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'220\\' viewBox=\\'0 0 400 220\\'><rect fill=\\'%23ddd\\' width=\\'400\\' height=\\'220\\'/><text fill=\\'%23888\\' font-family=\\'sans-serif\\' font-size=\\'20\\' dy=\\'10.5\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\'>Wait for Screenshot</text></svg>'">
            <div class="info">
                <h3>${name}</h3>
                <div class="tag-group">
                    <span class="tag">ID: ${hospital.id}</span>
                    <span class="tag">${info}</span>
                </div>
                <div class="url"><a href="${url}" target="_blank" style="text-decoration: none; color: inherit;">${url}</a></div>
            </div>
        </div>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>병원 벤치마킹 분석 결과</title>
    <style>
        body { font-family: 'Pretendard', -apple-system, sans-serif; background: #f8f9fa; padding: 40px; color: #333; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 40px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); }
        .card img { width: 100%; height: 220px; object-fit: cover; background: #eee; border-bottom: 1px solid #eee; }
        .info { padding: 20px; }
        .info h3 { margin: 0 0 10px 0; font-size: 1.2rem; }
        .tag-group { margin-bottom: 10px; }
        .tag { display: inline-block; background: #edf2f7; color: #4a5568; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 5px; font-weight: 500; }
        .url { font-size: 0.85rem; color: #3182ce; word-break: break-all; margin-top: 5px; }
        .url a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🏥 병원 벤치마킹 분석 결과 (${hospitalData.length}개 주요 병원)</h1>
    <div class="grid">
        ${cardsHtml}
    </div>
</body>
</html>`;

    fs.writeFileSync(viewerPath, htmlContent);
    console.log(`Successfully updated viewer.html with ${hospitalData.length} analyzed items.`);
} catch (err) {
    console.error('Error:', err);
}
