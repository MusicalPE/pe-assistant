/*******************************************************
 * 수업 도우미 모듈 (Mod_Class.gs) — 교사 전용
 *
 * 단독판 "체육전담 수업 도우미"(브라우저 저장)를 통합 뼈대 위로 옮긴 것입니다.
 *  - 학생 명단·학교명·담당자·학년도는 공통(Code.gs)을 그대로 씁니다. 별도 명단이 없습니다.
 *  - 저장은 브라우저가 아니라 스프레드시트에 합니다. 백업·복원 메뉴는 필요 없어졌습니다.
 *  - 시트 이름은 수업_ 접두어, 설정은 공통 설정 시트의 수업.* 항목, 서버 함수는 class_t_ 접두어.
 *
 * 시트
 *   수업_교시   : 교시, 시작, 끝                              (현재 교시를 판단하는 기준)
 *   수업_시간표 : 요일(1~5), 교시, 학년, 반, 장소, 학기(1·2)  (주간 체육 시간표 한 칸이 한 줄. 학기가 비어 있으면 두 학기 공통)
 *   수업_계획   : 계획ID, 학년도, 학년, 차시, 단원, 주제, 내용, 준비물, 장소, 날짜, 대상반, 수정일시
 *   수업_기록   : 기록ID, 학년도, 날짜, 교시, 학년, 반, 계획ID, 연결, 메모, 저장일시   (한 차시 수업이 한 줄)
 *   수업_출석   : 기록ID, 날짜, 교시, 학년, 반, 학생ID, 이름, 상태, 특이사항        (출석이 아니거나 특이사항이 있는 학생만)
 *
 * 기록ID 는 "날짜|교시|학년-반" 입니다. 같은 날 같은 교시 같은 반은 한 건입니다.
 *******************************************************/

var CLASS = { 교시: '수업_교시', 시간표: '수업_시간표', 계획: '수업_계획', 기록: '수업_기록', 출석: '수업_출석' };
var CLASS_H = {
  교시:   ['교시', '시작', '끝'],
  시간표: ['요일', '교시', '학년', '반', '장소', '학기'],
  계획:   ['계획ID', '학년도', '학년', '차시', '단원', '주제', '내용', '준비물', '장소', '날짜', '대상반', '수정일시'],
  기록:   ['기록ID', '학년도', '날짜', '교시', '학년', '반', '계획ID', '연결', '메모', '저장일시'],
  출석:   ['기록ID', '날짜', '교시', '학년', '반', '학생ID', '이름', '상태', '특이사항']
};
var CLASS_색 = '#ECEAFF';
var CLASS_상태 = ['결석', '지각', '조퇴', '견학'];
var CLASS_연결 = ['날짜 지정', '자동', '직접 선택', '계획 없음'];

var CLASS_기본교시 = [
  [1, '09:00', '09:40'], [2, '09:50', '10:30'], [3, '10:50', '11:30'],
  [4, '11:40', '12:20'], [5, '13:10', '13:50'], [6, '14:00', '14:40']
];

/* 공통 설정 시트에 '수업.항목' 으로 저장됩니다 */
function class_기본설정_() {
  return [
    ['1학기',    '',                                                       '1학기 기간 "시작~끝" (예 2026-03-02~2026-07-24). 비우면 3/2~7/24'],
    ['2학기',    '',                                                       '2학기 기간 "시작~끝" (예 2026-08-25~2027-01-09). 비우면 8/25~다음 해 1/9'],
    ['쉬는날',   '',                                                       '수업 없는 날. "날짜 이름"을 ; 로 구분 (예 2026-10-03 개천절;2026-10-09 한글날)'],
    ['장소',     '체육관,운동장,강당,교실',                               '시간표 칸에 빠르게 넣을 장소 (쉼표로 구분)'],
    ['태그',     '복장 미비,준비물 미지참,부상,보건실,적극 참여,배려 행동', '특이사항 빠른 입력 버튼 (쉼표로 구분)'],
    ['명렬제목', '명렬표',                                                 '명렬표 출력 제목'],
    ['기록칸',   '10',                                                     '명렬표 기록 칸 수'],
    ['줄수',     '25',                                                     '명렬표 최소 줄 수']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function class_hooks_() {
  return {
    준비확인: function () {
      return Object.keys(CLASS).every(function (k) { return !!findSheet_(CLASS[k]); });
    },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(CLASS.교시, CLASS_H.교시, { 색: CLASS_색, 기본행: CLASS_기본교시 }));
      만듦 = 만듦.concat(시트준비_(CLASS.시간표, CLASS_H.시간표, { 색: CLASS_색 }));
      만듦 = 만듦.concat(시트준비_(CLASS.계획, CLASS_H.계획, { 색: CLASS_색 }));
      만듦 = 만듦.concat(시트준비_(CLASS.기록, CLASS_H.기록, { 색: CLASS_색 }));
      만듦 = 만듦.concat(시트준비_(CLASS.출석, CLASS_H.출석, { 색: CLASS_색 }));
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      class_기본설정_().forEach(function (r) { if (!있음['수업.' + r[0]]) put['수업.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('수업 도우미 설정 ' + Object.keys(put).length + '항목'); }
      class_캐시지우기_();
      return 만듦;
    },
    캐시지우기: class_캐시지우기_,
    학생참여: function () { return false; },          // 교사 전용
    교사대시보드: function () {
      var d = class_데이터_(), now = new Date();
      var f = class_지금_(d, now), 카드 = [];
      if (f.ses) {
        var 제목 = { live: '지금 수업 중', next: '다음 수업', after: '오늘 마지막 수업' }[f.state];
        var n = class_반학생_(f.ses.학년, f.ses.반).length;
        var 설명 = (f.ses.장소 ? f.ses.장소 + ' · ' : '') + f.ses.시작 + '~' + f.ses.끝 + ' · ' + n + '명';
        if (f.state === 'next') 설명 = f.분 + '분 뒤 시작 · ' + 설명;
        if (f.state === 'live') 설명 = f.분 + '분 남음 · ' + 설명;
        카드.push({ 제목: 제목, 값: f.ses.교시 + '교시', 단위: f.ses.학년 + '학년 ' + f.ses.반 + '반', 설명: 설명, 이동: 'now' });
      } else {
        var 설명2 = f.오늘수업 ? '수업이 모두 끝났습니다' : '시간표에 오늘 수업이 없습니다';
        if (f.판정 && f.판정.상태 === '쉬는날') 설명2 = '쉬는 날 · ' + f.판정.이름;
        else if (f.판정 && f.판정.상태 === '방학') 설명2 = f.판정.이름 + (f.판정.다음 ? ' · ' + f.판정.다음.학기 + '학기 ' + class_월일_(f.판정.다음.시작) + ' 시작' : '');
        카드.push({ 제목: '오늘 체육 수업', 값: f.오늘수업, 단위: '시간', 설명: 설명2, 이동: 'now' });
      }
      var 이번주 = 주시작_(오늘_()), 주기록 = 0, 주특이 = 0;
      Object.keys(d.기록).forEach(function (k) {
        var r = d.기록[k];
        if (주시작_(r.날짜) !== 이번주) return;
        주기록++;
        주특이 += Object.keys(r.특이).length;
      });
      카드.push({ 제목: '이번 주 수업 기록', 값: 주기록, 단위: '회', 설명: 주특이 ? '특이사항 ' + 주특이 + '건' : '출석 확인을 완료한 수업', 이동: 'records' });
      return { 카드: 카드 };
    },
    학생프로필: function () { return null; },
    초기화정보: function () {
      var d = class_데이터_();
      return [
        { key: '기록', 이름: '수업 기록 (출석·특이사항·메모)', 수: Object.keys(d.기록).length },
        { key: '계획', 이름: '수업 계획', 수: rows_(CLASS.계획).length },
        { key: '시간표', 이름: '시간표·교시 시각 → 기본값으로', 수: rows_(CLASS.시간표).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var res = {};
      if (opts.기록) { res.기록 = 시트비우기_(CLASS.기록); 시트비우기_(CLASS.출석); }
      if (opts.계획) res.계획 = 시트비우기_(CLASS.계획);
      if (opts.시간표) {
        시트비우기_(CLASS.시간표); 시트비우기_(CLASS.교시);
        appendRows_(CLASS.교시, CLASS_H.교시, CLASS_기본교시.map(function (r) { return { 교시: r[0], 시작: r[1], 끝: r[2] }; }));
        res.시간표 = true;
      }
      class_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var n = 행지우기_(CLASS.출석, function (o) { return set[str_(o.학생ID)] === true; });
      class_캐시지우기_();
      return { 출석: n };
    }
  };
}

/* ================= 설정 ================= */

function class_설정_() {
  var all = 설정_(), out = {};
  class_기본설정_().forEach(function (r) {
    var v = all['수업.' + r[0]];
    out[r[0]] = (v === undefined || v === null || v === '') ? r[1] : String(v);
  });
  var 학사 = class_학사_(out), 쉬는날 = class_쉬는날_(out.쉬는날);
  var 판정 = class_학기판정_(학사, 쉬는날, 오늘_());
  return {
    학사: 학사, 쉬는날: 쉬는날, 오늘: 판정,
    학기: 판정.학기 || (오늘_() < 학사[2].시작 ? 1 : 2),      // 출석부 머리말 등에 쓰는 "지금 학기"
    장소: class_쉼표_(out.장소), 태그: class_쉼표_(out.태그),
    명렬제목: out.명렬제목 || '명렬표',
    기록칸: Math.max(0, Math.min(20, num_(out.기록칸) === null ? 10 : num_(out.기록칸))),
    줄수: Math.max(1, Math.min(40, num_(out.줄수) || 25)),
    학교명: str_(all.학교명), 담당자: str_(all.담당자), 학년도: str_(all.학년도)
  };
}
function class_쉼표_(v) { return str_(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function class_학년도_() { return str_(설정_().학년도) || String(new Date().getFullYear()); }

/* ---------- 학사일정 ---------- */
/** 설정 문자열 → { 1:{시작,끝}, 2:{시작,끝} } (비어 있으면 학년도 기준 기본값) */
function class_학사_(out) {
  var y = Number(class_학년도_()) || new Date().getFullYear();
  var parse = function (v, 기본시작, 기본끝) {
    var p = str_(v).split('~').map(function (x) { return 날짜정리_(x.trim()); });
    var a = p[0] || 기본시작, b = p[1] || 기본끝;
    if (a > b) { var t = a; a = b; b = t; }
    return { 시작: a, 끝: b };
  };
  return { 1: parse(out['1학기'], y + '-03-02', y + '-07-24'), 2: parse(out['2학기'], y + '-08-25', (y + 1) + '-01-09') };
}
/** "2026-10-03 개천절;2026-10-09 한글날" → [{날짜, 이름}] (날짜순) */
function class_쉬는날_(v) {
  var out = [], seen = {};
  str_(v).split(/[;\n]/).forEach(function (line) {
    var m = line.trim().match(/^(\S+)\s*(.*)$/); if (!m) return;
    var d = 날짜정리_(m[1]); if (!d || seen[d]) return;
    seen[d] = true; out.push({ 날짜: d, 이름: m[2].trim() });
  });
  return out.sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : 1; });
}
/**
 * 날짜가 학기 중인지, 방학인지, 쉬는 날인지
 * → { 학기: 1|2|0, 상태: '학기'|'쉬는날'|'방학', 이름, 다음: {학기, 시작}|null }
 */
function class_학기판정_(학사, 쉬는날, 날짜) {
  var 학기 = 0;
  if (날짜 >= 학사[1].시작 && 날짜 <= 학사[1].끝) 학기 = 1;
  else if (날짜 >= 학사[2].시작 && 날짜 <= 학사[2].끝) 학기 = 2;
  var 다음 = null;
  if (날짜 < 학사[1].시작) 다음 = { 학기: 1, 시작: 학사[1].시작 };
  else if (날짜 < 학사[2].시작) 다음 = { 학기: 2, 시작: 학사[2].시작 };
  var 휴 = null;
  (쉬는날 || []).some(function (h) { if (h.날짜 === 날짜) { 휴 = h; return true; } return false; });
  if (휴) return { 학기: 학기, 상태: '쉬는날', 이름: 휴.이름 || '쉬는 날', 다음: 다음 };
  if (학기) return { 학기: 학기, 상태: '학기', 이름: 학기 + '학기', 다음: null };
  return { 학기: 0, 상태: '방학', 이름: 다음 ? (다음.학기 === 1 ? '봄방학' : '여름방학') : '겨울방학', 다음: 다음 };
}
/** 학기별 시간표 자료. 학기가 빈 줄은 두 학기 공통 */
function class_시간표읽기_() {
  var tt = { 1: {}, 2: {} };
  rows_(CLASS.시간표).forEach(function (r) {
    var d = num_(r.요일), no = num_(r.교시), g = num_(r.학년), c = num_(r.반), sem = num_(r.학기);
    if (!d || !no || !g || !c) return;
    var v = { 반: g + '-' + c, 장소: str_(r.장소) };
    if (sem === 1 || sem === 2) tt[sem][d + '-' + no] = v;
    else { tt[1][d + '-' + no] = v; tt[2][d + '-' + no] = v; }
  });
  return tt;
}
/** 학기가 빈(공통) 줄을 두 학기 줄로 나눕니다 (한 학기만 고칠 때 다른 학기가 함께 바뀌지 않도록) */
function class_공통줄나누기_() {
  var legacy = rows_(CLASS.시간표).filter(function (r) { return num_(r.학기) !== 1 && num_(r.학기) !== 2; });
  if (!legacy.length) return;
  행지우기_(CLASS.시간표, function (o) { return num_(o.학기) !== 1 && num_(o.학기) !== 2; });
  var rows = [];
  legacy.forEach(function (r) { [1, 2].forEach(function (sem) { rows.push({ 요일: r.요일, 교시: r.교시, 학년: r.학년, 반: r.반, 장소: r.장소, 학기: sem }); }); });
  appendRows_(CLASS.시간표, CLASS_H.시간표, rows);
}

/* ================= 자료 읽기 (캐시) ================= */

function class_캐시지우기_() { 캐시지우기_('class_all'); }

function class_토분_(t) { var p = String(t || '0:0').split(':').map(Number); return p[0] * 60 + (p[1] || 0); }
function class_시각_(v) {
  if (v instanceof Date) return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  var s = str_(v), m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function class_반키_(g, c) { return num_(g) + '-' + num_(c); }
function class_월일_(ymd) { var p = String(ymd || '').split('-'); return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : ''; }

/** 시트 전체를 화면이 쓰는 모양으로. { 교시:[{no,시작,끝}], 시간표:{1:{'요일-교시':{반,장소}}, 2:{…}}, 계획:[], 기록:{key:rec} } */
function class_데이터_() {
  return 캐시_('class_all', function () {
    var 학년도 = class_학년도_();
    var 교시 = rows_(CLASS.교시).map(function (r) {
      return { no: num_(r.교시) || 0, 시작: class_시각_(r.시작) || '09:00', 끝: class_시각_(r.끝) || '09:40' };
    }).filter(function (p) { return p.no > 0; }).sort(function (a, b) { return class_토분_(a.시작) - class_토분_(b.시작); });
    var 시간표 = class_시간표읽기_();
    var 계획 = rows_(CLASS.계획).filter(function (r) { return str_(r.학년도) === 학년도 || !str_(r.학년도); }).map(class_계획공개_);
    var 기록 = {};
    rows_(CLASS.기록).forEach(function (r) {
      if (str_(r.학년도) && str_(r.학년도) !== 학년도) return;
      var key = str_(r.기록ID); if (!key) return;
      var pid = str_(r.계획ID);
      기록[key] = { key: key, 날짜: 날짜정리_(r.날짜), 교시: num_(r.교시) || 0, 반: class_반키_(r.학년, r.반), 상태: {}, 특이: {},
                   메모: str_(r.메모), 계획id: pid || null, 연결: str_(r.연결) || (pid ? '자동' : '계획 없음'), 저장: 시각문자_(r.저장일시) };
    });
    rows_(CLASS.출석).forEach(function (r) {
      var rec = 기록[str_(r.기록ID)]; if (!rec) return;
      var sid = str_(r.학생ID); if (!sid) return;
      var st = str_(r.상태), note = str_(r.특이사항);
      if (CLASS_상태.indexOf(st) >= 0) rec.상태[sid] = st;
      if (note) rec.특이[sid] = note;
    });
    return { 교시: 교시, 시간표: 시간표, 계획: 계획, 기록: 기록 };
  });
}

function class_계획공개_(r) {
  return { id: str_(r.계획ID), 학년: num_(r.학년) || 0, 차시: num_(r.차시) || 0, 단원: str_(r.단원), 주제: str_(r.주제), 내용: str_(r.내용),
           준비물: str_(r.준비물), 장소: str_(r.장소), 날짜: 날짜정리_(r.날짜), 대상: 목록_(r.대상반) };
}

/** 재학생 중 그 반 학생 (번호순) */
function class_반학생_(g, c) {
  return 학생목록_(false).filter(function (s) { return s.학년 === Number(g) && s.반 === Number(c); })
    .sort(function (a, b) { return a.번호 - b.번호; });
}

/** 서버 시각 기준 지금/다음 수업 (대시보드 카드용) */
function class_지금_(d, now) {
  var 지금 = 지금_(), 오늘 = 지금.slice(0, 10), p = 오늘.split('-').map(Number);
  var day = new Date(p[0], p[1] - 1, p[2]).getDay();          // 0=일 … 6=토 (시트 시간대 기준)
  var mins = class_토분_(지금.slice(11));
  var S = class_설정_(), 판정 = class_학기판정_(S.학사, S.쉬는날, 오늘);
  if (판정.상태 !== '학기') return { state: 'none', ses: null, 오늘수업: 0, 판정: 판정 };
  var tt = d.시간표[판정.학기] || {};
  var slots = d.교시.map(function (p) { var s = tt[day + '-' + p.no]; return s ? { p: p, s: s } : null; }).filter(Boolean);
  var mk = function (x) { var pr = x.s.반.split('-'); return { 교시: x.p.no, 학년: pr[0], 반: pr[1], 장소: x.s.장소, 시작: x.p.시작, 끝: x.p.끝 }; };
  if (!slots.length) return { state: 'none', ses: null, 오늘수업: 0, 판정: 판정 };
  for (var i = 0; i < slots.length; i++) {
    if (mins >= class_토분_(slots[i].p.시작) && mins < class_토분_(slots[i].p.끝)) return { state: 'live', ses: mk(slots[i]), 분: class_토분_(slots[i].p.끝) - mins, 오늘수업: slots.length, 판정: 판정 };
  }
  for (var j = 0; j < slots.length; j++) {
    if (class_토분_(slots[j].p.시작) > mins) return { state: 'next', ses: mk(slots[j]), 분: class_토분_(slots[j].p.시작) - mins, 오늘수업: slots.length, 판정: 판정 };
  }
  return { state: 'after', ses: null, 오늘수업: slots.length, 판정: 판정 };
}

/* ================= 교사 API ================= */

function class_t_boot(token) {
  교사확인_(token);
  var d = class_데이터_();
  return { 설정: class_설정_(), 교시: d.교시, 시간표: d.시간표, 계획: d.계획, 기록: d.기록, 오늘: 오늘_(), 지금: 지금_() };
}

/** 한 차시 기록 저장 (통째로 바꿔 씀). rec = { 날짜, 교시, 반:'5-2', 상태:{학생ID:상태}, 특이:{학생ID:글}, 메모, 계획id, 연결 } */
function class_t_saveRecord(token, rec) {
  교사확인_(token);
  rec = rec || {};
  var 날짜 = 날짜정리_(rec.날짜), 교시 = num_(rec.교시), pr = String(rec.반 || '').split('-');
  var g = num_(pr[0]), c = num_(pr[1]);
  if (!날짜 || !교시 || !g || !c) throw new Error('날짜·교시·반이 없습니다.');
  var key = 날짜 + '|' + 교시 + '|' + g + '-' + c;
  var 학생 = {};
  학생목록_(true).forEach(function (s) { 학생[s.학생ID] = s; });
  var 연결 = CLASS_연결.indexOf(str_(rec.연결)) >= 0 ? str_(rec.연결) : (rec.계획id ? '자동' : '계획 없음');
  var 지금 = 지금_();
  return withLock_(function () {
    var fields = { 기록ID: key, 학년도: class_학년도_(), 날짜: 날짜, 교시: 교시, 학년: g, 반: c,
                   계획ID: str_(rec.계획id), 연결: 연결, 메모: str_(rec.메모), 저장일시: 지금 };
    var have = rows_(CLASS.기록).filter(function (r) { return str_(r.기록ID) === key; })[0];
    if (have) setCells_(CLASS.기록, CLASS_H.기록, have._row, fields);
    else appendRow_(CLASS.기록, CLASS_H.기록, fields);
    행지우기_(CLASS.출석, function (o) { return str_(o.기록ID) === key; });
    var 상태 = rec.상태 || {}, 특이 = rec.특이 || {}, ids = {}, rows = [];
    Object.keys(상태).forEach(function (id) { ids[id] = true; });
    Object.keys(특이).forEach(function (id) { ids[id] = true; });
    Object.keys(ids).forEach(function (id) {
      var st = CLASS_상태.indexOf(str_(상태[id])) >= 0 ? str_(상태[id]) : '', note = str_(특이[id]);
      if (!st && !note) return;
      rows.push({ 기록ID: key, 날짜: 날짜, 교시: 교시, 학년: g, 반: c, 학생ID: id, 이름: 학생[id] ? 학생[id].이름 : '', 상태: st, 특이사항: note });
    });
    appendRows_(CLASS.출석, CLASS_H.출석, rows);
    class_캐시지우기_();
    return { ok: true, key: key, 저장: 지금 };
  });
}

function class_t_deleteRecord(token, key) {
  교사확인_(token);
  key = str_(key);
  return withLock_(function () {
    var n = 행지우기_(CLASS.기록, function (o) { return str_(o.기록ID) === key; });
    행지우기_(CLASS.출석, function (o) { return str_(o.기록ID) === key; });
    class_캐시지우기_();
    return { ok: true, 지움: n };
  });
}

/** 교시 시각 전체 저장. list = [{no, 시작, 끝}] — 없어진 교시의 시간표 칸도 지웁니다 */
function class_t_savePeriods(token, list) {
  교사확인_(token);
  var rows = (list || []).map(function (p) { return { 교시: num_(p.no), 시작: class_시각_(p.시작), 끝: class_시각_(p.끝) }; })
    .filter(function (p) { return p.교시 && p.시작 && p.끝; });
  if (!rows.length) throw new Error('교시가 하나는 있어야 합니다.');
  var keep = {};
  rows.forEach(function (p) { keep[p.교시] = true; });
  return withLock_(function () {
    시트비우기_(CLASS.교시);
    appendRows_(CLASS.교시, CLASS_H.교시, rows);
    행지우기_(CLASS.시간표, function (o) { return !keep[num_(o.교시)]; });
    class_캐시지우기_();
    return { ok: true, 교시: class_데이터_().교시 };
  });
}

/** 시간표 한 칸. 학기 = 1|2, cell = '요일-교시', v = { 반:'5-2', 장소 } 또는 null(비우기) */
function class_t_saveCell(token, 학기, cell, v) {
  교사확인_(token);
  var sem = num_(학기) === 2 ? 2 : 1;
  var p = String(cell || '').split('-').map(Number), d = p[0], no = p[1];
  if (!(d >= 1 && d <= 7) || !no) throw new Error('시간표 칸이 잘못되었습니다.');
  return withLock_(function () {
    class_공통줄나누기_();
    행지우기_(CLASS.시간표, function (o) { return num_(o.학기) === sem && num_(o.요일) === d && num_(o.교시) === no; });
    if (v && v.반) {
      var pr = String(v.반).split('-'), g = num_(pr[0]), c = num_(pr[1]);
      if (!g || !c) throw new Error('학년·반을 확인해 주세요.');
      appendRow_(CLASS.시간표, CLASS_H.시간표, { 요일: d, 교시: no, 학년: g, 반: c, 장소: str_(v.장소), 학기: sem });
      var pl = str_(v.장소), s = class_설정_();
      if (pl && s.장소.indexOf(pl) < 0) 설정저장_({ '수업.장소': s.장소.concat([pl]).join(',') });
    }
    class_캐시지우기_();
    return { ok: true, 시간표: class_데이터_().시간표, 설정: class_설정_() };
  });
}

/** 한 학기 시간표 비우기 */
function class_t_clearTimetable(token, 학기) {
  교사확인_(token);
  var sem = num_(학기) === 2 ? 2 : 1;
  return withLock_(function () {
    class_공통줄나누기_();
    var n = 행지우기_(CLASS.시간표, function (o) { return num_(o.학기) === sem; });
    class_캐시지우기_();
    return { ok: true, 지움: n, 시간표: class_데이터_().시간표 };
  });
}

/** 한 학기 시간표를 다른 학기로 복사 (대상 학기는 지우고 덮어씀) */
function class_t_copyTimetable(token, from, to) {
  교사확인_(token);
  var a = num_(from) === 2 ? 2 : 1, b = num_(to) === 2 ? 2 : 1;
  if (a === b) throw new Error('같은 학기입니다.');
  return withLock_(function () {
    class_공통줄나누기_();
    var src = rows_(CLASS.시간표).filter(function (r) { return num_(r.학기) === a; });
    행지우기_(CLASS.시간표, function (o) { return num_(o.학기) === b; });
    appendRows_(CLASS.시간표, CLASS_H.시간표, src.map(function (r) { return { 요일: r.요일, 교시: r.교시, 학년: r.학년, 반: r.반, 장소: r.장소, 학기: b }; }));
    class_캐시지우기_();
    return { ok: true, 복사: src.length, 시간표: class_데이터_().시간표 };
  });
}

/** 계획 한 건 저장 (id 없으면 새로). 돌려주는 값: 저장된 계획 */
function class_t_savePlan(token, plan) {
  교사확인_(token);
  plan = plan || {};
  var g = num_(plan.학년), no = num_(plan.차시);
  if (!g || !no || !str_(plan.주제)) throw new Error('학년·차시·학습 주제를 입력해 주세요.');
  var id = str_(plan.id) || makeId_('P');
  var fields = { 계획ID: id, 학년도: class_학년도_(), 학년: g, 차시: no, 단원: str_(plan.단원), 주제: str_(plan.주제), 내용: str_(plan.내용),
                 준비물: str_(plan.준비물), 장소: str_(plan.장소), 날짜: 날짜정리_(plan.날짜), 대상반: (plan.대상 || []).map(String).join(','), 수정일시: 지금_() };
  return withLock_(function () {
    var have = rows_(CLASS.계획).filter(function (r) { return str_(r.계획ID) === id; })[0];
    if (have) setCells_(CLASS.계획, CLASS_H.계획, have._row, fields);
    else appendRow_(CLASS.계획, CLASS_H.계획, fields);
    class_캐시지우기_();
    return { ok: true, 계획: class_계획공개_(fields) };
  });
}

function class_t_deletePlan(token, id) {
  교사확인_(token);
  id = str_(id);
  return withLock_(function () {
    var n = 행지우기_(CLASS.계획, function (o) { return str_(o.계획ID) === id; });
    class_캐시지우기_();
    return { ok: true, 지움: n };
  });
}

/** 진도표 붙여넣기 결과 여러 건 추가. replace 면 그 학년 기존 계획을 지움 */
function class_t_addPlans(token, 학년, rows, replace) {
  교사확인_(token);
  var g = num_(학년);
  if (!g) throw new Error('학년을 골라 주세요.');
  var 학년도 = class_학년도_(), 지금 = 지금_();
  var objs = (rows || []).map(function (r) {
    return { 계획ID: makeId_('P') + Math.floor(Math.random() * 90 + 10), 학년도: 학년도, 학년: g, 차시: num_(r.차시) || 0, 단원: str_(r.단원), 주제: str_(r.주제),
             내용: str_(r.내용), 준비물: str_(r.준비물), 장소: str_(r.장소), 날짜: 날짜정리_(r.날짜), 대상반: (r.대상 || []).join(','), 수정일시: 지금 };
  }).filter(function (o) { return o.차시 && (o.주제 || o.단원); });
  if (!objs.length) throw new Error('인식된 차시가 없습니다.');
  return withLock_(function () {
    if (replace) 행지우기_(CLASS.계획, function (o) { return num_(o.학년) === g && (!str_(o.학년도) || str_(o.학년도) === 학년도); });
    appendRows_(CLASS.계획, CLASS_H.계획, objs);
    class_캐시지우기_();
    return { ok: true, 추가: objs.length, 계획: class_데이터_().계획 };
  });
}

/** 수업 도우미 설정. map = { 학사:{1:{시작,끝},2:{시작,끝}}, 쉬는날:[{날짜,이름}]|문자열, 장소:[], 태그:[], 명렬제목, 기록칸, 줄수 } (있는 것만) */
function class_t_saveSettings(token, map) {
  교사확인_(token);
  map = map || {};
  var put = {};
  if (map.학사 !== undefined) {
    [1, 2].forEach(function (sem) {
      var t = (map.학사 || {})[sem] || {}, a = 날짜정리_(t.시작), b = 날짜정리_(t.끝);
      put['수업.' + sem + '학기'] = (a && b) ? (a > b ? b + '~' + a : a + '~' + b) : '';
    });
    var 학 = class_학사_({ '1학기': put['수업.1학기'], '2학기': put['수업.2학기'] });
    if (학[1].끝 >= 학[2].시작) throw new Error('1학기 끝이 2학기 시작보다 앞이어야 합니다.');
  }
  if (map.쉬는날 !== undefined) {
    var list = Array.isArray(map.쉬는날) ? map.쉬는날.map(function (h) { return 날짜정리_(h.날짜) + ' ' + str_(h.이름); }).join(';') : str_(map.쉬는날);
    put['수업.쉬는날'] = class_쉬는날_(list).map(function (h) { return h.날짜 + (h.이름 ? ' ' + h.이름 : ''); }).join(';');
  }
  if (map.장소 !== undefined) put['수업.장소'] = (Array.isArray(map.장소) ? map.장소 : class_쉼표_(map.장소)).map(function (x) { return String(x).trim(); }).filter(Boolean).join(',');
  if (map.태그 !== undefined) put['수업.태그'] = (Array.isArray(map.태그) ? map.태그 : class_쉼표_(map.태그)).map(function (x) { return String(x).trim(); }).filter(Boolean).join(',');
  if (map.명렬제목 !== undefined) put['수업.명렬제목'] = str_(map.명렬제목) || '명렬표';
  if (map.기록칸 !== undefined) put['수업.기록칸'] = String(Math.max(0, Math.min(20, num_(map.기록칸) === null ? 10 : num_(map.기록칸))));
  if (map.줄수 !== undefined) put['수업.줄수'] = String(Math.max(1, Math.min(40, num_(map.줄수) || 25)));
  if (Object.keys(put).length) 설정저장_(put);
  return { ok: true, 설정: class_설정_() };
}
