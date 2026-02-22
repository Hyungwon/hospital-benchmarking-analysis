import json
import os

samples = [
    {"id": 1, "name": "중앙산부인과", "url": "https://www.baby2you.com/", "size": "의원", "quality": 82, "layout": "정보 나열형"},
    {"id": 2, "name": "이보람여성의원", "url": "http://www.boram055.com/", "size": "의원", "quality": 75, "layout": "클래식 그리드"},
    {"id": 3, "name": "지앤유산부인과", "url": "https://www.gnuog.com/", "size": "의원", "quality": 88, "layout": "모던 심플"},
    {"id": 4, "name": "로즈마리병원", "url": "https://www.rmh.co.kr/", "size": "병원", "quality": 91, "layout": "풀스크린 비주얼"},
    {"id": 5, "name": "한별여성의원", "url": "https://hanbyulw.com/", "size": "의원", "quality": 85, "layout": "와이드 슬라이더"}
]

os.makedirs('data', exist_ok=True)
with open('data/metadata.json', 'w', encoding='utf-8') as f:
    json.dump(samples, f, ensure_ascii=False, indent=2)

print("Metadata updated with real samples.")
