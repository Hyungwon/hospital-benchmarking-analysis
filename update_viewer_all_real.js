const fs = require('fs');
const path = require('path');

// 파일 경로 설정
const analyzedPath = path.join(__dirname, 'analyzed_list_refined.json');
const viewerPath = path.join(__dirname, 'viewer.html');

try {
    // 1. 데이터 로드 (analyzed_list_refined.json)
    if (!fs.existsSync(analyzedPath)) {
        throw new Error(`Analyzed file not found at: ${analyzedPath}`);
    }
    
    const rawData = JSON.parse(fs.readFileSync(analyzedPath, 'utf8'));
    
    // 2. 데이터 정제 (노이즈 제거 및 중복 제거)
    const validHospitals = rawData.filter(item => {
        // OpenStreetMap 등 노이즈 제외 및 이름이 있는 것만
        return item.name && 
               !item.name.includes('OpenStreetMap') && 
               !item.name.includes('Copyright') &&
               item.official_url &&
               item.official_url.startsWith('http');
    });

    let cardsHtml = '';
    validHospitals.forEach(hospital => {
        const name = hospital.name;
        const url = hospital.official_url;
        const desc = hospital.metadata?.description || '상세 정보 없음';
        const title = hospital.metadata?.title || name;
        
        cardsHtml += `
        <div class="card">
            <img src="screenshots/${hospital.id}.png" onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'220\\' viewBox=\\'0 0 400 220\\'><rect fill=\\'%23ddd\\' width=\\'400\\' height=\\'220\\'/><text fill=\\'%23888\\' font-family=\\'sans-serif\\' font-size=\\'20\\' dy=\\'10.5\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\'>Wait for Screenshot</text></svg>'">
            <div class="info">
                <h3 title="${title}">${name}</h3>
                <div class="tag-group">
                    <span class="tag">ID: ${hospital.id}</span>
                    <span class="tag">${hospital.search_keyword || '전국'}</span>
                </div>
                <div class="desc" style="font-size: 0.85rem; color: #718096; height: 3.2em; overflow: hidden; margin-bottom: 10px;">${desc}</div>
                <div class="url"><a href="${url}" target="_blank" style="text-decoration: none; color: inherit;">${url}</a></div>
            </div>
        </div>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>병원 벤치마킹 분석 리포트 (전체)</title>
    <style>
        body { font-family: 'Pretendard', -apple-system, sans-serif; background: #f8f9fa; padding: 40px; color: #333; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 10px; }
        .subtitle { text-align: center; color: #718096; margin-bottom: 40px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); transition: transform 0.2s; display: flex; flex-direction: column; }
        .card:hover { transform: translateY(-5px); }
        .card img { width: 100%; height: 220px; object-fit: cover; background: #eee; border-bottom: 1px solid #eee; }
        .info { padding: 20px; flex-grow: 1; display: flex; flex-direction: column; }
        .info h3 { margin: 0 0 10px 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tag-group { margin-bottom: 10px; }
        .tag { display: inline-block; background: #edf2f7; color: #4a5568; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; margin-right: 5px; font-weight: 500; }
        .url { font-size: 0.8rem; color: #3182ce; word-break: break-all; margin-top: auto; }
        .url a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🏥 병원 벤치마킹 분석 리포트</h1>
    <p class="subtitle">실제 수집된 ${validHospitals.length}개의 병원 데이터 목록</p>
    <div class="grid">
        ${cardsHtml}
    </div>
</body>
</html>`;

    fs.writeFileSync(viewerPath, htmlContent);
    console.log(`Successfully updated viewer.html with ${validHospitals.length} valid items.`);
} catch (err) {
    console.error('Error:', err);
}
