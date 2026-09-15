/*******************************************************
 * PAPS 모듈 (Mod_Paps.gs)
 *
 * 단독판 PAPS 기록 관리 프로그램을 통합 뼈대 위로 옮긴 것입니다.
 *  - 학생 명단·비밀번호·로그인은 공통(Code.gs)이 맡습니다. 여기에는 명단이 없습니다.
 *  - 시트 이름은 PAPS_ 접두어, 설정은 공통 설정 시트의 PAPS.* 항목, 서버 함수는 paps_t_ / paps_s_ 접두어.
 *  - 기준표 데이터는 PAPS_Data.gs 의 PAPS_기준 배열에서 옵니다 (그 파일이 없으면 기준표가 비어 등급이 안 나옵니다).
 *  - 기록에는 학년도가 함께 저장됩니다. 학년 올리기를 해도 지난해 기록은 지난해 것으로 남습니다.
 *  - 학교급(초|중)은 공통 설정을 따릅니다. 기준표는 학교급·학년·성별·종목으로 찾고, 기본 종목·대상 학년도 학교급마다 다릅니다.
 *    (기준표 시트에 학교급 열이 없는 옛 시트는 '초' 로 읽습니다)
 *
 * 시트
 *   PAPS_종목   : 요인, 종목명, 단위, 소수자리, 방식, 사용
 *   PAPS_기준표 : 학교급, 학년, 성별, 종목, 등급, 하한, 상한
 *   PAPS_기록   : 기록ID, 입력일시, 학년도, 학생ID, 학년, 반, 번호, 이름, 성별, 회차, 요인, 종목, 측정값, 등급, 참고1, 참고2, 입력자
 *   PAPS_목표   : 학생ID, 학년도, 회차, 종목, 목표값, 수정일시
 *   PAPS_영상   : 순서, 종목, 제목, URL, 출처
 *   PAPS_도전   : 도전ID, 학생ID, 날짜, 종목, 측정값, 등급, 입력시각
 *   PAPS_내보내기 : 나이스 붙여넣기용 (필요할 때 만들어짐)
 *******************************************************/

var PAPS = { 종목: 'PAPS_종목', 기준표: 'PAPS_기준표', 기록: 'PAPS_기록', 목표: 'PAPS_목표', 영상: 'PAPS_영상', 도전: 'PAPS_도전', 내보내기: 'PAPS_내보내기' };
var PAPS_H = {
  종목:   ['요인', '종목명', '단위', '소수자리', '방식', '사용'],
  기준표: ['학교급', '학년', '성별', '종목', '등급', '하한', '상한'],
  기록:   ['기록ID', '입력일시', '학년도', '학생ID', '학년', '반', '번호', '이름', '성별', '회차', '요인', '종목', '측정값', '등급', '참고1', '참고2', '입력자'],
  목표:   ['학생ID', '학년도', '회차', '종목', '목표값', '수정일시'],
  영상:   ['순서', '종목', '제목', 'URL', '출처'],
  도전:   ['도전ID', '학생ID', '날짜', '종목', '측정값', '등급', '입력시각']
};

/* 학교급별 기본 종목. [요인, 종목명, 단위, 소수자리, 방식, 사용(기본 체크)] — 사용 여부는 학교마다 측정 종목 화면에서 바꿉니다 */
var PAPS_기본종목_초 = [
  ['심폐지구력',    '왕복오래달리기',       '회',  0, '일반', true ],
  ['심폐지구력',    '오래달리기-걷기',      '초',  0, '일반', false],
  ['심폐지구력',    '스텝검사',             'PEI', 1, '일반', false],
  ['유연성',        '앉아윗몸앞으로굽히기', 'cm',  1, '일반', true ],
  ['유연성',        '종합유연성검사',       '점',  0, '일반', false],
  ['근력·근지구력', '윗몸말아올리기',       '회',  0, '일반', true ],
  ['근력·근지구력', '악력',                 'kg',  1, '일반', false],
  ['순발력',        '50m달리기',            '초',  2, '일반', true ],
  ['순발력',        '제자리멀리뛰기',       'cm',  1, '일반', false],
  ['비만',          '체질량지수',           '',    1, 'BMI',  true ]
];
var PAPS_기본종목_중 = [
  ['심폐지구력',    '왕복오래달리기',       '회',  0, '일반', true ],
  ['심폐지구력',    '오래달리기-걷기',      '초',  0, '일반', false],
  ['심폐지구력',    '스텝검사',             'PEI', 1, '일반', false],
  ['유연성',        '앉아윗몸앞으로굽히기', 'cm',  1, '일반', true ],
  ['유연성',        '종합유연성검사',       '점',  0, '일반', false],
  ['근력·근지구력', '팔굽혀펴기',           '회',  0, '일반', true ],   // 여학생은 무릎대고팔굽혀펴기 기준으로 채점
  ['근력·근지구력', '윗몸말아올리기',       '회',  0, '일반', false],
  ['근력·근지구력', '악력',                 'kg',  1, '일반', false],
  ['순발력',        '50m달리기',            '초',  2, '일반', true ],
  ['순발력',        '제자리멀리뛰기',       'cm',  1, '일반', false],
  ['비만',          '체질량지수',           '',    1, 'BMI',  true ]
];
function paps_기본종목_(급) { return (급 || 학교급_().급) === '중' ? PAPS_기본종목_중 : PAPS_기본종목_초; }
function paps_기본대상학년_(급) { return (급 || 학교급_().급) === '중' ? '1,2,3' : '3,4,5,6'; }
var PAPS_요인순서 = ['심폐지구력', '유연성', '근력·근지구력', '순발력', '비만'];
var PAPS_판정색 = { '정상': 1, '과체중': 3, '마름': 4, '경도비만': 4, '고도비만': 5 };

function paps_기본설정_() {
  return [
    ['회차',     '1차,2차',  'PAPS 측정 회차 이름 (쉼표로 구분)'],
    ['대상학년', paps_기본대상학년_(), 'PAPS를 실시하는 학년 — 이 학년 학생에게만 PAPS 메뉴가 보입니다 (초등 3~6 · 중등 1~3)'],
    ['도전기록', 'Y',        'Y | N — 학생이 스스로 연습 기록(내 도전)을 남길 수 있게'],
    ['목표입력', 'Y',        'Y | N — 학생이 회차별 목표를 정할 수 있게']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function paps_hooks_() {
  return {
    준비확인: function () {
      var 다있음 = ['종목', '기준표', '기록', '목표', '영상', '도전'].every(function (k) { return !!findSheet_(PAPS[k]); });
      if (!다있음) return false;
      // 기준표가 비어 있거나 이 학교급 줄이 없는데 PAPS_Data.gs 가 (나중에라도) 들어왔으면 다음 접속 때 채웁니다
      if (paps_기준데이터_() && !paps_기준표급있음_()) return false;
      return true;
    },
    준비: function () {
      var 만듦 = [], 색 = '#E6F1FF';
      만듦 = 만듦.concat(시트준비_(PAPS.종목, PAPS_H.종목, { 색: 색, 기본행: paps_기본종목_(), 체크박스열: ['사용'] }));
      만듦 = 만듦.concat(시트준비_(PAPS.기준표, PAPS_H.기준표, { 색: 색 }));
      만듦 = 만듦.concat(시트준비_(PAPS.기록, PAPS_H.기록, { 색: 색 }));
      만듦 = 만듦.concat(시트준비_(PAPS.목표, PAPS_H.목표, { 색: 색 }));
      만듦 = 만듦.concat(시트준비_(PAPS.영상, PAPS_H.영상, { 색: 색 }));
      만듦 = 만듦.concat(시트준비_(PAPS.도전, PAPS_H.도전, { 색: 색 }));
      if (!paps_기준표급있음_()) {
        var n = paps_기준표채우기_();
        만듦.push(n ? 'PAPS 기준표 ' + n + '개 구간 (' + 학교급_().이름 + ')' : 'PAPS 기준표 비어 있음 (PAPS_Data.gs 파일을 넣어 주세요)');
      }
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      paps_기본설정_().forEach(function (r) { if (!있음['PAPS.' + r[0]]) put['PAPS.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('PAPS 설정 ' + Object.keys(put).length + '항목'); }
      paps_캐시지우기_();
      return 만듦;
    },
    캐시지우기: paps_캐시지우기_,
    학생참여: function (학생ID) {
      var s = 학생찾기_(학생ID);
      return !!s && paps_대상학년_().indexOf(Number(s.학년)) >= 0;
    },
    교사대시보드: function () {
      var 설정 = paps_설정_(), 회차들 = 설정.회차, 종목 = paps_종목목록_();
      var 대상 = 학생목록_(false).filter(function (s) { return 설정.대상학년.indexOf(Number(s.학년)) >= 0; });
      var 기록 = paps_기록전체_(설정.학년도);
      var 카드 = 회차들.map(function (회차) {
        var 완료 = 0, 시작 = 0;
        대상.forEach(function (s) {
          var m = (기록[회차] || {})[s.학생ID] || {};
          var n = 종목.filter(function (t) { return m[t.종목] !== undefined; }).length;
          if (n) 시작++;
          if (n >= 종목.length) 완료++;
        });
        return { 제목: 회차 + ' 측정 완료', 값: 완료, 단위: '/ ' + 대상.length + '명',
                 설명: 시작 ? (시작 - 완료) + '명은 일부 종목만 측정' : '아직 측정 전', 이동: 'input' };
      });
      return { 카드: 카드 };
    },
    학생배지: function (학생ID) { return paps_배지_(학생ID); },
    학생프로필: function (학생ID) {
      var s = 학생찾기_(학생ID);
      if (!s || paps_대상학년_().indexOf(Number(s.학년)) < 0) return null;
      var 설정 = paps_설정_(), 종목 = paps_종목목록_();
      var 기록 = paps_학생기록_(학생ID, 설정.학년도);
      var 회차 = null;
      설정.회차.forEach(function (r) { if (기록[r] && Object.keys(기록[r]).length) 회차 = r; });
      if (!회차) return { 제목: 'PAPS 측정 전', 값: '–', 단위: '', 설명: '선생님이 측정 기록을 넣으면 등급이 보여요', 요약: { 이름: 'PAPS 평균 등급', 값: '–', 단위: '' }, 이동: 'record' };
      var 등급들 = [];
      종목.forEach(function (t) { var r = 기록[회차][t.종목]; if (r && !isNaN(Number(r.등급)) && r.등급 !== '') 등급들.push(Number(r.등급)); });
      var 평균 = 등급들.length ? Math.round(등급들.reduce(function (a, b) { return a + b; }, 0) / 등급들.length * 10) / 10 : null;
      var 측정수 = Object.keys(기록[회차]).length;
      return {
        제목: 'PAPS ' + 회차 + ' 평균 등급', 값: 평균 === null ? '–' : 평균, 단위: '등급',
        진행: Math.round(측정수 / Math.max(1, 종목.length) * 100),
        설명: '측정 ' + 측정수 + '/' + 종목.length + '종목',
        요약: { 이름: 'PAPS 평균 등급', 값: 평균 === null ? '–' : 평균, 단위: '' },
        이동: 'record'
      };
    },
    초기화정보: function () {
      return [
        { key: '기록', 이름: '측정 기록·목표 (모든 학년도)', 수: rows_(PAPS.기록).length + rows_(PAPS.목표).length },
        { key: '도전', 이름: '학생 도전 기록', 수: rows_(PAPS.도전).length },
        { key: '영상', 이름: '참고 영상', 수: rows_(PAPS.영상).length },
        { key: '종목', 이름: '측정 종목 선택 → 기본값으로', 수: rows_(PAPS.종목).length },
        { key: '기준표', 이름: '기준표 다시 채우기 (PAPS_Data.gs)', 수: rows_(PAPS.기준표).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var 전부 = function () { return true; }, res = {};
      if (opts.기록) { res.기록 = 행지우기_(PAPS.기록, 전부); res.목표 = 행지우기_(PAPS.목표, 전부); }
      if (opts.도전) res.도전 = 행지우기_(PAPS.도전, 전부);
      if (opts.영상) res.영상 = 행지우기_(PAPS.영상, 전부);
      if (opts.종목) { paps_종목기본으로_(); res.종목 = true; }
      if (opts.기준표) res.기준표 = paps_기준표채우기_();
      paps_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var 맞나 = function (o) { return set[str_(o.학생ID)] === true; };
      return { 기록: 행지우기_(PAPS.기록, 맞나), 목표: 행지우기_(PAPS.목표, 맞나), 도전: 행지우기_(PAPS.도전, 맞나) };
    },
    /** 공통 설정에서 학교급이 바뀌었을 때: 대상 학년·측정 종목을 그 학교급 기본으로, 기준표에 그 학교급 줄이 없으면 채움. 기록은 건드리지 않음 */
    학교급변경: function (급) {
      var out = [];
      설정저장_({ 'PAPS.대상학년': paps_기본대상학년_(급.급) });
      out.push('PAPS 대상 학년 ' + paps_기본대상학년_(급.급).replace(/,/g, '·'));
      paps_종목기본으로_(급.급);
      out.push('PAPS 측정 종목을 ' + 급.이름 + ' 기본 구성으로');
      if (paps_기준데이터_() && !paps_기준표급있음_(급.급)) { var n = paps_기준표채우기_(); out.push('PAPS 기준표 ' + n + '개 구간'); }
      paps_캐시지우기_();
      return out;
    }
  };
}

/** 종목 시트를 학교급 기본 구성으로 되돌립니다 (기록은 그대로) */
function paps_종목기본으로_(급) {
  var 기본 = paps_기본종목_(급);
  시트비우기_(PAPS.종목);
  appendRows_(PAPS.종목, PAPS_H.종목, 기본.map(function (r) { var o = {}; PAPS_H.종목.forEach(function (h, i) { o[h] = r[i]; }); return o; }));
  try { var c = ensureColumns_(PAPS.종목, PAPS_H.종목).indexOf('사용') + 1; sheet_(PAPS.종목).getRange(2, c, 기본.length, 1).insertCheckboxes(); } catch (e) {}
  paps_캐시지우기_();
}

/* ================= 설정 · 종목 · 기준표 ================= */

function paps_설정_() {
  var s = 설정_();
  var 회차 = 목록_(s['PAPS.회차']);
  if (!회차.length) 회차 = ['1차', '2차'];
  var 급 = 학교급_();
  var 대상학년 = 목록_(s['PAPS.대상학년']).map(Number).filter(function (g) { return g >= 1 && g <= 급.최대학년; });
  if (!대상학년.length) 대상학년 = 목록_(paps_기본대상학년_(급.급)).map(Number);
  return {
    회차: 회차, 대상학년: 대상학년,
    학년도: str_(s.학년도) || String(new Date().getFullYear()),
    도전기록: str_(s['PAPS.도전기록']).toUpperCase() !== 'N',
    목표입력: str_(s['PAPS.목표입력']).toUpperCase() !== 'N'
  };
}
function paps_대상학년_() { return paps_설정_().대상학년; }
function paps_캐시지우기_() { 캐시지우기_('paps_cfg'); 캐시지우기_('paps_scale'); }

function paps_cfg_() {
  return 캐시_('paps_cfg', function () {
    var 종목 = rows_(PAPS.종목).map(function (r) {
      return { 요인: str_(r.요인), 종목: str_(r.종목명), 단위: str_(r.단위), 소수: num_(r.소수자리) || 0, 방식: str_(r.방식) || '일반', 사용: bool_(r.사용) };
    }).filter(function (t) { return t.종목; });
    종목.sort(function (a, b) { return PAPS_요인순서.indexOf(a.요인) - PAPS_요인순서.indexOf(b.요인); });
    return { 종목: 종목, 영상: rows_(PAPS.영상).filter(function (r) { return str_(r.URL); }).map(function (r) {
      return { 순서: num_(r.순서) || 0, 종목: str_(r.종목), 제목: str_(r.제목), URL: str_(r.URL), 출처: str_(r.출처) };
    }).sort(function (a, b) { return a.순서 - b.순서; }) };
  });
}
function paps_종목목록_(전부) { return paps_cfg_().종목.filter(function (t) { return 전부 || t.사용; }); }
function paps_영상목록_() { return paps_cfg_().영상; }
function paps_영상맵_() {
  var out = {};
  paps_영상목록_().forEach(function (v) { if (!out[v.종목]) out[v.종목] = []; out[v.종목].push({ 제목: v.제목, URL: v.URL, 출처: v.출처 }); });
  return out;
}

/** 기준표 전체를 { '학교급|학년|성별|종목': [{라벨,하한,상한}] } 로 (캐시). 학교급 열이 비어 있으면 '초'. 비어 있으면 캐시에 남기지 않아 시트를 채운 직후 바로 반영됩니다 */
function paps_기준키_(학년, 성별, 종목) { return [학교급_().급, Number(학년), String(성별), String(종목)].join('|'); }
function paps_기준맵_() {
  var v = 캐시읽기_('paps_scale');
  if (v && Object.keys(v).length) return v;
  var map = {};
  rows_(PAPS.기준표).forEach(function (r) {
    var key = [str_(r.학교급) || '초', num_(r.학년), str_(r.성별), str_(r.종목)].join('|');
    if (!map[key]) map[key] = [];
    map[key].push({ 라벨: (r.등급 === '' || r.등급 === null) ? '' : (isNaN(Number(r.등급)) ? str_(r.등급) : Number(r.등급)),
                    하한: (r.하한 === '' || r.하한 === null) ? null : Number(r.하한),
                    상한: (r.상한 === '' || r.상한 === null) ? null : Number(r.상한) });
  });
  if (Object.keys(map).length) { try { 캐시쓰기_('paps_scale', map); } catch (e) {} }
  return map;
}

function paps_등급색_(라벨) {
  if (라벨 === '' || 라벨 === null || 라벨 === undefined) return 0;
  var n = Number(라벨);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  return PAPS_판정색[String(라벨)] || 3;
}

/** 값이 클수록 좋은 종목인지 (1등급 구간과 5등급 구간 비교). 등급이 아니면 null */
function paps_방향_(구간) {
  var best = null, worst = null;
  구간.forEach(function (b) {
    var n = Number(b.라벨);
    if (isNaN(n) || b.라벨 === '') return;
    if (best === null || n < Number(best.라벨)) best = b;
    if (worst === null || n > Number(worst.라벨)) worst = b;
  });
  if (best === null || worst === null || best === worst) return null;
  var 대표 = function (b) { return (b.하한 === null) ? b.상한 : b.하한; };
  var a = 대표(best), c = 대표(worst);
  if (a === null || c === null) return null;
  return a > c;
}

/** 화면용 기준표: { 남: { 종목: { 클수록, 구간:[{라벨,하한,상한,색}] } }, 여: {...} } */
function paps_기준_(학년) {
  var map = paps_기준맵_(), out = { 남: {}, 여: {} }, 급 = 학교급_().급;
  Object.keys(map).forEach(function (key) {
    var p = key.split('|');
    if (p[0] !== 급 || Number(p[1]) !== Number(학년) || !out[p[2]]) return;
    var 구간 = map[key].map(function (b) { return { 라벨: b.라벨, 하한: b.하한, 상한: b.상한, 색: paps_등급색_(b.라벨) }; });
    구간.sort(function (a, b) {
      var an = Number(a.라벨), bn = Number(b.라벨);
      if (a.라벨 !== '' && b.라벨 !== '' && !isNaN(an) && !isNaN(bn)) return bn - an;
      var al = (a.하한 === null) ? -Infinity : a.하한, bl = (b.하한 === null) ? -Infinity : b.하한;
      return al - bl;
    });
    out[p[2]][p[3]] = { 클수록: paps_방향_(구간), 구간: 구간 };
  });
  return out;
}

function paps_등급구하기_(학년, 성별, 종목, 값) {
  if (값 === '' || 값 === null || isNaN(Number(값))) return '';
  var list = paps_기준맵_()[paps_기준키_(학년, 성별, 종목)];
  if (!list || !list.length) return '';
  var v = Number(값);
  for (var i = 0; i < list.length; i++) {
    var lo = list[i].하한 === null ? -Infinity : list[i].하한, hi = list[i].상한 === null ? Infinity : list[i].상한;
    if (v >= lo && v <= hi) return list[i].라벨;
  }
  var best = null;
  list.forEach(function (b) { var lo = b.하한 === null ? -Infinity : b.하한; if (lo <= v && (!best || lo > (best.하한 === null ? -Infinity : best.하한))) best = b; });
  if (best) return best.라벨;
  var lowest = list[0];
  list.forEach(function (b) { if ((b.하한 === null ? -Infinity : b.하한) < (lowest.하한 === null ? -Infinity : lowest.하한)) lowest = b; });
  return lowest.라벨;
}

function paps_BMI_(키cm, 몸무게kg) {
  var h = Number(키cm) / 100, w = Number(몸무게kg);
  if (!h || !w) return '';
  return Math.round((w / (h * h)) * 10) / 10;
}

/** PAPS_Data.gs 가 있으면 그 배열, 없으면 null (파일 유무를 안전하게 확인) */
function paps_기준데이터_() {
  try { return (typeof PAPS_기준 !== 'undefined' && PAPS_기준 && PAPS_기준.length) ? PAPS_기준 : null; } catch (e) { return null; }
}

/** 기준표 시트에 이 학교급의 줄이 있는지 (학교급 열이 없는 옛 시트는 '초' 로 봄) */
function paps_기준표급있음_(급) {
  급 = 급 || 학교급_().급;
  var rows = rows_(PAPS.기준표);
  for (var i = 0; i < rows.length; i++) if ((str_(rows[i].학교급) || '초') === 급) return true;
  return false;
}

/** PAPS_Data.gs 의 PAPS_기준 배열(초·중 전부)로 기준표 시트를 다시 채웁니다. 파일이 없으면 0 */
function paps_기준표채우기_() {
  var data = paps_기준데이터_();
  if (!data) return 0;
  시트비우기_(PAPS.기준표);
  var have = ensureColumns_(PAPS.기준표, PAPS_H.기준표);
  var rows = data.map(function (r) {
    // 옛 PAPS_Data.gs(6열, 학교급 없음)도 받아 줍니다
    var o = r.length >= 7 ? { 학교급: r[0], 학년: r[1], 성별: r[2], 종목: r[3], 등급: r[4], 하한: r[5], 상한: r[6] }
                          : { 학교급: '초', 학년: r[0], 성별: r[1], 종목: r[2], 등급: r[3], 하한: r[4], 상한: r[5] };
    return have.map(function (h) { return o[h] === undefined ? '' : o[h]; });
  });
  var sh = sheet_(PAPS.기준표);
  sh.getRange(2, 1, rows.length, have.length).setValues(rows);
  [have.indexOf('하한'), have.indexOf('상한')].forEach(function (c) { if (c >= 0) sh.getRange(2, c + 1, rows.length, 1).setNumberFormat('0.##'); });
  캐시지우기_('paps_scale');
  return rows.length;
}

/* ================= 기록 읽기 ================= */

/** { 회차: { 학생ID: { 종목: {값, 등급, 참고1, 참고2, 입력자} } } } — 해당 학년도만 */
function paps_기록전체_(학년도) {
  var out = {};
  rows_(PAPS.기록).forEach(function (r) {
    if (학년도 && str_(r.학년도) !== String(학년도)) return;
    var 회차 = str_(r.회차), id = str_(r.학생ID);
    if (!out[회차]) out[회차] = {};
    if (!out[회차][id]) out[회차][id] = {};
    out[회차][id][str_(r.종목)] = { 값: r.측정값, 등급: r.등급, 참고1: r.참고1, 참고2: r.참고2, 입력자: str_(r.입력자) };
  });
  return out;
}

/** 한 학생: { 회차: { 종목: {값, 등급} } } (학년도 지정 시 그 해만) */
function paps_학생기록_(학생ID, 학년도) {
  var out = {};
  rows_(PAPS.기록).forEach(function (r) {
    if (str_(r.학생ID) !== String(학생ID)) return;
    if (학년도 && str_(r.학년도) !== String(학년도)) return;
    var 회차 = str_(r.회차);
    if (!out[회차]) out[회차] = {};
    out[회차][str_(r.종목)] = { 값: r.측정값, 등급: r.등급 };
  });
  return out;
}

/** 한 학생의 지난 학년도 기록: [{학년도, 학년, 회차, 종목, 값, 등급}] */
function paps_학생이력_(학생ID) {
  return rows_(PAPS.기록).filter(function (r) { return str_(r.학생ID) === String(학생ID); }).map(function (r) {
    return { 학년도: str_(r.학년도), 학년: num_(r.학년), 회차: str_(r.회차), 종목: str_(r.종목), 값: r.측정값, 등급: r.등급 };
  });
}

function paps_학급학생_(학년, 반) {
  return 학생목록_(false).filter(function (s) { return s.학년 === Number(학년) && s.반 === Number(반); }).map(학생공개_);
}

function paps_학급목록_() {
  var 설정 = paps_설정_(), 학급 = {};
  학생목록_(false).forEach(function (s) {
    if (설정.대상학년.indexOf(s.학년) < 0) return;
    if (!학급[s.학년]) 학급[s.학년] = {};
    학급[s.학년][s.반] = true;
  });
  return Object.keys(학급).map(Number).sort(function (a, b) { return a - b; }).map(function (g) {
    return { 학년: g, 반: Object.keys(학급[g]).map(Number).sort(function (a, b) { return a - b; }) };
  });
}

/** { 학생ID: { 종목: 목표값 } } */
function paps_목표_(학년도, 회차, 소속) {
  var out = {};
  rows_(PAPS.목표).forEach(function (r) {
    if (str_(r.학년도) !== String(학년도) || str_(r.회차) !== String(회차)) return;
    if (r.목표값 === '' || r.목표값 === null) return;
    var id = str_(r.학생ID);
    if (소속 && !소속[id]) return;
    if (!out[id]) out[id] = {};
    out[id][str_(r.종목)] = Number(r.목표값);
  });
  return out;
}
function paps_내목표_(학생ID, 학년도) {
  var out = {};
  rows_(PAPS.목표).forEach(function (r) {
    if (str_(r.학생ID) !== String(학생ID) || str_(r.학년도) !== String(학년도)) return;
    if (r.목표값 === '' || r.목표값 === null) return;
    var 회차 = str_(r.회차);
    if (!out[회차]) out[회차] = {};
    out[회차][str_(r.종목)] = Number(r.목표값);
  });
  return out;
}

function paps_내도전_(학생ID) {
  return rows_(PAPS.도전).filter(function (r) { return str_(r.학생ID) === String(학생ID); }).map(function (r) {
    return { 도전ID: str_(r.도전ID), 날짜: 날짜정리_(r.날짜), 종목: str_(r.종목), 값: Number(r.측정값), 등급: r.등급,
             시각: r.입력시각 instanceof Date ? r.입력시각.getTime() : Number(r.입력시각) || 0 };
  }).sort(function (a, b) { if (a.날짜 !== b.날짜) return a.날짜 < b.날짜 ? -1 : 1; return a.시각 - b.시각; });
}

/* ================= 교사 API ================= */

function paps_t_boot(token) {
  교사확인_(token);
  var 설정 = paps_설정_();
  return { 종목: paps_종목목록_(), 학급: paps_학급목록_(), 회차: 설정.회차, 학년범위: 설정.대상학년, 학년도: 설정.학년도,
           기준있음: paps_기준표급있음_(), 기준파일: !!paps_기준데이터_(), 설정: 설정 };
}

/** 한 학급 화면에 필요한 것을 한 번에: 명단, 기록, 목표, 도전 수, 기준표 */
function paps_t_getClass(token, 학년, 반, 회차) {
  교사확인_(token);
  var 설정 = paps_설정_();
  var 명단 = paps_학급학생_(학년, 반);
  var 소속 = {};
  명단.forEach(function (s) { 소속[s.학생ID] = true; });
  var 기록 = paps_기록전체_(설정.학년도)[회차] || {};
  Object.keys(기록).forEach(function (id) { if (!소속[id]) delete 기록[id]; });
  var 도전수 = {};
  rows_(PAPS.도전).forEach(function (r) { var id = str_(r.학생ID); if (소속[id]) 도전수[id] = (도전수[id] || 0) + 1; });
  return { 학생: 명단, 기록: 기록, 목표: paps_목표_(설정.학년도, 회차, 소속), 도전수: 도전수, 기준: paps_기준_(학년) };
}

function paps_t_getScale(token, 학년) { 교사확인_(token); return paps_기준_(학년); }

/** 기준표를 PAPS_Data.gs 로 (다시) 채웁니다. 기록 입력 화면의 안내 버튼에서 부릅니다. */
function paps_t_fillScale(token) {
  교사확인_(token);
  if (!paps_기준데이터_()) return { ok: false, message: 'PAPS_Data.gs 파일이 없습니다. Apps Script 편집기에 파일을 추가하고 새 버전으로 배포한 뒤 다시 눌러 주세요.' };
  var n = withLock_(function () { return paps_기준표채우기_(); });
  return { ok: true, 구간: n };
}

/** payload = { 회차, 기록: [{학생ID, 종목, 값, 참고1, 참고2}] } — 같은 학생·학년도·회차·종목은 덮어씀 */
function paps_t_saveRecords(token, payload) {
  교사확인_(token);
  return paps_기록저장_(payload, '교사');
}

function paps_기록저장_(payload, 입력자) {
  var 설정 = paps_설정_(), 학년도 = 설정.학년도, 회차 = str_(payload.회차);
  if (설정.회차.indexOf(회차) < 0) return { ok: false, message: '회차가 맞지 않습니다.' };
  return withLock_(function () {
    var 학생맵 = 학생맵_(true), 종목정보 = {};
    paps_종목목록_().forEach(function (t) { 종목정보[t.종목] = t; });
    var 기존 = {};
    rows_(PAPS.기록).forEach(function (r) { 기존[[str_(r.학생ID), str_(r.학년도), str_(r.회차), str_(r.종목)].join('|')] = r._row; });
    var now = 지금_(), 신규 = [], 결과 = [];
    (payload.기록 || []).forEach(function (rec) {
      var s = 학생맵[String(rec.학생ID)]; if (!s) return;
      var info = 종목정보[rec.종목]; if (!info) return;
      var 값 = (info.방식 === 'BMI') ? paps_BMI_(rec.참고1, rec.참고2) : rec.값;
      if (값 === '' || 값 === null || isNaN(Number(값))) return;
      값 = Number(값);
      var 등급 = paps_등급구하기_(s.학년, s.성별, rec.종목, 값);
      var f = { 기록ID: uuid_(), 입력일시: now, 학년도: 학년도, 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 성별: s.성별,
                회차: 회차, 요인: info.요인, 종목: rec.종목, 측정값: 값, 등급: 등급, 참고1: rec.참고1 || '', 참고2: rec.참고2 || '', 입력자: 입력자 };
      var key = [s.학생ID, 학년도, 회차, rec.종목].join('|');
      if (기존[key]) { delete f.기록ID; setCells_(PAPS.기록, PAPS_H.기록, 기존[key], f); }
      else 신규.push(f);
      결과.push({ 학생ID: s.학생ID, 종목: rec.종목, 값: 값, 등급: 등급, 참고1: rec.참고1 || '', 참고2: rec.참고2 || '' });
    });
    if (신규.length) appendRows_(PAPS.기록, PAPS_H.기록, 신규);
    return { ok: true, 저장수: 결과.length, 결과: 결과 };
  });
}

/** 전체 조회: 학생 × 종목 등급 표 + 분포 */
function paps_t_getOverview(token, 학년, 반, 회차) {
  교사확인_(token);
  var d = paps_t_getClass(token, 학년, 반, 회차), 종목 = paps_종목목록_();
  var 분포 = {};
  종목.forEach(function (t) { 분포[t.종목] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 미측정: 0 }; });
  var 행 = d.학생.map(function (s) {
    return { 학생: s, 칸: 종목.map(function (t) {
      var r = (d.기록[s.학생ID] || {})[t.종목];
      if (!r || r.등급 === '' || r.등급 === undefined) { 분포[t.종목].미측정++; return { 값: '', 라벨: '', 색: 0 }; }
      var 색 = paps_등급색_(r.등급); 분포[t.종목][색]++;
      return { 값: r.값, 라벨: r.등급, 색: 색 };
    }) };
  });
  return { 종목: 종목, 행: 행, 분포: 분포, 인원: d.학생.length };
}

/* ---------- 내보내기 (나이스 붙여넣기용) ---------- */

function paps_정규화_(s) {
  return String(s).replace(/\([^)]*\)/g, '').replace(/[\s·\-_,./]/g, '').replace(/㎝|㎏|cm|kg|회|초|점|개/gi, '').toLowerCase();
}
var PAPS_열별칭 = [
  { 종류: '번호', 말: ['번호', '출석번호', '학번', '번'] }, { 종류: '이름', 말: ['이름', '성명'] }, { 종류: '성별', 말: ['성별'] },
  { 종류: '키', 말: ['키', '신장'] }, { 종류: '몸무게', 말: ['몸무게', '체중'] }
];
function paps_열해석_(머리글들, 종목들) {
  return 머리글들.map(function (h) {
    var n = paps_정규화_(h);
    if (!n) return { 이름: h, 종류: '빈칸' };
    for (var i = 0; i < PAPS_열별칭.length; i++) for (var j = 0; j < PAPS_열별칭[i].말.length; j++)
      if (n === paps_정규화_(PAPS_열별칭[i].말[j])) return { 이름: h, 종류: PAPS_열별칭[i].종류 };
    var 등급열 = /등급|판정/.test(String(h));
    for (var k = 0; k < 종목들.length; k++) {
      var tn = paps_정규화_(종목들[k].종목);
      if (n === tn || n.indexOf(tn) > -1 || tn.indexOf(n) > -1) return { 이름: h, 종류: 등급열 ? '등급' : '측정값', 종목: 종목들[k].종목 };
    }
    return { 이름: h, 종류: '모름' };
  });
}

/** 옵션 = { 머리글, 번호, 이름, 성별, 값종류: 측정값|등급|둘다, BMI분리 } */
function paps_t_export(token, 학년, 반, 회차, 옵션) {
  교사확인_(token);
  옵션 = 옵션 || {};
  var d = paps_t_getClass(token, 학년, 반, 회차), 종목들 = paps_종목목록_(), 열;
  var 머리글원문 = str_(옵션.머리글);
  if (머리글원문) {
    열 = paps_열해석_(머리글원문.split(/\r?\n/)[0].split(/\t|,/).map(function (x) { return x.trim(); }), 종목들);
  } else {
    열 = [];
    if (옵션.번호 !== false) 열.push({ 이름: '번호', 종류: '번호' });
    if (옵션.이름 !== false) 열.push({ 이름: '이름', 종류: '이름' });
    if (옵션.성별) 열.push({ 이름: '성별', 종류: '성별' });
    종목들.forEach(function (t) {
      if (t.방식 === 'BMI' && 옵션.BMI분리 !== false) { 열.push({ 이름: '키(cm)', 종류: '키' }); 열.push({ 이름: '몸무게(kg)', 종류: '몸무게' }); return; }
      if (옵션.값종류 !== '등급') 열.push({ 이름: t.종목, 종류: '측정값', 종목: t.종목 });
      if (옵션.값종류 === '등급' || 옵션.값종류 === '둘다') 열.push({ 이름: t.종목 + ' 등급', 종류: '등급', 종목: t.종목 });
    });
  }
  var BMI종목 = '';
  종목들.forEach(function (t) { if (t.방식 === 'BMI') BMI종목 = t.종목; });
  var 행 = d.학생.map(function (s) {
    var 내 = d.기록[s.학생ID] || {};
    return 열.map(function (c) {
      switch (c.종류) {
        case '번호': return s.번호;
        case '이름': return s.이름;
        case '성별': return s.성별;
        case '키': return (내[BMI종목] || {}).참고1 || '';
        case '몸무게': return (내[BMI종목] || {}).참고2 || '';
        case '측정값': return (내[c.종목] || {}).값 === undefined ? '' : 내[c.종목].값;
        case '등급': return (내[c.종목] || {}).등급 === undefined ? '' : 내[c.종목].등급;
        default: return '';
      }
    });
  });
  return { ok: true, 머리글: 열.map(function (c) { return c.이름; }), 해석: 열.map(function (c) { return c.종류; }), 행: 행, 인원: d.학생.length,
           못알아본: 열.filter(function (c) { return c.종류 === '모름'; }).map(function (c) { return c.이름; }) };
}

function paps_t_exportToSheet(token, 학년, 반, 회차, 옵션) {
  교사확인_(token);
  var d = paps_t_export(token, 학년, 반, 회차, 옵션);
  var ss = ss_(), sh = ss.getSheetByName(PAPS.내보내기) || ss.insertSheet(PAPS.내보내기);
  sh.clear();
  sh.getRange(1, 1).setValue(학년 + '학년 ' + 반 + '반 · ' + 회차 + ' · ' + 지금_()).setFontWeight('bold');
  sh.getRange(3, 1, 1, d.머리글.length).setValues([d.머리글]).setFontWeight('bold').setBackground('#E6F1FF');
  if (d.행.length) sh.getRange(4, 1, d.행.length, d.머리글.length).setValues(d.행);
  sh.setFrozenRows(3);
  return { ok: true, 시트: PAPS.내보내기, 행수: d.행.length, 열수: d.머리글.length, 못알아본: d.못알아본, url: ss.getUrl() + '#gid=' + sh.getSheetId() };
}

/* ---------- 측정 종목 선택 ---------- */

function paps_t_getEventChoices(token) {
  교사확인_(token);
  var by = {};
  paps_종목목록_(true).forEach(function (t) { if (!by[t.요인]) by[t.요인] = []; by[t.요인].push({ 종목: t.종목, 단위: t.단위, 사용: t.사용 }); });
  return PAPS_요인순서.filter(function (f) { return by[f]; }).map(function (f) { return { 요인: f, 종목들: by[f] }; });
}

function paps_t_setEventChoices(token, 선택) {
  교사확인_(token);
  if (!선택 || !선택.length) return { ok: false, message: '적어도 한 종목은 골라야 합니다.' };
  return withLock_(function () {
    var 켤것 = {};
    선택.forEach(function (n) { 켤것[String(n)] = true; });
    var sh = sheet_(PAPS.종목), last = sh.getLastRow();
    if (last < 2) return { ok: false, message: '종목 시트가 비어 있습니다.' };
    var head = ensureColumns_(PAPS.종목, PAPS_H.종목);
    var c이름 = head.indexOf('종목명') + 1, c사용 = head.indexOf('사용') + 1;
    var 이름들 = sh.getRange(2, c이름, last - 1, 1).getValues();
    var 값 = 이름들.map(function (row) { return [켤것[String(row[0])] === true]; });
    sh.getRange(2, c사용, last - 1, 1).setValues(값);
    paps_캐시지우기_();
    return { ok: true, 종목: paps_종목목록_(), 선택수: 값.filter(function (v) { return v[0]; }).length };
  });
}

/* ---------- 참고 영상 ---------- */

function paps_t_getVideos(token) { 교사확인_(token); return paps_영상목록_(); }

function paps_t_saveVideos(token, 목록) {
  교사확인_(token);
  return withLock_(function () {
    시트비우기_(PAPS.영상);
    var rows = (목록 || []).filter(function (v) { return str_(v.URL); }).map(function (v, i) {
      return { 순서: i + 1, 종목: str_(v.종목), 제목: str_(v.제목), URL: str_(v.URL), 출처: str_(v.출처) };
    });
    if (rows.length) appendRows_(PAPS.영상, PAPS_H.영상, rows);
    paps_캐시지우기_();
    return { ok: true, 영상: paps_영상목록_() };
  });
}

/* ---------- 자료 정리 (학생·학급 단위) ---------- */

/** 회차 = '전체' 이면 모든 회차 (이번 학년도만). 옵션 = { 기록, 목표, 도전 } */
function paps_t_resetStudent(token, 학생ID, 회차, 옵션) {
  교사확인_(token);
  if (!학생ID) return { ok: false, message: '학생을 골라 주세요.' };
  옵션 = 옵션 || {};
  if (!옵션.기록 && !옵션.목표 && !옵션.도전) return { ok: false, message: '지울 자료를 골라 주세요.' };
  var 학년도 = paps_설정_().학년도;
  return withLock_(function () {
    var 맞나 = function (o) {
      if (str_(o.학생ID) !== String(학생ID) || str_(o.학년도) !== 학년도) return false;
      return 회차 === '전체' || str_(o.회차) === String(회차);
    };
    var res = { 기록: 0, 목표: 0, 도전: 0 };
    if (옵션.기록) res.기록 = 행지우기_(PAPS.기록, 맞나);
    if (옵션.목표) res.목표 = 행지우기_(PAPS.목표, 맞나);
    if (옵션.도전) res.도전 = 행지우기_(PAPS.도전, function (o) { return str_(o.학생ID) === String(학생ID); });
    return { ok: true, 지움: res };
  });
}

function paps_t_resetClass(token, 학년, 반, 회차, 옵션) {
  교사확인_(token);
  옵션 = 옵션 || {};
  if (!옵션.기록 && !옵션.목표 && !옵션.도전) return { ok: false, message: '지울 자료를 골라 주세요.' };
  var 학년도 = paps_설정_().학년도, 소속 = {};
  paps_학급학생_(학년, 반).forEach(function (s) { 소속[s.학생ID] = true; });
  return withLock_(function () {
    var 맞나 = function (o) {
      if (!소속[str_(o.학생ID)] || str_(o.학년도) !== 학년도) return false;
      return 회차 === '전체' || str_(o.회차) === String(회차);
    };
    var res = { 기록: 0, 목표: 0, 도전: 0 };
    if (옵션.기록) res.기록 = 행지우기_(PAPS.기록, 맞나);
    if (옵션.목표) res.목표 = 행지우기_(PAPS.목표, 맞나);
    if (옵션.도전) res.도전 = 행지우기_(PAPS.도전, function (o) { return !!소속[str_(o.학생ID)]; });
    return { ok: true, 지움: res, 학급: 학년 + '학년 ' + 반 + '반' };
  });
}

/* ================= 학생 API ================= */

function paps_학생확인_(token) {
  var me = 학생확인_(token);
  if (paps_대상학년_().indexOf(Number(me.학년)) < 0) throw new Error('PAPS를 실시하는 학년이 아니에요.');
  return me;
}

/**
 * 도전 배지: 회차 측정 완료, 종목별 1등급·기록 향상, 고른 체력, 목표 달성, 평균 등급 향상, 체력 우수
 * 모두 PAPS_기록·PAPS_목표에서 계산합니다 (시트 없음)
 */
function paps_배지_(학생ID) {
  var s = 학생찾기_(학생ID);
  if (!s || paps_대상학년_().indexOf(Number(s.학년)) < 0) return [];
  var 설정 = paps_설정_(), 종목 = paps_종목목록_(), 기록 = paps_학생기록_(학생ID, 설정.학년도), 목표 = paps_내목표_(학생ID, 설정.학년도);
  var 기준 = (paps_기준_(s.학년)[s.성별] || {}), out = [], 평균들 = [], 측정회차 = [];
  var 등급 = function (rec, t) { var x = rec && rec[t]; return x && x.등급 !== '' && !isNaN(Number(x.등급)) ? Number(x.등급) : null; };
  var 값 = function (rec, t) { var x = rec && rec[t]; return x && x.값 !== '' && x.값 !== null && !isNaN(Number(x.값)) ? Number(x.값) : null; };
  var 좋아짐 = function (t, a, b) { var d = 기준[t] ? 기준[t].클수록 : null; if (d === null || d === undefined) return null; return d ? b > a : b < a; };
  설정.회차.forEach(function (r, i) {
    var rec = 기록[r] || {}, 측정 = Object.keys(rec).length, 등급들 = [];
    종목.forEach(function (t) { var g = 등급(rec, t.종목); if (g !== null) 등급들.push(g); });
    if (등급들.length) { 평균들.push(등급들.reduce(function (a, b) { return a + b; }, 0) / 등급들.length); 측정회차.push(r); }
    out.push({ id: 'PAPS-R' + (i + 1), 이름: r + ' 측정 완료', 설명: '모든 종목을 측정했어요', 아이콘: 'stopwatch', 달성: 종목.length > 0 && 측정 >= 종목.length, 진행: Math.round(측정 / Math.max(1, 종목.length) * 100), 값: 측정, 기준: 종목.length });
  });
  종목.forEach(function (t, i) {
    var best = null, vals = [], gs = [];
    설정.회차.forEach(function (r) { var g = 등급(기록[r], t.종목), v = 값(기록[r], t.종목); if (g !== null) { gs.push(g); if (best === null || g < best) best = g; } if (v !== null) vals.push(v); });
    if (t.방식 === 'BMI') return;   // 체질량지수는 등급 도전 대상이 아님
    out.push({ id: 'PAPS-G' + (i + 1), 이름: t.종목 + ' 1등급', 설명: t.종목 + '에서 1등급을 받았어요', 아이콘: 'medal', 달성: best === 1, 진행: best === null ? 0 : Math.round((5 - best) / 4 * 100), 값: best === null ? '-' : best + '등급', 기준: '1등급' });
    var 향상 = null;
    if (vals.length >= 2) { 향상 = 좋아짐(t.종목, vals[0], vals[vals.length - 1]); if (향상 === null && gs.length >= 2) 향상 = gs[gs.length - 1] < gs[0]; }
    out.push({ id: 'PAPS-U' + (i + 1), 이름: t.종목 + ' 기록 향상', 설명: '다음 회차에 첫 회차보다 좋은 기록을 냈어요', 아이콘: 'trending-up', 달성: 향상 === true, 진행: vals.length >= 2 ? (향상 ? 100 : 60) : (vals.length ? 30 : 0) });
  });
  var 최근 = 측정회차.length ? 기록[측정회차[측정회차.length - 1]] : null, 고른 = false, 고른진행 = 0;
  if (최근) { var gg = []; 종목.forEach(function (t) { if (t.방식 === 'BMI') return; var g = 등급(최근, t.종목); if (g !== null) gg.push(g); }); if (gg.length) { 고른 = gg.every(function (g) { return g <= 3; }); 고른진행 = Math.round(gg.filter(function (g) { return g <= 3; }).length / gg.length * 100); } }
  out.push({ id: 'PAPS-EVEN', 이름: '고른 체력', 설명: '모든 종목이 3등급 이내예요', 아이콘: 'circles', 달성: 고른, 진행: 고른진행 });
  var 목표달성 = 0, 목표수 = 0;
  Object.keys(목표).forEach(function (r) { Object.keys(목표[r]).forEach(function (t) { var v = 값(기록[r], t); if (v === null) return; 목표수++; var d = 기준[t] ? 기준[t].클수록 : true; if (d === null || d === undefined) d = true; if (d ? v >= 목표[r][t] : v <= 목표[r][t]) 목표달성++; }); });
  out.push({ id: 'PAPS-GOAL', 이름: '내 목표 달성', 설명: '스스로 정한 목표를 넘었어요', 아이콘: 'target-arrow', 달성: 목표달성 > 0, 진행: 목표수 ? Math.round(목표달성 / 목표수 * 100) : 0, 값: 목표달성, 기준: Math.max(1, 목표수) });
  if (설정.회차.length > 1) out.push({ id: 'PAPS-UP', 이름: '평균 등급 향상', 설명: '지난 회차보다 평균 등급이 좋아졌어요', 아이콘: 'chart-arrows-vertical', 달성: 평균들.length >= 2 && 평균들[평균들.length - 1] < 평균들[0], 진행: 평균들.length >= 2 ? (평균들[평균들.length - 1] < 평균들[0] ? 100 : 60) : (평균들.length ? 30 : 0) });
  out.push({ id: 'PAPS-TOP', 이름: '체력 우수', 설명: '평균 등급 2등급 이내', 아이콘: 'trophy', 달성: 평균들.length > 0 && 평균들[평균들.length - 1] <= 2, 진행: 평균들.length ? Math.max(0, Math.min(100, Math.round((5 - 평균들[평균들.length - 1]) / 3 * 100))) : 0 });
  return out;
}

function paps_s_boot(token) {
  var me = paps_학생확인_(token), 설정 = paps_설정_();
  return {
    학생: me, 종목: paps_종목목록_(), 회차: 설정.회차, 학년도: 설정.학년도,
    기준: (paps_기준_(me.학년)[me.성별] || {}),
    기록: paps_학생기록_(me.학생ID, 설정.학년도),
    이력: paps_학생이력_(me.학생ID).filter(function (r) { return r.학년도 !== 설정.학년도; }),
    목표: paps_내목표_(me.학생ID, 설정.학년도),
    영상: paps_영상맵_(),
    도전: 설정.도전기록 ? paps_내도전_(me.학생ID) : [],
    설정: { 도전기록: 설정.도전기록, 목표입력: 설정.목표입력 },
    배지: paps_배지_(me.학생ID),
    오늘: 오늘_()
  };
}

function paps_s_refresh(token) {
  var me = paps_학생확인_(token), 설정 = paps_설정_();
  return { 기록: paps_학생기록_(me.학생ID, 설정.학년도), 목표: paps_내목표_(me.학생ID, 설정.학년도) };
}

/** 목표들 = [{종목, 목표값}] — 빈 값이면 그 목표를 지움 */
function paps_s_saveGoals(token, 회차, 목표들) {
  var me = paps_학생확인_(token), 설정 = paps_설정_();
  if (!설정.목표입력) return { ok: false, message: '지금은 목표를 정하지 않아요.' };
  if (설정.회차.indexOf(str_(회차)) < 0) return { ok: false, message: '회차가 맞지 않아요.' };
  return withLock_(function () {
    var 기존 = {};
    rows_(PAPS.목표).forEach(function (r) { 기존[[str_(r.학생ID), str_(r.학년도), str_(r.회차), str_(r.종목)].join('|')] = r._row; });
    var 사용 = {};
    paps_종목목록_().forEach(function (t) { if (t.방식 !== 'BMI') 사용[t.종목] = true; });
    var 신규 = [], 수 = 0, now = 지금_();
    (목표들 || []).forEach(function (g) {
      if (!사용[g.종목]) return;
      var key = [me.학생ID, 설정.학년도, 회차, g.종목].join('|'), 값 = g.목표값;
      if (값 === '' || 값 === null || 값 === undefined || isNaN(Number(값))) {
        if (기존[key]) setCells_(PAPS.목표, PAPS_H.목표, 기존[key], { 목표값: '', 수정일시: now });
        return;
      }
      var f = { 학생ID: me.학생ID, 학년도: 설정.학년도, 회차: 회차, 종목: g.종목, 목표값: Number(값), 수정일시: now };
      if (기존[key]) setCells_(PAPS.목표, PAPS_H.목표, 기존[key], f); else 신규.push(f);
      수++;
    });
    if (신규.length) appendRows_(PAPS.목표, PAPS_H.목표, 신규);
    return { ok: true, 저장수: 수, 목표: paps_내목표_(me.학생ID, 설정.학년도) };
  });
}

function paps_s_getChallenges(token) { var me = paps_학생확인_(token); return paps_내도전_(me.학생ID); }

function paps_s_addChallenge(token, 종목, 값, 날짜) {
  var me = paps_학생확인_(token), 설정 = paps_설정_();
  if (!설정.도전기록) return { ok: false, message: '지금은 도전 기록을 받지 않아요.' };
  var info = null;
  paps_종목목록_().forEach(function (t) { if (t.종목 === 종목) info = t; });
  if (!info) return { ok: false, message: '지금 하지 않는 종목이에요.' };
  if (info.방식 === 'BMI') return { ok: false, message: '이 종목은 도전 기록을 넣지 않아요.' };
  if (값 === '' || 값 === null || isNaN(Number(값))) return { ok: false, message: '숫자를 입력해 주세요.' };
  var d = 날짜정리_(날짜) || 오늘_();
  if (d > 오늘_()) return { ok: false, message: '미래 날짜에는 기록할 수 없어요.' };
  return withLock_(function () {
    var v = Number(값), 등급 = paps_등급구하기_(me.학년, me.성별, 종목, v);
    appendRow_(PAPS.도전, PAPS_H.도전, { 도전ID: uuid_(), 학생ID: me.학생ID, 날짜: d, 종목: 종목, 측정값: v, 등급: 등급, 입력시각: new Date().getTime() });
    return { ok: true, 등급: 등급, 도전: paps_내도전_(me.학생ID) };
  });
}

function paps_s_deleteChallenge(token, 도전ID) {
  var me = paps_학생확인_(token);
  return withLock_(function () {
    var n = 행지우기_(PAPS.도전, function (o) { return str_(o.도전ID) === String(도전ID) && str_(o.학생ID) === me.학생ID; });
    return { ok: n > 0, 도전: paps_내도전_(me.학생ID) };
  });
}
