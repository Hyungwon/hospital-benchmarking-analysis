const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '대전', '대구', '부산', '광주', '울산', '세종'];
const types = ['산부인과', '소아과'];
const searchKeywords = [];

regions.forEach(r => {
    types.forEach(t => {
        searchKeywords.push(`${r} ${t}`);
    });
});

console.log(JSON.stringify(searchKeywords));
