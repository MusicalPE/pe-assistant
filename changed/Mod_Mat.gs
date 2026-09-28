/*******************************************************
 * 색깔 매트 놀이터 모듈 (Mod_Mat.gs) — 학생 실행 + 교사 관리
 *
 * 단독판 "색깔 매트 놀이터"(8종 게임)를 통합 뼈대 위로 옮기고, 실제로 뛴 시간과 점프 횟수를 누적합니다.
 * 맞게 밟았는지는 판정하지 않고, 실제로 플레이했는지만 봅니다 (짝이 "뛰고 있어요"로 확인).
 *  - 기록은 "함께"(짝 확인) 와 "연습"(혼자) 두 갈래로 따로 누적하고, 둘 다 본인의 노력으로 인정합니다.
 *  - 게임 화면은 Mat_Game.html (브라우저에서만 돌아감). 여기서는 저장·집계·배지·문제 은행만 합니다.
 *
 * 시트
 *   MAT_기록 : 기록ID, 학년도, 학생ID, 학년, 반, 번호, 이름, 구분(함께|연습|수업), 짝ID, 짝이름, 게임, 난이도,
 *              시작시각, 끝시각, 진행시간, 인정시간, 점프, 인정점프, 확인단계, 전체단계, 완주(완주|중간 종료|진행 중), 저장일시
 *              (한 판이 한 줄. 단계마다 중간 저장하므로 같은 기록ID 줄을 덮어씀)
 *   MAT_짝   : 학년도, 학년, 반, 학생ID, 이름, 짝ID, 짝이름, 등록일시     (교사가 배정한 짝. 3인 조는 A→B, B→C, C→A 처럼 원형으로)
 *   MAT_문제 : 문제ID, 상태(대기|승인|버림), 출처(AI|교사|학생), 학년군, 영역, 문제, 정답, 오답1, 오답2, 오답3, 해설, 제안자ID, 제안자, 등록일시, 교과
 *              (교과 = 체육·국어·수학·사회·과학·영어·도덕·기타, 영역은 체육일 때만 운동·스포츠·표현 — 2022 개정 교육과정)
 * 배지는 시트에 따로 두지 않고 누적에서 계산합니다 (줄넘기 모듈과 같은 방식).
 *******************************************************/

var MAT = { 기록: 'MAT_기록', 짝: 'MAT_짝', 문제: 'MAT_문제' };
var MAT_H = {
  기록: ['기록ID', '학년도', '학생ID', '학년', '반', '번호', '이름', '구분', '짝ID', '짝이름', '게임', '난이도', '시작시각', '끝시각',
         '진행시간', '인정시간', '점프', '인정점프', '확인단계', '전체단계', '완주', '저장일시'],
  짝:   ['학년도', '학년', '반', '학생ID', '이름', '짝ID', '짝이름', '등록일시'],
  문제: ['문제ID', '상태', '출처', '학년군', '영역', '문제', '정답', '오답1', '오답2', '오답3', '해설', '제안자ID', '제안자', '등록일시', '교과']
};
var MAT_색 = '#FFE8D6';
var MAT_게임 = [
  ['stroop', '색깔 스트룹'], ['memory', '기억력 스텝'], ['rhythm', '리듬 스텝'], ['dir', '방향 점프'],
  ['quiz', '퀴즈 점프'], ['assoc', '연상 점프'], ['twist', '손발 트위스터'], ['freeze', '얼음 스텝']
];
var MAT_교과 = ['체육', '국어', '수학', '사회', '과학', '영어', '도덕', '기타'];
var MAT_영역 = ['운동', '스포츠', '표현'];          // 체육과 영역 (2022 개정 교육과정)
var MAT_옛영역 = { '건강': '운동', '도전': '스포츠', '경쟁': '스포츠', '안전': '운동' };   // 예전 판 문제의 영역 이름 바꿔 읽기
var MAT_학년군 = ['1~2', '3~4', '5~6'];     // '5-6' 은 시트가 날짜로 바꿔 버려서 물결(~)로 씁니다
/** 시트 값 → '5~6'. 예전에 '5-6' 으로 저장돼 날짜(5월 6일)로 굳은 값도 되돌립니다 */
function mat_학년군정리_(v) {
  if (v instanceof Date) { var k = (v.getMonth() + 1) + '~' + v.getDate(); return MAT_학년군.indexOf(k) >= 0 ? k : ''; }
  var t = str_(v).replace(/\s/g, '');
  var m = t.match(/^\d{4}[-./~](\d{1,2})[-./~](\d{1,2})/);          // 시트가 날짜로 바꿔 버린 값 (2026-05-06 00:00 등)
  if (m) t = Number(m[1]) + '~' + Number(m[2]);
  t = t.replace(/[-–~]/g, '~').replace('학년', '');
  return MAT_학년군.indexOf(t) >= 0 ? t : '';
}
var MAT_구분 = ['함께', '연습', '수업'];
var MAT_GEMINI_ERR_KEY = 'MAT_GEMINI_LAST_ERROR';

/* 배지: 함께 기록과 연습 기록에 따로. [코드, 이름, 설명, 아이콘, 종류(시간분|점프|첫기록|게임수), 기준] */
function mat_배지목록_(s) {
  var 시간 = s.배지시간, 점프 = s.배지점프, out = [];
  [['함께', 'P', '함께'], ['연습', 'S', '연습']].forEach(function (k) {
    var 구분 = k[0], p = k[1], 라벨 = k[2];
    out.push([p + '00', 라벨 + ' 첫걸음', '첫 ' + (구분 === '함께' ? '인정' : '연습') + ' 기록', 'shoe', 구분, '첫기록', 1]);
    시간.forEach(function (m, i) { out.push([p + '1' + i, 라벨 + ' ' + mat_분표시_(m), '누적 ' + mat_분표시_(m), ['clock', 'clock-hour-3', 'hourglass-high', 'trophy'][Math.min(3, i)], 구분, '시간분', m]); });
    점프.forEach(function (n, i) { out.push([p + '2' + i, 라벨 + ' 점프 ' + n, (구분 === '함께' ? '인정' : '연습') + ' 점프 ' + n + '회', ['flame', 'medal', 'diamond'][Math.min(2, i)], 구분, '점프', n]); });
    out.push([p + '30', 라벨 + ' 게임 탐험가', '8종 게임을 모두 ' + (구분 === '함께' ? '함께 해' : '연습해') + ' 봄', 'compass', 구분, '게임수', 8]);
  });
  return out;
}
function mat_분표시_(m) { m = Number(m) || 0; return m >= 60 && m % 60 === 0 ? (m / 60) + '시간' : m + '분'; }

/* 공통 설정 시트에 '매트.항목' 으로 저장됩니다 */
function mat_기본설정_() {
  return [
    ['짝방식',   '학생',   '학생 | 교사 — 짝을 학생이 고르게 할지, 교사가 배정(짝 배정 화면)할지'],
    ['최소시간', '30',     '이보다 짧은 판(초)은 누적에서 뺌'],
    ['확인시간', '6',      '단계가 끝날 때 "뛰고 있어요" 버튼이 떠 있는 시간(초)'],
    ['게임',     MAT_게임.map(function (g) { return g[0]; }).join(','), '학생에게 보여 줄 게임 (쉼표로 구분: stroop,memory,rhythm,dir,quiz,assoc,twist,freeze)'],
    ['배지시간', '10,30,60', '시간 배지 기준(분, 쉼표로 구분)'],
    ['배지점프', '500,1000', '점프 배지 기준(회, 쉼표로 구분)'],
    ['학생제안', 'Y',      'Y 면 학생이 퀴즈 문제를 제안할 수 있음 (교사 승인 후 문제 은행에)'],
    ['해설표시', 'Y',      'Y 면 퀴즈 점프에서 정답을 보여 줄 때 한 줄 해설도 함께 (정답 시간이 조금 길어짐)'],
    ['대상학년', '',       '비우면 전 학년. 예: 3,4,5,6']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function mat_hooks_() {
  return {
    준비확인: function () { return !!findSheet_(MAT.기록) && !!findSheet_(MAT.문제); },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(MAT.기록, MAT_H.기록, { 색: MAT_색 }));
      만듦 = 만듦.concat(시트준비_(MAT.짝, MAT_H.짝, { 색: MAT_색 }));
      만듦 = 만듦.concat(시트준비_(MAT.문제, MAT_H.문제, { 색: MAT_색 }));
      ensureColumns_(MAT.문제, MAT_H.문제);   // 예전 판 시트에 교과 열 보충
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      mat_기본설정_().forEach(function (r) { if (!있음['매트.' + r[0]]) put['매트.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('색깔 매트 놀이터 설정 ' + Object.keys(put).length + '항목'); }
      mat_캐시지우기_();
      return 만듦;
    },
    캐시지우기: mat_캐시지우기_,
    학생참여: function (학생ID) {
      var s = mat_설정_(), st = 학생찾기_(학생ID);
      if (!st) return false;
      return !s.대상학년.length || s.대상학년.indexOf(Number(st.학년)) >= 0;
    },
    교사대시보드: function () {
      var 기록 = mat_기록전체_(), 주 = 주시작_(오늘_()), 오늘 = 오늘_();
      var 주판 = 0, 주초 = 0, 주학생 = {}, 오늘판 = 0;
      기록.forEach(function (r) {
        if (r.완주 === '진행 중') return;
        var d = r.시작.slice(0, 10);
        if (d === 오늘) 오늘판++;
        if (주시작_(d) !== 주) return;
        주판++; 주초 += r.인정시간; 주학생[r.학생ID] = true;
      });
      var 대기문제 = rows_(MAT.문제).filter(function (r) { return str_(r.상태) === '대기'; }).length;
      return {
        카드: [
          { 제목: '이번 주 색깔 매트 놀이터', 값: 주판, 단위: '판', 설명: Object.keys(주학생).length + '명 · 인정 시간 ' + mat_시간표시_(주초) + (오늘판 ? ' · 오늘 ' + 오늘판 + '판' : ''), 이동: 'dash' },
          { 제목: '퀴즈 문제 검토 대기', 값: 대기문제, 단위: '문제', 배지: 대기문제 || '', 설명: 대기문제 ? 'AI·학생이 낸 문제를 승인하면 퀴즈 점프에 나옵니다' : '검토할 문제가 없습니다', 이동: 'bank' }
        ],
        대기: 대기문제
      };
    },
    학생프로필: function (학생ID) {
      var y = mat_학생요약_(학생ID);
      if (!y.판수) return { 제목: '아직 기록이 없어요', 값: 0, 단위: '분', 설명: '게임을 고르고 뛰어 보세요. 짝과 함께 하면 함께 기록, 혼자 하면 연습 기록이 쌓여요', 요약: { 이름: '매트 운동', 값: 0, 단위: '분' }, 이동: 'games' };
      return {
        제목: '총 운동 시간 ' + mat_시간표시_(y.함께.시간 + y.연습.시간), 값: Math.round((y.함께.시간 + y.연습.시간) / 60), 단위: '분',
        설명: '함께 ' + mat_시간표시_(y.함께.시간) + ' · 연습 ' + mat_시간표시_(y.연습.시간) + ' · ' + y.판수 + '판 · 점프 ' + (y.함께.점프 + y.연습.점프) + '회',
        배지목록: y.배지.filter(function (b) { return b.달성; }).slice(-3).map(function (b) { return b.이름; }),
        요약: { 이름: '매트 운동', 값: Math.round((y.함께.시간 + y.연습.시간) / 60), 단위: '분' }, 이동: 'games'
      };
    },
    학생배지: function (학생ID) {
      return mat_학생요약_(학생ID).배지.map(function (b) { return { id: 'MAT-' + b.id, 이름: b.이름, 설명: b.설명, 아이콘: b.아이콘, 달성: b.달성, 진행: b.진행, 값: b.값, 기준: b.기준 }; });
    },
    초기화정보: function () {
      return [
        { key: '기록', 이름: '플레이 기록 (함께·연습·수업)', 수: rows_(MAT.기록).length },
        { key: '짝', 이름: '교사 배정 짝', 수: rows_(MAT.짝).length },
        { key: '문제', 이름: '퀴즈 문제 은행', 수: rows_(MAT.문제).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {}; var res = {};
      if (opts.기록) res.기록 = 시트비우기_(MAT.기록);
      if (opts.짝) res.짝 = 시트비우기_(MAT.짝);
      if (opts.문제) res.문제 = 시트비우기_(MAT.문제);
      mat_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var n = 행지우기_(MAT.기록, function (o) { return set[str_(o.학생ID)] === true; });
      행지우기_(MAT.짝, function (o) { return set[str_(o.학생ID)] === true || set[str_(o.짝ID)] === true; });
      mat_캐시지우기_();
      return { 기록: n };
    }
  };
}

/* ================= 설정 ================= */

function mat_설정_() {
  var all = 설정_(), out = {};
  mat_기본설정_().forEach(function (r) {
    var v = all['매트.' + r[0]];
    out[r[0]] = (v === undefined || v === null || v === '') ? r[1] : String(v);
  });
  var 급 = 학교급_();
  var 게임 = 목록_(out.게임).filter(function (g) { return MAT_게임.some(function (x) { return x[0] === g; }); });
  if (!게임.length) 게임 = MAT_게임.map(function (g) { return g[0]; });
  // 2.0 기본값(7종 전부)이 저장된 채로 2.1로 올라온 경우 새 게임(얼음 스텝)도 켜 줍니다
  if (게임.length === 7 && 게임.indexOf('freeze') < 0 && MAT_게임.every(function (x) { return x[0] === 'freeze' || 게임.indexOf(x[0]) >= 0; })) 게임.push('freeze');
  var 숫자목록 = function (v, 기본) { var a = 목록_(v).map(Number).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; }); return a.length ? a : 기본; };
  return {
    짝방식: out.짝방식 === '교사' ? '교사' : '학생',
    최소시간: Math.max(0, num_(out.최소시간) === null ? 30 : num_(out.최소시간)),
    확인시간: Math.max(2, Math.min(30, num_(out.확인시간) || 6)),
    게임: 게임,
    배지시간: 숫자목록(out.배지시간, [10, 30, 60]),
    배지점프: 숫자목록(out.배지점프, [500, 1000]),
    학생제안: str_(out.학생제안).toUpperCase() !== 'N',
    해설표시: str_(out.해설표시).toUpperCase() !== 'N',
    대상학년: 목록_(out.대상학년).map(Number).filter(function (g) { return g >= 1 && g <= 급.최대학년; }),
    학년도: str_(all.학년도) || String(new Date().getFullYear()),
    학교명: str_(all.학교명)
  };
}
function mat_캐시지우기_() { 캐시지우기_('mat_all'); }
function mat_게임이름_(id) { var g = MAT_게임.filter(function (x) { return x[0] === id; })[0]; return g ? g[1] : String(id || ''); }
function mat_시간표시_(초) {
  초 = Math.round(Number(초) || 0);
  var m = Math.floor(초 / 60), s = 초 % 60;
  if (m >= 60) return Math.floor(m / 60) + '시간 ' + (m % 60) + '분';
  return m ? m + '분' + (s ? ' ' + s + '초' : '') : s + '초';
}

/* ================= 기록 읽기 ================= */

/** 이번 학년도 기록 전부 (진행 중 포함) */
function mat_기록전체_() {
  return 캐시_('mat_all', function () {
    var 학년도 = mat_설정_().학년도;
    return rows_(MAT.기록).filter(function (r) { return !str_(r.학년도) || str_(r.학년도) === 학년도; }).map(mat_기록객체_);
  });
}
function mat_기록객체_(r) {
  return { id: str_(r.기록ID), 학생ID: str_(r.학생ID), 학년: num_(r.학년) || 0, 반: num_(r.반) || 0, 번호: num_(r.번호) || 0, 이름: str_(r.이름),
           구분: MAT_구분.indexOf(str_(r.구분)) >= 0 ? str_(r.구분) : '연습', 짝ID: str_(r.짝ID), 짝이름: str_(r.짝이름),
           게임: str_(r.게임), 난이도: str_(r.난이도), 시작: 시각문자_(r.시작시각), 끝: 시각문자_(r.끝시각),
           진행시간: num_(r.진행시간) || 0, 인정시간: num_(r.인정시간) || 0, 점프: num_(r.점프) || 0, 인정점프: num_(r.인정점프) || 0,
           확인단계: num_(r.확인단계) || 0, 전체단계: num_(r.전체단계) || 0, 완주: str_(r.완주) || '진행 중', 저장: 시각문자_(r.저장일시) };
}

/** 한 학생 누적: { 함께:{시간,점프,판수,게임:{}}, 연습:{…}, 판수, 최근, 배지:[] } — 최소시간 미만·진행 중 판은 뺌 */
function mat_학생요약_(학생ID, 기록, s) {
  s = s || mat_설정_(); 기록 = 기록 || mat_기록전체_();
  var mk = function () { return { 시간: 0, 점프: 0, 판수: 0, 게임: {}, 첫: '' }; };
  var y = { 함께: mk(), 연습: mk(), 판수: 0, 최근: '', 게임별: {}, 날짜: {} };
  기록.forEach(function (r) {
    if (r.학생ID !== String(학생ID) || r.완주 === '진행 중') return;
    var k = r.구분 === '연습' ? '연습' : '함께';
    if (r.인정시간 < s.최소시간) return;
    var o = y[k];
    o.시간 += r.인정시간; o.점프 += r.인정점프; o.판수++; o.게임[r.게임] = (o.게임[r.게임] || 0) + 1;
    if (!o.첫 || r.시작 < o.첫) o.첫 = r.시작;
    y.판수++; if (r.시작 > y.최근) y.최근 = r.시작;
    y.게임별[r.게임] = (y.게임별[r.게임] || 0) + 1;
    var d = r.시작.slice(0, 10); y.날짜[d] = (y.날짜[d] || 0) + r.인정시간;
  });
  y.배지 = mat_배지_(y, s);
  return y;
}
function mat_배지_(y, s) {
  return mat_배지목록_(s).map(function (b) {
    var o = y[b[4]], v = 0;
    if (b[5] === '첫기록') v = o.판수 ? 1 : 0;
    else if (b[5] === '시간분') v = Math.floor(o.시간 / 60);
    else if (b[5] === '점프') v = o.점프;
    else if (b[5] === '게임수') v = Object.keys(o.게임).length;
    return { id: b[0], 이름: b[1], 설명: b[2], 아이콘: b[3], 구분: b[4], 종류: b[5], 기준: b[6], 값: v, 달성: v >= b[6], 진행: Math.min(100, Math.round(v / b[6] * 100)) };
  });
}

/** 반 학생 누적 현황 (순위 포함). 학년·반이 0이면 전체 */
function mat_학급현황_(학년, 반, 기록, s) {
  s = s || mat_설정_(); 기록 = 기록 || mat_기록전체_();
  var 학생 = 학생목록_(false).filter(function (st) { return (!학년 || st.학년 === Number(학년)) && (!반 || st.반 === Number(반)); })
    .filter(function (st) { return !s.대상학년.length || s.대상학년.indexOf(st.학년) >= 0; });
  var list = 학생.map(function (st) {
    var y = mat_학생요약_(st.학생ID, 기록, s);
    return { 학생ID: st.학생ID, 학년: st.학년, 반: st.반, 번호: st.번호, 이름: st.이름, 성별: st.성별,
             함께: y.함께.시간, 연습: y.연습.시간, 합계: y.함께.시간 + y.연습.시간, 점프: y.함께.점프 + y.연습.점프, 판수: y.판수, 최근: y.최근,
             배지수: y.배지.filter(function (b) { return b.달성; }).length, 게임수: Object.keys(y.게임별).length };
  });
  var 순 = list.slice().sort(function (a, b) { return b.합계 - a.합계 || b.점프 - a.점프; });
  var rank = {}; 순.forEach(function (x, i) { rank[x.학생ID] = x.합계 ? i + 1 : 0; });
  list.forEach(function (x) { x.순위 = rank[x.학생ID]; });
  list.sort(function (a, b) { return a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호; });
  return list;
}

/* ================= 짝 ================= */

function mat_짝표_() {
  var 학년도 = mat_설정_().학년도, map = {};
  rows_(MAT.짝).forEach(function (r) { if (str_(r.학년도) && str_(r.학년도) !== 학년도) return; var id = str_(r.학생ID); if (id) map[id] = { 짝ID: str_(r.짝ID), 짝이름: str_(r.짝이름) }; });
  return map;
}

/* ================= 문제 은행 ================= */

function mat_문제객체_(r) {
  var 영역 = str_(r.영역); if (MAT_옛영역[영역]) 영역 = MAT_옛영역[영역];
  var 교과 = str_(r.교과) || (영역 ? '체육' : '');
  return { id: str_(r.문제ID), 상태: str_(r.상태) || '대기', 출처: str_(r.출처), 학년군: mat_학년군정리_(r.학년군), 교과: 교과, 영역: 교과 === '체육' ? 영역 : '', 문제: str_(r.문제), 정답: str_(r.정답),
           오답: [str_(r.오답1), str_(r.오답2), str_(r.오답3)].filter(Boolean), 해설: str_(r.해설), 제안자ID: str_(r.제안자ID), 제안자: str_(r.제안자), 등록: 시각문자_(r.등록일시) };
}
/** 승인된 문제를 게임 엔진 형식으로: [문제, 정답, 오답1, 오답2, 오답3, 해설, 학년군, 교과] */
function mat_승인문제_(해설표시) {
  return rows_(MAT.문제).filter(function (r) { return str_(r.상태) === '승인' && str_(r.문제) && str_(r.정답); }).map(function (r) {
    var q = mat_문제객체_(r), row = [q.문제, q.정답].concat(q.오답.slice(0, 3));
    while (row.length < 5) row.push('');
    row.push(해설표시 ? q.해설 : ''); row.push(q.학년군); row.push(q.교과 || '');
    return row;
  });
}
function mat_문제정리_(q) {
  var 문제 = str_(q.문제).slice(0, 120), 정답 = str_(q.정답).slice(0, 40);
  var 오답 = (Array.isArray(q.오답) ? q.오답 : [q.오답1, q.오답2, q.오답3]).map(function (x) { return str_(x).slice(0, 40); }).filter(function (x) { return x && x !== 정답; });
  오답 = 오답.filter(function (x, i) { return 오답.indexOf(x) === i; }).slice(0, 3);
  if (!문제 || !정답 || !오답.length) return null;
  var 교과 = MAT_교과.indexOf(str_(q.교과)) >= 0 ? str_(q.교과) : '';
  var 영역 = str_(q.영역); if (MAT_옛영역[영역]) 영역 = MAT_옛영역[영역];
  if (!교과 && MAT_영역.indexOf(영역) >= 0) 교과 = '체육';
  return { 문제: 문제, 정답: 정답, 오답1: 오답[0] || '', 오답2: 오답[1] || '', 오답3: 오답[2] || '', 해설: str_(q.해설).slice(0, 120),
           학년군: mat_학년군정리_(q.학년군), 교과: 교과, 영역: 교과 === '체육' && MAT_영역.indexOf(영역) >= 0 ? 영역 : '' };
}
function mat_문제추가_(list, 출처, 상태, 제안자ID, 제안자) {
  var 지금 = 지금_(), rows = [], 있음 = {};
  rows_(MAT.문제).forEach(function (r) { if (str_(r.상태) !== '버림') 있음[str_(r.문제).replace(/\s+/g, '')] = true; });
  (list || []).forEach(function (q) {
    var c = mat_문제정리_(q); if (!c) return;
    var key = c.문제.replace(/\s+/g, ''); if (있음[key]) return; 있음[key] = true;
    rows.push({ 문제ID: makeId_('Q') + Math.floor(Math.random() * 900 + 100), 상태: 상태, 출처: 출처, 학년군: c.학년군, 교과: c.교과, 영역: c.영역, 문제: c.문제, 정답: c.정답,
                오답1: c.오답1, 오답2: c.오답2, 오답3: c.오답3, 해설: c.해설, 제안자ID: 제안자ID || '', 제안자: 제안자 || '', 등록일시: 지금 });
  });
  appendRows_(MAT.문제, MAT_H.문제, rows);
  return rows.length;
}

/* ---------- Gemini 로 문제 받기 (줄넘기 모듈의 키·모델 선택을 함께 씀) ---------- */
function mat_gemini키_() {
  try { return (typeof ROPE_GEMINI_KEY !== 'undefined' ? 속성_(ROPE_GEMINI_KEY) : 속성_('GEMINI_KEY')) || ''; } catch (e) { return ''; }
}
function mat_gemini문제_(학년군, 교과, 영역, 주제, 개수) {
  var key = mat_gemini키_();
  if (!key) throw new Error('Gemini API 키가 없습니다. 줄넘기 → 설정의 AI 응원 문구 칸에 키를 넣어 주세요.');
  if (typeof rope_gemini호출_ !== 'function') throw new Error('줄넘기 모듈(Mod_Rope.gs)이 있어야 AI 문제를 받을 수 있습니다.');
  개수 = Math.max(1, Math.min(20, num_(개수) || 10));
  var 기존 = rows_(MAT.문제).filter(function (r) { return str_(r.상태) !== '버림'; }).map(function (r) { return str_(r.문제); }).slice(-60);
  var 학년설명 = { '1~2': '초등학교 1~2학년 (쉬운 낱말, 짧은 문장)', '3~4': '초등학교 3~4학년', '5~6': '초등학교 5~6학년' }[학년군] || '초등학생';
  교과 = 교과 || '체육';
  var 범위 = 교과 === '체육' ? '체육과 (2022 개정 교육과정 기준) ' + (영역 ? 영역 + ' 영역' : '운동·스포츠·표현 영역 전반')
           : 교과 === '기타' ? '초등 교과 전반(상식 포함)' : 교과 + '과 — 그 학년군 교육과정에서 배우는 내용';
  var prompt = '너는 초등학교 교사를 돕는 출제 도우미야. 매트 4칸으로 답을 고르는 체육 시간 퀴즈 활동에 쓸 4지선다 문제를 ' + 개수 + '개 만들어 줘.\n' +
    '- 대상: ' + 학년설명 + '\n- 교과·범위: ' + 범위 + '\n' + (주제 ? '- 오늘 주제/단원: ' + 주제 + ' (이 주제에 맞는 문제로)\n' : '') +
    '- 문제는 40자 이내, 보기는 각 12자 이내로 짧게. 정답 1개, 오답 3개. 오답은 그럴듯하지만 분명히 틀린 것.\n' +
    '- 사실이 확실한 내용만. 규칙·기록은 널리 알려진 것만.\n- 한 줄 해설은 30자 이내.\n' +
    (기존.length ? '- 아래 문제와 같거나 비슷한 문제는 내지 마:\n' + 기존.map(function (q) { return '  · ' + q; }).join('\n') + '\n' : '') +
    '반드시 아래 JSON 배열 형식으로만 답해 (다른 말 없이):\n[{"q":"문제","a":"정답","w":["오답1","오답2","오답3"],"e":"해설"}]';
  var text;
  try {
    text = rope_gemini호출_(key, prompt);
    try { 속성저장_(MAT_GEMINI_ERR_KEY, null); } catch (e2) {}
  } catch (e) {
    try { 속성저장_(MAT_GEMINI_ERR_KEY, (지금_() + ' ' + e.message).slice(0, 300)); } catch (e3) {}
    throw e;
  }
  var m = String(text).match(/\[[\s\S]*\]/);
  if (!m) throw new Error('AI 응답에서 문제 목록을 읽지 못했습니다: ' + String(text).slice(0, 120));
  var arr;
  try { arr = JSON.parse(m[0]); } catch (e) { throw new Error('AI 응답(JSON)을 읽지 못했습니다: ' + String(text).slice(0, 120)); }
  return arr.map(function (x) { return { 문제: x.q, 정답: x.a, 오답: x.w || [], 해설: x.e, 학년군: 학년군, 교과: 교과, 영역: 교과 === '체육' ? 영역 : '' }; });
}

/* ================= 저장 ================= */

/** 판 하나 저장 (같은 기록ID 면 덮어씀). rec = { id, 구분, 짝ID, 게임, 난이도, 시작, 끝, 진행시간, 인정시간, 점프, 인정점프, 확인단계, 전체단계, 완주 } */
function mat_기록저장_(st, rec) {
  rec = rec || {};
  var id = str_(rec.id); if (!id) throw new Error('기록ID가 없습니다.');
  if (!/^[\w-]{6,60}$/.test(id)) throw new Error('기록ID가 잘못되었습니다.');
  var 구분 = MAT_구분.indexOf(str_(rec.구분)) >= 0 ? str_(rec.구분) : '연습';
  var 짝 = 구분 === '함께' && str_(rec.짝ID) ? 학생찾기_(str_(rec.짝ID)) : null;
  var 완주 = ['완주', '중간 종료', '진행 중'].indexOf(str_(rec.완주)) >= 0 ? str_(rec.완주) : '진행 중';
  var 지금 = 지금_();
  var fields = { 기록ID: id, 학년도: mat_설정_().학년도, 학생ID: st.학생ID, 학년: st.학년, 반: st.반, 번호: st.번호, 이름: st.이름, 구분: 구분,
                 짝ID: 짝 ? 짝.학생ID : (구분 === '수업' ? '' : str_(rec.짝ID)), 짝이름: 짝 ? 짝.이름 : (구분 === '수업' ? '수업(전체)' : str_(rec.짝이름)),
                 게임: str_(rec.게임), 난이도: str_(rec.난이도).slice(0, 40), 시작시각: str_(rec.시작) || 지금, 끝시각: str_(rec.끝) || 지금,
                 진행시간: Math.max(0, Math.round(num_(rec.진행시간) || 0)), 인정시간: Math.max(0, Math.round(num_(rec.인정시간) || 0)),
                 점프: Math.max(0, Math.round(num_(rec.점프) || 0)), 인정점프: Math.max(0, Math.round(num_(rec.인정점프) || 0)),
                 확인단계: Math.max(0, Math.round(num_(rec.확인단계) || 0)), 전체단계: Math.max(0, Math.round(num_(rec.전체단계) || 0)), 완주: 완주, 저장일시: 지금 };
  if (fields.인정시간 > fields.진행시간 + 5) fields.인정시간 = fields.진행시간;
  if (fields.인정점프 > fields.점프) fields.인정점프 = fields.점프;
  return withLock_(function () {
    var have = rows_(MAT.기록).filter(function (r) { return str_(r.기록ID) === id; })[0];
    if (have) {
      if (str_(have.학생ID) !== st.학생ID) throw new Error('다른 학생의 기록입니다.');
      setCells_(MAT.기록, MAT_H.기록, have._row, fields);
    } else appendRow_(MAT.기록, MAT_H.기록, fields);
    mat_캐시지우기_();
    return mat_기록객체_(fields);
  });
}

/* ================= 학생 API ================= */

function mat_학생확인_(token) {
  var me = 학생확인_(token);
  if (!mat_hooks_().학생참여(me.학생ID)) throw new Error('색깔 매트 놀이터 대상 학년이 아닙니다.');
  return me;
}

/** 학생 부팅: 설정 · 짝 후보 · 내 누적 · 문제 은행 */
function mat_s_boot(token) {
  var me = mat_학생확인_(token), s = mat_설정_();
  var y = mat_학생요약_(me.학생ID, null, s);
  var 짝표 = mat_짝표_(), 배정 = 짝표[me.학생ID] || null;
  var 반친구 = 학생목록_(false).filter(function (st) { return st.학년 === Number(me.학년) && st.반 === Number(me.반) && st.학생ID !== me.학생ID; })
    .sort(function (a, b) { return a.번호 - b.번호; }).map(function (st) { return { 학생ID: st.학생ID, 번호: st.번호, 이름: st.이름 }; });
  var 최근 = mat_기록전체_().filter(function (r) { return r.학생ID === me.학생ID && r.완주 !== '진행 중'; })
    .sort(function (a, b) { return a.시작 < b.시작 ? 1 : -1; }).slice(0, 30);
  return {
    설정: { 짝방식: s.짝방식, 최소시간: s.최소시간, 확인시간: s.확인시간, 게임: s.게임, 학생제안: s.학생제안, 해설표시: s.해설표시 },
    게임이름: MAT_게임, 짝: 배정, 반친구: 반친구, 요약: mat_요약공개_(y), 최근: 최근,
    문제: mat_승인문제_(s.해설표시), 내제안: rows_(MAT.문제).filter(function (r) { return str_(r.제안자ID) === me.학생ID; }).map(mat_문제객체_).slice(-10)
  };
}
function mat_요약공개_(y) {
  return { 함께: { 시간: y.함께.시간, 점프: y.함께.점프, 판수: y.함께.판수 }, 연습: { 시간: y.연습.시간, 점프: y.연습.점프, 판수: y.연습.판수 },
           총시간: y.함께.시간 + y.연습.시간, 판수: y.판수, 최근: y.최근, 게임별: y.게임별, 날짜: y.날짜,
           배지: y.배지, 배지수: y.배지.filter(function (b) { return b.달성; }).length };
}

/** 판 저장 (단계마다 중간 저장 · 끝날 때 최종). 돌려주는 값: 저장된 기록 + 새 누적 + 새로 받은 배지 */
function mat_s_saveRecord(token, rec, 이전배지) {
  var me = mat_학생확인_(token), s = mat_설정_();
  rec = rec || {};
  if (str_(rec.구분) === '수업') throw new Error('학생은 수업 기록을 만들 수 없습니다.');
  // 역할 바꾸기: 로그인한 학생(me)이 확인자, 짝(플레이어ID)이 뛴 판 — 같은 반이고 짝ID 가 me 일 때만
  var player = 학생찾기_(me.학생ID);
  if (str_(rec.플레이어ID) && str_(rec.플레이어ID) !== me.학생ID) {
    var p = 학생찾기_(str_(rec.플레이어ID));
    if (!p || p.학년 !== Number(me.학년) || p.반 !== Number(me.반)) throw new Error('같은 반 짝만 대신 기록할 수 있어요.');
    if (str_(rec.구분) !== '함께' || str_(rec.짝ID) !== me.학생ID) throw new Error('역할을 바꿔 뛸 때는 내가 짝이어야 해요.');
    player = p;
  }
  if (str_(rec.구분) === '함께') {
    var 짝 = 학생찾기_(str_(rec.짝ID));
    if (!짝 || 짝.학생ID === player.학생ID) throw new Error('짝을 골라 주세요.');
    if (짝.학년 !== Number(player.학년) || 짝.반 !== Number(player.반)) throw new Error('같은 반 친구를 짝으로 골라 주세요.');
    if (s.짝방식 === '교사') { var 배정 = mat_짝표_()[player.학생ID]; if (!배정 || 배정.짝ID !== 짝.학생ID) throw new Error('선생님이 정해 준 짝과 함께 해야 해요.'); }
  }
  var saved = mat_기록저장_(player, rec);
  var y = mat_학생요약_(player.학생ID, null, s), 요약 = mat_요약공개_(y);
  var 전 = {}; (이전배지 || []).forEach(function (id) { 전[id] = true; });
  var 새배지 = y.배지.filter(function (b) { return b.달성 && !전[b.id]; }).map(function (b) { return { id: b.id, 이름: b.이름, 설명: b.설명 }; });
  return { ok: true, 기록: saved, 요약: 요약, 새배지: 이전배지 ? 새배지 : [] };
}

/** 학생이 문제 제안 (교사 승인 후 문제 은행에) */
function mat_s_proposeQuestion(token, q) {
  var me = mat_학생확인_(token), s = mat_설정_();
  if (!s.학생제안) throw new Error('문제 제안이 꺼져 있어요.');
  var 내것 = rows_(MAT.문제).filter(function (r) { return str_(r.제안자ID) === me.학생ID && str_(r.상태) === '대기'; }).length;
  if (내것 >= 10) throw new Error('선생님이 검토 중인 문제가 10개나 있어요. 조금 기다려 주세요.');
  var n = mat_문제추가_([q], '학생', '대기', me.학생ID, me.이름);
  if (!n) throw new Error('문제·정답·오답을 모두 써 주세요. (이미 있는 문제일 수도 있어요)');
  return { ok: true, 내제안: rows_(MAT.문제).filter(function (r) { return str_(r.제안자ID) === me.학생ID; }).map(mat_문제객체_).slice(-10) };
}

/* ================= 교사 API ================= */

function mat_t_boot(token) {
  교사확인_(token);
  var s = mat_설정_(), 학급 = {};
  학생목록_(false).forEach(function (st) { if (s.대상학년.length && s.대상학년.indexOf(st.학년) < 0) return; if (!학급[st.학년]) 학급[st.학년] = {}; 학급[st.학년][st.반] = true; });
  var 학급목록 = Object.keys(학급).map(Number).sort(function (a, b) { return a - b; }).map(function (g) { return { 학년: g, 반: Object.keys(학급[g]).map(Number).sort(function (a, b) { return a - b; }) }; });
  var 문제수 = { 대기: 0, 승인: 0, 버림: 0 };
  rows_(MAT.문제).forEach(function (r) { var st = str_(r.상태) || '대기'; 문제수[st] = (문제수[st] || 0) + 1; });
  var err = ''; try { err = 속성_(MAT_GEMINI_ERR_KEY) || ''; } catch (e) {}
  return { 설정: s, 게임이름: MAT_게임, 학급목록: 학급목록, 문제수: 문제수, gemini여부: !!mat_gemini키_(), geminiError: err,
           문제: mat_승인문제_(s.해설표시), 오늘: 오늘_(), 교과: MAT_교과, 영역: MAT_영역, 학년군: MAT_학년군 };
}

/** 학급 현황 (학년·반 0 = 전체) */
function mat_t_getClass(token, 학년, 반) {
  교사확인_(token);
  var s = mat_설정_(), 기록 = mat_기록전체_();
  return { 학생: mat_학급현황_(num_(학년) || 0, num_(반) || 0, 기록, s), 짝: mat_짝표_() };
}

/** 학생 상세: 누적 + 판 목록 */
function mat_t_getStudent(token, 학생ID) {
  교사확인_(token);
  var st = 학생찾기_(str_(학생ID)); if (!st) throw new Error('학생을 찾지 못했습니다.');
  var s = mat_설정_(), 기록 = mat_기록전체_();
  var 판 = 기록.filter(function (r) { return r.학생ID === st.학생ID; }).sort(function (a, b) { return a.시작 < b.시작 ? 1 : -1; });
  var 짝들 = {}; 판.forEach(function (r) { if (r.구분 === '함께' && r.짝이름) 짝들[r.짝이름] = (짝들[r.짝이름] || 0) + 1; });
  return { 학생: 학생공개_(st), 요약: mat_요약공개_(mat_학생요약_(st.학생ID, 기록, s)), 판: 판, 짝들: 짝들, 최소시간: s.최소시간 };
}

/** 게임 통계 (학년·반 0 = 전체): 게임별 판수·시간, 난이도 분포, 구분 비율 */
function mat_t_getStats(token, 학년, 반) {
  교사확인_(token);
  var g = num_(학년) || 0, c = num_(반) || 0, s = mat_설정_();
  var 게임 = {}, 구분 = { 함께: 0, 연습: 0, 수업: 0 }, 날짜 = {}, 완주 = { 완주: 0, '중간 종료': 0 }, 판 = 0;
  mat_기록전체_().forEach(function (r) {
    if (r.완주 === '진행 중' || r.인정시간 < s.최소시간) return;
    if (g && r.학년 !== g) return; if (c && r.반 !== c) return;
    판++;
    var o = 게임[r.게임] || (게임[r.게임] = { 게임: r.게임, 이름: mat_게임이름_(r.게임), 판수: 0, 시간: 0, 점프: 0, 난이도: {} });
    o.판수++; o.시간 += r.인정시간; o.점프 += r.인정점프; o.난이도[r.난이도 || '-'] = (o.난이도[r.난이도 || '-'] || 0) + 1;
    구분[r.구분] = (구분[r.구분] || 0) + 1;
    var d = r.시작.slice(0, 10); 날짜[d] = (날짜[d] || 0) + 1;
    완주[r.완주] = (완주[r.완주] || 0) + 1;
  });
  var list = Object.keys(게임).map(function (k) { return 게임[k]; }).sort(function (a, b) { return b.판수 - a.판수; });
  return { 판수: 판, 게임: list, 구분: 구분, 날짜: 날짜, 완주: 완주 };
}

/** 교사 짝 배정 저장. pairs = [[학생ID, 짝ID], …] — 그 반의 기존 배정을 지우고 새로 씀. 3인 조는 [A,B],[B,C],[C,A] 로 */
function mat_t_savePairs(token, 학년, 반, pairs) {
  교사확인_(token);
  var g = num_(학년), c = num_(반);
  if (!g || !c) throw new Error('학년·반을 골라 주세요.');
  var 학생 = {}; 학생목록_(false).forEach(function (st) { if (st.학년 === g && st.반 === c) 학생[st.학생ID] = st; });
  var 학년도 = mat_설정_().학년도, 지금 = 지금_(), rows = [];
  (pairs || []).forEach(function (p) {
    var a = 학생[str_(p[0])], b = 학생[str_(p[1])];
    if (!a || !b || a.학생ID === b.학생ID) return;
    rows.push({ 학년도: 학년도, 학년: g, 반: c, 학생ID: a.학생ID, 이름: a.이름, 짝ID: b.학생ID, 짝이름: b.이름, 등록일시: 지금 });
  });
  return withLock_(function () {
    행지우기_(MAT.짝, function (o) { return num_(o.학년) === g && num_(o.반) === c && (!str_(o.학년도) || str_(o.학년도) === 학년도); });
    appendRows_(MAT.짝, MAT_H.짝, rows);
    return { ok: true, 저장: rows.length, 짝: mat_짝표_() };
  });
}

/** 자동 짝 짓기 안(번호순 이웃 또는 무작위). 홀수면 마지막 셋이 3인 조(원형) */
function mat_t_suggestPairs(token, 학년, 반, 무작위) {
  교사확인_(token);
  var g = num_(학년), c = num_(반);
  var list = 학생목록_(false).filter(function (st) { return st.학년 === g && st.반 === c; }).sort(function (a, b) { return a.번호 - b.번호; }).map(function (st) { return st.학생ID; });
  if (무작위) for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = list[i]; list[i] = list[j]; list[j] = t; }
  var pairs = [];
  var n = list.length, even = n % 2 === 0 ? n : n - 3;
  for (var k = 0; k + 1 < even; k += 2) { pairs.push([list[k], list[k + 1]]); pairs.push([list[k + 1], list[k]]); }
  if (n % 2 === 1 && n >= 3) { var a = list[n - 3], b = list[n - 2], d = list[n - 1]; pairs.push([a, b], [b, d], [d, a]); }
  return { pairs: pairs };
}

/** 수업 모드: 한 판을 반 전체(재학생)의 "수업" 기록으로 일괄 저장. sum = { 게임, 난이도, 시작, 끝, 진행시간, 점프, 전체단계, 완주 }, 제외 = [학생ID] */
function mat_t_saveClassRecord(token, 학년, 반, sum, 제외) {
  교사확인_(token);
  var g = num_(학년), c = num_(반);
  if (!g || !c) throw new Error('학년·반을 골라 주세요.');
  sum = sum || {};
  var 뺌 = {}; (제외 || []).forEach(function (id) { 뺌[String(id)] = true; });
  var 학생 = 학생목록_(false).filter(function (st) { return st.학년 === g && st.반 === c && !뺌[st.학생ID]; });
  if (!학생.length) throw new Error('저장할 학생이 없습니다.');
  var base = makeId_('MC'), 지금 = 지금_(), 학년도 = mat_설정_().학년도;
  var 진행 = Math.max(0, Math.round(num_(sum.진행시간) || 0)), 점프 = Math.max(0, Math.round(num_(sum.점프) || 0));
  var rows = 학생.map(function (st, i) {
    return { 기록ID: base + '-' + (i + 1), 학년도: 학년도, 학생ID: st.학생ID, 학년: st.학년, 반: st.반, 번호: st.번호, 이름: st.이름, 구분: '수업', 짝ID: '', 짝이름: '수업(전체)',
             게임: str_(sum.게임), 난이도: str_(sum.난이도).slice(0, 40), 시작시각: str_(sum.시작) || 지금, 끝시각: str_(sum.끝) || 지금,
             진행시간: 진행, 인정시간: 진행, 점프: 점프, 인정점프: 점프, 확인단계: num_(sum.전체단계) || 0, 전체단계: num_(sum.전체단계) || 0,
             완주: str_(sum.완주) === '완주' ? '완주' : '중간 종료', 저장일시: 지금 };
  });
  return withLock_(function () { appendRows_(MAT.기록, MAT_H.기록, rows); mat_캐시지우기_(); return { ok: true, 저장: rows.length }; });
}

function mat_t_deleteRecord(token, id) {
  교사확인_(token);
  id = str_(id);
  return withLock_(function () { var n = 행지우기_(MAT.기록, function (o) { return str_(o.기록ID) === id; }); mat_캐시지우기_(); return { ok: true, 지움: n }; });
}

/* ---------- 문제 은행 ---------- */

function mat_t_getQuestions(token, 상태) {
  교사확인_(token);
  var st = str_(상태);
  return rows_(MAT.문제).map(mat_문제객체_).filter(function (q) { return !st || q.상태 === st; }).reverse();
}
/** 문제 상태 바꾸기·고치기. patch = { 상태?, 문제?, 정답?, 오답?, 해설?, 학년군?, 영역? } */
function mat_t_setQuestion(token, id, patch) {
  교사확인_(token);
  id = str_(id); patch = patch || {};
  return withLock_(function () {
    var have = rows_(MAT.문제).filter(function (r) { return str_(r.문제ID) === id; })[0];
    if (!have) throw new Error('문제를 찾지 못했습니다.');
    var f = {};
    if (patch.상태 !== undefined) { if (['대기', '승인', '버림'].indexOf(str_(patch.상태)) < 0) throw new Error('상태가 잘못되었습니다.'); f.상태 = str_(patch.상태); }
    if (patch.문제 !== undefined || patch.정답 !== undefined || patch.오답 !== undefined || patch.해설 !== undefined || patch.학년군 !== undefined || patch.영역 !== undefined || patch.교과 !== undefined) {
      var cur = mat_문제객체_(have);
      var c = mat_문제정리_({ 문제: patch.문제 !== undefined ? patch.문제 : cur.문제, 정답: patch.정답 !== undefined ? patch.정답 : cur.정답,
                              오답: patch.오답 !== undefined ? patch.오답 : cur.오답, 해설: patch.해설 !== undefined ? patch.해설 : cur.해설,
                              학년군: patch.학년군 !== undefined ? patch.학년군 : cur.학년군, 교과: patch.교과 !== undefined ? patch.교과 : cur.교과, 영역: patch.영역 !== undefined ? patch.영역 : cur.영역 });
      if (!c) throw new Error('문제·정답·오답을 모두 써 주세요.');
      Object.keys(c).forEach(function (k) { f[k] = c[k]; });
    }
    setCells_(MAT.문제, MAT_H.문제, have._row, f);
    return { ok: true };
  });
}
function mat_t_setQuestions(token, ids, 상태) {
  교사확인_(token);
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  if (['대기', '승인', '버림'].indexOf(str_(상태)) < 0) throw new Error('상태가 잘못되었습니다.');
  return withLock_(function () {
    var n = 0;
    rows_(MAT.문제).forEach(function (r) { if (set[str_(r.문제ID)]) { setCells_(MAT.문제, MAT_H.문제, r._row, { 상태: str_(상태) }); n++; } });
    return { ok: true, 바꿈: n };
  });
}
function mat_t_deleteQuestions(token, ids) {
  교사확인_(token);
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  return withLock_(function () { var n = 행지우기_(MAT.문제, function (o) { return set[str_(o.문제ID)] === true; }); return { ok: true, 지움: n }; });
}
/** 교사가 직접 넣기 (바로 승인). list = [{문제, 정답, 오답:[], 해설, 학년군, 교과, 영역}] 또는 "문제 / 정답 / 오답 / 오답" 줄글 */
function mat_t_addQuestions(token, list, 학년군, 교과, 영역) {
  교사확인_(token);
  if (typeof list === 'string') {
    list = list.split(/\n/).map(function (l) { return l.split(/[\/|]/).map(function (s) { return s.trim(); }).filter(Boolean); })
      .filter(function (r) { return r.length >= 3; }).map(function (r) { return { 문제: r[0], 정답: r[1], 오답: r.slice(2, 5), 해설: r[5] || '' }; });
  }
  (list || []).forEach(function (q) { if (!q.학년군) q.학년군 = 학년군; if (!q.교과) q.교과 = 교과; if (!q.영역) q.영역 = 영역; });
  var n = withLock_(function () { return mat_문제추가_(list, '교사', '승인', '', ''); });
  return { ok: true, 추가: n };
}
/** AI 에서 문제 받기 → 검토 대기로 넣기 */
function mat_t_genQuestions(token, 학년군, 교과, 영역, 주제, 개수) {
  교사확인_(token);
  var list = mat_gemini문제_(mat_학년군정리_(학년군), MAT_교과.indexOf(str_(교과)) >= 0 ? str_(교과) : '체육', MAT_영역.indexOf(str_(영역)) >= 0 ? str_(영역) : '', str_(주제).slice(0, 60), 개수);
  var n = withLock_(function () { return mat_문제추가_(list, 'AI', '대기', '', ''); });
  return { ok: true, 받음: list.length, 추가: n };
}

/** 설정 저장 */
function mat_t_saveSettings(token, map) {
  교사확인_(token);
  map = map || {}; var put = {};
  if (map.짝방식 !== undefined) put['매트.짝방식'] = str_(map.짝방식) === '교사' ? '교사' : '학생';
  if (map.최소시간 !== undefined) put['매트.최소시간'] = String(Math.max(0, Math.min(600, num_(map.최소시간) === null ? 30 : num_(map.최소시간))));
  if (map.확인시간 !== undefined) put['매트.확인시간'] = String(Math.max(2, Math.min(30, num_(map.확인시간) || 6)));
  if (map.게임 !== undefined) put['매트.게임'] = (Array.isArray(map.게임) ? map.게임 : 목록_(map.게임)).filter(function (g) { return MAT_게임.some(function (x) { return x[0] === g; }); }).join(',');
  if (map.배지시간 !== undefined) put['매트.배지시간'] = 목록_(Array.isArray(map.배지시간) ? map.배지시간.join(',') : map.배지시간).map(Number).filter(function (n) { return n > 0; }).join(',') || '10,30,60';
  if (map.배지점프 !== undefined) put['매트.배지점프'] = 목록_(Array.isArray(map.배지점프) ? map.배지점프.join(',') : map.배지점프).map(Number).filter(function (n) { return n > 0; }).join(',') || '500,1000';
  if (map.학생제안 !== undefined) put['매트.학생제안'] = map.학생제안 ? 'Y' : 'N';
  if (map.해설표시 !== undefined) put['매트.해설표시'] = map.해설표시 ? 'Y' : 'N';
  if (map.대상학년 !== undefined) put['매트.대상학년'] = (Array.isArray(map.대상학년) ? map.대상학년 : 목록_(map.대상학년)).map(Number).filter(function (g) { return g > 0; }).join(',');
  if (Object.keys(put).length) 설정저장_(put);
  mat_캐시지우기_();
  return { ok: true, 설정: mat_설정_() };
}
