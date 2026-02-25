const fs = require('fs');
const path = require('path');

// 파일 경로 설정
const analyzedPath = path.join(__dirname, 'analyzed_list_refined.json');
const viewerPath = path.join(__dirname, 'viewer.html');

try {
    // 1. 데이터 로드
    if (!fs.existsSync(analyzedPath)) {
        throw new Error(`Analyzed file not found at: ${analyzedPath}`);
    }
    
    const rawData = JSON.parse(fs.readFileSync(analyzedPath, 'utf8'));
    
    // 2. 데이터 정제
    const validHospitals = rawData.filter(item => {
        return item.name && 
               !item.name.includes('OpenStreetMap') && 
               item.official_url &&
               item.official_url.startsWith('http');
    }).map(h => ({
        id: h.id,
        name: h.name,
        url: h.official_url,
        keyword: h.search_keyword || '기타',
        desc: h.metadata?.description || '상세 정보 없음',
        region: (h.search_keyword || '').split(' ')[0] || '전국'
    }));

    // 3. HTML 템플릿 생성 (screenshots_pro 폴더를 참조하도록 수정)
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>전국 병원 메인 홈페이지 분석 리포트</title>
    <style>
        :root {
            --primary: #3182ce;
            --bg: #f8f9fa;
            --text: #2d3748;
            --card-bg: #ffffff;
        }
        body { font-family: 'Pretendard', -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 30px; }
        h1 { color: #2c3e50; margin-bottom: 10px; }
        .stats { text-align: center; color: #718096; font-size: 0.9rem; margin-top: 10px; }
        
        .controls { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 30px; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
        .search-box { flex-grow: 1; min-width: 250px; }
        input, select { padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; width: 100%; box-sizing: border-box; }
        .filter-group { display: flex; gap: 10px; align-items: center; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; }
        .card { background: var(--card-bg); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); transition: transform 0.2s; display: flex; flex-direction: column; }
        .card:hover { transform: translateY(-5px); }
        .card img { width: 100%; height: 200px; object-fit: cover; background: #eee; border-bottom: 1px solid #edf2f7; cursor: pointer; }
        .info { padding: 18px; flex-grow: 1; display: flex; flex-direction: column; }
        .info h3 { margin: 0 0 10px 0; font-size: 1.1rem; color: #1a202c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tag-group { margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 5px; }
        .tag { background: #edf2f7; color: #4a5568; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; }
        .tag.region { background: #ebf8ff; color: #2b6cb0; }
        .desc { font-size: 0.85rem; color: #718096; height: 3em; overflow: hidden; margin-bottom: 15px; line-height: 1.5; }
        .url { font-size: 0.8rem; color: var(--primary); word-break: break-all; margin-top: auto; }
        .url a { text-decoration: none; color: inherit; }
        
        .pagination { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 40px; padding-bottom: 40px; }
        .page-btn { padding: 8px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        .page-btn:hover { background: #edf2f7; }
        .page-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🏥 전국 병원 홈페이지 분석 리포트 (고해상도)</h1>
            <div id="total-stats" class="stats">로딩 중...</div>
        </header>

        <div class="controls">
            <div class="search-box">
                <input type="text" id="search-input" placeholder="병원 이름 또는 설명 검색..." oninput="handleFilter()">
            </div>
            <div class="filter-group">
                <select id="region-filter" onchange="handleFilter()">
                    <option value="">모든 지역</option>
                </select>
                <select id="keyword-filter" onchange="handleFilter()">
                    <option value="">모든 키워드</option>
                </select>
            </div>
        </div>

        <div id="hospital-grid" class="grid"></div>
        <div class="pagination" id="pagination"></div>
    </div>

    <script>
        const allData = ${JSON.stringify(validHospitals)};
        let filteredData = [...allData];
        const itemsPerPage = 12;
        let currentPage = 1;

        function initFilters() {
            const regions = [...new Set(allData.map(h => h.region))].sort();
            const keywords = [...new Set(allData.map(h => h.keyword))].sort();
            const regionSelect = document.getElementById('region-filter');
            const keywordSelect = document.getElementById('keyword-filter');
            regions.forEach(r => r && regionSelect.add(new Option(r, r)));
            keywords.forEach(k => k && keywordSelect.add(new Option(k, k)));
        }

        function handleFilter() {
            const searchTerm = document.getElementById('search-input').value.toLowerCase();
            const selectedRegion = document.getElementById('region-filter').value;
            const selectedKeyword = document.getElementById('keyword-filter').value;

            filteredData = allData.filter(h => {
                const matchesSearch = h.name.toLowerCase().includes(searchTerm) || h.desc.toLowerCase().includes(searchTerm);
                const matchesRegion = !selectedRegion || h.region === selectedRegion;
                const matchesKeyword = !selectedKeyword || h.keyword === selectedKeyword;
                return matchesSearch && matchesRegion && matchesKeyword;
            });
            currentPage = 1;
            render();
        }

        function render() {
            const grid = document.getElementById('hospital-grid');
            const pagination = document.getElementById('pagination');
            const stats = document.getElementById('total-stats');
            
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = filteredData.slice(start, end);
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);

            stats.innerText = \`전체 \${allData.length}개 중 \${filteredData.length}개 분석됨 (페이지: \${currentPage} / \${totalPages || 1})\`;

            grid.innerHTML = pageData.map(h => \`
                <div class="card">
                    <img src="screenshots_pro/\${h.id}.png" onclick="window.open(this.src)" onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'220\\' viewBox=\\'0 0 400 220\\'><rect fill=\\'%23ddd\\' width=\\'400\\' height=\\'220\\'/><text fill=\\'%23888\\' font-family=\\'sans-serif\\' font-size=\\'20\\' dy=\\'10.5\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\'>캡처 진행 중...</text></svg>'" title="원본 메인 화면 보기">
                    <div class="info">
                        <h3>\${h.name}</h3>
                        <div class="tag-group">
                            <span class="tag">ID: \${h.id}</span>
                            <span class="tag region">\${h.region}</span>
                        </div>
                        <div class="desc" title="\${h.desc}">\${h.desc}</div>
                        <div class="url"><a href="\${h.url}" target="_blank">\${h.url}</a></div>
                    </div>
                </div>
            \`).join('');

            let btnHtml = \`<button class="page-btn" \${currentPage === 1 ? 'disabled' : ''} onclick="changePage(\${currentPage - 1})">이전</button>\`;
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            for (let i = startPage; i <= endPage; i++) {
                btnHtml += \`<button class="page-btn \${i === currentPage ? 'active' : ''}" onclick="changePage(\${i})">\${i}</button>\`;
            }
            btnHtml += \`<button class="page-btn" \${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="changePage(\${currentPage + 1})">다음</button>\`;
            pagination.innerHTML = btnHtml;
        }

        function changePage(p) { currentPage = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

        initFilters();
        render();
    </script>
</body>
</html>`;

    fs.writeFileSync(viewerPath, htmlContent);
    console.log(`Successfully updated viewer.html to point to screenshots_pro.`);
} catch (err) {
    console.error('Error:', err);
}
