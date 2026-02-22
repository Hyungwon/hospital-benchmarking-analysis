import json

# 데이터 로드
with open('data/metadata.json', 'r', encoding='utf-8') as f:
    data_json = f.read()

# HTML 뼈대 정의
html_template = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>산부인과 레이아웃 벤치마킹</title>
    <style>
        body {{ font-family: 'Pretendard', -apple-system, sans-serif; background: #f8f9fa; padding: 40px; color: #333; }}
        h1 {{ text-align: center; color: #2c3e50; margin-bottom: 40px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px; }}
        .card {{ background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); transition: transform 0.2s; }}
        .card:hover {{ transform: translateY(-5px); }}
        .card img {{ width: 100%; height: 220px; object-fit: cover; background: #eee; border-bottom: 1px solid #eee; }}
        .info {{ padding: 20px; }}
        .info h3 {{ margin: 0 0 10px 0; font-size: 1.2rem; }}
        .tag-group {{ margin-bottom: 10px; }}
        .tag {{ display: inline-block; background: #edf2f7; color: #4a5568; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 5px; font-weight: 500; }}
        .tag.high {{ background: #ebf8ff; color: #2b6cb0; }}
        .url {{ font-size: 0.85rem; color: #a0aec0; word-break: break-all; margin-top: 5px; }}
        .btn {{ display: block; width: 100%; padding: 10px; background: #4a5568; color: white; text-align: center; text-decoration: none; border-radius: 6px; margin-top: 15px; font-size: 0.9rem; box-sizing: border-box; }}
        .btn:hover {{ background: #2d3748; }}
    </style>
</head>
<body>
    <h1>🏥 산부인과/여성의원 레이아웃 분석 리포트</h1>
    <div id="content" class="grid"></div>
    <script>
        const rawData = {data_json};
        const container = document.getElementById('content');
        
        rawData.forEach(item => {{
            const qualityClass = item.quality >= 85 ? 'high' : '';
            const placeholder = "data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'><rect fill='%23ddd' width='400' height='220'/><text fill='%23888' font-family='sans-serif' font-size='20' dy='10.5' x='50%' y='50%' text-anchor='middle'>Wait for Screenshot</text></svg>";
            
            container.innerHTML += `
                <div class="card">
                    <img src="screenshots/$$[item.id].png" onerror="this.src='$$[placeholder]'">
                    <div class="info">
                        <h3>$$[item.name]</h3>
                        <div class="tag-group">
                            <span class="tag">$$[item.layout]</span>
                            <span class="tag">$$[item.size]</span>
                            <span class="tag $$[qualityClass]">⭐ $$[item.quality]점</span>
                        </div>
                        <div class="url">$$[item.url]</div>
                        <a href="sites/$$[item.id]/index.html" class="btn">코드 자원 보기</a>
                    </div>
                </div>
            `.replace(/\$\$/g, '$').replace(/\[/g, '{{').replace(/\]/g, '}}');
            // Template literal 충돌 방지를 위해 임시 치환자 사용 후 복구
        }});
    </script>
</body>
</html>
"""

# 임시 치환자 복구 및 저장
final_html = html_template.replace('$$[', '${').replace(']', '}')

with open('viewer.html', 'w', encoding='utf-8') as f:
    f.write(final_html)
