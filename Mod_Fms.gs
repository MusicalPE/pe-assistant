/*******************************************************
 * FMS 도전 모듈 (Mod_Fms.gs)
 *
 * 단독판 FMS 도전 프로그램을 통합 뼈대 위로 옮긴 것입니다.
 *  - 학생 명단·비밀번호·로그인은 공통(Code.gs)이 맡습니다. 여기에는 명단이 없습니다.
 *  - 시트 이름은 FMS_ 접두어, 서버 함수는 fms_t_ / fms_s_ 접두어.
 *  - 기본 기준표는 FMS_Data.gs 에서 옵니다. 준거·단계는 행을 지우지 않고 사용(Y/N)으로 끕니다.
 *  - 학년군: 학년 기준(1~2 저, 3~4 중, 5~6 고) → 학생 전체 지정(FMS_학년군조정의 기술ID '전체') → 기술별 조정 순으로 우선합니다.
 *
 * 시트
 *   FMS_기술목록 : 기술ID, 범주, 기술명, 적용 학년군, 사용(Y/N), 시범 추천, 학생용 설명, 준비물
 *   FMS_준거     : 준거ID, 기술ID, 학년군, 표시 순서, 교사용 관찰 준거, 학생용 문구, 학생 화면 표시, 사용(Y/N)
 *   FMS_도전단계 : 단계ID, 기술ID, 학년군, 단계, 도전 과제, 유형, 기록 기준, 단위, 기록 방향, 필요 준거 수, 비고, 사용(Y/N)
 *   FMS_학년군조정 : 학생ID, 기술ID('전체' 또는 기술ID), 적용 학년군, 사유, 설정일
 *   FMS_피드백문구 : 문구ID, 반려·격려 문구
 *   FMS_평가기록 : 기록ID, 일시, 학생ID, 기술ID, 적용 학년군, 준거 결과(준거ID:1/0), 충족 준거 수, 평가자 유형, 평가자ID, 메모
 *   FMS_배지기록 : 신청ID, 신청 일시, 학생ID, 단계ID, 기록값, 확인 동료ID, 동료 확인 일시, 상태, 처리 일시, 피드백 문구ID, 미충족 준거ID, 동료 체크(준거ID:1/0)
 *******************************************************/

var FMS = { 기술: 'FMS_기술목록', 준거: 'FMS_준거', 단계: 'FMS_도전단계', 조정: 'FMS_학년군조정', 피드백: 'FMS_피드백문구', 평가: 'FMS_평가기록', 배지: 'FMS_배지기록' };
var FMS_H = {
  기술:   ['기술ID', '범주', '기술명', '적용 학년군', '사용(Y/N)', '시범 추천', '학생용 설명', '준비물'],
  준거:   ['준거ID', '기술ID', '학년군', '표시 순서', '교사용 관찰 준거', '학생용 문구', '학생 화면 표시', '사용(Y/N)'],
  단계:   ['단계ID', '기술ID', '학년군', '단계', '도전 과제', '유형', '기록 기준', '단위', '기록 방향', '필요 준거 수', '비고', '사용(Y/N)'],
  조정:   ['학생ID', '기술ID', '적용 학년군', '사유', '설정일'],
  피드백: ['문구ID', '반려·격려 문구'],
  평가:   ['기록ID', '일시', '학생ID', '기술ID', '적용 학년군', '준거 결과(준거ID:1/0)', '충족 준거 수', '평가자 유형', '평가자ID', '메모'],
  배지:   ['신청ID', '신청 일시', '학생ID', '단계ID', '기록값', '확인 동료ID', '동료 확인 일시', '상태', '처리 일시', '피드백 문구ID', '미충족 준거ID', '동료 체크(준거ID:1/0)']
};
var FMS_STATUS = { PEER: '동료확인대기', PEER_NO: '동료반려', PENDING: '교사승인대기', OK: '승인', NO: '반려', CANCEL: '취소' };
var FMS_BANDS = ['저', '중', '고'];
var FMS_전체 = '전체';

function fms_기본데이터_() {
  var g = { 기술: [], 준거: [], 단계: [], 피드백: [] };
  try {
    if (typeof FMS_SKILLS !== 'undefined') g.기술 = FMS_SKILLS;
    if (typeof FMS_CRITERIA !== 'undefined') g.준거 = FMS_CRITERIA;
    if (typeof FMS_LEVELS !== 'undefined') g.단계 = FMS_LEVELS.map(function (d) { return d.concat(['', 'Y']); });
    if (typeof FMS_FEEDBACK !== 'undefined') g.피드백 = FMS_FEEDBACK;
  } catch (e) {}
  return g;
}
function fms_기본있음_() { return typeof FMS_SKILLS !== 'undefined'; }

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function fms_hooks_() {
  return {
    준비확인: function () {
      var 다있음 = Object.keys(FMS).every(function (k) { return !!findSheet_(FMS[k]); });
      if (!다있음) return false;
      if (fms_기본있음_() && sheet_(FMS.기술).getLastRow() < 2) return false;
      return true;
    },
    준비: function () {
      var 만듦 = [], 색 = '#E8EFFD', d = fms_기본데이터_();
      만듦 = 만듦.concat(시트준비_(FMS.기술, FMS_H.기술, { 색: 색, 기본행: d.기술 }));
      만듦 = 만듦.concat(시트준비_(FMS.준거, FMS_H.준거, { 색: 색, 기본행: d.준거 }));
      만듦 = 만듦.concat(시트준비_(FMS.단계, FMS_H.단계, { 색: 색, 기본행: d.단계 }));
      만듦 = 만듦.concat(시트준비_(FMS.조정, FMS_H.조정, { 색: 색 }));
      만듦 = 만듦.concat(시트준비_(FMS.피드백, FMS_H.피드백, { 색: 색, 기본행: d.피드백 }));
      만듦 = 만듦.concat(시트준비_(FMS.평가, FMS_H.평가, { 색: 색 }));
      만듦 = 만듦.concat(시트준비_(FMS.배지, FMS_H.배지, { 색: 색 }));
      // 파일이 나중에 들어온 경우: 비어 있는 기준표 시트를 채움
      if (d.기술.length && sheet_(FMS.기술).getLastRow() < 2) { appendRows_(FMS.기술, FMS_H.기술, d.기술.map(fms_행객체_(FMS_H.기술))); 만듦.push('FMS 기술 ' + d.기술.length + '개'); }
      if (d.준거.length && sheet_(FMS.준거).getLastRow() < 2) appendRows_(FMS.준거, FMS_H.준거, d.준거.map(fms_행객체_(FMS_H.준거)));
      if (d.단계.length && sheet_(FMS.단계).getLastRow() < 2) appendRows_(FMS.단계, FMS_H.단계, d.단계.map(fms_행객체_(FMS_H.단계)));
      if (d.피드백.length && sheet_(FMS.피드백).getLastRow() < 2) appendRows_(FMS.피드백, FMS_H.피드백, d.피드백.map(fms_행객체_(FMS_H.피드백)));
      if (!fms_기본있음_() && sheet_(FMS.기술).getLastRow() < 2) 만듦.push('FMS 기준표 비어 있음 (FMS_Data.gs 파일을 넣어 주세요)');
      fms_캐시지우기_();
      return 만듦;
    },
    캐시지우기: fms_캐시지우기_,
    학생참여: function (학생ID) { return true; },
    교사대시보드: function () {
      var 대기 = 0, 짝 = 0;
      rows_(FMS.배지).forEach(function (r) { var s = str_(r.상태); if (s === FMS_STATUS.PENDING) 대기++; if (s === FMS_STATUS.PEER) 짝++; });
      return { 카드: [
        { 제목: '승인 기다리는 도전', 값: 대기, 단위: '건', 배지: 대기 || '', 설명: 짝 ? '짝 확인 중 ' + 짝 + '건' : (대기 ? '짝이 확인한 도전입니다' : '기다리는 도전이 없습니다'), 이동: 'pending' }
      ], 대기: 대기 };
    },
    학생배지: function (학생ID) {
      var me = 학생찾기_(학생ID); if (!me) return [];
      var app = fms_appData_(), stu = fms_학생객체_(me), adj = fms_조정맵_()[학생ID] || {};
      var apps = rows_(FMS.배지).filter(function (r) { return str_(r.학생ID) === 학생ID; }).map(fms_배지객체_);
      var out = [];
      app.skills.forEach(function (k) {
        var band = adj[k.id] || stu.band;
        app.levels.filter(function (l) { return l.skillId === k.id && l.band === band; }).forEach(function (l) {
          var st = fms_단계상태_(apps, l.id);
          out.push({ id: 'FMS-' + l.id, 이름: k.name + ' ' + l.step + '단계', 설명: l.task, 아이콘: 'run', 달성: st.s === 'ok', 진행: st.s === 'ok' ? 100 : (st.s === 'wait' || st.s === 'peer' ? 50 : 0), 상태: st.s });
        });
      });
      return out;
    },
    학생프로필: function (학생ID) {
      var me = 학생찾기_(학생ID); if (!me) return null;
      var app = fms_appData_(), stu = fms_학생객체_(me), adj = fms_조정맵_()[학생ID] || {};
      var apps = rows_(FMS.배지).filter(function (r) { return str_(r.학생ID) === 학생ID; }).map(fms_배지객체_);
      var 총 = 0, 통과 = 0, 도전중 = 0, 반려 = null, 대기 = 0;
      app.skills.forEach(function (k) {
        var band = adj[k.id] || stu.band;
        var lv = app.levels.filter(function (l) { return l.skillId === k.id && l.band === band; });
        if (!lv.length) return;
        var cur = null;
        lv.sort(function (a, b) { return a.step - b.step; }).forEach(function (l) {
          총++;
          var st = fms_단계상태_(apps, l.id);
          if (st.s === 'ok') 통과++;
          else if (cur === null) { cur = st; if (st.s === 'no' && st.app) 반려 = { 기술: k.name, 단계: l.step }; if (st.s === 'wait') 대기++; }
        });
        if (cur !== null) 도전중++;
      });
      var 요청 = rows_(FMS.배지).filter(function (r) { return str_(r['확인 동료ID']) === 학생ID && str_(r.상태) === FMS_STATUS.PEER; }).length;
      return {
        제목: 'FMS 배지 ' + 통과 + '/' + 총 + '개', 값: 통과, 단위: '개', 진행: 총 ? Math.round(통과 / 총 * 100) : 0,
        설명: '도전 중인 기술 ' + 도전중 + '개' + (대기 ? ' · 선생님 확인 중 ' + 대기 + '건' : ''),
        알림: 요청 ? 'FMS: 친구 ' + 요청 + '명이 확인을 기다려요' : (반려 ? 'FMS: ' + 반려.기술 + ' ' + 반려.단계 + '단계를 다시 도전해요' : ''),
        요약: { 이름: 'FMS 배지', 값: 통과, 단위: '개' },
        이동: 요청 ? 'requests' : 'home'
      };
    },
    초기화정보: function () {
      return [
        { key: '기록', 이름: '평가기록·배지기록', 수: rows_(FMS.평가).length + rows_(FMS.배지).length },
        { key: '조정', 이름: '학년군 지정·기술별 조정', 수: rows_(FMS.조정).length },
        { key: '기준표', 이름: '기술·준거·단계·피드백 문구 → 기본값으로 (FMS_Data.gs)', 수: rows_(FMS.기술).length + rows_(FMS.준거).length + rows_(FMS.단계).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var 전부 = function () { return true; }, res = {};
      if (opts.기록) { res.평가 = 행지우기_(FMS.평가, 전부); res.배지 = 행지우기_(FMS.배지, 전부); }
      if (opts.조정) res.조정 = 행지우기_(FMS.조정, 전부);
      if (opts.기준표) {
        var d = fms_기본데이터_();
        if (!d.기술.length) res.기준표 = 'FMS_Data.gs 없음';
        else {
          시트비우기_(FMS.기술); appendRows_(FMS.기술, FMS_H.기술, d.기술.map(fms_행객체_(FMS_H.기술)));
          시트비우기_(FMS.준거); appendRows_(FMS.준거, FMS_H.준거, d.준거.map(fms_행객체_(FMS_H.준거)));
          시트비우기_(FMS.단계); appendRows_(FMS.단계, FMS_H.단계, d.단계.map(fms_행객체_(FMS_H.단계)));
          시트비우기_(FMS.피드백); appendRows_(FMS.피드백, FMS_H.피드백, d.피드백.map(fms_행객체_(FMS_H.피드백)));
          res.기준표 = true;
        }
      }
      fms_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var 맞나 = function (o) { return set[str_(o.학생ID)] === true; };
      return { 평가: 행지우기_(FMS.평가, 맞나), 배지: 행지우기_(FMS.배지, 맞나), 조정: 행지우기_(FMS.조정, 맞나) };
    }
  };
}

function fms_행객체_(headers) { return function (r) { var o = {}; headers.forEach(function (h, i) { o[h] = r[i] === undefined ? '' : r[i]; }); return o; }; }
function fms_yn_(v) { return str_(v).toUpperCase() !== 'N'; }
function fms_캐시지우기_() { 캐시지우기_('fms_app'); }

/* ================= 기준표 (기술·준거·단계·피드백) ================= */

/** 화면용 기준표 (사용 Y만, 캐시) */
function fms_appData_() {
  return 캐시_('fms_app', function () {
    var all = fms_standards_();
    return {
      skills: all.skills.filter(function (k) { return k.use; }),
      criteria: all.criteria.filter(function (c) { return c.use; }),
      levels: all.levels.filter(function (l) { return l.use; }),
      feedback: all.feedback
    };
  });
}

/** 기준표 전체 (사용 N 포함) */
function fms_standards_() {
  var criteria = rows_(FMS.준거).map(function (r) {
    return { id: str_(r.준거ID), skillId: str_(r.기술ID), band: str_(r.학년군), order: num_(r['표시 순서']) || 0,
      teacher: str_(r['교사용 관찰 준거']), student: str_(r['학생용 문구']) || str_(r['교사용 관찰 준거']), show: fms_yn_(r['학생 화면 표시']), use: fms_yn_(r['사용(Y/N)']) };
  }).filter(function (c) { return c.id; });
  criteria.sort(function (a, b) {
    if (a.skillId !== b.skillId) return a.skillId < b.skillId ? -1 : 1;
    if (a.band !== b.band) return FMS_BANDS.indexOf(a.band) - FMS_BANDS.indexOf(b.band);
    return a.order - b.order;
  });
  return {
    skills: rows_(FMS.기술).map(function (r) {
      return { id: str_(r.기술ID), category: str_(r.범주), name: str_(r.기술명), desc: str_(r['학생용 설명']), gear: str_(r.준비물), bands: str_(r['적용 학년군']), use: fms_yn_(r['사용(Y/N)']) };
    }).filter(function (k) { return k.id; }),
    criteria: criteria,
    levels: rows_(FMS.단계).map(function (r) {
      return { id: str_(r.단계ID), skillId: str_(r.기술ID), band: str_(r.학년군), step: num_(r.단계) || 0, task: str_(r['도전 과제']),
        type: str_(r.유형) || '준거', target: num_(r['기록 기준']), unit: str_(r.단위), dir: str_(r['기록 방향']) === '이하' ? '이하' : '이상',
        need: num_(r['필요 준거 수']), note: str_(r.비고), use: fms_yn_(r['사용(Y/N)']) };
    }).filter(function (l) { return l.id; }).sort(function (a, b) { return a.step - b.step; }),
    feedback: rows_(FMS.피드백).map(function (r) { return { id: str_(r.문구ID), text: str_(r['반려·격려 문구']) }; }).filter(function (f) { return f.id; })
  };
}

function fms_단계찾기_(levelId, onlyUsed) {
  var hit = null;
  rows_(FMS.단계).forEach(function (r) { if (!hit && str_(r.단계ID) === levelId && (!onlyUsed || fms_yn_(r['사용(Y/N)']))) hit = r; });
  if (!hit) return null;
  return { id: str_(hit.단계ID), skillId: str_(hit.기술ID), band: str_(hit.학년군), step: num_(hit.단계) || 0, task: str_(hit['도전 과제']),
    type: str_(hit.유형) || '준거', target: num_(hit['기록 기준']), unit: str_(hit.단위), dir: str_(hit['기록 방향']) === '이하' ? '이하' : '이상', need: num_(hit['필요 준거 수']) };
}

/* ================= 학생·학년군 ================= */

function fms_학년군_(g) { if (!g) return ''; return g <= 2 ? '저' : (g <= 4 ? '중' : '고'); }

/** { 학생ID: { 기술ID|'전체': 학년군 } } */
function fms_조정맵_() {
  var map = {};
  rows_(FMS.조정).forEach(function (r) {
    var sid = str_(r.학생ID), kid = str_(r.기술ID) || FMS_전체, b = str_(r['적용 학년군']);
    if (!sid || FMS_BANDS.indexOf(b) < 0) return;
    if (!map[sid]) map[sid] = {};
    map[sid][kid] = b;
  });
  return map;
}

/** 공통 학생 → FMS 학생 객체 (영문 키: 화면 코드가 단독판과 같게) */
function fms_학생객체_(s, 조정) {
  var fix = 조정 && 조정[s.학생ID] ? 조정[s.학생ID][FMS_전체] : '';
  var base = fms_학년군_(s.학년), fixed = FMS_BANDS.indexOf(fix) >= 0;
  return { id: s.학생ID, grade: s.학년, cls: s.반, no: s.번호, name: s.이름, memo: s.비고 || '', band: fixed ? fix : base, baseBand: base, bandFixed: fixed };
}
function fms_학생들_() {
  var 조정 = fms_조정맵_();
  return 학생목록_(false).map(function (s) { return fms_학생객체_(s, 조정); });
}
/** 기술별 조정만 (전체 지정 제외) */
function fms_기술조정_(조정) {
  var out = {};
  Object.keys(조정).forEach(function (sid) {
    Object.keys(조정[sid]).forEach(function (kid) { if (kid === FMS_전체) return; if (!out[sid]) out[sid] = {}; out[sid][kid] = 조정[sid][kid]; });
  });
  return out;
}

function fms_배지객체_(r) {
  return { id: str_(r.신청ID), at: 시각문자_(r['신청 일시']), studentId: str_(r.학생ID), levelId: str_(r.단계ID), record: str_(r.기록값),
    peerId: str_(r['확인 동료ID']), peerAt: 시각문자_(r['동료 확인 일시']), status: str_(r.상태), decidedAt: 시각문자_(r['처리 일시']),
    feedbackId: str_(r['피드백 문구ID']), unmet: fms_ids_(r['미충족 준거ID']), peerResults: fms_결과맵_(r['동료 체크(준거ID:1/0)']) };
}
function fms_ids_(v) { return str_(v).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; }); }
function fms_결과맵_(v) {
  var o = {};
  str_(v).split(',').forEach(function (p) { var kv = p.split(':'), id = (kv[0] || '').trim(); if (id) o[id] = Number((kv[1] || '0').trim()) === 1 ? 1 : 0; });
  return o;
}
function fms_결과정리_(arr) { return (arr || []).filter(function (x) { return x && str_(x.id); }).map(function (x) { return { id: str_(x.id), met: !!x.met }; }); }
function fms_결과문자_(arr) { return arr.map(function (x) { return x.id + ':' + (x.met ? 1 : 0); }).join(', '); }

/** 단계 상태 (서버용): ok · peer · wait · no · peerno · none */
function fms_단계상태_(apps, levelId) {
  var last = null, ok = false;
  apps.forEach(function (a) { if (a.levelId !== levelId || a.status === FMS_STATUS.CANCEL) return; if (a.status === FMS_STATUS.OK) ok = true; last = a; });
  if (ok) return { s: 'ok', app: null };
  var map = {}; map[FMS_STATUS.PEER] = 'peer'; map[FMS_STATUS.PENDING] = 'wait'; map[FMS_STATUS.NO] = 'no'; map[FMS_STATUS.PEER_NO] = 'peerno';
  if (last && map[last.status]) return { s: map[last.status], app: last };
  return { s: 'none', app: null };
}

/* ================= 공용 API ================= */

/** 기술·준거·단계·피드백 (교사·학생 모두) */
function fms_getAppData(token) { 세션_(token); return fms_appData_(); }

/* ================= 교사 API ================= */

function fms_t_boot(token) {
  교사확인_(token);
  var 조정 = fms_조정맵_();
  var students = 학생목록_(false).map(function (s) { return fms_학생객체_(s, 조정); });
  var approved = {}, pending = [], peerWaiting = 0;
  rows_(FMS.배지).map(fms_배지객체_).forEach(function (b) {
    if (b.status === FMS_STATUS.PEER) peerWaiting++;
    if (b.status === FMS_STATUS.OK) { if (!approved[b.studentId]) approved[b.studentId] = {}; approved[b.studentId][b.levelId] = 1; }
    else if (b.status === FMS_STATUS.PENDING) pending.push(b);
  });
  var latest = {};
  rows_(FMS.평가).forEach(function (r) {
    if (str_(r['평가자 유형']) !== '교사') return;
    var sid = str_(r.학생ID), kid = str_(r.기술ID);
    if (!latest[sid]) latest[sid] = {};
    latest[sid][kid] = { band: str_(r['적용 학년군']), at: 시각문자_(r.일시), results: fms_결과맵_(r['준거 결과(준거ID:1/0)']) };
  });
  return { students: students, adjust: fms_기술조정_(조정), approved: approved, pending: pending, latestTeacher: latest, peerWaiting: peerWaiting, app: fms_appData_() };
}

function fms_t_pending(token) {
  교사확인_(token);
  return rows_(FMS.배지).map(fms_배지객체_).filter(function (b) { return b.status === FMS_STATUS.PENDING; });
}

/** 교사 관찰평가 저장. p = { studentId, skillId, band, results:[{id,met}], memo } */
function fms_t_saveEvaluation(token, p) {
  교사확인_(token);
  p = p || {};
  return fms_평가저장_(str_(p.studentId), '교사', '교사', p);
}
function fms_평가저장_(studentId, type, evaluatorId, p) {
  var results = fms_결과정리_(p.results);
  if (!studentId || !str_(p.skillId) || !results.length) throw new Error('평가 내용이 비어 있습니다.');
  return withLock_(function () {
    var id = makeId_('E'), now = 지금_();
    appendRow_(FMS.평가, FMS_H.평가, { 기록ID: id, 일시: now, 학생ID: studentId, 기술ID: str_(p.skillId), '적용 학년군': str_(p.band),
      '준거 결과(준거ID:1/0)': fms_결과문자_(results), '충족 준거 수': results.filter(function (x) { return x.met; }).length,
      '평가자 유형': type, 평가자ID: evaluatorId, 메모: str_(p.memo) });
    return { ok: true, id: id, at: now };
  });
}

/** 승인·반려. p = { appId, approve, feedbackId, unmet:[] } */
function fms_t_decide(token, p) {
  교사확인_(token);
  p = p || {};
  var appId = str_(p.appId), approve = !!p.approve;
  return withLock_(function () {
    var row = null;
    rows_(FMS.배지).forEach(function (r) { if (!row && str_(r.신청ID) === appId) row = r; });
    if (!row) throw new Error('신청 내역을 찾을 수 없습니다.');
    if (str_(row.상태) !== FMS_STATUS.PENDING) throw new Error('이미 처리된 신청입니다.');
    var f = { 상태: approve ? FMS_STATUS.OK : FMS_STATUS.NO, '처리 일시': 지금_(), '피드백 문구ID': approve ? '' : str_(p.feedbackId) };
    if (!approve) f['미충족 준거ID'] = (p.unmet || []).map(str_).filter(function (x) { return x; }).join(', ');
    setCells_(FMS.배지, FMS_H.배지, row._row, f);
    return { ok: true };
  });
}

/** 학생 전체 학년군 지정. band = '저'|'중'|'고'|'' (''=학년 기준으로) */
function fms_t_setStudentBands(token, ids, band) {
  교사확인_(token);
  band = str_(band);
  if (band && FMS_BANDS.indexOf(band) < 0) return { ok: false, message: '학년군은 저·중·고 중에서 골라 주세요.' };
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  var 맵 = 학생맵_(false), n = 0;
  return withLock_(function () {
    행지우기_(FMS.조정, function (o) { return set[str_(o.학생ID)] && (str_(o.기술ID) === FMS_전체 || !str_(o.기술ID)); });
    var rows = [];
    Object.keys(set).forEach(function (id) { if (!맵[id]) return; n++; if (band) rows.push({ 학생ID: id, 기술ID: FMS_전체, '적용 학년군': band, 사유: '', 설정일: 오늘_() }); });
    if (rows.length) appendRows_(FMS.조정, FMS_H.조정, rows);
    return { ok: n > 0, count: n, students: fms_학생들_(), adjust: fms_기술조정_(fms_조정맵_()), message: n ? '' : '바꿀 학생이 없습니다.' };
  });
}

/** 한 학생의 기술별 학년군 조정. map = { 기술ID: '저'|'중'|'고'|'' } */
function fms_t_saveSkillBands(token, studentId, map, reason) {
  교사확인_(token);
  studentId = str_(studentId);
  if (!학생찾기_(studentId)) return { ok: false, message: '학생을 찾을 수 없습니다.' };
  var skills = {};
  rows_(FMS.기술).forEach(function (r) { skills[str_(r.기술ID)] = true; });
  return withLock_(function () {
    행지우기_(FMS.조정, function (o) { return str_(o.학생ID) === studentId && str_(o.기술ID) && str_(o.기술ID) !== FMS_전체; });
    var rows = [], today = 오늘_();
    Object.keys(map || {}).forEach(function (kid) {
      var b = str_(map[kid]);
      if (!skills[kid] || FMS_BANDS.indexOf(b) < 0) return;
      rows.push({ 학생ID: studentId, 기술ID: kid, '적용 학년군': b, 사유: str_(reason), 설정일: today });
    });
    if (rows.length) appendRows_(FMS.조정, FMS_H.조정, rows);
    return { ok: true, count: rows.length, adjust: fms_기술조정_(fms_조정맵_()) };
  });
}

function fms_t_getStandards(token) { 교사확인_(token); return fms_standards_(); }

/** 기술 추가·수정. s = { id?, category, name, desc, gear, bands, use } */
function fms_t_saveSkill(token, s) {
  교사확인_(token);
  s = s || {};
  var name = str_(s.name), category = str_(s.category);
  if (!name) return { ok: false, message: '기술 이름을 입력해 주세요.' };
  if (['이동', '비이동', '조작'].indexOf(category) < 0) return { ok: false, message: '범주는 이동·비이동·조작 중에서 골라 주세요.' };
  return withLock_(function () {
    var rows = rows_(FMS.기술), id = str_(s.id);
    var f = { 범주: category, 기술명: name, '학생용 설명': str_(s.desc), 준비물: str_(s.gear), '적용 학년군': str_(s.bands) || '저·중·고', '사용(Y/N)': s.use === false ? 'N' : 'Y' };
    if (id) {
      var row = null; rows.forEach(function (r) { if (str_(r.기술ID) === id) row = r; });
      if (!row) return { ok: false, message: '기술을 찾을 수 없습니다.' };
      setCells_(FMS.기술, FMS_H.기술, row._row, f);
    } else {
      var max = 0;
      rows.forEach(function (r) { var m = /^S([0-9]+)$/.exec(str_(r.기술ID)); if (m) max = Math.max(max, Number(m[1])); });
      id = 'S' + ('0' + (max + 1)).slice(-2);
      f.기술ID = id; f['시범 추천'] = '';
      appendRow_(FMS.기술, FMS_H.기술, f);
    }
    fms_캐시지우기_();
    return { ok: true, id: id, standards: fms_standards_() };
  });
}

/** 한 기술·한 학년군의 준거와 단계 저장. p = { skillId, band, criteria:[...], levels:[...] } (행은 지우지 않고 사용 N으로) */
function fms_t_saveStandards(token, p) {
  교사확인_(token);
  p = p || {};
  var skillId = str_(p.skillId), band = str_(p.band);
  if (FMS_BANDS.indexOf(band) < 0) return { ok: false, message: '학년군이 올바르지 않습니다.' };
  if (!rows_(FMS.기술).some(function (r) { return str_(r.기술ID) === skillId; })) return { ok: false, message: '기술을 찾을 수 없습니다.' };
  var crit = (p.criteria || []).filter(function (c) { return str_(c.id) || str_(c.teacher); });
  for (var i = 0; i < crit.length; i++) if (!str_(crit[i].teacher)) return { ok: false, message: (i + 1) + '번째 준거의 교사용 문장이 비어 있습니다.' };
  var activeCrit = crit.filter(function (c) { return c.use !== false; }).length;
  var lv = (p.levels || []).filter(function (l) { return str_(l.id) || str_(l.task); });
  var steps = {};
  for (var j = 0; j < lv.length; j++) {
    var l = lv[j], label = (j + 1) + '번째 단계: ';
    if (!str_(l.task)) return { ok: false, message: label + '도전 과제가 비어 있습니다.' };
    var type = str_(l.type), step = num_(l.step);
    if (['기록', '준거', '혼합'].indexOf(type) < 0) return { ok: false, message: label + '유형을 골라 주세요.' };
    if (!step || step < 1 || Math.floor(step) !== step) return { ok: false, message: label + '단계는 1 이상의 정수로 입력해 주세요.' };
    if (l.use !== false) { if (steps[step]) return { ok: false, message: step + '단계가 두 번 있습니다.' }; steps[step] = true; }
    if (type !== '준거' && num_(l.target) === null) return { ok: false, message: label + '기록 기준 숫자를 입력해 주세요.' };
    if (type !== '기록') {
      var need = num_(l.need);
      if (!need || need < 1) return { ok: false, message: label + '필요 준거 수를 입력해 주세요.' };
      if (l.use !== false && need > activeCrit) return { ok: false, message: label + '필요 준거 수(' + need + ')가 사용 중인 준거 수(' + activeCrit + ')보다 많습니다.' };
    }
  }
  return withLock_(function () {
    var critRows = rows_(FMS.준거), levelRows = rows_(FMS.단계), prefix = skillId + '-' + band + '-';
    var nextSeq = function (rows, key) {
      var max = 0;
      rows.forEach(function (r) { var id = str_(r[key]); if (id.indexOf(prefix) === 0) { var n = Number(id.slice(prefix.length)); if (!isNaN(n)) max = Math.max(max, n); } });
      return max + 1;
    };
    var cSeq = nextSeq(critRows, '준거ID'), lSeq = nextSeq(levelRows, '단계ID'), newC = [], newL = [];
    crit.forEach(function (c, idx) {
      var f = { '표시 순서': num_(c.order) || idx + 1, '교사용 관찰 준거': str_(c.teacher), '학생용 문구': str_(c.student) || str_(c.teacher), '학생 화면 표시': c.show === false ? 'N' : 'Y', '사용(Y/N)': c.use === false ? 'N' : 'Y' };
      var row = null; if (str_(c.id)) critRows.forEach(function (r) { if (str_(r.준거ID) === str_(c.id)) row = r; });
      if (row) setCells_(FMS.준거, FMS_H.준거, row._row, f);
      else { f.준거ID = prefix + (cSeq++); f.기술ID = skillId; f.학년군 = band; newC.push(f); }
    });
    lv.forEach(function (l) {
      var type = str_(l.type);
      var f = { 단계: num_(l.step), '도전 과제': str_(l.task), 유형: type, '기록 기준': type === '준거' ? '' : num_(l.target), 단위: type === '준거' ? '' : str_(l.unit),
        '기록 방향': type === '준거' ? '' : (str_(l.dir) === '이하' ? '이하' : '이상'), '필요 준거 수': type === '기록' ? '' : num_(l.need), 비고: str_(l.note), '사용(Y/N)': l.use === false ? 'N' : 'Y' };
      var row = null; if (str_(l.id)) levelRows.forEach(function (r) { if (str_(r.단계ID) === str_(l.id)) row = r; });
      if (row) setCells_(FMS.단계, FMS_H.단계, row._row, f);
      else { f.단계ID = prefix + (lSeq++); f.기술ID = skillId; f.학년군 = band; newL.push(f); }
    });
    if (newC.length) appendRows_(FMS.준거, FMS_H.준거, newC);
    if (newL.length) appendRows_(FMS.단계, FMS_H.단계, newL);
    fms_캐시지우기_();
    return { ok: true, standards: fms_standards_() };
  });
}

/** 피드백 문구 저장. list = [{ id?, text }] */
function fms_t_saveFeedback(token, list) {
  교사확인_(token);
  return withLock_(function () {
    var rows = rows_(FMS.피드백), max = 0, add = [];
    rows.forEach(function (r) { var m = /^FB([0-9]+)$/.exec(str_(r.문구ID)); if (m) max = Math.max(max, Number(m[1])); });
    (list || []).forEach(function (f) {
      var text = str_(f.text), id = str_(f.id), row = null;
      if (id) rows.forEach(function (r) { if (str_(r.문구ID) === id) row = r; });
      if (row) { if (text) setCells_(FMS.피드백, FMS_H.피드백, row._row, { '반려·격려 문구': text }); }
      else if (text) { max++; add.push({ 문구ID: 'FB' + ('0' + max).slice(-2), '반려·격려 문구': text }); }
    });
    if (add.length) appendRows_(FMS.피드백, FMS_H.피드백, add);
    fms_캐시지우기_();
    return { ok: true, standards: fms_standards_() };
  });
}

/* ================= 학생 API ================= */

function fms_학생화면_(me) {
  var 조정 = fms_조정맵_(), all = 학생목록_(false).map(function (s) { return fms_학생객체_(s, 조정); });
  var byId = {}; all.forEach(function (s) { byId[s.id] = s; });
  var badgeRows = rows_(FMS.배지);
  var apps = badgeRows.filter(function (r) { return str_(r.학생ID) === me.학생ID; }).map(fms_배지객체_);
  var requests = badgeRows.filter(function (r) { return str_(r['확인 동료ID']) === me.학생ID && str_(r.상태) === FMS_STATUS.PEER; }).map(function (r) {
    var who = byId[str_(r.학생ID)];
    return { id: str_(r.신청ID), at: 시각문자_(r['신청 일시']), levelId: str_(r.단계ID),
      requester: who ? { name: who.name, grade: who.grade, cls: who.cls, no: who.no } : { name: '(명단에 없음)', grade: 0, cls: '', no: 0 } };
  });
  var peers = all.filter(function (s) { return s.id !== me.학생ID; }).map(function (s) { return { id: s.id, grade: s.grade, cls: s.cls, no: s.no, name: s.name }; });
  var stu = byId[me.학생ID] || fms_학생객체_(학생찾기_(me.학생ID) || { 학생ID: me.학생ID, 학년: me.학년, 반: me.반, 번호: me.번호, 이름: me.이름 }, 조정);
  return { student: stu, adjust: (fms_기술조정_(조정))[me.학생ID] || {}, applications: apps, peers: peers, requests: requests };
}

function fms_s_boot(token) {
  var me = 학생확인_(token);
  var v = fms_학생화면_(me);
  v.app = fms_appData_();
  return v;
}
function fms_s_view(token) { return fms_학생화면_(학생확인_(token)); }

/** 혼자 체크하기 저장. p = { skillId, band, results } */
function fms_s_saveSelf(token, p) {
  var me = 학생확인_(token);
  return fms_평가저장_(me.학생ID, '자기', me.학생ID, p || {});
}

/** 짝에게 확인 요청 */
function fms_s_submit(token, levelId, peerId) {
  var me = 학생확인_(token);
  levelId = str_(levelId); peerId = str_(peerId);
  if (!levelId) throw new Error('신청 정보가 비어 있습니다.');
  if (!peerId) throw new Error('확인해 줄 짝을 골라 주세요.');
  if (peerId === me.학생ID) throw new Error('자기 자신은 확인할 수 없어요. 짝을 골라 주세요.');
  if (!학생찾기_(peerId)) throw new Error('짝 정보를 찾을 수 없어요.');
  if (!fms_단계찾기_(levelId, true)) throw new Error('도전 단계를 찾을 수 없습니다.');
  return withLock_(function () {
    var dup = null;
    rows_(FMS.배지).forEach(function (r) {
      var st = str_(r.상태);
      if (!dup && str_(r.학생ID) === me.학생ID && str_(r.단계ID) === levelId && (st === FMS_STATUS.PEER || st === FMS_STATUS.PENDING || st === FMS_STATUS.OK)) dup = st;
    });
    if (dup) throw new Error(dup === FMS_STATUS.OK ? '이미 통과한 단계예요.' : dup === FMS_STATUS.PEER ? '이미 짝에게 확인을 요청했어요.' : '이미 선생님 확인을 기다리고 있어요.');
    appendRow_(FMS.배지, FMS_H.배지, { 신청ID: makeId_('B'), '신청 일시': 지금_(), 학생ID: me.학생ID, 단계ID: levelId, 기록값: '', '확인 동료ID': peerId, 상태: FMS_STATUS.PEER });
    return { ok: true };
  });
}

/** 짝의 답. p = { appId, confirm, record, results:[{id,met}], comment } */
function fms_s_peerRespond(token, p) {
  var me = 학생확인_(token);
  p = p || {};
  var appId = str_(p.appId), confirm = !!p.confirm, record = (p.record === null || p.record === undefined) ? '' : str_(p.record), results = fms_결과정리_(p.results);
  return withLock_(function () {
    var row = null;
    rows_(FMS.배지).forEach(function (r) { if (!row && str_(r.신청ID) === appId) row = r; });
    if (!row) throw new Error('요청을 찾을 수 없어요.');
    if (str_(row['확인 동료ID']) !== me.학생ID) throw new Error('나에게 온 요청이 아니에요.');
    if (str_(row.상태) !== FMS_STATUS.PEER) throw new Error('이미 처리되었거나 취소된 요청이에요.');
    var level = fms_단계찾기_(str_(row.단계ID), false);
    if (!level) throw new Error('도전 단계를 찾을 수 없습니다.');
    if (confirm && (level.type === '기록' || level.type === '혼합') && record === '') throw new Error('기록을 적어 주세요.');
    if (record !== '' && isNaN(Number(record))) throw new Error('기록은 숫자로 적어 주세요.');
    var now = 지금_();
    if (results.length) {
      appendRow_(FMS.평가, FMS_H.평가, { 기록ID: makeId_('E'), 일시: now, 학생ID: str_(row.학생ID), 기술ID: level.skillId, '적용 학년군': level.band,
        '준거 결과(준거ID:1/0)': fms_결과문자_(results), '충족 준거 수': results.filter(function (x) { return x.met; }).length, '평가자 유형': '동료', 평가자ID: me.학생ID, 메모: str_(p.comment) });
    }
    setCells_(FMS.배지, FMS_H.배지, row._row, { 상태: confirm ? FMS_STATUS.PENDING : FMS_STATUS.PEER_NO, '동료 확인 일시': now, 기록값: record === '' ? '' : Number(record),
      '동료 체크(준거ID:1/0)': fms_결과문자_(results), '미충족 준거ID': results.filter(function (x) { return !x.met; }).map(function (x) { return x.id; }).join(', ') });
    return { ok: true, status: confirm ? FMS_STATUS.PENDING : FMS_STATUS.PEER_NO };
  });
}

/** 짝 확인 전 요청 취소 */
function fms_s_cancel(token, appId) {
  var me = 학생확인_(token);
  appId = str_(appId);
  return withLock_(function () {
    var row = null;
    rows_(FMS.배지).forEach(function (r) { if (!row && str_(r.신청ID) === appId) row = r; });
    if (!row || str_(row.학생ID) !== me.학생ID) throw new Error('요청을 찾을 수 없어요.');
    if (str_(row.상태) !== FMS_STATUS.PEER) throw new Error('짝이 이미 확인한 요청은 취소할 수 없어요.');
    setCells_(FMS.배지, FMS_H.배지, row._row, { 상태: FMS_STATUS.CANCEL });
    return { ok: true };
  });
}
