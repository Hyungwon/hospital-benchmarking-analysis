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
    
    // 2. 데이터 정제 (노이즈 제거)
    const validHospitals = rawData.filter(item => {
        return item.name && 
               !item.name.includes('OpenStreetMap') && 
               !item.name.includes('Copyright') &&
               item.official_url &&
               item.official_url.startsWith('http');
    }).map(h => ({
        id: h.id,
        name: h.name,
        url: h.official_url,
        keyword: h.search_keyword || '기타',
        desc: h.metadata?.description || '상세 정보 없음',
        region: (h.search_keyword || '').split(' ')[0] || '기타' // 키워드 첫 단어를 지역으로 추정
    }));

    // 3. HTML 템플릿 생성 (클라이언트 사이드 페이징/필터링 로직 포함)
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>병원 벤치마킹 분석 리포트 (고도화)</title>
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
        
        /* 필터 영역 */
        .controls { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 30px; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
        .search-box { flex-grow: 1; min-width: 250px; }
        input, select { padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; width: 100%; box-sizing: border-box; }
        .filter-group { display: flex; gap: 10px; align-items: center; }
        
        /* 그리드 및 카드 */
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
        .url a:hover { text-decoration: underline; }

        /* 페이징 */
        .pagination { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 40px; padding-bottom: 40px; }
        .page-btn { padding: 8px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        .page-btn:hover { background: #edf2f7; }
        .page-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .stats { text-align: center; color: #718096; font-size: 0.9rem; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🏥 병원 벤치마킹 분석 리포트</h1>
            <div id="total-stats" class="stats">데이터 로딩 중...</div>
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

        <div id="hospital-grid" class="grid">
            <!-- 데이터가 여기에 동적으로 삽입됩니다 -->
        </div>

        <div class="pagination" id="pagination">
            <!-- 페이지 버튼이 여기에 동적으로 삽입됩니다 -->
        </div>
    </div>

    <script>
        const allData = ${JSON.stringify(validHospitals)};
        let filteredData = [...allData];
        const itemsPerPage = 12;
        let currentPage = 1;

        // 필터 옵션 초기화
        function initFilters() {
            const regions = [...new Set(allData.map(h => h.region))].sort();
            const keywords = [...new Set(allData.map(h => h.keyword))].sort();
            
            const regionSelect = document.getElementById('region-filter');
            const keywordSelect = document.getElementById('keyword-filter');
            
            regions.forEach(r => {
                if(r) regionSelect.add(new Option(r, r));
            });
            keywords.forEach(k => {
                if(k) keywordSelect.add(new Option(k, k));
            });
        }

        // 필터링 핸들러
        function handleFilter() {
            const searchTerm = document.getElementById('search-input').value.toLowerCase();
            const selectedRegion = document.getElementById('region-filter').value;
            const selectedKeyword = document.getElementById('keyword-filter').value;

            filteredData = allData.filter(h => {
                const matchesSearch = h.name.toLowerCase().includes(searchTerm) || 
                                     h.desc.toLowerCase().includes(searchTerm);
                const matchesRegion = !selectedRegion || h.region === selectedRegion;
                const matchesKeyword = !selectedKeyword || h.keyword === selectedKeyword;
                return matchesSearch && matchesRegion && matchesKeyword;
            });

            currentPage = 1;
            render();
        }

        // 렌더링 함수
        function render() {
            const grid = document.getElementById('hospital-grid');
            const pagination = document.getElementById('pagination');
            const stats = document.getElementById('total-stats');
            
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = filteredData.slice(start, end);
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);

            stats.innerText = \`전체 \${allData.length}개 중 \${filteredData.length}개 검색됨 (현재 \${currentPage} / \${totalPages || 1} 페이지)\`;

            // 그리드 업데이트
            grid.innerHTML = pageData.map(h => \`
                <div class="card">
                    <img src="screenshots/\${h.id}.png" onclick="window.open(this.src)" onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'220\\' viewBox=\\'0 0 400 220\\'><rect fill=\\'%23ddd\\' width=\\'400\\' height=\\'220\\'/><text fill=\\'%23888\\' font-family=\\'sans-serif\\' font-size=\\'20\\' dy=\\'10.5\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\'>이미지 없음</text></svg>'" title="클릭하여 원본 보기">
                    <div class="info">
                        <h3>\${h.name}</h3>
                        <div class="tag-group">
                            <span class="tag">ID: \${h.id}</span>
                            <span class="tag region">\${h.region}</span>
                            <span class="tag">\${h.keyword}</span>
                        </div>
                        <div class="desc" title="\${h.desc}">\${h.desc}</div>
                        <div class="url"><a href="\${h.url}" target="_blank">\${h.url}</a></div>
                    </div>
                </div>
            \`).join('');

            // 페이지 버튼 업데이트
            let btnHtml = \`<button class="page-btn" \${currentPage === 1 ? 'disabled' : ''} onclick="changePage(\${currentPage - 1})">이전</button>\`;
            
            // 페이지 번호 (최대 5개만 표시)
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

            for (let i = startPage; i <= endPage; i++) {
                btnHtml += \`<button class="page-btn \${i === currentPage ? 'active' : ''}" onclick="changePage(\${i})">\${i}</button>\`;
            }

            btnHtml += \`<button class="page-btn" \${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="changePage(\${currentPage + 1})">다음</button>\`;
            pagination.innerHTML = btnHtml;
            
            // 상단으로 스크롤
            if(start > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function changePage(p) {
            currentPage = p;
            render();
        }

        // 초기 실행
        initFilters();
        render();
    </script>
</body>
</html>`;

    fs.writeFileSync(viewerPath, htmlContent);
    console.log(`Successfully updated viewer.html with pagination and filtering for ${validHospitals.length} items.`);
} catch (err) {
    console.error('Error:', err);
}
