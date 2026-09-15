/*******************************************************
 * 줄넘기 모듈 (Mod_Rope.gs) — 교사 + 학생
 *
 * 단독판 줄넘기 기록 프로그램의 "개념"만 가져와 통합 뼈대 위에 새로 쓴 모듈입니다.
 *  - 하루에 여러 번 입력 → 각각 한 줄로 쌓여 그날 횟수가 누적됩니다 (덮어쓰기 없음).
 *  - 학생 입력은 대기 → 교사 확인(또는 설정으로 자동 확인) → 그래프·순위에 반영.
 *  - 하루 목표(개인), 학급 공동 목표, 개인 기록·누적에 따른 배지(학생), 학급 간 목표 달성률 순위(교사).
 *  - 단순 건강활동 기록용이라 차시 운영은 두지 않습니다.
 *  - 학생 명단·로그인은 공통. 대상 학년은 설정 `줄넘기.대상학년`(비우면 전체).
 *
 * 시트
 *   줄넘기_기록 : 기록ID, 입력일시, 날짜, 시각, 학생ID, 횟수, 상태(대기/확인/반려), 확인일시, 입력자(학생/교사), 메모
 *
 * 설정(공통 설정 시트) : 줄넘기.하루목표, 줄넘기.대상학년, 줄넘기.자동확인, 줄넘기.하루최대입력, 줄넘기.한번최대횟수, 줄넘기.학급목표
 * 응원 문구 : 스크립트 속성 GEMINI_KEY 가 있으면 Gemini, 없으면 기본 문구
 *******************************************************/

var ROPE = { 기록: '줄넘기_기록' };
var ROPE_H = { 기록: ['기록ID', '입력일시', '날짜', '시각', '학생ID', '횟수', '상태', '확인일시', '입력자', '메모'] };

/* 배지: [id, 이름, 설명, 아이콘, 기준 종류, 기준값]  — 기준 종류: 누적 | 달성일 | 연속(최장) | 기록일 | 하루최고 */
var ROPE_배지 = [
  ['R01', '첫 줄넘기',      '첫 기록을 남겼어요',            'shoe',        '기록일', 1],
  ['R02', '천 번의 점프',   '누적 1,000회',                  'flame',       '누적', 1000],
  ['R03', '오천 번의 점프', '누적 5,000회',                  'medal',       '누적', 5000],
  ['R04', '만 번의 점프',   '누적 10,000회',                 'trophy',      '누적', 10000],
  ['R05', '삼만 점프 마스터', '누적 30,000회',               'diamond',     '누적', 30000],
  ['R06', '목표 달성!',     '하루 목표를 처음 넘었어요',     'target-arrow', '달성일', 1],
  ['R07', '열 번의 목표',   '하루 목표 10일 달성',           'target',      '달성일', 10],
  ['R08', '서른 번의 목표', '하루 목표 30일 달성',           'award',       '달성일', 30],
  ['R09', '3일 연속',       '3일 연속 기록',                 'bolt',        '연속', 3],
  ['R10', '일주일 연속',    '7일 연속 기록',                 'calendar-check', '연속', 7],
  ['R11', '한 달 연속',     '30일 연속 기록',                'crown',       '연속', 30],
  ['R12', '꾸준한 발걸음',  '기록한 날 20일',                'walk',        '기록일', 20],
  ['R13', '꾸준함의 힘',    '기록한 날 50일',                'mountain',    '기록일', 50],
  ['R14', '하루 500',       '하루에 500회',                  'rocket',      '하루최고', 500],
  ['R15', '하루 1000',      '하루에 1,000회',                'star',        '하루최고', 1000]
];
var ROPE_색 = '#FFEDE7';
var ROPE_상태 = ['대기', '확인', '반려'];
var ROPE_GEMINI_KEY = 'GEMINI_KEY';

function rope_기본설정_() {
  return [
    ['하루목표',     '100', '학생 한 명의 하루 목표 횟수'],
    ['대상학년',     '',    '줄넘기 메뉴를 보여 줄 학년 (예: 3,4,5,6 / 비우면 전체)'],
    ['자동확인',     'N',   'Y 면 학생이 입력한 기록을 교사 확인 없이 바로 인정'],
    ['하루최대입력', '10',  '학생이 하루에 입력할 수 있는 기록 수'],
    ['한번최대횟수', '3000', '한 번에 입력할 수 있는 최대 횟수 (오타 방지)'],
    ['학급목표',     '5000', '학급 공동 목표 (반 전체 누적 횟수)']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function rope_hooks_() {
  return {
    준비확인: function () { return !!findSheet_(ROPE.기록); },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(ROPE.기록, ROPE_H.기록, { 색: ROPE_색 }));
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      rope_기본설정_().forEach(function (r) { if (!있음['줄넘기.' + r[0]]) put['줄넘기.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('줄넘기 설정 ' + Object.keys(put).length + '항목'); }
      rope_캐시지우기_();
      return 만듦;
    },
    캐시지우기: rope_캐시지우기_,
    학생참여: function (학생ID) {
      var s = rope_설정_(), st = 학생찾기_(학생ID);
      if (!st) return false;
      return !s.대상학년.length || s.대상학년.indexOf(Number(st.학년)) >= 0;
    },
    교사대시보드: function () {
      var 기록 = rope_기록전체_(), 오늘 = 오늘_(), s = rope_설정_();
      var 대기 = 기록.filter(function (r) { return r.상태 === '대기'; }).length;
      var 오늘합 = {}, 오늘총 = 0;
      기록.forEach(function (r) { if (r.상태 === '확인' && r.날짜 === 오늘) { 오늘합[r.학생ID] = (오늘합[r.학생ID] || 0) + r.횟수; 오늘총 += r.횟수; } });
      var 달성 = Object.keys(오늘합).filter(function (id) { return 오늘합[id] >= s.하루목표; }).length;
      var 반들 = rope_학급비교_(rope_학급현황_(0, 0, 기록, s), s), top = 반들[0];
      return {
        카드: [
          { 제목: '확인 기다리는 줄넘기 기록', 값: 대기, 단위: '건', 배지: 대기 || '', 설명: 대기 ? '학생이 입력한 횟수를 확인해 주세요' : '모두 확인했습니다', 이동: 'pending' },
          { 제목: '오늘 줄넘기', 값: 오늘총, 단위: '회', 설명: Object.keys(오늘합).length + '명 기록 · 목표 ' + s.하루목표 + '회 달성 ' + 달성 + '명' + (top && top.달성률 ? ' · 달성률 1위 ' + top.학년 + '-' + top.반 + ' (' + top.달성률 + '%)' : ''), 이동: 'dash' }
        ],
        대기: 대기
      };
    },
    학생프로필: function (학생ID) {
      var y = rope_학생요약_(학생ID, rope_기록전체_(), rope_설정_());
      return {
        제목: '오늘 ' + y.오늘 + ' / ' + y.하루목표 + '회', 값: y.누적, 단위: '회', 진행: rope_pct_(y.오늘, y.하루목표),
        설명: '기록한 날 ' + y.기록일수 + '일 · 연속 ' + y.연속 + '일' + (y.대기 ? ' · 확인 대기 ' + y.대기 + '건' : ''),
        알림: y.반려 ? '줄넘기: 반려된 기록이 ' + y.반려 + '건 있어요. 선생님께 물어보세요' : '',
        배지목록: rope_배지_(y).filter(function (b) { return b.달성; }).slice(-3).map(function (b) { return b.이름; }),
        요약: { 이름: '줄넘기 누적', 값: y.누적, 단위: '회' }, 이동: 'home'
      };
    },
    학생배지: function (학생ID) {
      var y = rope_학생요약_(학생ID, rope_기록전체_(), rope_설정_());
      return rope_배지_(y).map(function (b) { return { id: 'ROPE-' + b.id, 이름: b.이름, 설명: b.설명, 아이콘: b.아이콘, 달성: b.달성, 진행: b.진행, 값: b.값, 기준: b.기준 }; });
    },
    초기화정보: function () {
      return [{ key: '기록', 이름: '줄넘기 기록 (학생 입력·교사 입력 모두)', 수: rows_(ROPE.기록).length }];
    },
    초기화: function (opts) {
      opts = opts || {};
      var res = {};
      if (opts.기록) res.기록 = 시트비우기_(ROPE.기록);
      rope_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var n = 행지우기_(ROPE.기록, function (o) { return set[str_(o.학생ID)] === true; });
      rope_캐시지우기_();
      return { 기록: n };
    }
  };
}

/* ================= 설정 · 읽기 ================= */

function rope_설정_() {
  var all = 설정_(), out = {};
  rope_기본설정_().forEach(function (r) { var v = all['줄넘기.' + r[0]]; out[r[0]] = (v === undefined || v === null || v === '') ? r[1] : String(v); });
  return {
    하루목표: Math.max(1, num_(out.하루목표) || 100),
    대상학년: 목록_(out.대상학년).map(Number).filter(function (g) { return g >= 1 && g <= 6; }),
    자동확인: str_(out.자동확인).toUpperCase() === 'Y',
    하루최대입력: Math.max(1, num_(out.하루최대입력) || 10),
    한번최대횟수: Math.max(1, num_(out.한번최대횟수) || 3000),
    학급목표: Math.max(0, num_(out.학급목표) || 0),
    학년도: str_(all.학년도)
  };
}
function rope_캐시지우기_() { 캐시지우기_('rope_rec'); }
function rope_시각_(v) {
  if (v instanceof Date) return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  var m = str_(v).match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function rope_pct_(a, b) { if (!b) return 0; return Math.max(0, Math.min(100, Math.round(a / b * 100))); }

function rope_기록전체_() {
  return 캐시_('rope_rec', function () {
    return rows_(ROPE.기록).map(function (r) {
      return { 기록ID: str_(r.기록ID), 입력일시: 시각문자_(r.입력일시), 날짜: 날짜정리_(r.날짜), 시각: rope_시각_(r.시각), 학생ID: str_(r.학생ID),
               횟수: Math.max(0, Math.round(num_(r.횟수) || 0)), 상태: ROPE_상태.indexOf(str_(r.상태)) >= 0 ? str_(r.상태) : '대기',
               확인일시: 시각문자_(r.확인일시), 입력자: str_(r.입력자) || '학생', 메모: str_(r.메모), _row: r._row };
    }).filter(function (r) { return r.기록ID && r.날짜 && r.학생ID; })
      .sort(function (a, b) { return (a.날짜 + a.시각 + a.입력일시).localeCompare(b.날짜 + b.시각 + b.입력일시); });
  });
}

/* 날짜 map → 오늘 기준 연속 일수 (오늘 기록이 없으면 어제부터 셈) */
function rope_연속_(날짜맵, 오늘) {
  var d = 날짜맵[오늘] ? 오늘 : 날짜더하기_(오늘, -1), n = 0;
  while (날짜맵[d]) { n++; d = 날짜더하기_(d, -1); if (n > 400) break; }
  return n;
}
function rope_최장연속_(날짜맵) {
  var days = Object.keys(날짜맵).sort(), best = 0, run = 0, prev = null;
  days.forEach(function (d) { run = (prev && 날짜더하기_(prev, 1) === d) ? run + 1 : 1; if (run > best) best = run; prev = d; });
  return best;
}

/** 학생 한 명 요약 (확인된 기록 기준) */
function rope_학생요약_(학생ID, 기록, s) {
  var 오늘 = 오늘_(), 주 = 주시작_(오늘), 날짜맵 = {}, 누적 = 0, 오늘합 = 0, 주합 = 0, 대기 = 0, 반려 = 0, 목표달성일 = 0;
  기록.forEach(function (r) {
    if (r.학생ID !== 학생ID) return;
    if (r.상태 === '대기') { 대기++; return; }
    if (r.상태 === '반려') { 반려++; return; }
    누적 += r.횟수; 날짜맵[r.날짜] = (날짜맵[r.날짜] || 0) + r.횟수;
    if (r.날짜 === 오늘) 오늘합 += r.횟수;
    if (주시작_(r.날짜) === 주) 주합 += r.횟수;
  });
  var 하루최고 = 0;
  Object.keys(날짜맵).forEach(function (d) { if (날짜맵[d] >= s.하루목표) 목표달성일++; if (날짜맵[d] > 하루최고) 하루최고 = 날짜맵[d]; });
  return { 누적: 누적, 오늘: 오늘합, 이번주: 주합, 하루목표: s.하루목표, 기록일수: Object.keys(날짜맵).length, 연속: rope_연속_(날짜맵, 오늘), 최장연속: rope_최장연속_(날짜맵),
           목표달성일: 목표달성일, 하루최고: 하루최고, 대기: 대기, 반려: 반려, 날짜별: 날짜맵 };
}

/** 요약 → 배지 목록 [{id, 이름, 설명, 아이콘, 달성, 값, 기준}] */
function rope_배지_(y) {
  var 값 = { 누적: y.누적, 달성일: y.목표달성일, 연속: y.최장연속, 기록일: y.기록일수, 하루최고: y.하루최고 };
  return ROPE_배지.map(function (b) {
    var v = 값[b[4]] || 0;
    return { id: b[0], 이름: b[1], 설명: b[2], 아이콘: b[3], 종류: b[4], 기준: b[5], 값: v, 달성: v >= b[5], 진행: Math.min(100, Math.round(v / b[5] * 100)) };
  });
}

/** 학급 순위·현황 (확인된 기록). 학년·반이 0이면 전체 */
function rope_학급현황_(학년, 반, 기록, s) {
  var 오늘 = 오늘_(), 주 = 주시작_(오늘);
  var 학생 = 학생목록_(false).filter(function (st) { return (!학년 || st.학년 === Number(학년)) && (!반 || st.반 === Number(반)); })
    .filter(function (st) { return !s.대상학년.length || s.대상학년.indexOf(st.학년) >= 0; });
  var by = {};
  학생.forEach(function (st) { by[st.학생ID] = { 학생ID: st.학생ID, 학년: st.학년, 반: st.반, 번호: st.번호, 이름: st.이름, 누적: 0, 오늘: 0, 이번주: 0, 날짜맵: {}, 대기: 0 }; });
  기록.forEach(function (r) {
    var o = by[r.학생ID]; if (!o) return;
    if (r.상태 === '대기') { o.대기++; return; }
    if (r.상태 !== '확인') return;
    o.누적 += r.횟수; o.날짜맵[r.날짜] = (o.날짜맵[r.날짜] || 0) + r.횟수;
    if (r.날짜 === 오늘) o.오늘 += r.횟수;
    if (주시작_(r.날짜) === 주) o.이번주 += r.횟수;
  });
  var list = 학생.map(function (st) {
    var o = by[st.학생ID], 달성일 = 0;
    Object.keys(o.날짜맵).forEach(function (d) { if (o.날짜맵[d] >= s.하루목표) 달성일++; });
    return { 학생ID: o.학생ID, 학년: o.학년, 반: o.반, 번호: o.번호, 이름: o.이름, 누적: o.누적, 오늘: o.오늘, 이번주: o.이번주,
             기록일수: Object.keys(o.날짜맵).length, 연속: rope_연속_(o.날짜맵, 오늘), 최장연속: rope_최장연속_(o.날짜맵), 목표달성일: 달성일, 대기: o.대기 };
  });
  var 총 = 0, 오늘총 = 0, 달성 = 0;
  list.forEach(function (o) { 총 += o.누적; 오늘총 += o.오늘; if (o.오늘 >= s.하루목표) 달성++; });
  var top = function (key) { var best = null; list.forEach(function (o) { if (o[key] > 0 && (!best || o[key] > best[key])) best = o; }); return best ? { 이름: best.이름, 학년: best.학년, 반: best.반, 값: best[key] } : null; };
  return { 학생: list, 총: 총, 오늘총: 오늘총, 달성: 달성, 오늘기록인원: list.filter(function (o) { return o.오늘 > 0; }).length,
           왕: { 오늘: top('오늘'), 이번주: top('이번주'), 연속: top('연속'), 누적: top('누적') } };
}

/** 학급별 비교 (오늘 목표 달성률 순). 현황.학생을 학년-반으로 묶음 */
function rope_학급비교_(현황, s) {
  var by = {};
  현황.학생.forEach(function (o) {
    var k = o.학년 + '-' + o.반, g = by[k] || (by[k] = { 학년: o.학년, 반: o.반, 인원: 0, 오늘달성: 0, 오늘기록: 0, 오늘총: 0, 누적: 0, 기록일합: 0 });
    g.인원++; g.누적 += o.누적; g.오늘총 += o.오늘; g.기록일합 += o.기록일수;
    if (o.오늘 > 0) g.오늘기록++;
    if (o.오늘 >= s.하루목표) g.오늘달성++;
  });
  return Object.keys(by).map(function (k) {
    var g = by[k];
    g.달성률 = g.인원 ? Math.round(g.오늘달성 / g.인원 * 100) : 0;
    g.평균 = g.인원 ? Math.round(g.누적 / g.인원) : 0;
    g.평균기록일 = g.인원 ? Math.round(g.기록일합 / g.인원 * 10) / 10 : 0;
    return g;
  }).sort(function (a, b) { return (b.달성률 - a.달성률) || (b.오늘총 - a.오늘총) || (b.평균 - a.평균) || (a.학년 - b.학년) || (a.반 - b.반); });
}

/* ================= 응원 문구 ================= */

var ROPE_문구 = [
  '오늘의 작은 도약이 내일의 큰 성장을 만들어요!',
  '꾸준함이 실력이에요. 오늘도 줄넘기 한 번 더!',
  '땀 흘린 만큼 튼튼해지는 우리 친구들, 최고예요!',
  '어제보다 한 번 더! 나와의 약속을 지켜 봐요.',
  '건강한 습관은 매일의 반복에서 시작돼요.',
  '넘어져도 괜찮아요. 다시 줄을 잡는 게 진짜 실력이에요.'
];
function rope_응원문구_(현황) {
  var key = '';
  try { key = 속성_(ROPE_GEMINI_KEY) || ''; } catch (e) {}
  if (key && 현황) {
    var cached = 캐시읽기_('rope_ai_' + 오늘_());
    if (cached) return cached;
    try {
      var prompt = '너는 초등학생들의 줄넘기 운동을 지도하는 체육 선생님이다.\n현재 ' + 현황.학생.length + '명의 학생이 참여했고 누적 줄넘기 총 횟수는 ' + 현황.총 + '회, 오늘은 ' + 현황.오늘기록인원 + '명이 ' + 현황.오늘총 + '회를 뛰었다.\n' +
        (현황.왕.누적 ? '누적 1위는 ' + 현황.왕.누적.이름 + ' 학생(' + 현황.왕.누적.값 + '회)이다.\n' : '') +
        '학생들을 격려하고 꾸준한 운동 습관을 만들어 주는 한 문장짜리 응원 문구를 한국어 존댓말(~해요)로 작성해줘. 따옴표나 설명 없이 문장 하나만 출력해.';
      var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
        { method: 'post', contentType: 'application/json', payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), muteHttpExceptions: true });
      var json = JSON.parse(res.getContentText());
      var text = json.candidates && json.candidates[0].content.parts[0].text;
      if (text) { text = String(text).trim().slice(0, 120); 캐시쓰기_('rope_ai_' + 오늘_(), text, 3600 * 6); return text; }
    } catch (e) {}
  }
  var d = 오늘_().split('-').map(Number);
  return ROPE_문구[(d[1] * 31 + d[2]) % ROPE_문구.length];
}

/* ================= 기록 쓰기 (공통) ================= */

function rope_기록추가_(학생ID, 날짜, 시각, 횟수, 상태, 입력자, 메모) {
  var now = 지금_();
  var rec = { 기록ID: makeId_('R'), 입력일시: now, 날짜: 날짜, 시각: 시각, 학생ID: 학생ID, 횟수: 횟수, 상태: 상태, 확인일시: 상태 === '확인' ? now : '', 입력자: 입력자, 메모: str_(메모).slice(0, 100) };
  appendRow_(ROPE.기록, ROPE_H.기록, rec);
  rope_캐시지우기_();
  return rec;
}

/* ================= 교사 API ================= */

function rope_t_boot(token) {
  교사확인_(token);
  var s = rope_설정_();
  return { 설정: s, 오늘: 오늘_(), 대기: rope_기록전체_().filter(function (r) { return r.상태 === '대기'; }).length };
}

/** 학급 현황. 학년·반 0 이면 전체 */
function rope_t_getClass(token, 학년, 반) {
  교사확인_(token);
  var s = rope_설정_(), 기록 = rope_기록전체_();
  var 현황 = rope_학급현황_(num_(학년) || 0, num_(반) || 0, 기록, s);
  현황.문구 = rope_응원문구_(현황);
  현황.하루목표 = s.하루목표; 현황.학급목표 = s.학급목표;
  현황.학급비교 = rope_학급비교_(현황, s);
  // 최근 14일 학급 합계 (그래프용)
  var 오늘 = 오늘_(), 일별 = [], set = {};
  현황.학생.forEach(function (o) { set[o.학생ID] = true; });
  for (var i = 13; i >= 0; i--) { var d = 날짜더하기_(오늘, -i); 일별.push({ 날짜: d, 횟수: 0, 인원: 0 }); }
  var idx = {}; 일별.forEach(function (x, i) { idx[x.날짜] = i; });
  var 인원 = {};
  기록.forEach(function (r) { if (r.상태 === '확인' && set[r.학생ID] && idx[r.날짜] !== undefined) { 일별[idx[r.날짜]].횟수 += r.횟수; (인원[r.날짜] = 인원[r.날짜] || {})[r.학생ID] = true; } });
  일별.forEach(function (x) { x.인원 = Object.keys(인원[x.날짜] || {}).length; });
  현황.일별 = 일별;
  return 현황;
}

function rope_t_getPending(token) {
  교사확인_(token);
  var 학생 = 학생맵_(true);
  return rope_기록전체_().filter(function (r) { return r.상태 === '대기'; }).map(function (r) {
    var st = 학생[r.학생ID] || {};
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 입력일시: r.입력일시, 학생ID: r.학생ID, 학년: st.학년 || '', 반: st.반 || '', 번호: st.번호 || '', 이름: st.이름 || '(삭제된 학생)', 횟수: r.횟수, 메모: r.메모 };
  }).sort(function (a, b) { return (a.학년 - b.학년) || (a.반 - b.반) || (a.번호 - b.번호) || a.날짜.localeCompare(b.날짜); });
}

/** 상태 바꾸기. ids 배열, 상태 '확인' | '반려' | '대기', 메모(선택, 반려 사유) */
function rope_t_setStatus(token, ids, 상태, 메모) {
  교사확인_(token);
  if (ROPE_상태.indexOf(상태) < 0) throw new Error('상태가 잘못되었습니다.');
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  var now = 지금_(), n = 0;
  return withLock_(function () {
    rows_(ROPE.기록).forEach(function (r) {
      if (!set[str_(r.기록ID)]) return;
      var f = { 상태: 상태, 확인일시: 상태 === '대기' ? '' : now };
      if (메모 !== undefined && 메모 !== null && 상태 === '반려') f.메모 = str_(메모).slice(0, 100);
      setCells_(ROPE.기록, ROPE_H.기록, r._row, f); n++;
    });
    rope_캐시지우기_();
    return { ok: true, 처리: n, 대기: rope_기록전체_().filter(function (r) { return r.상태 === '대기'; }).length };
  });
}

/** 교사 입력 (바로 확인). rows = [{학생ID, 횟수}], 날짜·시각 공통 */
function rope_t_addRecords(token, 날짜, 시각, rows, 메모) {
  교사확인_(token);
  날짜 = 날짜정리_(날짜) || 오늘_(); 시각 = rope_시각_(시각);
  var 학생 = 학생맵_(false), objs = [], now = 지금_();
  (rows || []).forEach(function (r) {
    var id = str_(r.학생ID), n = Math.round(num_(r.횟수) || 0);
    if (!학생[id] || n <= 0) return;
    objs.push({ 기록ID: makeId_('R') + Math.floor(Math.random() * 90 + 10), 입력일시: now, 날짜: 날짜, 시각: 시각, 학생ID: id, 횟수: n, 상태: '확인', 확인일시: now, 입력자: '교사', 메모: str_(메모).slice(0, 100) });
  });
  if (!objs.length) throw new Error('입력된 횟수가 없습니다.');
  return withLock_(function () {
    appendRows_(ROPE.기록, ROPE_H.기록, objs);
    rope_캐시지우기_();
    return { ok: true, 추가: objs.length };
  });
}

/** 학생 한 명의 기록 전체 (교사 관리용) */
function rope_t_getStudent(token, 학생ID) {
  교사확인_(token);
  var st = 학생찾기_(학생ID);
  if (!st) throw new Error('학생을 찾지 못했습니다.');
  var 기록 = rope_기록전체_().filter(function (r) { return r.학생ID === 학생ID; }).map(function (r) {
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 횟수: r.횟수, 상태: r.상태, 입력자: r.입력자, 메모: r.메모, 입력일시: r.입력일시 };
  }).reverse();
  return { 학생: 학생공개_(st), 기록: 기록, 요약: rope_학생요약_(학생ID, rope_기록전체_(), rope_설정_()) };
}

function rope_t_updateRecord(token, 기록ID, 횟수, 상태, 메모) {
  교사확인_(token);
  var n = Math.round(num_(횟수) || 0);
  if (n <= 0) throw new Error('횟수는 1 이상이어야 합니다.');
  if (ROPE_상태.indexOf(상태) < 0) 상태 = '확인';
  var hit = rows_(ROPE.기록).filter(function (r) { return str_(r.기록ID) === str_(기록ID); })[0];
  if (!hit) throw new Error('기록을 찾지 못했습니다.');
  setCells_(ROPE.기록, ROPE_H.기록, hit._row, { 횟수: n, 상태: 상태, 확인일시: 상태 === '대기' ? '' : 지금_(), 메모: str_(메모).slice(0, 100) });
  rope_캐시지우기_();
  return { ok: true };
}

function rope_t_deleteRecords(token, ids) {
  교사확인_(token);
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  var n = 행지우기_(ROPE.기록, function (o) { return set[str_(o.기록ID)] === true; });
  rope_캐시지우기_();
  return { ok: true, 지움: n };
}

function rope_t_saveSettings(token, map) {
  교사확인_(token);
  map = map || {};
  var put = {};
  if (map.하루목표 !== undefined) put['줄넘기.하루목표'] = String(Math.max(1, Math.min(100000, num_(map.하루목표) || 100)));
  if (map.대상학년 !== undefined) put['줄넘기.대상학년'] = (Array.isArray(map.대상학년) ? map.대상학년 : 목록_(map.대상학년)).map(Number).filter(function (g) { return g >= 1 && g <= 6; }).join(',');
  if (map.자동확인 !== undefined) put['줄넘기.자동확인'] = map.자동확인 ? 'Y' : 'N';
  if (map.하루최대입력 !== undefined) put['줄넘기.하루최대입력'] = String(Math.max(1, Math.min(50, num_(map.하루최대입력) || 10)));
  if (map.한번최대횟수 !== undefined) put['줄넘기.한번최대횟수'] = String(Math.max(1, Math.min(100000, num_(map.한번최대횟수) || 3000)));
  if (map.학급목표 !== undefined) put['줄넘기.학급목표'] = String(Math.max(0, num_(map.학급목표) || 0));
  if (Object.keys(put).length) 설정저장_(put);
  if (map.geminiKey !== undefined) {
    var k = str_(map.geminiKey);
    속성저장_(ROPE_GEMINI_KEY, k || null);
    캐시지우기_('rope_ai_' + 오늘_());
  }
  return { ok: true, 설정: rope_설정_(), gemini: rope_gemini여부_() };
}
function rope_gemini여부_() { try { return !!속성_(ROPE_GEMINI_KEY); } catch (e) { return false; } }
function rope_t_getSettings(token) { 교사확인_(token); return { 설정: rope_설정_(), gemini: rope_gemini여부_() }; }

/* ================= 학생 API ================= */

function rope_s_view_(me) {
  var s = rope_설정_(), 기록 = rope_기록전체_();
  var y = rope_학생요약_(me.학생ID, 기록, s);
  var 오늘 = 오늘_();
  var 내기록 = 기록.filter(function (r) { return r.학생ID === me.학생ID; }).map(function (r) { return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 횟수: r.횟수, 상태: r.상태, 입력자: r.입력자, 메모: r.메모 }; });
  var 오늘입력 = 내기록.filter(function (r) { return r.날짜 === 오늘 && r.입력자 === '학생'; }).length;
  var 반 = rope_학급현황_(me.학년, me.반, 기록, s);
  return {
    학생: me, 오늘: 오늘, 설정: { 하루목표: s.하루목표, 하루최대입력: s.하루최대입력, 한번최대횟수: s.한번최대횟수, 자동확인: s.자동확인, 학급목표: s.학급목표 },
    요약: y, 기록: 내기록.slice().reverse(), 오늘입력: 오늘입력, 배지: rope_배지_(y),
    학급: { 총: 반.총, 오늘총: 반.오늘총, 인원: 반.학생.length, 오늘기록인원: 반.오늘기록인원, 달성: 반.달성, 학급목표: s.학급목표, 진행: rope_pct_(반.총, s.학급목표) },
    문구: rope_응원문구_(반)
  };
}
function rope_s_boot(token) { return rope_s_view_(학생확인_(token)); }

/** 학생 기록 입력. m = { 횟수, 시각?, 메모? } — 날짜는 오늘로 고정 */
function rope_s_addRecord(token, m) {
  var me = 학생확인_(token);
  m = m || {};
  var s = rope_설정_(), n = Math.round(num_(m.횟수) || 0);
  if (n <= 0) throw new Error('횟수를 1 이상 입력해 주세요.');
  if (n > s.한번최대횟수) throw new Error('한 번에 ' + s.한번최대횟수 + '회까지 입력할 수 있어요. 여러 번 나눠서 넣어 주세요.');
  var 오늘 = 오늘_();
  var 오늘입력 = rope_기록전체_().filter(function (r) { return r.학생ID === me.학생ID && r.날짜 === 오늘 && r.입력자 === '학생'; }).length;
  if (오늘입력 >= s.하루최대입력) throw new Error('오늘은 ' + s.하루최대입력 + '번까지만 입력할 수 있어요.');
  var 시각 = rope_시각_(m.시각) || 지금_().slice(11);
  return withLock_(function () {
    var rec = rope_기록추가_(me.학생ID, 오늘, 시각, n, s.자동확인 ? '확인' : '대기', '학생', m.메모);
    var v = rope_s_view_(me);
    v.방금 = { 기록ID: rec.기록ID, 횟수: n, 상태: rec.상태 };
    return v;
  });
}

/** 대기 중인 내 기록 지우기 (확인된 기록은 교사만) */
function rope_s_deleteRecord(token, 기록ID) {
  var me = 학생확인_(token);
  var hit = rope_기록전체_().filter(function (r) { return r.기록ID === str_(기록ID) && r.학생ID === me.학생ID; })[0];
  if (!hit) throw new Error('기록을 찾지 못했습니다.');
  if (hit.상태 !== '대기') throw new Error('선생님이 이미 확인한 기록은 지울 수 없어요.');
  행지우기_(ROPE.기록, function (o) { return str_(o.기록ID) === hit.기록ID; });
  rope_캐시지우기_();
  return rope_s_view_(me);
}
