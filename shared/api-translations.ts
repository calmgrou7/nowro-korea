// Display-only translation pilot. Source records and route identifiers stay unchanged.
const rows: string[][] = [
  [
    "제6회 남경서회전",
    "6th Namgyeong Calligraphy Exhibition",
    "第6回 ナムギョン書会展",
    "第6届Namgyeong书法展",
    "第6屆Namgyeong書法展"
  ],
  [
    "2026 부산미술원로작가회",
    "2026 Busan Senior Artists Exhibition",
    "2026 釜山美術ベテラン作家展",
    "2026釜山资深美术家展",
    "2026釜山資深美術家展"
  ],
  [
    "복천박물관 특별기획전 <함께 달린 시간: 우리 곁의 말 이야기>",
    "Bokcheon Museum: Running Together — Stories of Horses",
    "福泉博物館特別展「共に走った時間：身近な馬の物語」",
    "福泉博物馆特别展：共同奔跑的时光——身边的马的故事",
    "福泉博物館特別展：共同奔跑的時光——身邊的馬的故事"
  ],
  [
    "초록마술사의 과학마술쇼",
    "Green Magician’s Science Magic Show",
    "緑の魔術師の科学マジックショー",
    "绿色魔术师的科学魔术秀",
    "綠色魔術師的科學魔術秀"
  ],
  [
    "제3회 밀마루합창단 정기연주회",
    "3rd Milmaru Choir Concert",
    "第3回 ミルマル合唱団定期演奏会",
    "第3届Milmaru合唱团音乐会",
    "第3屆Milmaru合唱團音樂會"
  ],
  [
    "NAC@시그니처 클래식 시벨리우스 5번 & 시벨리우스 바이올린 협주곡",
    "NAC Signature Classics: Sibelius Symphony No. 5 & Violin Concerto",
    "NAC シグネチャー・クラシック：シベリウス交響曲第5番＆ヴァイオリン協奏曲",
    "NAC经典系列：西贝柳斯第五交响曲与小提琴协奏曲",
    "NAC經典系列：西貝流士第五交響曲與小提琴協奏曲"
  ],
  [
    "빨간코 루돌프와 산타클로스",
    "Rudolph the Red-Nosed Reindeer and Santa Claus",
    "赤鼻のルドルフとサンタクロース",
    "红鼻子鲁道夫与圣诞老人",
    "紅鼻子魯道夫與聖誕老人"
  ],
  [
    "신해경 단독 콘서트: 나의 가역반응 사가",
    "Shin Hae Gyeong Solo Concert: My Reversible Reaction Saga",
    "シン・ヘギョン単独コンサート：私の可逆反応サーガ",
    "Shin Hae Gyeong个人演唱会：我的可逆反应传奇",
    "Shin Hae Gyeong個人演唱會：我的可逆反應傳奇"
  ],
  [
    "로드 기획연주, 임홍균 바이올린 리사이틀",
    "Lim Hong-gyun Violin Recital — Road Concert Series",
    "イム・ホンギュン ヴァイオリン・リサイタル",
    "Lim Hong-gyun小提琴独奏会",
    "Lim Hong-gyun小提琴獨奏會"
  ],
  [
    "국제게임전시회 지스타 2026",
    "G-STAR 2026 International Game Exhibition",
    "国際ゲーム展示会 G-STAR 2026",
    "G-STAR 2026国际游戏展",
    "G-STAR 2026國際遊戲展"
  ],
  [
    "크리스마스 빌리지 부산 2026",
    "Busan Christmas Village 2026",
    "釜山クリスマスビレッジ2026",
    "2026釜山圣诞村",
    "2026釜山聖誕村"
  ],
  [
    "해운대 빛축제",
    "Haeundae Light Festival",
    "海雲台光祭り",
    "海云台灯光节",
    "海雲台燈光節"
  ],
  [
    "부산브릿지마라톤",
    "Busan Bridge Marathon",
    "釜山ブリッジマラソン",
    "釜山大桥马拉松",
    "釜山大橋馬拉松"
  ],
  [
    "부산광역시 연제구 중앙대로 1001 2층 시청전시실",
    "City Hall Exhibition Hall, 2F, 1001 Jungang-daero, Yeonje-gu, Busan",
    "釜山市蓮堤区中央大路1001、市庁2階展示室",
    "釜山市莲堤区中央大路1001，市厅2楼展厅",
    "釜山市蓮堤區中央大路1001，市廳2樓展廳"
  ],
  [
    "부산광역시 동래구 복천로 63",
    "63 Bokcheon-ro, Dongnae-gu, Busan",
    "釜山市東莱区福泉路63",
    "釜山市东莱区福泉路63",
    "釜山市東萊區福泉路63"
  ],
  [
    "나다소극장",
    "Nada Small Theater",
    "ナダ小劇場",
    "Nada小剧场",
    "Nada小劇場"
  ],
  [
    "초록마술극장",
    "Green Magic Theater",
    "緑のマジック劇場",
    "绿色魔术剧场",
    "綠色魔術劇場"
  ],
  [
    "KT&G 상상마당 라이브홀 [부산]",
    "KT&G Sangsangmadang Live Hall, Busan",
    "KT&G サンサンマダン ライブホール（釜山）",
    "KT&G想象空间Live Hall（釜山）",
    "KT&G想像空間Live Hall（釜山）"
  ],
  [
    "(재) 영화의전당",
    "Busan Cinema Center",
    "映画の殿堂",
    "电影殿堂",
    "電影殿堂"
  ],
  [
    "낙동아트센터",
    "Nakdong Arts Center",
    "洛東アートセンター",
    "洛东艺术中心",
    "洛東藝術中心"
  ],
  [
    "하하아트홀 (구. 성원아트홀)",
    "Haha Art Hall (formerly Seongwon Art Hall)",
    "ハハアートホール（旧ソンウォンアートホール）",
    "Haha艺术厅（原Seongwon艺术厅）",
    "Haha藝術廳（原Seongwon藝術廳）"
  ],
  [
    "KBS홀 [부산]",
    "KBS Hall, Busan",
    "KBSホール（釜山）",
    "KBS大厅（釜山）",
    "KBS大廳（釜山）"
  ],
  [
    "부산문화회관",
    "Busan Cultural Center",
    "釜山文化会館",
    "釜山文化会馆",
    "釜山文化會館"
  ],
  [
    "금정문화회관",
    "Geumjeong Cultural Center",
    "金井文化会館",
    "金井文化会馆",
    "金井文化會館"
  ],
  [
    "영도문화예술회관",
    "Yeongdo Culture and Arts Center",
    "影島文化芸術会館",
    "影岛文化艺术会馆",
    "影島文化藝術會館"
  ],
  [
    "서커스/마술 공연중",
    "Circus / magic · running",
    "サーカス・マジック／公演中",
    "杂技／魔术 · 演出中",
    "雜技／魔術 · 演出中"
  ],
  [
    "연극 공연중",
    "Theatre · running",
    "演劇／公演中",
    "话剧 · 演出中",
    "話劇 · 演出中"
  ],
  [
    "대중음악 공연중",
    "Popular music · running",
    "ポピュラー音楽／公演中",
    "流行音乐 · 演出中",
    "流行音樂 · 演出中"
  ],
  [
    "연제구",
    "Yeonje-gu",
    "蓮堤区",
    "莲堤区",
    "蓮堤區"
  ],
  [
    "동래구",
    "Dongnae-gu",
    "東莱区",
    "东莱区",
    "東萊區"
  ],
  [
    "해운대구",
    "Haeundae-gu",
    "海雲台区",
    "海云台区",
    "海雲台區"
  ],
  [
    "수영구",
    "Suyeong-gu",
    "水営区",
    "水营区",
    "水營區"
  ],
  [
    "부산",
    "Busan",
    "釜山",
    "釜山",
    "釜山"
  ]
];
export function cleanApiText(value:unknown){return String(value||'').replace(/&lt;?/g,'<').replace(/&gt;?/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
export function apiTranslation(value:unknown,lang:string,enabled=true):string{
 const raw=cleanApiText(value);const index=['en','ja','zh-CN','zh-TW'].indexOf(lang)+1;if(!enabled||index===0)return raw;
 const exact=rows.find(row=>row[0]===raw);if(exact)return exact[index];
 const base=raw.replace(/\s*\[부산\]/g,'').replace(/\s*\(\d+월\)/g,'').trim();
 const translated=rows.find(row=>row[0]===base)?.[index];
 const month=raw.match(/\((\d+)월\)/)?.[1];
 const suffix=raw.includes('[부산]')?[' · Busan',' · 釜山',' · 釜山',' · 釜山'][index-1]:'';
 if(translated)return translated+suffix;
 if(base&&!/[가-힣]/.test(base))return base+suffix+(month?' · '+(index===1?['January','February','March','April','May','June','July','August','September','October','November','December'][Number(month)-1]:month+'月'):'');
 return raw;
}
export const apiTranslationCount=rows.length;
