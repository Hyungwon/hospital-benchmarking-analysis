const fs = require('fs');
const path = require('path');

const listPath = path.join(__dirname, 'list.json');
const viewerPath = path.join(__dirname, 'viewer.html');

try {
    const listData = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    
    let cardsHtml = '';
    listData.forEach(hospital => {
        cardsHtml += `
        <div class="card">
            <img src="screenshots/${hospital.id}.png" onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'220\\' viewBox=\\'0 0 400 220\\'><rect fill=\\'%23ddd\\' width=\\'400\\' height=\\'220\\'/><text fill=\\'%23888\\' font-family=\\'sans-serif\\' font-size=\\'20\\' dy=\\'10.5\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\'>Wait for Screenshot</text></svg>'">
            <div class="info">
                <h3>${hospital.name}</h3>
                <div class="tag-group">
                    <span class="tag">ID: ${hospital.id}</span>
                </div>
                <div class="url">${hospital.url}</div>
            </div>
        </div>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>병원 리스트 뷰어</title>
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
        .url { font-size: 0.85rem; color: #a0aec0; word-break: break-all; margin-top: 5px; }
    </style>
</head>
<body>
    <h1>🏥 병원 크롤링 결과 전체 목록 (${listData.length}개)</h1>
    <div class="grid">
        ${cardsHtml}
    </div>
</body>
</html>`;

    fs.writeFileSync(viewerPath, htmlContent);
    console.log(`Successfully updated viewer.html with ${listData.length} items.`);
} catch (err) {
    console.error('Error:', err);
}
