import re

path = 'viewer.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 외부 placeholder URL을 내장 SVG로 교체
svg_placeholder = "data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'><rect fill='%23ddd' width='400' height='220'/><text fill='%23888' font-family='sans-serif' font-size='20' dy='10.5' x='50%' y='50%' text-anchor='middle'>Wait for Screenshot</text></svg>"
pattern = r"https://via\.placeholder\.com/400x220\?text=Wait\+for\+Screenshot"
updated_content = re.sub(pattern, svg_placeholder, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(updated_content)
