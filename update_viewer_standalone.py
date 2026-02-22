import json
import os

with open('data/metadata.json', 'r', encoding='utf-8') as f:
    data = f.read()

with open('viewer.html', 'r', encoding='utf-8') as f:
    html = f.read()

# fetch 부분을 내장 데이터 사용 방식으로 교체
new_script = f"""
    <script>
        const data = {data};
        const container = document.getElementById('content');
        data.forEach(item => {{
            const qualityClass = item.quality >= 85 ? 'high' : '';
            container.innerHTML += `
                <div class="card">
                    <img src="screenshots/\${{item.id}}.png" onerror="this.src='https://via.placeholder.com/400x220?text=Wait+for+Screenshot'">
                    <div class="info">
                        <h3>\${{item.name}}</h3>
                        <div class="tag-group">
                            <span class="tag">\${{item.layout}}</span>
                            <span class="tag">\${{item.size}}</span>
                            <span class="tag \${{qualityClass}}">⭐ \${{item.quality}}점</span>
                        </div>
                        <div class="url">\${{item.url}}</div>
                        <a href="sites/\${{item.id}}/index.html" class="btn">코드 자원 보기</a>
                    </div>
                </div>
            `;
        }});
    </script>
"""

# 기존 스크립트 태그 영역을 새로운 스크립트로 교체 (단순화를 위해 마지막에 덮어쓰기)
import re
updated_html = re.sub(r'<script>.*?</script>', new_script, html, flags=re.DOTALL)

with open('viewer.html', 'w', encoding='utf-8') as f:
    f.write(updated_html)
