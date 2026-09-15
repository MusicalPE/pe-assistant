/*******************************************************
 * 스포츠클럽 모듈 (Mod_Club.gs) — 교사 전용
 *
 * 단독판 "스포츠클럽 활동 관리"(브라우저 저장)를 통합 뼈대 위로 옮긴 것입니다.
 *  - 클럽은 여러 개 둘 수 있습니다 (클럽_클럽 시트 한 줄이 클럽 하나).
 *  - 참가 학생은 공통 학생 명단에서 고릅니다. 별도 명렬 붙여넣기는 없습니다.
 *  - 학교명·학교장·담당자·전화·이메일은 공통 설정을 씁니다. 주소·직위만 클럽에 둡니다.
 *  - 사진은 드라이브 폴더("스포츠클럽 사진·보고서")에 저장하고 시트에는 파일ID만 둡니다.
 *  - 정산보고서(인쇄·Word)는 화면에서 만듭니다. 서버는 자료와 사진만 내려줍니다.
 *
 * 시트
 *   클럽_클럽   : 클럽ID, 학년도, 이름, 종목, 대상, 운영시작, 운영종료, 활동시간대, 활동장소, 목표시간, 배정예산, 개요, 내용, 결과, 직위, 주소, 등록일
 *   클럽_참가자 : 클럽ID, 학생ID, 이름, 비고, 등록일
 *   클럽_활동   : 활동ID, 클럽ID, 날짜, 시작, 종료, 분, 유형, 장소, 내용, 비고, 참여학생ID, 참여수, 입력일시
 *   클럽_대회   : 대회ID, 클럽ID, 일자, 대회명, 주최, 장소, 결과, 인원, 비고
 *   클럽_예산   : 예산ID, 클럽ID, 항목, 세부, 단가, 수량, 금액, 집행일, 비고
 *   클럽_사진   : 사진ID, 클럽ID, 날짜, 설명, 파일ID, 썸네일ID, 파일명, 업로드일시
 *******************************************************/

var CLUB = { 클럽: '클럽_클럽', 참가자: '클럽_참가자', 활동: '클럽_활동', 대회: '클럽_대회', 예산: '클럽_예산', 사진: '클럽_사진' };
var CLUB_H = {
  클럽:   ['클럽ID', '학년도', '이름', '종목', '대상', '운영시작', '운영종료', '활동시간대', '활동장소', '목표시간', '배정예산', '개요', '내용', '결과', '직위', '주소', '등록일'],
  참가자: ['클럽ID', '학생ID', '이름', '비고', '등록일'],
  활동:   ['활동ID', '클럽ID', '날짜', '시작', '종료', '분', '유형', '장소', '내용', '비고', '참여학생ID', '참여수', '입력일시'],
  대회:   ['대회ID', '클럽ID', '일자', '대회명', '주최', '장소', '결과', '인원', '비고'],
  예산:   ['예산ID', '클럽ID', '항목', '세부', '단가', '수량', '금액', '집행일', '비고'],
  사진:   ['사진ID', '클럽ID', '날짜', '설명', '파일ID', '썸네일ID', '파일명', '업로드일시']
};
var CLUB_색 = '#FFF4D1';
var CLUB_FOLDER_KEY = 'CLUB_PHOTO_FOLDER_ID';
var CLUB_유형 = ['정규 연습', '추가 연습', '교내 경기', '대회 참가', '친선 경기', '기타'];

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function club_hooks_() {
  return {
    준비확인: function () {
      return Object.keys(CLUB).every(function (k) { return !!findSheet_(CLUB[k]); });
    },
    준비: function () {
      var 만듦 = [];
      Object.keys(CLUB).forEach(function (k) { 만듦 = 만듦.concat(시트준비_(CLUB[k], CLUB_H[k], { 색: CLUB_색 })); });
      club_캐시지우기_();
      return 만듦;
    },
    캐시지우기: club_캐시지우기_,
    학생참여: function (학생ID) {
      return club_클럽목록_().some(function (c) { return c.참가자.some(function (m) { return m.학생ID === 학생ID; }); });
    },
    교사대시보드: function () {
      var 이번달 = 오늘_().slice(0, 7), 카드 = [];
      club_클럽목록_().slice(0, 3).forEach(function (c) {
        var 이달 = c.활동.filter(function (a) { return a.날짜.slice(0, 7) === 이번달; }).length;
        var 총분 = 0; c.활동.forEach(function (a) { 총분 += a.분; });
        var 최근 = c.활동.length ? c.활동[c.활동.length - 1] : null;
        카드.push({ 제목: (c.이름 || '스포츠클럽') + ' · ' + c.종목, 값: 이달, 단위: '회 (이번 달)',
                   설명: '참가 ' + c.참가자.length + '명 · 누적 ' + c.활동.length + '회 ' + Math.round(총분 / 60 * 10) / 10 + '시간' + (최근 ? ' · 최근 ' + 최근.날짜.slice(5).replace('-', '/') : ''), 이동: 'dash' });
      });
      if (!카드.length) 카드.push({ 제목: '스포츠클럽', 값: 0, 단위: '개', 설명: '클럽 설정에서 첫 클럽을 만들어 주세요', 이동: 'settings' });
      return { 카드: 카드 };
    },
    학생프로필: function (학생ID) {
      var 내클럽 = club_클럽목록_().filter(function (c) { return c.참가자.some(function (m) { return m.학생ID === 학생ID; }); });
      if (!내클럽.length) return null;
      var c = 내클럽[0], 횟수 = 0, 분 = 0;
      c.활동.forEach(function (a) { if (a.참여.indexOf(학생ID) >= 0) { 횟수++; 분 += a.분; } });
      var 목표분 = (c.목표시간 || 17) * 60;
      return {
        제목: (c.이름 || '스포츠클럽') + ' (' + c.종목 + ')', 값: Math.round(분 / 60 * 10) / 10, 단위: '시간', 진행: Math.min(100, Math.round(분 / 목표분 * 100)),
        설명: '참여 ' + 횟수 + '회 · 목표 ' + (c.목표시간 || 17) + '시간' + (내클럽.length > 1 ? ' · 클럽 ' + 내클럽.length + '개' : ''),
        요약: { 이름: '스포츠클럽 활동', 값: Math.round(분 / 60 * 10) / 10, 단위: '시간' }
      };
    },
    초기화정보: function () {
      return [
        { key: '기록', 이름: '활동 일지·대회 실적·예산 집행 (클럽·참가자는 남음)', 수: rows_(CLUB.활동).length + rows_(CLUB.대회).length + rows_(CLUB.예산).length },
        { key: '사진', 이름: '활동 사진 (드라이브 파일도 휴지통으로)', 수: rows_(CLUB.사진).length },
        { key: '클럽', 이름: '클럽·참가 학생까지 모두', 수: rows_(CLUB.클럽).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var res = {};
      if (opts.기록 || opts.클럽) { res.활동 = 시트비우기_(CLUB.활동); 시트비우기_(CLUB.대회); 시트비우기_(CLUB.예산); }
      if (opts.사진 || opts.클럽) {
        var 파일 = [];
        rows_(CLUB.사진).forEach(function (p) { if (p.파일ID) 파일.push(p.파일ID); if (p.썸네일ID) 파일.push(p.썸네일ID); });
        club_휴지통_(파일);
        res.사진 = 시트비우기_(CLUB.사진);
      }
      if (opts.클럽) { res.클럽 = 시트비우기_(CLUB.클럽); 시트비우기_(CLUB.참가자); }
      club_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var n = 행지우기_(CLUB.참가자, function (o) { return set[str_(o.학생ID)] === true; });
      rows_(CLUB.활동).forEach(function (r) {
        var 참여 = 목록_(r.참여학생ID), 남김 = 참여.filter(function (id) { return !set[id]; });
        if (남김.length !== 참여.length) setCells_(CLUB.활동, CLUB_H.활동, r._row, { 참여학생ID: 남김.join(','), 참여수: 남김.length });
      });
      club_캐시지우기_();
      return { 참가자: n };
    }
  };
}

/* ================= 읽기 ================= */

function club_캐시지우기_() { 캐시지우기_('club_all'); }
function club_시각_(v) {
  if (v instanceof Date) return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  var m = str_(v).match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

/** 모든 클럽을 화면이 쓰는 모양으로 (참가자·활동·대회·예산·사진 포함). 캐시됨 */
function club_클럽목록_() {
  return 캐시_('club_all', function () {
    var 학년도 = str_(설정_().학년도);
    var by = {}, list = [];
    rows_(CLUB.클럽).forEach(function (r) {
      var id = str_(r.클럽ID); if (!id) return;
      var c = { id: id, 학년도: str_(r.학년도) || 학년도, 이름: str_(r.이름), 종목: str_(r.종목) || '기타', 대상: str_(r.대상),
                운영시작: 날짜정리_(r.운영시작), 운영종료: 날짜정리_(r.운영종료), 활동시간대: str_(r.활동시간대), 활동장소: str_(r.활동장소),
                목표시간: num_(r.목표시간) || 17, 배정예산: num_(r.배정예산) || 0, 개요: str_(r.개요), 내용: str_(r.내용), 결과: str_(r.결과),
                직위: str_(r.직위) || '교사', 주소: str_(r.주소), 등록일: 날짜정리_(r.등록일),
                참가자: [], 활동: [], 대회: [], 예산: [], 사진: [] };
      by[id] = c; list.push(c);
    });
    rows_(CLUB.참가자).forEach(function (r) { var c = by[str_(r.클럽ID)]; if (c && str_(r.학생ID)) c.참가자.push({ 학생ID: str_(r.학생ID), 비고: str_(r.비고), 등록일: 날짜정리_(r.등록일) }); });
    rows_(CLUB.활동).forEach(function (r) {
      var c = by[str_(r.클럽ID)]; if (!c || !str_(r.활동ID)) return;
      c.활동.push({ id: str_(r.활동ID), 날짜: 날짜정리_(r.날짜), 시작: club_시각_(r.시작), 종료: club_시각_(r.종료), 분: num_(r.분) || 0,
                   유형: str_(r.유형) || '정규 연습', 장소: str_(r.장소), 내용: str_(r.내용), 비고: str_(r.비고), 참여: 목록_(r.참여학생ID) });
    });
    rows_(CLUB.대회).forEach(function (r) { var c = by[str_(r.클럽ID)]; if (c && str_(r.대회ID)) c.대회.push({ id: str_(r.대회ID), 일자: 날짜정리_(r.일자), 대회명: str_(r.대회명), 주최: str_(r.주최), 장소: str_(r.장소), 결과: str_(r.결과), 인원: num_(r.인원) === null ? '' : num_(r.인원), 비고: str_(r.비고) }); });
    rows_(CLUB.예산).forEach(function (r) { var c = by[str_(r.클럽ID)]; if (c && str_(r.예산ID)) c.예산.push({ id: str_(r.예산ID), 항목: str_(r.항목), 세부: str_(r.세부), 단가: num_(r.단가) === null ? '' : num_(r.단가), 수량: num_(r.수량) === null ? '' : num_(r.수량), 금액: num_(r.금액) || 0, 집행일: 날짜정리_(r.집행일), 비고: str_(r.비고) }); });
    rows_(CLUB.사진).forEach(function (r) { var c = by[str_(r.클럽ID)]; if (c && str_(r.사진ID)) c.사진.push({ id: str_(r.사진ID), 날짜: 날짜정리_(r.날짜), 설명: str_(r.설명), 파일ID: str_(r.파일ID), 썸네일ID: str_(r.썸네일ID), 파일명: str_(r.파일명) }); });
    list.forEach(function (c) {
      c.활동.sort(function (a, b) { return (a.날짜 + a.시작).localeCompare(b.날짜 + b.시작); });
      c.대회.sort(function (a, b) { return a.일자.localeCompare(b.일자); });
      c.사진.sort(function (a, b) { return b.날짜.localeCompare(a.날짜); });
    });
    return list;
  });
}
function club_찾기_(id) {
  var hit = club_클럽목록_().filter(function (c) { return c.id === str_(id); })[0];
  if (!hit) throw new Error('클럽을 찾지 못했습니다. 화면을 새로 고쳐 주세요.');
  return hit;
}
function club_설정_() {
  var s = 공개설정_();
  return { 학교명: s.학교명, 학교장: s.학교장, 담당자: s.담당자, 전화: s.전화, 이메일: s.이메일, 학년도: s.학년도, 유형: CLUB_유형 };
}

/* ================= 교사 API ================= */

function club_t_boot(token) {
  교사확인_(token);
  return { 설정: club_설정_(), 클럽: club_클럽목록_(), 오늘: 오늘_() };
}

/** 클럽 저장 (id 없으면 새 클럽). 돌려주는 값: { ok, 클럽:[전체] , id } */
function club_t_saveClub(token, m) {
  교사확인_(token);
  m = m || {};
  var id = str_(m.id) || makeId_('C');
  var fields = {
    클럽ID: id, 학년도: str_(m.학년도) || str_(설정_().학년도), 이름: str_(m.이름).slice(0, 60), 종목: str_(m.종목) || '기타', 대상: str_(m.대상),
    운영시작: 날짜정리_(m.운영시작), 운영종료: 날짜정리_(m.운영종료), 활동시간대: str_(m.활동시간대), 활동장소: str_(m.활동장소),
    목표시간: Math.max(1, num_(m.목표시간) || 17), 배정예산: num_(m.배정예산) || 0, 개요: str_(m.개요), 내용: str_(m.내용), 결과: str_(m.결과),
    직위: str_(m.직위) || '교사', 주소: str_(m.주소)
  };
  if (!fields.이름) throw new Error('클럽 이름을 적어 주세요.');
  return withLock_(function () {
    var have = rows_(CLUB.클럽).filter(function (r) { return str_(r.클럽ID) === id; })[0];
    if (have) setCells_(CLUB.클럽, CLUB_H.클럽, have._row, fields);
    else { fields.등록일 = 오늘_(); appendRow_(CLUB.클럽, CLUB_H.클럽, fields); }
    club_캐시지우기_();
    return { ok: true, id: id, 클럽: club_클럽목록_() };
  });
}

function club_t_deleteClub(token, id) {
  교사확인_(token);
  id = str_(id);
  var c = club_찾기_(id);
  return withLock_(function () {
    var 파일 = [];
    c.사진.forEach(function (p) { 파일.push(p.파일ID, p.썸네일ID); });
    club_휴지통_(파일);
    var 같은 = function (o) { return str_(o.클럽ID) === id; };
    Object.keys(CLUB).forEach(function (k) { 행지우기_(CLUB[k], 같은); });
    club_캐시지우기_();
    return { ok: true, 클럽: club_클럽목록_() };
  });
}

/** 참가 학생 추가 (이미 있는 학생은 건너뜀) */
function club_t_addMembers(token, clubId, ids) {
  교사확인_(token);
    var c = club_찾기_(clubId), 학생 = 학생맵_(true), have = {};
  c.참가자.forEach(function (m) { have[m.학생ID] = true; });
  var rows = [];
  (ids || []).forEach(function (id) {
    id = str_(id);
    if (!학생[id] || have[id]) return;
    have[id] = true;
    rows.push({ 클럽ID: c.id, 학생ID: id, 이름: 학생[id].이름, 비고: '', 등록일: 오늘_() });
  });
  return withLock_(function () {
    appendRows_(CLUB.참가자, CLUB_H.참가자, rows);
    club_캐시지우기_();
    return { ok: true, 추가: rows.length, 클럽: club_클럽목록_() };
  });
}

function club_t_updateMember(token, clubId, sid, note) {
  교사확인_(token);
  var c = club_찾기_(clubId);
  return withLock_(function () {
    var hit = rows_(CLUB.참가자).filter(function (r) { return str_(r.클럽ID) === c.id && str_(r.학생ID) === str_(sid); })[0];
    if (!hit) throw new Error('참가 학생을 찾지 못했습니다.');
    setCells_(CLUB.참가자, CLUB_H.참가자, hit._row, { 비고: str_(note).slice(0, 200) });
    club_캐시지우기_();
    return { ok: true, 클럽: club_클럽목록_() };
  });
}

/** 참가 학생 빼기 — 활동 일지의 참여 체크에서도 뺍니다 */
function club_t_removeMember(token, clubId, sid) {
  교사확인_(token);
  var c = club_찾기_(clubId); sid = str_(sid);
  return withLock_(function () {
    행지우기_(CLUB.참가자, function (o) { return str_(o.클럽ID) === c.id && str_(o.학생ID) === sid; });
    rows_(CLUB.활동).forEach(function (r) {
      if (str_(r.클럽ID) !== c.id) return;
      var 참여 = 목록_(r.참여학생ID);
      if (참여.indexOf(sid) < 0) return;
      var 남김 = 참여.filter(function (x) { return x !== sid; });
      setCells_(CLUB.활동, CLUB_H.활동, r._row, { 참여학생ID: 남김.join(','), 참여수: 남김.length });
    });
    club_캐시지우기_();
    return { ok: true, 클럽: club_클럽목록_() };
  });
}

/** 활동 한 건 저장 (id 없으면 새로). a = { 클럽ID, id?, 날짜, 시작, 종료, 분, 유형, 장소, 내용, 비고, 참여:[학생ID] } */
function club_t_saveActivity(token, a) {
  교사확인_(token);
  a = a || {};
  var c = club_찾기_(a.클럽ID);
  var 날짜 = 날짜정리_(a.날짜), 분 = num_(a.분);
  if (!날짜) throw new Error('날짜를 골라 주세요.');
  if (!(분 > 0)) throw new Error('활동시간(분)을 적어 주세요.');
  var 회원 = {}; c.참가자.forEach(function (m) { 회원[m.학생ID] = true; });
  var 참여 = [], seen = {};
  (a.참여 || []).forEach(function (id) { id = str_(id); if (회원[id] && !seen[id]) { seen[id] = true; 참여.push(id); } });
  var id = str_(a.id) || makeId_('A');
  var fields = { 활동ID: id, 클럽ID: c.id, 날짜: 날짜, 시작: club_시각_(a.시작), 종료: club_시각_(a.종료), 분: 분, 유형: CLUB_유형.indexOf(str_(a.유형)) >= 0 ? str_(a.유형) : '정규 연습',
                 장소: str_(a.장소), 내용: str_(a.내용), 비고: str_(a.비고), 참여학생ID: 참여.join(','), 참여수: 참여.length, 입력일시: 지금_() };
  return withLock_(function () {
    var have = rows_(CLUB.활동).filter(function (r) { return str_(r.활동ID) === id; })[0];
    if (have) setCells_(CLUB.활동, CLUB_H.활동, have._row, fields);
    else appendRow_(CLUB.활동, CLUB_H.활동, fields);
    club_캐시지우기_();
    return { ok: true, id: id, 클럽: club_클럽목록_() };
  });
}

function club_t_deleteActivity(token, id) {
  교사확인_(token);
  id = str_(id);
  return withLock_(function () {
    var n = 행지우기_(CLUB.활동, function (o) { return str_(o.활동ID) === id; });
    club_캐시지우기_();
    return { ok: true, 지움: n, 클럽: club_클럽목록_() };
  });
}

/** 출석부 칸 하나 토글 */
function club_t_toggleAttend(token, actId, sid) {
  교사확인_(token);
  actId = str_(actId); sid = str_(sid);
  return withLock_(function () {
    var hit = rows_(CLUB.활동).filter(function (r) { return str_(r.활동ID) === actId; })[0];
    if (!hit) throw new Error('활동을 찾지 못했습니다.');
    var 참여 = 목록_(hit.참여학생ID), i = 참여.indexOf(sid);
    if (i >= 0) 참여.splice(i, 1); else 참여.push(sid);
    setCells_(CLUB.활동, CLUB_H.활동, hit._row, { 참여학생ID: 참여.join(','), 참여수: 참여.length });
    club_캐시지우기_();
    return { ok: true, 참여: 참여 };
  });
}

/** 대회 실적 전체 저장 (그 클럽 것을 통째로 바꿈) */
function club_t_saveComps(token, clubId, rows) {
  교사확인_(token);
  var c = club_찾기_(clubId);
  var objs = (rows || []).filter(function (r) { return str_(r.대회명) || 날짜정리_(r.일자); }).map(function (r) {
    return { 대회ID: str_(r.id) || makeId_('K') + Math.floor(Math.random() * 90 + 10), 클럽ID: c.id, 일자: 날짜정리_(r.일자), 대회명: str_(r.대회명), 주최: str_(r.주최),
             장소: str_(r.장소), 결과: str_(r.결과), 인원: num_(r.인원) === null ? '' : num_(r.인원), 비고: str_(r.비고) };
  });
  return withLock_(function () {
    행지우기_(CLUB.대회, function (o) { return str_(o.클럽ID) === c.id; });
    appendRows_(CLUB.대회, CLUB_H.대회, objs);
    club_캐시지우기_();
    return { ok: true, 저장: objs.length, 클럽: club_클럽목록_() };
  });
}

/** 예산 전체 저장 */
function club_t_saveBudget(token, clubId, 배정예산, rows) {
  교사확인_(token);
  var c = club_찾기_(clubId);
  var objs = (rows || []).filter(function (r) { return str_(r.항목) || str_(r.세부) || num_(r.금액); }).map(function (r) {
    return { 예산ID: str_(r.id) || makeId_('B') + Math.floor(Math.random() * 90 + 10), 클럽ID: c.id, 항목: str_(r.항목), 세부: str_(r.세부),
             단가: num_(r.단가) === null ? '' : num_(r.단가), 수량: num_(r.수량) === null ? '' : num_(r.수량), 금액: num_(r.금액) || 0, 집행일: 날짜정리_(r.집행일), 비고: str_(r.비고) };
  });
  return withLock_(function () {
    var have = rows_(CLUB.클럽).filter(function (r) { return str_(r.클럽ID) === c.id; })[0];
    if (have) setCells_(CLUB.클럽, CLUB_H.클럽, have._row, { 배정예산: num_(배정예산) || 0 });
    행지우기_(CLUB.예산, function (o) { return str_(o.클럽ID) === c.id; });
    appendRows_(CLUB.예산, CLUB_H.예산, objs);
    club_캐시지우기_();
    return { ok: true, 저장: objs.length, 클럽: club_클럽목록_() };
  });
}

/* ================= 사진 (드라이브) ================= */

function club_폴더_() {
  var id = 속성_(CLUB_FOLDER_KEY);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var parent = null;
  try { var parents = DriveApp.getFileById(ss_().getId()).getParents(); if (parents.hasNext()) parent = parents.next(); } catch (e) {}
  var folder = (parent || DriveApp).createFolder('스포츠클럽 사진·보고서');
  속성저장_(CLUB_FOLDER_KEY, folder.getId());
  return folder;
}
function club_휴지통_(파일ID들) {
  var n = 0;
  (파일ID들 || []).forEach(function (id) { if (!id) return; try { DriveApp.getFileById(String(id)).setTrashed(true); n++; } catch (e) {} });
  return n;
}

/** m = { 클럽ID, 날짜, 설명, 파일명, 본문(base64 jpeg), 썸네일(base64 jpeg) } */
function club_t_uploadPhoto(token, m) {
  교사확인_(token);
  m = m || {};
  var c = club_찾기_(m.클럽ID);
  if (!m.본문) throw new Error('사진 내용이 비어 있습니다.');
  var folder = club_폴더_();
  var 날짜 = 날짜정리_(m.날짜) || 오늘_();
  var 이름 = 날짜 + '_' + str_(m.파일명 || 'photo.jpg').replace(/[\\\/:*?"<>|]/g, '_');
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m.본문), 'image/jpeg', 이름));
  var thumb = m.썸네일 ? folder.createFile(Utilities.newBlob(Utilities.base64Decode(m.썸네일), 'image/jpeg', 'thumb_' + 이름)) : null;
  appendRow_(CLUB.사진, CLUB_H.사진, { 사진ID: uuid_(), 클럽ID: c.id, 날짜: 날짜, 설명: str_(m.설명).slice(0, 200), 파일ID: file.getId(), 썸네일ID: thumb ? thumb.getId() : '', 파일명: 이름, 업로드일시: 지금_() });
  club_캐시지우기_();
  return { ok: true, 클럽: club_클럽목록_() };
}

function club_t_updatePhoto(token, 사진ID, 날짜, 설명) {
  교사확인_(token);
  var hit = rows_(CLUB.사진).filter(function (r) { return str_(r.사진ID) === str_(사진ID); })[0];
  if (!hit) throw new Error('사진을 찾지 못했습니다.');
  setCells_(CLUB.사진, CLUB_H.사진, hit._row, { 날짜: 날짜정리_(날짜) || 오늘_(), 설명: str_(설명).slice(0, 200) });
  club_캐시지우기_();
  return { ok: true, 클럽: club_클럽목록_() };
}

function club_t_deletePhoto(token, 사진ID) {
  교사확인_(token);
  var hit = rows_(CLUB.사진).filter(function (r) { return str_(r.사진ID) === str_(사진ID); })[0];
  if (!hit) throw new Error('사진을 찾지 못했습니다.');
  club_휴지통_([str_(hit.파일ID), str_(hit.썸네일ID)]);
  행지우기_(CLUB.사진, function (o) { return str_(o.사진ID) === str_(사진ID); });
  club_캐시지우기_();
  return { ok: true, 클럽: club_클럽목록_() };
}

/** 파일ID 목록 → { 파일ID: 'data:image/jpeg;base64,…' } (한 번에 40개까지). 시트에 등록된 파일만 */
function club_t_getPhotoData(token, ids) {
  교사확인_(token);
  var 허용 = {};
  rows_(CLUB.사진).forEach(function (r) { if (r.파일ID) 허용[str_(r.파일ID)] = true; if (r.썸네일ID) 허용[str_(r.썸네일ID)] = true; });
  var out = {};
  (ids || []).slice(0, 40).forEach(function (id) {
    id = str_(id);
    if (!허용[id]) { out[id] = ''; return; }
    try { var blob = DriveApp.getFileById(id).getBlob(); out[id] = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()); }
    catch (e) { out[id] = ''; }
  });
  return out;
}

function club_t_folderUrl(token) { 교사확인_(token); return club_폴더_().getUrl(); }
