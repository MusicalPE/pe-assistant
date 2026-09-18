/*******************************************************
 * 수행평가 모듈 (Mod_Eval.gs) — 교사 전용
 *
 *  - 평가 계획을 학년별로 세우고(3단계 상·중·하 / 4단계), 반별 명렬에 단계를 찍고 특기사항을 남깁니다.
 *  - 학생 화면·학생 프로필·배지 어디에도 나가지 않습니다 (학생이 평가 결과를 실시간으로 보지 않도록).
 *  - 출력(평가별 결과표·반별 종합표·빈 채점표)은 화면에서 만듭니다. 서버는 자료만 내려줍니다.
 *  - 결과에는 학년도가 붙어 학년 올리기를 해도 지난 학년도 결과가 남습니다.
 *
 *  - 평가마다 '상호평가'를 켜면 짝이 기준을 보며 체크하고 한마디를 적어 사진·영상과 함께 보냅니다.
 *    그래도 단계는 선생님이 찍습니다(짝 의견은 참고 자료). 학생에게 단계·특기사항은 여전히 보이지 않습니다.
 *
 * 시트
 *   평가_계획 : 평가ID, 학년도, 학기, 학년, 순서, 영역, 평가명, 성취기준, 평가요소, 방법, 단계수, 단계라벨, 시기, 비고, 수정일시,
 *               상호평가(N|학생|교사), 평가기준(| 로 구분한 학생용 문장)
 *   평가_결과 : 결과ID, 평가ID, 학년도, 학생ID, 학년, 반, 번호, 이름, 단계, 특기사항, 평가일, 입력일시
 *   평가_상호 : 상호ID, 평가ID, 학년도, 대상학생ID, 학년, 반, 번호, 대상이름, 짝학생ID, 짝이름, 상태, 요청일시, 응답일시,
 *               기준체크(1:1,2:0), 짝의견, 인증파일ID, 인증종류, 인증썸네일ID, 인증파일명, 교사메모, 처리일시
 *               상태: 짝확인대기 → 교사확인대기 → 반영완료 (취소)
 *
 * 설정 (공통 설정 시트의 평가.* 항목)
 *   계획방식 : 간단 | 자세히 — 자세히면 영역·성취기준·평가요소 칸을 씀
 *   라벨3 / 라벨4 : 새 평가를 만들 때 넣어 주는 기본 단계 이름 (평가마다 바꿀 수 있음)
 *   인증자료 : 없음 | 사진 | 사진+영상 — 짝이 올릴 수 있는 것
 *   인증필수 : Y/N — 보내려면 꼭 올려야 하는지
 *   인증보관 : 유지 | 반영후삭제 — 단계를 반영한 뒤 파일 처리
 *******************************************************/

var EVAL = { 계획: '평가_계획', 결과: '평가_결과', 상호: '평가_상호' };
var EVAL_H = {
  계획: ['평가ID', '학년도', '학기', '학년', '순서', '영역', '평가명', '성취기준', '평가요소', '방법', '단계수', '단계라벨', '시기', '비고', '수정일시', '상호평가', '평가기준'],
  결과: ['결과ID', '평가ID', '학년도', '학생ID', '학년', '반', '번호', '이름', '단계', '특기사항', '평가일', '입력일시'],
  상호: ['상호ID', '평가ID', '학년도', '대상학생ID', '학년', '반', '번호', '대상이름', '짝학생ID', '짝이름', '상태', '요청일시', '응답일시',
         '기준체크', '짝의견', '인증파일ID', '인증종류', '인증썸네일ID', '인증파일명', '교사메모', '처리일시']
};
var EVAL_색 = '#F3E8FF';
var EVAL_영역 = ['운동', '스포츠', '표현', '건강', '도전', '경쟁', '기타'];
var EVAL_상호방식 = ['N', '학생', '교사'];     // N=안 씀 · 학생=학생이 짝을 고름 · 교사=선생님이 짝을 배정
var EVAL_ST = { 대기: '짝확인대기', 확인: '교사확인대기', 완료: '반영완료', 취소: '취소' };
var EVAL_MEDIA_MAX = 25 * 1024 * 1024;         // 영상 25MB (base64 로 오가므로 화면에서도 막습니다)
var EVAL_FOLDER_KEY = 'EVAL_MEDIA_FOLDER_ID';

function eval_기본설정_() {
  return [
    ['계획방식', '간단', '간단 | 자세히 — 자세히면 평가 계획에 영역·성취기준·평가요소 칸을 씁니다'],
    ['라벨3',    '상,중,하', '3단계 기본 단계 이름 (쉼표로 구분, 잘한 순서)'],
    ['라벨4',    '매우잘함,잘함,보통,노력요함', '4단계 기본 단계 이름 (쉼표로 구분, 잘한 순서)'],
    ['출력제목', '수행평가 결과표', '평가별 결과표 인쇄 제목'],
    ['인증자료', '사진+영상', '없음 | 사진 | 사진+영상 — 상호평가에서 짝이 올릴 수 있는 자료'],
    ['인증필수', 'N',         'Y/N — 짝이 보내려면 사진·영상을 꼭 올려야 하는지'],
    ['인증보관', '유지',      '유지 | 반영후삭제 — 단계를 반영한 뒤 인증 파일을 그대로 둘지, 휴지통으로 보낼지']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function eval_hooks_() {
  return {
    준비확인: function () { return !!findSheet_(EVAL.계획) && !!findSheet_(EVAL.결과) && !!findSheet_(EVAL.상호); },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(EVAL.계획, EVAL_H.계획, { 색: EVAL_색 }));
      만듦 = 만듦.concat(시트준비_(EVAL.결과, EVAL_H.결과, { 색: EVAL_색 }));
      만듦 = 만듦.concat(시트준비_(EVAL.상호, EVAL_H.상호, { 색: EVAL_색 }));
      ensureColumns_(EVAL.계획, EVAL_H.계획);   // 예전 판 시트에 상호평가·평가기준 열 보충
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      eval_기본설정_().forEach(function (r) { if (!있음['평가.' + r[0]]) put['평가.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('수행평가 설정 ' + Object.keys(put).length + '항목'); }
      eval_캐시지우기_();
      return 만듦;
    },
    캐시지우기: eval_캐시지우기_,
    /* 학생프로필·학생배지 훅은 일부러 두지 않습니다 — 학생에게 단계·특기사항은 보이지 않습니다.
       상호평가를 켠 평가가 있을 때만 학생 메뉴('상호평가')가 생깁니다. */
    학생참여: function (학생ID) { return eval_학생쓸일_(학생ID); },
    학생메뉴: function (학생ID) { return eval_학생쓸일_(학생ID); },
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
      var 상호 = eval_상호수_();
      if (계획.some(function (p) { return p.상호평가 !== 'N'; }) || 상호.확인 || 상호.대기) {
        카드.push({ 제목: '상호평가 확인', 값: 상호.확인, 단위: '건', 배지: 상호.확인 || '', 이동: 'peer',
                    설명: 상호.확인 ? '짝이 보낸 것 — 보고 단계를 찍어 주세요' : (상호.대기 ? '짝 확인 중 ' + 상호.대기 + '건' : '기다리는 것이 없습니다') });
      }
      return { 카드: 카드, 대기: 미완 + 상호.확인 };
    },
    초기화정보: function () {
      return [
        { key: '결과', 이름: '평가 결과·상호평가 (모든 학년도 · 계획은 남음, 인증 사진·영상도 휴지통으로)', 수: rows_(EVAL.결과).length + rows_(EVAL.상호).length },
        { key: '계획', 이름: '평가 계획·결과 모두', 수: rows_(EVAL.계획).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var res = {};
      if (opts.결과 || opts.계획) {
        eval_휴지통_(eval_인증파일들_(function () { return true; }));
        res.결과 = 시트비우기_(EVAL.결과);
        res.상호 = 시트비우기_(EVAL.상호);
      }
      if (opts.계획) res.계획 = 시트비우기_(EVAL.계획);
      eval_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var 맞나 = function (o) { return set[str_(o.대상학생ID)] === true || set[str_(o.짝학생ID)] === true; };
      eval_휴지통_(eval_인증파일들_(맞나));
      var n = 행지우기_(EVAL.결과, function (o) { return set[str_(o.학생ID)] === true; });
      var m = 행지우기_(EVAL.상호, 맞나);
      eval_캐시지우기_();
      return { 결과: n, 상호: m };
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
    인증자료: ['없음', '사진', '사진+영상'].indexOf(out.인증자료) >= 0 ? out.인증자료 : '사진+영상',
    인증필수: String(out.인증자료) !== '없음' && String(out.인증필수).toUpperCase() === 'Y',
    인증보관: out.인증보관 === '반영후삭제' ? '반영후삭제' : '유지',
    영역: EVAL_영역
  };
}

/** 평가기준 문장 목록 ↔ 한 칸 문자열 */
function eval_기준목록_(v) {
  return String(v === null || v === undefined ? '' : v).split(/[|\r\n]+/).map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, 10);
}
function eval_상호방식_(v) { v = str_(v); return EVAL_상호방식.indexOf(v) >= 0 ? v : 'N'; }

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
               단계수: lb.단계수, 라벨: lb.라벨, 시기: str_(r.시기), 비고: str_(r.비고), 수정: 시각문자_(r.수정일시),
               상호평가: eval_상호방식_(r.상호평가), 기준: eval_기준목록_(r.평가기준) };
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
  return { 설정: eval_설정_(), 계획: eval_계획목록_(), 요약: eval_요약_(), 학년도: eval_학년도_(), 오늘: 오늘_(), 상호수: eval_상호수_() };
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
                   방법: str_(plan.방법), 단계수: lb.단계수, 단계라벨: lb.라벨.join(','), 시기: str_(plan.시기), 비고: str_(plan.비고), 수정일시: now,
                   상호평가: eval_상호방식_(plan.상호평가), 평가기준: eval_기준목록_(Array.isArray(plan.기준) ? plan.기준.join('|') : plan.기준).join('|') };
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
    eval_휴지통_(eval_인증파일들_(function (o) { return str_(o.평가ID) === id; }));
    var n = 행지우기_(EVAL.계획, function (o) { return str_(o.평가ID) === id; });
    var m = 행지우기_(EVAL.결과, function (o) { return str_(o.평가ID) === id; });
    var k = 행지우기_(EVAL.상호, function (o) { return str_(o.평가ID) === id; });
    eval_캐시지우기_();
    return { ok: n > 0, 결과삭제: m, 상호삭제: k, 계획: eval_계획목록_() };
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
               방법: p.방법, 단계수: p.단계수, 단계라벨: p.라벨.join(','), 시기: p.시기, 비고: p.비고, 수정일시: now,
               상호평가: p.상호평가, 평가기준: (p.기준 || []).join('|') };
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
  if (map.인증자료 !== undefined) { if (['없음', '사진', '사진+영상'].indexOf(str_(map.인증자료)) < 0) return { ok: false, message: '인증 자료는 없음·사진·사진+영상 중 하나입니다.' }; put['평가.인증자료'] = str_(map.인증자료); }
  if (map.인증필수 !== undefined) put['평가.인증필수'] = map.인증필수 ? 'Y' : 'N';
  if (map.인증보관 !== undefined) put['평가.인증보관'] = str_(map.인증보관) === '반영후삭제' ? '반영후삭제' : '유지';
  설정저장_(put);
  eval_캐시지우기_();
  return { ok: true, 설정: eval_설정_() };
}

/* ================= 상호평가 (짝 확인 → 교사 반영) =================
   짝이 기준을 보며 체크하고 한마디를 적어 사진·영상과 함께 보냅니다.
   단계는 선생님이 직접 찍습니다 — 짝이 보낸 것은 참고 자료입니다.
   학생 화면에는 진행 상태와 '짝이 찍어 준 사진·영상'만 보이고 단계·특기사항은 보이지 않습니다.
=================================================================== */

function eval_상호객체_(r) {
  return {
    id: str_(r.상호ID), 평가ID: str_(r.평가ID), 학년도: str_(r.학년도),
    대상학생ID: str_(r.대상학생ID), 학년: num_(r.학년), 반: num_(r.반), 번호: num_(r.번호), 대상이름: str_(r.대상이름),
    짝학생ID: str_(r.짝학생ID), 짝이름: str_(r.짝이름), 상태: str_(r.상태) || EVAL_ST.대기,
    요청: 시각문자_(r.요청일시), 응답: 시각문자_(r.응답일시), 처리: 시각문자_(r.처리일시),
    체크: eval_체크맵_(r.기준체크), 의견: str_(r.짝의견), 교사메모: str_(r.교사메모),
    mediaId: str_(r.인증파일ID), mediaType: str_(r.인증종류), thumbId: str_(r.인증썸네일ID)
  };
}
function eval_체크맵_(v) {
  var o = {};
  String(v === null || v === undefined ? '' : v).split(',').forEach(function (part) {
    var kv = String(part).split(':'), k = (kv[0] || '').trim();
    if (k) o[k] = Number((kv[1] || '0').trim()) === 1 ? 1 : 0;
  });
  return o;
}
function eval_체크문자_(arr, 기준수) {
  var out = [];
  for (var i = 1; i <= 기준수; i++) out.push(i + ':' + ((arr || []).indexOf(i) >= 0 || (arr || []).indexOf(String(i)) >= 0 ? 1 : 0));
  return out.join(', ');
}
/** 이번 학년도 상호평가 행 (조건에 맞는 것만) */
function eval_상호목록_(맞나) {
  var 학년도 = eval_학년도_(), out = [];
  rows_(EVAL.상호).forEach(function (r) {
    if (str_(r.학년도) !== 학년도) return;
    var o = eval_상호객체_(r);
    if (o.상태 === EVAL_ST.취소) return;
    if (!맞나 || 맞나(o)) out.push(o);
  });
  return out;
}
function eval_상호행_(id) {
  var hit = null;
  rows_(EVAL.상호).forEach(function (r) { if (!hit && str_(r.상호ID) === String(id)) hit = r; });
  return hit;
}
/** 대기·교사확인 건수 */
function eval_상호수_() {
  var 대기 = 0, 확인 = 0;
  eval_상호목록_().forEach(function (o) { if (o.상태 === EVAL_ST.대기) 대기++; else if (o.상태 === EVAL_ST.확인) 확인++; });
  return { 대기: 대기, 확인: 확인 };
}
/** 이 학생에게 상호평가로 할 일이 있는지 (메뉴 노출 조건) */
function eval_학생쓸일_(학생ID) {
  var me = 학생찾기_(학생ID); if (!me) return false;
  var 켠평가 = eval_계획목록_().filter(function (p) { return p.학년 === Number(me.학년) && p.상호평가 !== 'N'; });
  if (켠평가.length) return true;
  return eval_상호목록_(function (o) { return o.대상학생ID === String(학생ID) || o.짝학생ID === String(학생ID); }).length > 0;
}

/* ---------- 교사: 짝 배정·확인 ---------- */

/** 상호평가 화면 자료. 평가ID 를 주면 그 평가만 */
function eval_t_peerBoard(token, 평가ID, 학년, 반) {
  교사확인_(token);
  var pid = str_(평가ID), g = num_(학년), c = num_(반);
  var 계획 = eval_계획목록_().filter(function (p) { return p.상호평가 !== 'N'; });
  var list = eval_상호목록_(function (o) {
    if (pid && o.평가ID !== pid) return false;
    if (g && o.학년 !== g) return false;
    if (c && o.반 !== c) return false;
    return true;
  });
  var 학생 = (g && c) ? eval_학급학생_(g, c) : [];
  var 결과 = (g && c) ? eval_반결과_(g, c, pid || null) : {};
  return { 계획: 계획, 목록: list, 학생: 학생, 결과: 결과, 설정: eval_설정_(), 수: eval_상호수_(), 학년도: eval_학년도_() };
}

/** 교사 배정. pairs = [{ 대상학생ID, 짝학생ID }] — 이미 반영된 건은 건드리지 않습니다 */
function eval_t_assignPairs(token, 평가ID, pairs) {
  교사확인_(token);
  var p = eval_계획_(str_(평가ID));
  if (!p) throw new Error('평가를 찾지 못했습니다.');
  if (p.상호평가 === 'N') throw new Error('이 평가는 상호평가를 쓰지 않습니다.');
  return withLock_(function () {
    var 학년도 = eval_학년도_(), 맵 = 학생맵_(true), now = 지금_();
    var 기존 = {};
    rows_(EVAL.상호).forEach(function (r) {
      if (str_(r.평가ID) !== p.id || str_(r.학년도) !== 학년도) return;
      기존[str_(r.대상학생ID)] = r;
    });
    var 신규 = [], 바뀜 = 0, 건너뜀 = 0;
    (pairs || []).forEach(function (x) {
      var a = 맵[String(x.대상학생ID)], b = 맵[String(x.짝학생ID)];
      if (!a || !b || a.학생ID === b.학생ID) { 건너뜀++; return; }
      var old = 기존[a.학생ID];
      if (old) {
        var st = str_(old.상태);
        if (st === EVAL_ST.완료 || st === EVAL_ST.확인) { 건너뜀++; return; }   // 이미 보낸 것은 그대로
        setCells_(EVAL.상호, EVAL_H.상호, old._row, { 짝학생ID: b.학생ID, 짝이름: b.이름, 상태: EVAL_ST.대기, 요청일시: now, 교사메모: '' });
        바뀜++;
      } else {
        신규.push({ 상호ID: makeId_('EP'), 평가ID: p.id, 학년도: 학년도, 대상학생ID: a.학생ID, 학년: a.학년, 반: a.반, 번호: a.번호, 대상이름: a.이름,
                    짝학생ID: b.학생ID, 짝이름: b.이름, 상태: EVAL_ST.대기, 요청일시: now });
      }
    });
    if (신규.length) appendRows_(EVAL.상호, EVAL_H.상호, 신규);
    return { ok: true, 새로: 신규.length, 바꿈: 바뀜, 건너뜀: 건너뜀, 목록: eval_상호목록_(function (o) { return o.평가ID === p.id; }), 수: eval_상호수_() };
  });
}

/** 교사: 짝이 보낸 것을 보고 단계를 찍어 반영 (평가_결과에 저장) */
function eval_t_peerApply(token, 상호ID, 단계, 특기사항, 평가일) {
  교사확인_(token);
  return withLock_(function () {
    var row = eval_상호행_(str_(상호ID));
    if (!row) throw new Error('상호평가 내역을 찾지 못했습니다.');
    var o = eval_상호객체_(row), p = eval_계획_(o.평가ID);
    if (!p) throw new Error('평가를 찾지 못했습니다.');
    var 단 = str_(단계);
    if (단 && p.라벨.indexOf(단) < 0) throw new Error('이 평가에 없는 단계입니다.');
    var 학년도 = eval_학년도_(), d = 날짜정리_(평가일) || 오늘_(), now = 지금_();
    var s = 학생맵_(true)[o.대상학생ID];
    if (!s) throw new Error('학생을 명단에서 찾지 못했습니다.');
    var 기존행 = null;
    rows_(EVAL.결과).forEach(function (r) { if (!기존행 && str_(r.평가ID) === p.id && str_(r.학년도) === 학년도 && str_(r.학생ID) === s.학생ID) 기존행 = r; });
    var f = { 평가ID: p.id, 학년도: 학년도, 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름,
              단계: 단, 특기사항: str_(특기사항), 평가일: d, 입력일시: now };
    if (기존행) setCells_(EVAL.결과, EVAL_H.결과, 기존행._row, f);
    else { f.결과ID = makeId_('ER'); appendRow_(EVAL.결과, EVAL_H.결과, f); }
    var 설정 = eval_설정_(), 지운파일 = 0, up = { 상태: EVAL_ST.완료, 처리일시: now };
    if (설정.인증보관 === '반영후삭제') {
      지운파일 = eval_휴지통_([o.mediaId, o.thumbId]);
      up.인증파일ID = ''; up.인증종류 = ''; up.인증썸네일ID = ''; up.인증파일명 = '';
    }
    setCells_(EVAL.상호, EVAL_H.상호, row._row, up);
    eval_캐시지우기_();
    return { ok: true, 지운파일: 지운파일, 수: eval_상호수_(), 요약: eval_요약_() };
  });
}

/** 교사: 다시 하기 (짝에게 돌려보냄) — 체크·의견은 지우고 메모를 남깁니다 */
function eval_t_peerRedo(token, 상호ID, 메모) {
  교사확인_(token);
  return withLock_(function () {
    var row = eval_상호행_(str_(상호ID));
    if (!row) throw new Error('상호평가 내역을 찾지 못했습니다.');
    setCells_(EVAL.상호, EVAL_H.상호, row._row, { 상태: EVAL_ST.대기, 응답일시: '', 기준체크: '', 짝의견: '', 교사메모: str_(메모), 요청일시: 지금_() });
    return { ok: true, 수: eval_상호수_() };
  });
}

/** 교사: 상호평가 건 삭제 (인증 파일도 휴지통으로). 평가 결과는 그대로 둡니다 */
function eval_t_peerDelete(token, 상호ID) {
  교사확인_(token);
  var id = str_(상호ID);
  return withLock_(function () {
    var row = eval_상호행_(id);
    if (!row) throw new Error('상호평가 내역을 찾지 못했습니다.');
    var o = eval_상호객체_(row);
    var n = eval_휴지통_([o.mediaId, o.thumbId]);
    행지우기_(EVAL.상호, function (x) { return str_(x.상호ID) === id; });
    return { ok: true, 지운파일: n, 수: eval_상호수_() };
  });
}

/** 교사: 인증 파일만 지우기 */
function eval_t_deleteMedia(token, 상호ID) {
  교사확인_(token);
  return withLock_(function () {
    var row = eval_상호행_(str_(상호ID));
    if (!row) throw new Error('상호평가 내역을 찾지 못했습니다.');
    var o = eval_상호객체_(row);
    var n = eval_휴지통_([o.mediaId, o.thumbId]);
    setCells_(EVAL.상호, EVAL_H.상호, row._row, { 인증파일ID: '', 인증종류: '', 인증썸네일ID: '', 인증파일명: '' });
    return { ok: true, 지운파일: n };
  });
}

function eval_t_mediaInfo(token) {
  교사확인_(token);
  var n = 0;
  rows_(EVAL.상호).forEach(function (r) { if (r.인증파일ID) n++; });
  var url = ''; try { url = eval_폴더_().getUrl(); } catch (e) {}
  return { 파일수: n, 폴더URL: url, 설정: eval_설정_() };
}

/* ---------- 학생 ---------- */

function eval_학생화면_(me) {
  var 설정 = eval_설정_(), 학년도 = eval_학년도_();
  var 계획 = eval_계획목록_().filter(function (p) { return p.학년 === Number(me.학년) && p.상호평가 !== 'N'; })
    .map(function (p) { return { id: p.id, 학기: p.학기, 평가명: p.평가명, 방법: p.방법, 시기: p.시기, 기준: p.기준, 상호평가: p.상호평가 }; });
  var 전체 = eval_상호목록_();
  var 내것 = 전체.filter(function (o) { return o.대상학생ID === me.학생ID; }).map(function (o) {
    return { id: o.id, 평가ID: o.평가ID, 짝이름: o.짝이름, 상태: o.상태, 요청: o.요청, 응답: o.응답,
             mediaId: o.mediaId, mediaType: o.mediaType, thumbId: o.thumbId };   // 단계·의견은 학생에게 보내지 않습니다
  });
  var 요청 = 전체.filter(function (o) { return o.짝학생ID === me.학생ID && o.상태 === EVAL_ST.대기; }).map(function (o) {
    return { id: o.id, 평가ID: o.평가ID, 대상이름: o.대상이름, 번호: o.번호, 요청: o.요청, 교사메모: o.교사메모 };
  });
  var 반친구 = 학생목록_(false).filter(function (s) { return s.학년 === Number(me.학년) && s.반 === Number(me.반) && s.학생ID !== me.학생ID; })
    .map(function (s) { return { 학생ID: s.학생ID, 번호: s.번호, 이름: s.이름 }; })
    .sort(function (a, b) { return a.번호 - b.번호; });
  return { 학생: { 이름: me.이름, 학년: Number(me.학년), 반: Number(me.반), 번호: Number(me.번호) },
           계획: 계획, 내것: 내것, 요청: 요청, 친구: 반친구,
           설정: { 인증자료: 설정.인증자료, 인증필수: 설정.인증필수 }, 학년도: 학년도 };
}
function eval_s_boot(token) { return eval_학생화면_(학생확인_(token)); }
function eval_s_view(token) { return eval_학생화면_(학생확인_(token)); }

/** 학생이 자기를 봐 줄 짝을 고름 (평가의 짝 지정이 '학생'일 때만) */
function eval_s_pickPeer(token, 평가ID, 짝학생ID) {
  var me = 학생확인_(token);
  var p = eval_계획_(str_(평가ID));
  if (!p) throw new Error('평가를 찾을 수 없어요.');
  if (p.상호평가 !== '학생') throw new Error('이 평가는 선생님이 짝을 정해 주세요.');
  if (p.학년 !== Number(me.학년)) throw new Error('우리 학년 평가가 아니에요.');
  var 짝 = 학생찾기_(str_(짝학생ID));
  if (!짝) throw new Error('짝을 찾을 수 없어요.');
  if (String(짝.학생ID) === me.학생ID) throw new Error('자기 자신은 고를 수 없어요.');
  if (Number(짝.학년) !== Number(me.학년) || Number(짝.반) !== Number(me.반)) throw new Error('같은 반 친구만 고를 수 있어요.');
  return withLock_(function () {
    var 학년도 = eval_학년도_(), now = 지금_(), row = null;
    rows_(EVAL.상호).forEach(function (r) {
      if (!row && str_(r.평가ID) === p.id && str_(r.학년도) === 학년도 && str_(r.대상학생ID) === me.학생ID) row = r;
    });
    if (row) {
      var st = str_(row.상태);
      if (st === EVAL_ST.완료) throw new Error('이미 선생님이 확인을 끝낸 평가예요.');
      if (st === EVAL_ST.확인) throw new Error('짝이 이미 보냈어요. 선생님 확인을 기다려요.');
      setCells_(EVAL.상호, EVAL_H.상호, row._row, { 짝학생ID: 짝.학생ID, 짝이름: 짝.이름, 상태: EVAL_ST.대기, 요청일시: now });
    } else {
      appendRow_(EVAL.상호, EVAL_H.상호, { 상호ID: makeId_('EP'), 평가ID: p.id, 학년도: 학년도, 대상학생ID: me.학생ID, 학년: me.학년, 반: me.반, 번호: me.번호,
                                          대상이름: me.이름, 짝학생ID: 짝.학생ID, 짝이름: 짝.이름, 상태: EVAL_ST.대기, 요청일시: now });
    }
    var out = eval_학생화면_(me); out.ok = true; return out;
  });
}

/** 짝 확인 전 요청 취소 (학생이 고른 경우만) */
function eval_s_cancelPeer(token, 상호ID) {
  var me = 학생확인_(token);
  return withLock_(function () {
    var row = eval_상호행_(str_(상호ID));
    if (!row || str_(row.대상학생ID) !== me.학생ID) throw new Error('요청을 찾을 수 없어요.');
    if (str_(row.상태) !== EVAL_ST.대기) throw new Error('짝이 이미 확인한 것은 취소할 수 없어요.');
    var p = eval_계획_(str_(row.평가ID));
    if (p && p.상호평가 === '교사') throw new Error('선생님이 정해 준 짝이에요.');
    행지우기_(EVAL.상호, function (x) { return str_(x.상호ID) === str_(상호ID); });
    var out = eval_학생화면_(me); out.ok = true; return out;
  });
}

/** 짝의 답. m = { 상호ID, 체크:[1,3], 의견, media:{종류,타입,본문,썸네일,파일명} } */
function eval_s_respond(token, m) {
  var me = 학생확인_(token);
  m = m || {};
  var 설정 = eval_설정_(), media = eval_인증검사_(m.media, 설정);
  var 의견 = str_(m.의견).slice(0, 300);
  if (의견.replace(/\s/g, '').length < 2) throw new Error('친구가 어떻게 했는지 한 문장이라도 적어 주세요.');
  if (설정.인증필수 && !media) throw new Error('보내려면 ' + (설정.인증자료 === '사진' ? '사진을' : '사진이나 영상을') + ' 함께 올려야 해요.');
  return withLock_(function () {
    var row = eval_상호행_(str_(m.상호ID));
    if (!row) throw new Error('요청을 찾을 수 없어요.');
    if (str_(row.짝학생ID) !== me.학생ID) throw new Error('나에게 온 요청이 아니에요.');
    if (str_(row.상태) !== EVAL_ST.대기) throw new Error('이미 보낸 요청이에요.');
    var p = eval_계획_(str_(row.평가ID));
    if (!p) throw new Error('평가를 찾을 수 없어요.');
    var now = 지금_();
    var f = { 상태: EVAL_ST.확인, 응답일시: now, 기준체크: eval_체크문자_(m.체크, p.기준.length), 짝의견: 의견 };
    if (media) {
      var 대상 = 학생찾기_(str_(row.대상학생ID)) || {};
      try {
        var saved = eval_인증저장_(대상, p, me, media);
        f.인증파일ID = saved.파일ID; f.인증종류 = media.종류; f.인증썸네일ID = saved.썸네일ID; f.인증파일명 = saved.파일명;
      } catch (e) { throw new Error((media.종류 === '영상' ? '영상' : '사진') + '을 저장하지 못했어요. 다시 해 주세요. (' + e.message + ')'); }
    }
    setCells_(EVAL.상호, EVAL_H.상호, row._row, f);
    var out = eval_학생화면_(me); out.ok = true; return out;
  });
}

/* ---------- 인증 사진·영상 ---------- */

function eval_인증검사_(m, 설정) {
  if (!m || !m.본문) return null;
  if (설정.인증자료 === '없음') return null;
  var 종류 = str_(m.종류) === '영상' ? '영상' : '사진';
  if (종류 === '영상' && 설정.인증자료 !== '사진+영상') throw new Error('영상은 올릴 수 없어요. 사진으로 올려 주세요.');
  var 타입 = str_(m.타입) || (종류 === '영상' ? 'video/mp4' : 'image/jpeg');
  if (종류 === '영상' && !/^video\//.test(타입)) throw new Error('영상 파일이 아니에요.');
  if (종류 === '사진' && !/^image\//.test(타입)) throw new Error('사진 파일이 아니에요.');
  var bytes = Math.round(String(m.본문).length * 0.75);
  if (bytes > EVAL_MEDIA_MAX) throw new Error('파일이 너무 커요 (' + Math.round(bytes / 1048576) + 'MB). 영상은 15초 안으로 짧게 찍어 주세요.');
  return { 종류: 종류, 타입: 타입, 본문: m.본문, 썸네일: str_(m.썸네일), 파일명: str_(m.파일명) };
}
function eval_폴더_() {
  var id = 속성_(EVAL_FOLDER_KEY);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var parent = null;
  try { var parents = DriveApp.getFileById(ss_().getId()).getParents(); if (parents.hasNext()) parent = parents.next(); } catch (e) {}
  var folder = (parent || DriveApp).createFolder('수행평가 상호평가 사진·영상');
  속성저장_(EVAL_FOLDER_KEY, folder.getId());
  return folder;
}
function eval_인증저장_(대상, p, 짝, media) {
  var folder = eval_폴더_();
  var ext = media.종류 === '영상' ? (/webm/.test(media.타입) ? '.webm' : /quicktime|mov/.test(media.타입) ? '.mov' : '.mp4') : '.jpg';
  var 이름 = 오늘_() + '_' + (대상.학년 || '') + '-' + (대상.반 || '') + '-' + (대상.번호 || '') + '_' + str_(대상.이름 || 대상.학생ID) + '_' + str_(p.평가명) + ext;
  이름 = 이름.replace(/[\\\/:*?"<>|]/g, '_');
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(media.본문), media.타입, 이름));
  try { file.setDescription('수행평가 상호평가 · 대상 ' + str_(대상.이름) + ' · 확인 ' + str_(짝.이름) + ' · ' + 지금_()); } catch (e) {}
  var thumb = media.썸네일 ? folder.createFile(Utilities.newBlob(Utilities.base64Decode(media.썸네일), 'image/jpeg', 'thumb_' + 이름.replace(/\.\w+$/, '') + '.jpg')) : null;
  return { 파일ID: file.getId(), 썸네일ID: thumb ? thumb.getId() : '', 파일명: 이름 };
}
function eval_휴지통_(파일ID들) {
  var n = 0;
  (파일ID들 || []).forEach(function (id) { if (!id) return; try { DriveApp.getFileById(String(id)).setTrashed(true); n++; } catch (e) {} });
  return n;
}
function eval_인증파일들_(맞나) {
  var out = [];
  rows_(EVAL.상호).forEach(function (r) { if (맞나 && !맞나(r)) return; if (r.인증파일ID) out.push(str_(r.인증파일ID)); if (r.인증썸네일ID) out.push(str_(r.인증썸네일ID)); });
  return out;
}
function eval_파일데이터_(파일ID목록, 허용) {
  var out = {};
  (파일ID목록 || []).slice(0, 60).forEach(function (id) {
    id = String(id);
    if (허용 && !허용[id]) { out[id] = ''; return; }
    try { var blob = DriveApp.getFileById(id).getBlob(); out[id] = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()); }
    catch (e) { out[id] = ''; }
  });
  return out;
}
/** 학생이 볼 수 있는 파일: 자기가 대상인 것 + 자기가 찍어 준 것 */
function eval_학생허용파일_(학생ID) {
  var 허용 = {};
  rows_(EVAL.상호).forEach(function (r) {
    if (str_(r.대상학생ID) !== String(학생ID) && str_(r.짝학생ID) !== String(학생ID)) return;
    if (r.인증파일ID) 허용[str_(r.인증파일ID)] = true;
    if (r.인증썸네일ID) 허용[str_(r.인증썸네일ID)] = true;
  });
  return 허용;
}
function eval_t_getMedia(token, 파일ID목록) { 교사확인_(token); return eval_파일데이터_(파일ID목록, null); }
function eval_s_getMedia(token, 파일ID목록) { var me = 학생확인_(token); return eval_파일데이터_(파일ID목록, eval_학생허용파일_(me.학생ID)); }
