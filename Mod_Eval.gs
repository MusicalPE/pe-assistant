/*******************************************************
 * 수행평가 모듈 (Mod_Eval.gs) — 교사 전용
 *
 *  - 평가 계획을 학년별로 세우고(3단계 상·중·하 / 4단계), 반별 명렬에 단계를 찍고 특기사항을 남깁니다.
 *  - 학생 화면·학생 프로필·배지 어디에도 나가지 않습니다 (학생이 평가 결과를 실시간으로 보지 않도록).
 *  - 출력(평가별 결과표·반별 종합표·빈 채점표)은 화면에서 만듭니다. 서버는 자료만 내려줍니다.
 *  - 결과에는 학년도가 붙어 학년 올리기를 해도 지난 학년도 결과가 남습니다.
 *
 * 시트
 *   평가_계획 : 평가ID, 학년도, 학기, 학년, 순서, 영역, 평가명, 성취기준, 평가요소, 방법, 단계수, 단계라벨, 시기, 비고, 수정일시
 *   평가_결과 : 결과ID, 평가ID, 학년도, 학생ID, 학년, 반, 번호, 이름, 단계, 특기사항, 평가일, 입력일시
 *
 * 설정 (공통 설정 시트의 평가.* 항목)
 *   계획방식 : 간단 | 자세히 — 자세히면 영역·성취기준·평가요소 칸을 씀
 *   라벨3 / 라벨4 : 새 평가를 만들 때 넣어 주는 기본 단계 이름 (평가마다 바꿀 수 있음)
 *******************************************************/

var EVAL = { 계획: '평가_계획', 결과: '평가_결과' };
var EVAL_H = {
  계획: ['평가ID', '학년도', '학기', '학년', '순서', '영역', '평가명', '성취기준', '평가요소', '방법', '단계수', '단계라벨', '시기', '비고', '수정일시'],
  결과: ['결과ID', '평가ID', '학년도', '학생ID', '학년', '반', '번호', '이름', '단계', '특기사항', '평가일', '입력일시']
};
var EVAL_색 = '#F3E8FF';
var EVAL_영역 = ['운동', '스포츠', '표현', '건강', '도전', '경쟁', '기타'];

function eval_기본설정_() {
  return [
    ['계획방식', '간단', '간단 | 자세히 — 자세히면 평가 계획에 영역·성취기준·평가요소 칸을 씁니다'],
    ['라벨3',    '상,중,하', '3단계 기본 단계 이름 (쉼표로 구분, 잘한 순서)'],
    ['라벨4',    '매우잘함,잘함,보통,노력요함', '4단계 기본 단계 이름 (쉼표로 구분, 잘한 순서)'],
    ['출력제목', '수행평가 결과표', '평가별 결과표 인쇄 제목']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function eval_hooks_() {
  return {
    준비확인: function () { return !!findSheet_(EVAL.계획) && !!findSheet_(EVAL.결과); },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(EVAL.계획, EVAL_H.계획, { 색: EVAL_색 }));
      만듦 = 만듦.concat(시트준비_(EVAL.결과, EVAL_H.결과, { 색: EVAL_색 }));
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      eval_기본설정_().forEach(function (r) { if (!있음['평가.' + r[0]]) put['평가.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('수행평가 설정 ' + Object.keys(put).length + '항목'); }
      eval_캐시지우기_();
      return 만듦;
    },
    캐시지우기: eval_캐시지우기_,
    /* 학생참여·학생프로필·학생배지 훅은 일부러 두지 않습니다 — 학생에게는 보이지 않는 모듈 */
    교사대시보드: function () {
      var 학년도 = eval_학년도_(), 계획 = eval_계획목록_(), 요약 = eval_요약_();
      var 학급 = {};
      학생목록_(false).forEach(function (s) { if (s.반 && s.번호) { var k = s.학년 + '-' + s.반; 학급[k] = (학급[k] || 0) + 1; } });
      var 미완 = 0, 완료 = 0;
      계획.forEach(function (p) {
        Object.keys(학급).forEach(function (k) {
          if (Number(k.split('-')[0]) !== p.학년) return;
          var n = (요약[p.id] || {})[k] || 0;
          if (n >= 학급[k]) 완료++; else 미완++;
        });
      });
      var 카드 = [{ 제목: '수행평가 ' + 학년도 + '학년도', 값: 계획.length, 단위: '개 평가', 이동: 'plans',
                    설명: 계획.length ? ('반별 입력 완료 ' + 완료 + ' · 남은 ' + 미완) : '평가 계획에서 첫 평가를 만들어 주세요' }];
      return { 카드: 카드, 대기: 미완 };
    },
    초기화정보: function () {
      return [
        { key: '결과', 이름: '평가 결과 (모든 학년도 · 계획은 남음)', 수: rows_(EVAL.결과).length },
        { key: '계획', 이름: '평가 계획·결과 모두', 수: rows_(EVAL.계획).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var res = {};
      if (opts.결과 || opts.계획) res.결과 = 시트비우기_(EVAL.결과);
      if (opts.계획) res.계획 = 시트비우기_(EVAL.계획);
      eval_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var n = 행지우기_(EVAL.결과, function (o) { return set[str_(o.학생ID)] === true; });
      eval_캐시지우기_();
      return { 결과: n };
    }
  };
}

/* ================= 설정 · 읽기 ================= */

function eval_캐시지우기_() { 캐시지우기_('eval_plans'); 캐시지우기_('eval_sum'); }
function eval_학년도_() { return str_(설정_().학년도) || String(new Date().getFullYear()); }

function eval_설정_() {
  var all = 설정_(), out = {};
  eval_기본설정_().forEach(function (r) { var v = all['평가.' + r[0]]; out[r[0]] = (v === undefined || v === null || v === '') ? r[1] : String(v); });
  var 라벨3 = 목록_(out.라벨3), 라벨4 = 목록_(out.라벨4);
  return {
    계획방식: out.계획방식 === '자세히' ? '자세히' : '간단',
    라벨3: 라벨3.length === 3 ? 라벨3 : ['상', '중', '하'],
    라벨4: 라벨4.length === 4 ? 라벨4 : ['매우잘함', '잘함', '보통', '노력요함'],
    출력제목: out.출력제목 || '수행평가 결과표',
    영역: EVAL_영역
  };
}

function eval_라벨정리_(단계수, 라벨) {
  var n = num_(단계수) === 4 ? 4 : 3, 기본 = eval_설정_()[n === 4 ? '라벨4' : '라벨3'];
  var list = (Array.isArray(라벨) ? 라벨 : 목록_(라벨)).map(function (x) { return str_(x); }).filter(Boolean);
  if (list.length !== n) list = 기본.slice();
  return { 단계수: n, 라벨: list };
}

/** 이번 학년도 평가 계획 전체 (학년·학기·순서 정렬) — 캐시 */
function eval_계획목록_() {
  return 캐시_('eval_plans', function () {
    var 학년도 = eval_학년도_();
    return rows_(EVAL.계획).filter(function (r) { return str_(r.평가ID) && (str_(r.학년도) === 학년도 || !str_(r.학년도)); }).map(function (r) {
      var lb = eval_라벨정리_(r.단계수, r.단계라벨);
      return { id: str_(r.평가ID), 학년도: str_(r.학년도) || 학년도, 학기: num_(r.학기) === 2 ? 2 : 1, 학년: num_(r.학년) || 0, 순서: num_(r.순서) || 0,
               영역: str_(r.영역), 평가명: str_(r.평가명), 성취기준: str_(r.성취기준), 평가요소: str_(r.평가요소), 방법: str_(r.방법),
               단계수: lb.단계수, 라벨: lb.라벨, 시기: str_(r.시기), 비고: str_(r.비고), 수정: 시각문자_(r.수정일시) };
    }).sort(function (a, b) { return (a.학년 - b.학년) || (a.학기 - b.학기) || (a.순서 - b.순서) || a.평가명.localeCompare(b.평가명, 'ko'); });
  });
}
function eval_계획_(id) {
  var list = eval_계획목록_();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/** { 평가ID: { '학년-반': 단계가 찍힌 학생 수 } } — 이번 학년도만 (대시보드·진행률) */
function eval_요약_() {
  return 캐시_('eval_sum', function () {
    var 학년도 = eval_학년도_(), out = {};
    rows_(EVAL.결과).forEach(function (r) {
      if (str_(r.학년도) !== 학년도 || !str_(r.단계)) return;
      var pid = str_(r.평가ID), k = num_(r.학년) + '-' + num_(r.반);
      if (!out[pid]) out[pid] = {};
      out[pid][k] = (out[pid][k] || 0) + 1;
    });
    return out;
  });
}

function eval_학급학생_(학년, 반) {
  return 학생목록_(false).filter(function (s) { return s.학년 === Number(학년) && s.반 === Number(반); }).map(학생공개_);
}

/** 한 반의 결과 { 학생ID: { 평가ID: {단계, 특기사항, 평가일} } } (이번 학년도). 평가ID를 주면 그 평가만 */
function eval_반결과_(학년, 반, 평가ID) {
  var 학년도 = eval_학년도_(), out = {};
  rows_(EVAL.결과).forEach(function (r) {
    if (str_(r.학년도) !== 학년도) return;
    if (num_(r.학년) !== Number(학년) || num_(r.반) !== Number(반)) return;
    var pid = str_(r.평가ID);
    if (평가ID && pid !== String(평가ID)) return;
    var id = str_(r.학생ID);
    if (!out[id]) out[id] = {};
    out[id][pid] = { 단계: str_(r.단계), 특기사항: str_(r.특기사항), 평가일: 날짜정리_(r.평가일) };
  });
  return out;
}

/* ================= 교사 API ================= */

function eval_t_boot(token) {
  교사확인_(token);
  return { 설정: eval_설정_(), 계획: eval_계획목록_(), 요약: eval_요약_(), 학년도: eval_학년도_(), 오늘: 오늘_() };
}

/* ---------- 평가 계획 ---------- */

/** plan = { id?, 학기, 학년, 영역, 평가명, 성취기준, 평가요소, 방법, 단계수, 라벨:[..], 시기, 비고 } */
function eval_t_savePlan(token, plan) {
  교사확인_(token);
  plan = plan || {};
  var g = num_(plan.학년), 이름 = str_(plan.평가명);
  if (!g) throw new Error('학년을 골라 주세요.');
  if (!이름) throw new Error('평가명을 입력해 주세요.');
  var lb = eval_라벨정리_(plan.단계수, plan.라벨);
  return withLock_(function () {
    var 학년도 = eval_학년도_(), id = str_(plan.id), now = 지금_();
    var fields = { 학년도: 학년도, 학기: num_(plan.학기) === 2 ? 2 : 1, 학년: g, 영역: str_(plan.영역), 평가명: 이름, 성취기준: str_(plan.성취기준), 평가요소: str_(plan.평가요소),
                   방법: str_(plan.방법), 단계수: lb.단계수, 단계라벨: lb.라벨.join(','), 시기: str_(plan.시기), 비고: str_(plan.비고), 수정일시: now };
    var row = null;
    if (id) rows_(EVAL.계획).some(function (r) { if (str_(r.평가ID) === id) { row = r; return true; } return false; });
    if (row) {
      setCells_(EVAL.계획, EVAL_H.계획, row._row, fields);
    } else {
      id = makeId_('EV');
      var 같은학년 = eval_계획목록_().filter(function (p) { return p.학년 === g && p.학기 === fields.학기; });
      fields.평가ID = id; fields.순서 = 같은학년.length ? 같은학년[같은학년.length - 1].순서 + 1 : 1;
      appendRow_(EVAL.계획, EVAL_H.계획, fields);
    }
    eval_캐시지우기_();
    return { ok: true, id: id, 계획: eval_계획목록_() };
  });
}

/** 삭제 — 그 평가의 결과도 함께 지웁니다 */
function eval_t_deletePlan(token, id) {
  교사확인_(token);
  id = str_(id);
  return withLock_(function () {
    var n = 행지우기_(EVAL.계획, function (o) { return str_(o.평가ID) === id; });
    var m = 행지우기_(EVAL.결과, function (o) { return str_(o.평가ID) === id; });
    eval_캐시지우기_();
    return { ok: n > 0, 결과삭제: m, 계획: eval_계획목록_() };
  });
}

/** 순서 바꾸기: ids 를 준 순서대로 1,2,3… */
function eval_t_reorderPlans(token, ids) {
  교사확인_(token);
  return withLock_(function () {
    var pos = {}; (ids || []).forEach(function (id, i) { pos[String(id)] = i + 1; });
    rows_(EVAL.계획).forEach(function (r) { var p = pos[str_(r.평가ID)]; if (p) setCells_(EVAL.계획, EVAL_H.계획, r._row, { 순서: p }); });
    eval_캐시지우기_();
    return { ok: true, 계획: eval_계획목록_() };
  });
}

/**
 * 표 붙여넣기로 여러 평가 한 번에. 한 줄에 탭·쉼표 구분:
 *   간단  : 평가명 [방법] [시기] [비고]
 *   자세히: 평가명 [영역] [성취기준] [평가요소] [방법] [시기] [비고]
 * 단계수는 옵션(기본 3)
 */
function eval_t_addPlans(token, 학년, 학기, 텍스트, 단계수) {
  교사확인_(token);
  var g = num_(학년); if (!g) throw new Error('학년을 골라 주세요.');
  var 자세히 = eval_설정_().계획방식 === '자세히', lb = eval_라벨정리_(단계수, null);
  return withLock_(function () {
    var 학년도 = eval_학년도_(), sem = num_(학기) === 2 ? 2 : 1, now = 지금_();
    var 기존 = eval_계획목록_().filter(function (p) { return p.학년 === g && p.학기 === sem; });
    var 순서 = 기존.length ? 기존[기존.length - 1].순서 : 0, 신규 = [];
    String(텍스트 || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var c = line.split(/\t|,/).map(function (x) { return x.trim(); });
      if (!c[0]) return;
      var f = { 평가ID: makeId_('EV'), 학년도: 학년도, 학기: sem, 학년: g, 순서: ++순서, 평가명: c[0], 단계수: lb.단계수, 단계라벨: lb.라벨.join(','), 수정일시: now };
      if (자세히) { f.영역 = c[1] || ''; f.성취기준 = c[2] || ''; f.평가요소 = c[3] || ''; f.방법 = c[4] || ''; f.시기 = c[5] || ''; f.비고 = c[6] || ''; }
      else { f.방법 = c[1] || ''; f.시기 = c[2] || ''; f.비고 = c[3] || ''; }
      신규.push(f);
    });
    if (!신규.length) return { ok: false, message: '읽어 들일 줄이 없습니다.' };
    appendRows_(EVAL.계획, EVAL_H.계획, 신규);
    eval_캐시지우기_();
    return { ok: true, 추가: 신규.length, 계획: eval_계획목록_() };
  });
}

/** 한 학년의 계획을 다른 학년으로 복제 (결과는 복제하지 않음) */
function eval_t_copyPlans(token, from, to, 학기) {
  교사확인_(token);
  var a = num_(from), b = num_(to); if (!a || !b || a === b) throw new Error('서로 다른 학년을 골라 주세요.');
  return withLock_(function () {
    var sem = num_(학기) || 0, now = 지금_();
    var src = eval_계획목록_().filter(function (p) { return p.학년 === a && (!sem || p.학기 === sem); });
    var 기존 = eval_계획목록_().filter(function (p) { return p.학년 === b; });
    var 순서 = 기존.length ? 기존[기존.length - 1].순서 : 0;
    var rows = src.map(function (p) {
      return { 평가ID: makeId_('EV'), 학년도: p.학년도, 학기: p.학기, 학년: b, 순서: ++순서, 영역: p.영역, 평가명: p.평가명, 성취기준: p.성취기준, 평가요소: p.평가요소,
               방법: p.방법, 단계수: p.단계수, 단계라벨: p.라벨.join(','), 시기: p.시기, 비고: p.비고, 수정일시: now };
    });
    if (rows.length) appendRows_(EVAL.계획, EVAL_H.계획, rows);
    eval_캐시지우기_();
    return { ok: true, 복제: rows.length, 계획: eval_계획목록_() };
  });
}

/* ---------- 평가 입력 ---------- */

function eval_t_getClass(token, 평가ID, 학년, 반) {
  교사확인_(token);
  var p = eval_계획_(str_(평가ID));
  if (!p) throw new Error('평가를 찾지 못했습니다.');
  var 학생 = eval_학급학생_(학년, 반), 결과 = eval_반결과_(학년, 반, p.id), out = {};
  학생.forEach(function (s) { out[s.학생ID] = (결과[s.학생ID] || {})[p.id] || null; });
  return { 평가: p, 학생: 학생, 결과: out };
}

/**
 * rows = [{학생ID, 단계, 특기사항}] — 같은 학생·평가·학년도는 덮어씀. 단계·특기사항이 모두 비면 지움.
 * 평가일은 반 전체에 같은 날짜를 씁니다(비우면 오늘).
 */
function eval_t_saveResults(token, 평가ID, 학년, 반, 평가일, rows) {
  교사확인_(token);
  var p = eval_계획_(str_(평가ID));
  if (!p) throw new Error('평가를 찾지 못했습니다.');
  var d = 날짜정리_(평가일) || 오늘_();
  return withLock_(function () {
    var 학년도 = eval_학년도_(), 학생맵 = 학생맵_(true), now = 지금_();
    var 기존 = {};
    rows_(EVAL.결과).forEach(function (r) { if (str_(r.평가ID) === p.id && str_(r.학년도) === 학년도) 기존[str_(r.학생ID)] = r._row; });
    var 신규 = [], 지울ID = {}, n = 0;
    (rows || []).forEach(function (x) {
      var s = 학생맵[String(x.학생ID)]; if (!s) return;
      var 단계 = str_(x.단계), 특기 = str_(x.특기사항);
      if (단계 && p.라벨.indexOf(단계) < 0) 단계 = '';
      if (!단계 && !특기) { if (기존[s.학생ID]) 지울ID[s.학생ID] = true; return; }
      var f = { 평가ID: p.id, 학년도: 학년도, 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 단계: 단계, 특기사항: 특기, 평가일: d, 입력일시: now };
      if (기존[s.학생ID]) setCells_(EVAL.결과, EVAL_H.결과, 기존[s.학생ID], f);
      else { f.결과ID = makeId_('ER'); 신규.push(f); }
      n++;
    });
    if (신규.length) appendRows_(EVAL.결과, EVAL_H.결과, 신규);
    if (Object.keys(지울ID).length) 행지우기_(EVAL.결과, function (o) { return str_(o.평가ID) === p.id && str_(o.학년도) === 학년도 && 지울ID[str_(o.학생ID)] === true; });
    eval_캐시지우기_();
    return { ok: true, 저장수: n, 요약: eval_요약_() };
  });
}

/* ---------- 결과 조회 · 출력 ---------- */

/** 한 반의 모든 평가 결과 (이번 학년도) */
function eval_t_getMatrix(token, 학년, 반) {
  교사확인_(token);
  var g = num_(학년), c = num_(반);
  var 평가 = eval_계획목록_().filter(function (p) { return p.학년 === g; });
  return { 평가: 평가, 학생: eval_학급학생_(g, c), 결과: eval_반결과_(g, c, null), 설정: eval_설정_(), 공통: 공개설정_(), 학년도: eval_학년도_() };
}

/** 한 학생의 지난 학년도까지 모든 결과 (교사용) */
function eval_t_studentHistory(token, 학생ID) {
  교사확인_(token);
  var 계획 = {};
  rows_(EVAL.계획).forEach(function (r) { 계획[str_(r.평가ID)] = { 평가명: str_(r.평가명), 학기: num_(r.학기) || 1, 영역: str_(r.영역) }; });
  return rows_(EVAL.결과).filter(function (r) { return str_(r.학생ID) === String(학생ID); }).map(function (r) {
    var p = 계획[str_(r.평가ID)] || {};
    return { 학년도: str_(r.학년도), 학년: num_(r.학년), 학기: p.학기 || '', 영역: p.영역 || '', 평가명: p.평가명 || '(삭제된 평가)', 단계: str_(r.단계), 특기사항: str_(r.특기사항), 평가일: 날짜정리_(r.평가일) };
  }).sort(function (a, b) { return a.학년도 < b.학년도 ? -1 : a.학년도 > b.학년도 ? 1 : (a.평가일 < b.평가일 ? -1 : 1); });
}

/* ---------- 설정 ---------- */

function eval_t_saveSettings(token, map) {
  교사확인_(token);
  map = map || {};
  var put = {};
  if (map.계획방식 !== undefined) put['평가.계획방식'] = str_(map.계획방식) === '자세히' ? '자세히' : '간단';
  if (map.라벨3 !== undefined) { var a = (Array.isArray(map.라벨3) ? map.라벨3 : 목록_(map.라벨3)).map(str_).filter(Boolean); if (a.length !== 3) return { ok: false, message: '3단계 이름은 3개여야 합니다.' }; put['평가.라벨3'] = a.join(','); }
  if (map.라벨4 !== undefined) { var b = (Array.isArray(map.라벨4) ? map.라벨4 : 목록_(map.라벨4)).map(str_).filter(Boolean); if (b.length !== 4) return { ok: false, message: '4단계 이름은 4개여야 합니다.' }; put['평가.라벨4'] = b.join(','); }
  if (map.출력제목 !== undefined) put['평가.출력제목'] = str_(map.출력제목) || '수행평가 결과표';
  설정저장_(put);
  eval_캐시지우기_();
  return { ok: true, 설정: eval_설정_() };
}
