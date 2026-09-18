/*******************************************************
 * 체육교사 보조 프로그램 — 공통 뼈대 (Code.gs)
 *
 * 하나의 스프레드시트 · 하나의 배포 · 한 번의 로그인으로
 * 수업 도우미 · 수행평가 · PAPS · 건강체력교실 · 줄넘기 · FMS · 스포츠클럽 모듈을 관리합니다.
 *
 * 이 파일이 맡는 것 (모듈은 여기를 건드리지 않습니다)
 *   진입점(doGet, include) · 시트 준비 · 설정 · 모듈 켜고 끄기
 *   세션 · 교사/학생 로그인 · 비밀번호
 *   학생 명단 (유일한 명단) · 학년 올리기 · 졸업 처리
 *   홈 대시보드 · 학생 프로필 (모듈이 카드를 보태 줌)
 *   초기화
 *
 * 공통 시트
 *   설정 : 항목, 값, 설명
 *   학생 : 학생ID, 학년, 반, 번호, 이름, 성별, 초기비밀번호, 비밀번호해시, 상태, 비고, 등록일, 수정일시
 *   안내 : 설명
 *
 * 모듈이 공통에 끼워 넣는 방법
 *   Mod_XXX.gs 에 function xxx_hooks_() { return { 준비, 초기화정보, 초기화, 교사대시보드, 학생프로필, 학생배지, 학생참여, 명단삭제후, 학교급변경 } }
 *   를 두면 이 파일이 알아서 찾아 부릅니다. (MODULES 의 hooks 이름 참고)
 *
 * 학교급 (초등학교 / 중학교)
 *   설정 '학교급'(초|중) 하나로 같은 코드가 초등·중등 어느 쪽으로도 동작합니다. 학교급_() 가 학년 범위·졸업 학년을 돌려주고,
 *   MODULES 의 학교급 속성이 있는 모듈(FMS 는 초등만)은 다른 학교급에서 아예 보이지 않습니다.
 *******************************************************/

var SS_ID = '';   // 비워 두면 이 스크립트가 붙어 있는 스프레드시트

var APP_VERSION = '1.5.1';
var 기본프로그램이름 = '체육교사 보조 프로그램';
var 기본학생용이름 = '체육 활동 기록장';   // 학생·학부모가 보는 이름

/* 학교급. 설정 시트의 '학교급' 값(초 | 중)으로 고르며, 학년 범위·졸업 학년·PAPS 기준표·쓸 수 있는 모듈이 달라집니다. */
var 학교급표 = {
  '초': { 급: '초', 이름: '초등학교', 학생: '초등학생', 최대학년: 6, 학년들: [1, 2, 3, 4, 5, 6], 기본학년범위: '1,2,3,4,5,6' },
  '중': { 급: '중', 이름: '중학교',   학생: '중학생',   최대학년: 3, 학년들: [1, 2, 3],          기본학년범위: '1,2,3' }
};
function 학교급_(급) {
  var k = str_(급 === undefined ? 설정_().학교급 : 급);
  return 학교급표[k] || 학교급표['초'];
}

var SHEET = { 설정: '설정', 학생: '학생', 안내: '안내' };

var HEADERS = {
  설정: ['항목', '값', '설명'],
  학생: ['학생ID', '학년', '반', '번호', '이름', '성별', '초기비밀번호', '비밀번호해시', '상태', '비고', '등록일', '수정일시']
};

/* 모듈 목록. 순서가 사이드바 순서입니다. */
var MODULES = [
  { key: 'CLASS', 이름: '수업 도우미',  설명: '지금 수업·출석·특이사항·시간표·수업 계획·명렬표 출력 (교사 전용)', 아이콘: 'clock-play', 색: 'violet', 학생화면: false, hooks: 'class_hooks_' },
  { key: 'EVAL',  이름: '수행평가',     설명: '평가 계획·단계별 체크·특기사항·결과표 출력 · 상호평가(짝 확인 → 교사 반영). 결과는 학생에게 보이지 않음', 아이콘: 'checkbox', 색: 'plum', 학생화면: false, hooks: 'eval_hooks_' },
  { key: 'PAPS', 이름: 'PAPS',        설명: '학생건강체력평가 기록·등급·나이스 내보내기',   아이콘: 'stopwatch',  색: 'sky',   학생화면: true,  hooks: 'paps_hooks_' },
  { key: 'FIT',  이름: '건강체력교실', 설명: '참가 학생의 운동 기록·출석·포인트·배지',       아이콘: 'heartbeat',  색: 'mint',  학생화면: true,  hooks: 'fit_hooks_'  },
  { key: 'ROPE', 이름: '줄넘기',       설명: '줄넘기 횟수 누적·승인·학급 공동 목표',          아이콘: 'jump-rope',  색: 'coral', 학생화면: true,  hooks: 'rope_hooks_' },
  { key: 'FMS',  이름: 'FMS 도전',     설명: '기본 움직임 기술 관찰평가·단계 도전·배지',      아이콘: 'run',        색: 'blue',  학생화면: true,  hooks: 'fms_hooks_', 학교급: ['초'] },
  { key: 'CLUB', 이름: '스포츠클럽',   설명: '클럽 활동 일지·출석·대회·예산·정산보고서',      아이콘: 'ball-volleyball', 색: 'sun', 학생화면: false, hooks: 'club_hooks_' }
];

/** 화면 색상 테마 (App.html 의 THEMES 와 같은 이름·순서) */
var 테마들 = ['민트', '바다', '코랄', '라벤더', '숲', '자정', '로즈', '그래파이트'];
function 테마_(v) { v = str_(v); return 테마들.indexOf(v) >= 0 ? v : 테마들[0]; }

function 기본설정_() {
  var y = new Date().getFullYear();
  var rows = [
    ['프로그램이름', 기본프로그램이름, '선생님 화면 상단에 보이는 이름'],
    ['학생용이름',   기본학생용이름,   '학생·학부모가 보는 이름 (로그인 화면, 학생 화면, 비밀번호 카드)'],
    ['학교명',       '',              '결과물·보고서에 들어갈 학교 이름'],
    ['학교장',       '',              '보고서용'],
    ['담당자',       '',              '보고서용 담당 교사 이름'],
    ['전화',         '',              '보고서용'],
    ['이메일',       '',              '보고서용'],
    ['학교급',       '초',            '초 | 중 — 초등학교 / 중학교. 학년 범위·졸업 학년·PAPS 기준표·쓸 수 있는 모듈이 달라집니다'],
    ['학년도',       String(y),       '올해 학년도'],
    ['학년범위',     '1,2,3,4,5,6',   '학생 등록 화면에서 고를 수 있는 학년 (중학교는 1,2,3)'],
    ['반범위',       '15',            '반은 1부터 이 숫자까지'],
    ['자동나가기분', '3',             '학생이 이 시간(분) 동안 화면을 만지지 않으면 로그인 화면으로'],
    ['학생로그인',   '숫자판',        '숫자판 | 입력칸 — 학생 비밀번호를 넣는 방식'],
    ['테마',         '민트',          '로그인·메인 화면 색상 테마: ' + 테마들.join(' | ')]
  ];
  MODULES.forEach(function (m) {
    rows.push(['모듈.' + m.key, 'Y', m.이름 + ' 모듈 사용 (Y/N)']);
  });
  return rows;
}

var PW_KEY = 'TEACHER_PW_HASH';
var 기본교사비번 = '1234';
var 세션시간 = 21600;      // 교사 6시간
var 학생세션시간 = 10800;  // 학생 3시간 (화면은 자동 나가기가 먼저 닫음)
var MAX_FAILS = 5;         // 학생 비밀번호 5번 틀리면 1분 잠금
var 학생상태 = ['재학', '졸업', '전출'];

/* ================= 진입점 ================= */

/**
 * 웹앱 입구. 껍데기(Shell.gs)가 라이브러리로 부를 때는 ctx = { url, legacyProps } 를 함께 줍니다.
 * legacyProps: 옛 방식(스크립트 속성)으로 저장돼 있던 값 — 처음 한 번 '_속성' 시트로 옮깁니다.
 */
function doGet(e, ctx) {
  ctx설정_(ctx);
  속성이사_(ctx && ctx.legacyProps);
  var 준비결과 = 준비_();
  var 설정 = 설정_();
  var tpl = HtmlService.createTemplateFromFile('App');
  tpl.mods = 모듈상태_();          // { PAPS: true, ... } 켜져 있고 설치된 것만 true
  tpl.page = (e && e.parameter && e.parameter.page) || '';
  tpl.title = tpl.page === 'teacher' ? (str_(설정.프로그램이름) || 기본프로그램이름) : (str_(설정.학생용이름) || 기본학생용이름);
  tpl.teacherTitle = str_(설정.프로그램이름) || 기본프로그램이름;
  tpl.theme = 테마_(설정.테마);      // 첫 화면부터 테마 색으로 (깜빡임 방지)
  return tpl.evaluate()
    .setTitle(tpl.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 옛 스크립트 속성 → '_속성' 시트로 (교사 비밀번호·사진 폴더·Gemini 키). 한 번만 */
function 속성이사_(legacy) {
  if (!legacy || 속성_(PW_KEY)) return;
  var keys = [PW_KEY, 'PIN_SALT', 'CLUB_PHOTO_FOLDER_ID', 'FIT_PHOTO_FOLDER_ID', 'GEMINI_KEY', 'UPDATE_REPO'];
  keys.forEach(function (k) { if (legacy[k]) 속성저장_(k, legacy[k]); });
}

/**
 * 껍데기(Shell.gs)의 rpc(name, args) 가 부르는 서버 함수 분배기.
 * 화면은 google.script.run.rpc('t_boot', [token]) 처럼 부르고, 여기서 실제 함수를 찾아 실행합니다.
 * 끝이 _ 인 내부 함수와 입구 함수는 부를 수 없습니다.
 */
var RPC_허용 = ['getLoginInfo', 'loginTeacher', 'loginStudent', 'logout', 'changeTeacherPassword'];   // 그 밖엔 t_·s_·<모듈>_t_·<모듈>_s_·off_ 로 시작하는 것만
function rpc(name, args, ctx) {
  ctx설정_(ctx);
  name = String(name || '');
  var ok = /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !/_$/.test(name) && (RPC_허용.indexOf(name) >= 0 || /^(t_|s_|[a-z]+_(t|s)_|off_)/.test(name));
  if (!ok) throw new Error('허용되지 않은 요청입니다: ' + name);
  var f = 전역_()[name];
  if (typeof f !== 'function') throw new Error('함수를 찾지 못했습니다: ' + name);
  return f.apply(null, Array.isArray(args) ? args : []);
}

/** 다른 HTML 파일을 끼워 넣습니다. 없거나 비어 있으면 무엇이 빠졌는지 화면에 띄웁니다. */
function include(name) {
  var content;
  try { content = HtmlService.createHtmlOutputFromFile(name).getContent(); }
  catch (err) { return 경고배너_(name + '.html 파일을 찾지 못했습니다.', 'Apps Script 편집기에서 ' + name + ' HTML 파일을 만들어 주세요.'); }
  if (!content || !content.trim()) return 경고배너_(name + '.html 파일이 비어 있습니다.', '내용이 제대로 붙여넣어졌는지 확인해 주세요.');
  return content;
}

function 경고배너_(제목, 설명) {
  return '<div style="background:#E5484D;color:#fff;padding:14px 18px;font:14px/1.5 sans-serif"><b>' + 제목 + '</b><br>' + 설명 + '</div>';
}

function onOpen() { 메뉴만들기(); }
/** 스프레드시트 메뉴. 껍데기의 onOpen 이 부릅니다 (메뉴 항목은 껍데기에 같은 이름의 함수가 있어야 함) */
function 메뉴만들기() {
  SpreadsheetApp.getUi().createMenu('체육교사 보조')
    .addItem('상태 점검', '상태점검')
    .addItem('초기 설정 다시 확인', '초기설정')
    .addSeparator()
    .addItem('교사 비밀번호 초기화(1234)', '교사비밀번호초기화')
    .addItem('캐시 비우기', '캐시비우기')
    .addSeparator()
    .addItem('업데이트 확인', '업데이트확인')
    .addToUi();
}

/* ================= 모듈 훅 ================= */

function 전역_() { return this; }

/** 모듈이 정의한 hooks 객체. 모듈 파일이 없으면 null */
function 모듈훅_(key) {
  var m = 모듈정의_(key);
  if (!m) return null;
  var g = 전역_();
  var f = g[m.hooks];
  if (typeof f !== 'function') return null;
  try { return f() || {}; } catch (e) { return {}; }
}

function 모듈정의_(key) {
  for (var i = 0; i < MODULES.length; i++) if (MODULES[i].key === key) return MODULES[i];
  return null;
}

function 모듈설치됨_(key) { return 모듈훅_(key) !== null; }

/** 이 학교급에서 쓸 수 있는 모듈인지 (FMS 는 초등만). 지원하지 않는 모듈은 화면·설정·준비 어디에도 나타나지 않습니다 */
function 모듈지원_(m) { return !m.학교급 || m.학교급.indexOf(학교급_().급) >= 0; }
function 지원모듈_() { return MODULES.filter(모듈지원_); }

/** { PAPS: true/false, ... } — 이 학교급에서 지원하고, 설정에서 켜져 있고, 파일도 있는 모듈만 true */
function 모듈상태_() {
  var s = 설정_(), out = {};
  MODULES.forEach(function (m) {
    out[m.key] = 모듈지원_(m) && str_(s['모듈.' + m.key]).toUpperCase() !== 'N' && 모듈설치됨_(m.key);
  });
  return out;
}

/** 화면용 모듈 목록 (이 학교급에서 지원하는 모듈만) */
function 모듈목록_() {
  var 상태 = 모듈상태_(), s = 설정_();
  return 지원모듈_().map(function (m) {
    return { key: m.key, 이름: m.이름, 설명: m.설명, 아이콘: m.아이콘, 색: m.색, 학생화면: m.학생화면,
             설치: 모듈설치됨_(m.key), 켜짐: str_(s['모듈.' + m.key]).toUpperCase() !== 'N', 사용: 상태[m.key] };
  });
}

/* ================= 시트 준비 ================= */

/**
 * 공통 시트·설정·비밀번호를 확인하고 없는 것만 만듭니다. 켜진 모듈의 준비 훅도 부릅니다.
 * 웹앱에 처음 접속할 때 자동으로 실행되므로 편집기에서 따로 실행할 필요가 없습니다.
 */
var 준비플래그_ = '준비됨_' + APP_VERSION;   // 시트 확인을 통과하면 6시간 동안 다시 확인하지 않음 (요청마다 시트 30개를 찾던 비용 절약)

function 준비_() {
  if (캐시읽기_(준비플래그_)) return [];
  var ss = ss_();
  var 빠짐 = !findSheet_(SHEET.설정) || !findSheet_(SHEET.학생) || !findSheet_(SHEET.안내) || !속성_(PW_KEY);
  var 모듈빠짐 = false;
  if (!빠짐) {
    지원모듈_().forEach(function (m) {
      var h = 모듈훅_(m.key);
      if (h && typeof h.준비확인 === 'function') { try { if (!h.준비확인()) 모듈빠짐 = true; } catch (e) { 모듈빠짐 = true; } }
    });
  }
  if (!빠짐 && !모듈빠짐) { try { 캐시쓰기_(준비플래그_, 1, 21600); } catch (e) {} return []; }

  return withLock_(function () {
    var 만듦 = [];
    만듦 = 만듦.concat(시트준비_(SHEET.설정, HEADERS.설정, { 기본행: 기본설정_() }));
    만듦 = 만듦.concat(시트준비_(SHEET.학생, HEADERS.학생));
    설정보충_();
    if (!findSheet_(SHEET.안내)) { 안내시트_(); 만듦.push('안내 시트'); }
    if (!속성_(PW_KEY)) { 속성저장_(PW_KEY, hash_(기본교사비번)); 만듦.push('교사 비밀번호(' + 기본교사비번 + ')'); }
    지원모듈_().forEach(function (m) {
      var h = 모듈훅_(m.key);
      if (h && typeof h.준비 === 'function') {
        try { 만듦 = 만듦.concat(h.준비() || []); } catch (e) { 만듦.push(m.이름 + ' 준비 실패: ' + e.message); }
      }
    });
    var 기본시트 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
    if (기본시트 && ss.getSheets().length > 1 && 기본시트.getLastRow() === 0) { try { ss.deleteSheet(기본시트); } catch (e) {} }
    캐시지우기_('설정'); 캐시지우기_('학생');
    try { 캐시쓰기_(준비플래그_, 1, 21600); } catch (e) {}
    return 만듦;
  }, 120000);
}

/** 설정 시트에 새 항목이 생겼으면 빠진 항목만 아래에 붙입니다 (값은 건드리지 않음) */
function 설정보충_() {
  var sh = sheet_(SHEET.설정);
  var have = {};
  rows_(SHEET.설정).forEach(function (r) { have[str_(r.항목)] = true; });
  var add = 기본설정_().filter(function (r) { return !have[r[0]]; });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setValues(add);
  sh.getRange(2, 2, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
}

function 안내시트_() {
  var ss = ss_();
  var sh = ss.insertSheet(SHEET.안내);
  var rows = [
    ['체육교사 보조 프로그램 · 안내', ''],
    ['', ''],
    ['시트', '설명'],
    ['설정', '프로그램 이름, 학교 정보, 모듈 켜고 끄기(모듈.XXX 를 Y/N). 대부분 선생님 화면 > 설정에서 바꿀 수 있습니다.'],
    ['학생', '유일한 학생 명단. 학생ID는 바뀌지 않고, 학년·반·번호는 매년 바뀝니다. 선생님 화면 > 학생 명단에서 관리합니다.'],
    ['수업_*', '수업 도우미 모듈 시트'], ['평가_*', '수행평가 모듈 시트 (계획·결과·상호평가)'],
    ['PAPS_*', 'PAPS 모듈 시트'], ['체력_*', '건강체력교실 모듈 시트'], ['줄넘기_*', '줄넘기 모듈 시트'],
    ['FMS_*', 'FMS 도전 모듈 시트'], ['클럽_*', '스포츠클럽 모듈 시트'],
    ['', ''],
    ['교사 비밀번호', '초기값 1234. 잊었으면 메뉴 체육교사 보조 > 교사 비밀번호 초기화'],
    ['학생 비밀번호', '초기 비밀번호는 자동 생성되어 학생 시트에 보입니다. 학생이 바꾸면 암호화되어 선생님도 볼 수 없고, 잊으면 학생 명단에서 초기화합니다.'],
    ['자료가 느릴 때', '메뉴 체육교사 보조 > 캐시 비우기']
  ];
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sh.getRange(3, 1, 1, 2).setFontWeight('bold').setBackground('#E3F2EF');
  sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 640);
}

function 초기설정() {
  var r = 준비_();
  알림_((r.length ? '새로 만든 것\n · ' + r.join('\n · ') : '이미 모두 준비되어 있습니다.') +
        '\n\n교사 비밀번호 초기값은 ' + 기본교사비번 + ' 입니다.');
}

function 교사비밀번호초기화() {
  속성저장_(PW_KEY, hash_(기본교사비번));
  알림_('교사 비밀번호를 ' + 기본교사비번 + ' 으로 되돌렸습니다.');
}

function 캐시비우기() {
  캐시지우기_('설정'); 캐시지우기_('학생'); 캐시지우기_(준비플래그_);
  MODULES.forEach(function (m) {
    var h = 모듈훅_(m.key);
    if (h && typeof h.캐시지우기 === 'function') { try { h.캐시지우기(); } catch (e) {} }
  });
  알림_('캐시를 비웠습니다. 다음 접속부터 시트를 다시 읽습니다.');
}

function 상태점검() {
  var 줄 = ['버전 ' + APP_VERSION, '학교급: ' + 학교급_().이름];
  줄.push('시트 설정: ' + (findSheet_(SHEET.설정) ? '있음' : '없음 ✗'));
  줄.push('시트 학생: ' + (findSheet_(SHEET.학생) ? 학생목록_(true).length + '명' : '없음 ✗'));
  줄.push('교사 비밀번호: ' + (속성_(PW_KEY) ? '설정됨' : '설정 안 됨 ✗'));
  var 상태 = 모듈상태_(), s = 설정_();
  MODULES.forEach(function (m) {
    줄.push('모듈 ' + m.이름 + ': ' + (!모듈지원_(m) ? '해당 없음(' + 학교급_().이름 + ')' : 모듈설치됨_(m.key) ? (상태[m.key] ? '켜짐' : '꺼짐(설정 모듈.' + m.key + '=' + str_(s['모듈.' + m.key]) + ')') : '파일 없음'));
  });
  var 결과 = 줄.join('\n');
  알림_(결과);
  return 결과;
}

/* ================= 설정 ================= */

var _설정메모 = null;
function 설정_() {
  if (_설정메모) return _설정메모;
  _설정메모 = 캐시_('설정', function () {
    var out = {};
    기본설정_().forEach(function (r) { out[r[0]] = r[1]; });
    rows_(SHEET.설정).forEach(function (r) {
      var k = str_(r.항목);
      if (k) out[k] = str_(r.값);
    });
    return out;
  });
  return _설정메모;
}

function 설정저장_(map) {
  var sh = sheet_(SHEET.설정);
  var values = sh.getDataRange().getValues();
  var rowOf = {};
  for (var r = 1; r < values.length; r++) rowOf[str_(values[r][0])] = r + 1;
  var 설명 = {};
  기본설정_().forEach(function (x) { 설명[x[0]] = x[2]; });
  Object.keys(map).forEach(function (k) {
    var v = map[k] === null || map[k] === undefined ? '' : String(map[k]);
    if (rowOf[k]) sh.getRange(rowOf[k], 2).setValue(v);
    else { sh.appendRow([k, v, 설명[k] || '']); rowOf[k] = sh.getLastRow(); }
  });
  _설정메모 = null; 캐시지우기_('설정');
}

/** 화면에 내려보낼 설정 */
function 공개설정_() {
  var s = 설정_(), 급 = 학교급_();
  var 학년범위 = 목록_(s.학년범위).map(Number).filter(function (g) { return g >= 1 && g <= 급.최대학년; });
  return {
    프로그램이름: str_(s.프로그램이름) || 기본프로그램이름,
    학생용이름: str_(s.학생용이름) || 기본학생용이름,
    학교명: str_(s.학교명), 학교장: str_(s.학교장), 담당자: str_(s.담당자), 전화: str_(s.전화), 이메일: str_(s.이메일),
    학년도: str_(s.학년도),
    학교급: 급.급, 학교급이름: 급.이름, 최대학년: 급.최대학년, 학년들: 급.학년들.slice(),   // 학년들: 이 학교급의 모든 학년 (화면의 학년 고르기용)
    학년범위: 학년범위.length ? 학년범위 : 급.학년들.slice(),
    반범위: Math.max(1, Math.min(30, num_(s.반범위) || 15)),
    자동나가기분: Math.max(1, Math.min(60, num_(s.자동나가기분) || 3)),
    학생로그인: str_(s.학생로그인) === '입력칸' ? '입력칸' : '숫자판',
    테마: 테마_(s.테마), 테마목록: 테마들.slice()
  };
}

/* ================= 세션 ================= */

function 세션저장_(obj, 초) {
  var token = uuid_();
  CacheService.getScriptCache().put('S_' + ck_(token), JSON.stringify(obj), 초 || 세션시간);
  return token;
}
function 세션_(token) {
  var raw = token ? CacheService.getScriptCache().get('S_' + ck_(token)) : null;
  if (!raw) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  return JSON.parse(raw);
}
function 교사확인_(token) {
  var s = 세션_(token);
  if (s.역할 !== '교사') throw new Error('교사만 할 수 있는 작업입니다. 다시 로그인해 주세요.');
  return s;
}
/** 학생 세션. 돌려주는 값은 학생 객체 { 학생ID, 학년, 반, 번호, 이름, 성별 } */
function 학생확인_(token) {
  var s = 세션_(token);
  if (s.역할 !== '학생') throw new Error('학생 로그인이 필요합니다. 다시 로그인해 주세요.');
  return s.학생;
}
function logout(token) {
  if (token) CacheService.getScriptCache().remove('S_' + ck_(token));
  return true;
}

/* ================= 로그인 ================= */

/** 로그인 화면용. 학년 → 반 → 번호 목록(재학생만, 이름 없음) */
function getLoginInfo() {
  var created = 준비_();
  var 표 = {};
  학생목록_(false).forEach(function (s) {
    if (!s.반 || !s.번호) return;
    var g = String(s.학년), c = String(s.반);
    if (!표[g]) 표[g] = {};
    if (!표[g][c]) 표[g][c] = [];
    표[g][c].push(s.번호);
  });
  var 숫자순 = function (a, b) { return Number(a) - Number(b); };
  var 공개 = 공개설정_();
  return {
    제목: 공개.프로그램이름, 학생용이름: 공개.학생용이름, 학교명: 공개.학교명, 버전: APP_VERSION,
    학생로그인: 공개.학생로그인, 자동나가기분: 공개.자동나가기분, 테마: 공개.테마,
    모듈: 모듈목록_().filter(function (m) { return m.사용; }).map(function (m) { return { key: m.key, 이름: m.이름, 아이콘: m.아이콘, 색: m.색, 학생화면: m.학생화면 }; }),   // 로그인 화면: 학생 탭엔 학생화면 모듈만, 선생님 탭엔 전부
    학급: Object.keys(표).sort(숫자순).map(function (g) {
      return { 학년: Number(g), 반들: Object.keys(표[g]).sort(숫자순).map(function (c) {
        return { 반: Number(c), 번호: 표[g][c].sort(숫자순) }; }) };
    }),
    setupCreated: created
  };
}

function loginTeacher(비밀번호) {
  준비_();
  var saved = 속성_(PW_KEY);
  if (hash_(비밀번호) !== saved) return { ok: false, message: '비밀번호가 맞지 않습니다.' };
  var 토큰 = 세션저장_({ 역할: '교사' });
  var res = { ok: true, 토큰: 토큰, 기본비번여부: hash_(기본교사비번) === saved };
  try { res.boot = t_boot(토큰); res.boot.홈 = 홈자료_(); } catch (e) {}   // 로그인 한 번에 부팅 자료까지 (왕복 2번 절약)
  return res;
}

function changeTeacherPassword(token, 현재, 새것) {
  교사확인_(token);
  if (hash_(현재) !== 속성_(PW_KEY)) return { ok: false, message: '현재 비밀번호가 맞지 않습니다.' };
  새것 = str_(새것);
  if (새것.length < 4) return { ok: false, message: '새 비밀번호는 4자 이상으로 해 주세요.' };
  if (새것 === 기본교사비번) return { ok: false, message: '초기 비밀번호(1234)와 다른 비밀번호를 정해 주세요.' };
  속성저장_(PW_KEY, hash_(새것));
  return { ok: true };
}

function loginStudent(학년, 반, 번호, 비밀번호) {
  준비_();
  var pin = str_(비밀번호);
  var hit = null;
  학생목록_(false).some(function (s) {
    if (s.학년 === Number(학년) && s.반 === Number(반) && s.번호 === Number(번호)) { hit = s; return true; }
    return false;
  });
  if (!hit) return { ok: false, message: '그 번호의 학생이 없어요. 학년·반·번호를 다시 골라요.' };

  var cache = CacheService.getScriptCache();
  var failKey = 'F_' + ck_(hit.학생ID);
  var fails = Number(cache.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return { ok: false, message: '여러 번 틀렸어요. 1분 뒤에 다시 해 봐요.' };
  if (hit.비번상태 === '없음') return { ok: false, message: '아직 비밀번호가 없어요. 선생님께 말씀드려요.' };
  if (!비번맞나_(hit, pin)) {
    fails++;
    cache.put(failKey, String(fails), 60);
    return { ok: false, message: fails >= MAX_FAILS ? '여러 번 틀렸어요. 1분 뒤에 다시 해 봐요.' : '비밀번호가 달라요. 다시 눌러요.' };
  }
  cache.remove(failKey);
  var me = 학생공개_(hit);
  var 토큰 = 세션저장_({ 역할: '학생', 학생: me }, 학생세션시간);
  var res = { ok: true, 토큰: 토큰, 학생: me, 초기비번여부: hit.비번상태 === '초기' };
  try { res.boot = s_boot(토큰); } catch (e) {}   // 로그인 한 번에 부팅 자료까지
  return res;
}

/** 학생이 자기 비밀번호 바꾸기 (숫자 4자리) */
function s_changePin(token, 현재, 새것, 확인) {
  var me = 학생확인_(token);
  현재 = str_(현재); 새것 = str_(새것); 확인 = str_(확인);
  if (!/^[0-9]{4}$/.test(새것)) return { ok: false, message: '새 비밀번호는 숫자 4자리예요.' };
  if (새것 !== 확인) return { ok: false, message: '두 번 누른 번호가 달라요.' };
  if (새것 === 현재) return { ok: false, message: '지금 비밀번호와 다른 번호로 정해요.' };
  return withLock_(function () {
    var row = 학생찾기_(me.학생ID);
    if (!row) return { ok: false, message: '학생 정보를 찾을 수 없어요.' };
    if (!비번맞나_(row, 현재)) return { ok: false, message: '지금 비밀번호가 달라요.' };
    setCells_(SHEET.학생, HEADERS.학생, row._row, { 초기비밀번호: '', 비밀번호해시: 핀해시_(me.학생ID, 새것), 수정일시: 지금_() });
    캐시지우기_('학생');
    return { ok: true };
  });
}

/* ---------- 비밀번호 내부 ---------- */

function 핀정리_(v) {
  var s = str_(v);
  return /^[0-9]{1,4}$/.test(s) ? ('0000' + s).slice(-4) : s;
}
function 비번상태_(r) {
  if (str_(r.비밀번호해시)) return '변경함';
  if (str_(r.초기비밀번호)) return '초기';
  return '없음';
}
function 비번맞나_(s, pin) {
  if (s.비번상태 === '변경함') return 핀해시_(s.학생ID, pin) === s.비밀번호해시;
  if (s.비번상태 === '초기') return s.초기비밀번호 === pin;
  return false;
}
function 핀해시_(학생ID, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    핀솔트_() + '|' + 학생ID + '|' + pin, Utilities.Charset.UTF_8));
}
function 핀솔트_() {
  var salt = 속성_('PIN_SALT');
  if (!salt) { salt = uuid_(); 속성저장_('PIN_SALT', salt); }
  return salt;
}
/** 0000, 1234 같은 쉬운 번호는 피해서 만듦 */
function 랜덤핀_() {
  for (var i = 0; i < 50; i++) {
    var pin = ('0000' + Math.floor(Math.random() * 10000)).slice(-4);
    if (/^([0-9])\1{3}$/.test(pin)) continue;
    if ('0123456789'.indexOf(pin) >= 0 || '9876543210'.indexOf(pin) >= 0) continue;
    return pin;
  }
  return '2580';
}

/* ================= 학생 명단 ================= */

/**
 * 전체 학생. 포함졸업=false 면 재학생만.
 * 캐시에 두고 명단을 고칠 때마다 지웁니다.
 */
function 학생목록_(포함졸업) {
  var all = 캐시_('학생', function () {
    return rows_(SHEET.학생).map(function (r) {
      return {
        학생ID: str_(r.학생ID), 학년: num_(r.학년) || 0, 반: num_(r.반) || 0, 번호: num_(r.번호) || 0,
        이름: str_(r.이름), 성별: str_(r.성별) === '여' ? '여' : (str_(r.성별) === '남' ? '남' : ''),
        초기비밀번호: 핀정리_(r.초기비밀번호), 비밀번호해시: str_(r.비밀번호해시), 비번상태: 비번상태_(r),
        상태: 학생상태.indexOf(str_(r.상태)) >= 0 ? str_(r.상태) : '재학',
        비고: str_(r.비고), 등록일: 날짜정리_(r.등록일), _row: r._row
      };
    }).filter(function (s) { return s.이름; }).sort(학생정렬_);
  });
  return 포함졸업 ? all : all.filter(function (s) { return s.상태 === '재학'; });
}

function 학생정렬_(a, b) {
  return (a.학년 - b.학년) || (a.반 - b.반) || (a.번호 - b.번호) || a.이름.localeCompare(b.이름, 'ko');
}

/** { 학생ID: 학생 } */
function 학생맵_(포함졸업) {
  var m = {};
  학생목록_(포함졸업).forEach(function (s) { m[s.학생ID] = s; });
  return m;
}

function 학생찾기_(학생ID) {
  var all = 학생목록_(true);
  for (var i = 0; i < all.length; i++) if (all[i].학생ID === 학생ID) return all[i];
  return null;
}

/** 화면·세션용 (비밀번호 제외) */
function 학생공개_(s) {
  return { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 성별: s.성별, 상태: s.상태 };
}

/** 교사 명단 화면용 (초기 비밀번호는 보이고 해시는 상태만) */
function 학생명단행_(s) {
  return { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 성별: s.성별, 상태: s.상태, 비고: s.비고,
           등록일: s.등록일, 비번상태: s.비번상태, 초기비밀번호: s.비번상태 === '초기' ? s.초기비밀번호 : '' };
}

function 새학생ID_() {
  var y = str_(설정_().학년도).slice(-2) || Utilities.formatDate(new Date(), tz_(), 'yy');
  var max = 0;
  학생목록_(true).forEach(function (s) {
    var m = s.학생ID.match(/^S(\d{2})-(\d+)$/);
    if (m && m[1] === y) max = Math.max(max, Number(m[2]));
  });
  return 'S' + y + '-' + ('0000' + (max + 1)).slice(-4);
}

/**
 * 학생 한 명 저장. m = { 학생ID?, 학년, 반, 번호, 이름, 성별, 비고, 비밀번호?, 상태? }
 * 비밀번호를 넣으면 그 번호로 초기 비밀번호를 정합니다(학생이 바꾼 것은 지워짐).
 */
function 학생저장_(m) {
  var 학년 = Number(m.학년), 반 = Number(m.반), 번호 = Number(m.번호), 이름 = str_(m.이름), pin = str_(m.비밀번호);
  var 공개 = 공개설정_();
  if (!이름) return { ok: false, message: '이름을 입력해 주세요.' };
  if (공개.학년범위.indexOf(학년) < 0) return { ok: false, message: '학년은 ' + 공개.학년범위.join('·') + ' 중에서 골라 주세요.' };
  if (!(반 >= 1 && 반 <= 공개.반범위)) return { ok: false, message: '반은 1~' + 공개.반범위 + ' 사이로 입력해 주세요.' };
  if (!(번호 >= 1 && 번호 <= 99)) return { ok: false, message: '번호는 1~99 사이로 입력해 주세요.' };
  if (pin && !/^[0-9]{4}$/.test(pin)) return { ok: false, message: '비밀번호는 숫자 4자리로 입력해 주세요.' };
  var 성별 = str_(m.성별) === '여' ? '여' : (str_(m.성별) === '남' ? '남' : '');
  var 상태 = 학생상태.indexOf(str_(m.상태)) >= 0 ? str_(m.상태) : null;

  var all = 학생목록_(true);
  var id = str_(m.학생ID), existing = null;
  if (id) {
    existing = all.filter(function (s) { return s.학생ID === id; })[0];
    if (!existing) return { ok: false, message: '수정할 학생을 찾을 수 없습니다.' };
  }
  var dup = all.filter(function (s) {
    return s.상태 === '재학' && s.학년 === 학년 && s.반 === 반 && s.번호 === 번호 && s.학생ID !== id;
  })[0];
  if (dup) return { ok: false, message: 학년 + '학년 ' + 반 + '반 ' + 번호 + '번은 이미 ' + dup.이름 + ' 학생입니다.' };

  var fields = { 학년: 학년, 반: 반, 번호: 번호, 이름: 이름, 성별: 성별, 수정일시: 지금_() };
  if (m.비고 !== undefined) fields.비고 = str_(m.비고);
  if (상태) fields.상태 = 상태;
  if (pin) { fields.초기비밀번호 = pin; fields.비밀번호해시 = ''; }

  if (existing) {
    setCells_(SHEET.학생, HEADERS.학생, existing._row, fields);
  } else {
    id = 새학생ID_();
    fields.학생ID = id; fields.상태 = 상태 || '재학'; fields.등록일 = 오늘_();
    if (!pin) { fields.초기비밀번호 = 랜덤핀_(); fields.비밀번호해시 = ''; }
    appendRow_(SHEET.학생, HEADERS.학생, fields);
    // 초기비밀번호 열은 텍스트 서식 (0으로 시작하는 번호 보존)
    var sh = sheet_(SHEET.학생), have = ensureColumns_(SHEET.학생, HEADERS.학생);
    sh.getRange(sh.getLastRow(), have.indexOf('초기비밀번호') + 1).setNumberFormat('@').setValue(fields.초기비밀번호);
  }
  캐시지우기_('학생');
  return { ok: true, 학생ID: id };
}

function 명단응답_() {
  return { 학생: 학생목록_(true).map(학생명단행_) };
}

/* ---------- 교사 API ---------- */

/** 교사 화면 부팅: 설정·모듈·명단·주소 */
function t_boot(token) {
  교사확인_(token);
  var saved = 속성_(PW_KEY);
  var url = 앱주소_();
  return {
    설정: 공개설정_(), 모듈: 모듈목록_(), 학생: 학생목록_(true).map(학생명단행_),
    오늘: 오늘_(), 앱URL: url, 시트URL: ss_().getUrl(), 기본비번여부: hash_(기본교사비번) === saved, 버전: APP_VERSION,
    업데이트: (typeof 업데이트_확인_ === 'function') ? 업데이트_확인_(false) : null
  };
}

function t_getStudents(token) { 교사확인_(token); return 명단응답_(); }

function t_saveStudent(token, m) {
  교사확인_(token);
  return withLock_(function () {
    var r = 학생저장_(m || {});
    if (!r.ok) return r;
    var out = 명단응답_(); out.ok = true; out.학생ID = r.학생ID;
    return out;
  });
}

/**
 * 명렬 붙여넣기. 한 줄에 "번호 이름 (성별)" 또는 "학년 반 번호 이름 (성별)". 탭·쉼표·공백 구분.
 * 옵션.매칭 = true 면 같은 학년에 반·번호가 비어 있는 같은 이름의 학생이 있을 때(학년 올리기 뒤) 새로 만들지 않고 그 학생의 반·번호를 채웁니다.
 */
function t_bulkAdd(token, 학년, 반, 텍스트, 옵션) {
  교사확인_(token);
  옵션 = 옵션 || {};
  return withLock_(function () {
    var added = 0, matched = 0, failed = [];
    var 대기 = 학생목록_(true).filter(function (s) { return s.상태 === '재학' && (!s.반 || !s.번호); });
    String(텍스트 || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var nums = [], name = null, sex = '';
      line.split(/[\t,]+|\s+/).forEach(function (tok) {
        if (!tok) return;
        if (/^[0-9]{1,3}$/.test(tok)) nums.push(Number(tok));
        else if (/^(남|여|남자|여자|M|F|m|f)$/.test(tok)) sex = /^(여|여자|F|f)$/.test(tok) ? '여' : '남';
        else if (name === null) name = tok;
      });
      var g = Number(학년), c = Number(반), n = null;
      if (nums.length >= 3) { g = nums[0]; c = nums[1]; n = nums[2]; }
      else if (nums.length >= 1) n = nums[nums.length - 1];
      if (!name || !n) { failed.push(line); return; }
      var target = null;
      if (옵션.매칭) {
        target = 대기.filter(function (s) { return s.이름 === name && s.학년 === g; })[0];
        if (target) 대기 = 대기.filter(function (s) { return s !== target; });
      }
      var r = 학생저장_({ 학생ID: target ? target.학생ID : '', 학년: g, 반: c, 번호: n, 이름: name, 성별: sex || (target ? target.성별 : '') });
      if (r.ok) { if (target) matched++; else added++; }
      else failed.push(line + ' (' + r.message + ')');
    });
    var out = 명단응답_();
    out.ok = added + matched > 0; out.added = added; out.matched = matched; out.failed = failed;
    out.message = out.ok ? '' : '읽어 들일 학생이 없습니다.';
    return out;
  }, 60000);
}

/** 학생 삭제: 명단과 모든 모듈의 그 학생 기록을 지웁니다 */
function t_deleteStudents(token, ids, 확인문구) {
  교사확인_(token);
  if (str_(확인문구) !== '삭제') return { ok: false, message: '확인 칸에 삭제라고 입력해 주세요.' };
  var set = {};
  (ids || []).forEach(function (id) { set[str_(id)] = true; });
  return withLock_(function () {
    var n = 행지우기_(SHEET.학생, function (r) { return set[str_(r.학생ID)]; });
    var 모듈결과 = {};
    MODULES.forEach(function (m) {
      var h = 모듈훅_(m.key);
      if (h && typeof h.명단삭제후 === 'function') { try { 모듈결과[m.key] = h.명단삭제후(Object.keys(set)); } catch (e) { 모듈결과[m.key] = '실패: ' + e.message; } }
    });
    캐시지우기_('학생');
    var out = 명단응답_(); out.ok = true; out.deleted = n; out.모듈 = 모듈결과;
    return out;
  }, 60000);
}

/** 선택한 학생들의 비밀번호를 새 초기 비밀번호로 */
function t_resetPins(token, ids) {
  교사확인_(token);
  return withLock_(function () {
    var n = 0, cache = CacheService.getScriptCache();
    (ids || []).forEach(function (id) {
      var s = 학생찾기_(str_(id));
      if (!s) return;
      setCells_(SHEET.학생, HEADERS.학생, s._row, { 초기비밀번호: 랜덤핀_(), 비밀번호해시: '', 수정일시: 지금_() });
      cache.remove('F_' + ck_(s.학생ID));
      n++;
    });
    캐시지우기_('학생');
    var out = 명단응답_(); out.ok = n > 0; out.count = n; out.message = n ? '' : '바꿀 학생이 없습니다.';
    return out;
  }, 30000);
}

/** 학생 비밀번호를 교사가 직접 정함 */
function t_setPin(token, 학생ID, pin) {
  교사확인_(token);
  pin = str_(pin);
  if (!/^[0-9]{4}$/.test(pin)) return { ok: false, message: '비밀번호는 숫자 4자리로 정해 주세요.' };
  return withLock_(function () {
    var s = 학생찾기_(str_(학생ID));
    if (!s) return { ok: false, message: '학생을 찾을 수 없습니다.' };
    setCells_(SHEET.학생, HEADERS.학생, s._row, { 초기비밀번호: pin, 비밀번호해시: '', 수정일시: 지금_() });
    CacheService.getScriptCache().remove('F_' + ck_(s.학생ID));
    캐시지우기_('학생');
    var out = 명단응답_(); out.ok = true;
    return out;
  });
}

/** 상태 바꾸기: 재학 / 졸업 / 전출 */
function t_setStatus(token, ids, 상태) {
  교사확인_(token);
  if (학생상태.indexOf(str_(상태)) < 0) return { ok: false, message: '상태는 재학·졸업·전출 중 하나입니다.' };
  return withLock_(function () {
    var n = 0;
    (ids || []).forEach(function (id) {
      var s = 학생찾기_(str_(id));
      if (!s) return;
      setCells_(SHEET.학생, HEADERS.학생, s._row, { 상태: 상태, 수정일시: 지금_() });
      n++;
    });
    캐시지우기_('학생');
    var out = 명단응답_(); out.ok = n > 0; out.count = n;
    return out;
  }, 30000);
}

/**
 * 학년 올리기. 선택한 재학생의 학년을 +1 하고 반·번호를 비웁니다(새 학기에 명렬 붙여넣기 > 기존 학생 매칭으로 채움).
 * 마지막 학년(초등 6 · 중등 3)은 졸업 처리. 기록은 학생ID로 연결되어 그대로 남습니다.
 */
function t_promote(token, ids) {
  교사확인_(token);
  var 최대학년 = 학교급_().최대학년;
  return withLock_(function () {
    var 올림 = 0, 졸업 = 0;
    (ids || []).forEach(function (id) {
      var s = 학생찾기_(str_(id));
      if (!s || s.상태 !== '재학') return;
      if (s.학년 >= 최대학년) { setCells_(SHEET.학생, HEADERS.학생, s._row, { 상태: '졸업', 수정일시: 지금_() }); 졸업++; }
      else { setCells_(SHEET.학생, HEADERS.학생, s._row, { 학년: s.학년 + 1, 반: '', 번호: '', 수정일시: 지금_() }); 올림++; }
    });
    캐시지우기_('학생');
    var out = 명단응답_(); out.ok = 올림 + 졸업 > 0; out.올림 = 올림; out.졸업 = 졸업;
    return out;
  }, 60000);
}

/* ================= 설정 API ================= */

function t_getSettings(token) {
  교사확인_(token);
  var s = 설정_(), 모듈 = {};
  MODULES.forEach(function (m) { 모듈[m.key] = str_(s['모듈.' + m.key]).toUpperCase() !== 'N'; });
  return { 설정: 공개설정_(), 모듈: 모듈, 모듈목록: 모듈목록_() };
}

/** map = { 프로그램이름, 학교명, ..., 학교급:'초'|'중', 학년범위:[..], 반범위, 자동나가기분, 학생로그인, 모듈:{PAPS:true,...} } */
function t_saveSettings(token, map) {
  교사확인_(token);
  map = map || {};
  var put = {};
  ['프로그램이름', '학생용이름', '학교명', '학교장', '담당자', '전화', '이메일', '학년도', '학생로그인'].forEach(function (k) {
    if (map[k] !== undefined) put[k] = str_(map[k]);
  });
  if (!put.프로그램이름 && map.프로그램이름 !== undefined) put.프로그램이름 = 기본프로그램이름;
  if (!put.학생용이름 && map.학생용이름 !== undefined) put.학생용이름 = 기본학생용이름;
  if (map.테마 !== undefined) {
    if (테마들.indexOf(str_(map.테마)) < 0) return { ok: false, message: '없는 색상 테마입니다.' };
    put.테마 = str_(map.테마);
  }

  // 학교급이 바뀌면 학년 범위와 모듈별 대상 학년을 그 학교급의 기본값으로 되돌리고, 모듈에 알립니다 (PAPS 종목·기준표 등)
  var 급바뀜 = false, 새급 = 학교급_();
  if (map.학교급 !== undefined) {
    if (!학교급표[str_(map.학교급)]) return { ok: false, message: '학교급은 초 또는 중입니다.' };
    if (str_(map.학교급) !== 학교급_().급) { 급바뀜 = true; 새급 = 학교급_(map.학교급); put.학교급 = 새급.급; }
  }
  if (급바뀜) {
    put.학년범위 = 새급.기본학년범위;
  } else if (map.학년범위 !== undefined) {
    var g = (map.학년범위 || []).map(Number).filter(function (x) { return x >= 1 && x <= 새급.최대학년; });
    if (!g.length) return { ok: false, message: '학년을 하나 이상 골라 주세요.' };
    put.학년범위 = g.sort(function (a, b) { return a - b; }).join(',');
  }
  if (map.반범위 !== undefined) {
    var c = num_(map.반범위);
    if (!c || c < 1 || c > 30) return { ok: false, message: '반 수는 1~30 사이로 정해 주세요.' };
    put.반범위 = String(c);
  }
  if (map.자동나가기분 !== undefined) {
    var i = num_(map.자동나가기분);
    if (!i || i < 1 || i > 60) return { ok: false, message: '자동 나가기는 1~60분 사이로 정해 주세요.' };
    put.자동나가기분 = String(i);
  }
  if (map.모듈) MODULES.forEach(function (m) { if (map.모듈[m.key] !== undefined) put['모듈.' + m.key] = map.모듈[m.key] ? 'Y' : 'N'; });
  설정저장_(put);
  var 바뀐것 = [];
  if (급바뀜) {
    바뀐것 = withLock_(function () {
      var out = [];
      MODULES.forEach(function (m) {
        var h = 모듈훅_(m.key);
        if (h && typeof h.학교급변경 === 'function') { try { out = out.concat(h.학교급변경(새급) || []); } catch (e) { out.push(m.이름 + ': ' + e.message); } }
      });
      return out;
    }, 60000);
    캐시지우기_(준비플래그_);   // 새 학교급에서 쓰는 모듈 시트를 다음 접속 때 확인
    준비_();
  }
  return { ok: true, 설정: 공개설정_(), 모듈목록: 모듈목록_(), 학교급바뀜: 급바뀜, 바뀐것: 바뀐것 };
}

/* ================= 통합 배지 ================= */

/* 모듈을 가로지르는 배지: [id, 이름, 설명, 아이콘, 조건(모듈수 | 배지수), 기준] */
var 통합배지 = [
  ['ALL-1',  '첫 발걸음',     '어떤 활동이든 첫 배지를 받았어요',        'shoe',        '배지수', 1],
  ['ALL-2',  '두 가지 활동',  '두 가지 활동에서 배지를 받았어요',        'circles',     '모듈수', 2],
  ['ALL-3',  '세 가지 활동',  '세 가지 활동에서 배지를 받았어요',        'hexagons',    '모듈수', 3],
  ['ALL-4',  '체육 만능',     '참여하는 모든 활동에서 배지를 받았어요',  'trophy',      '전부', 1],
  ['ALL-10', '배지 수집가',   '배지 10개',                               'stack-2',     '배지수', 10],
  ['ALL-30', '배지 마스터',   '배지 30개',                               'crown',       '배지수', 30]
];

/**
 * 학생 한 명의 배지 묶음. 모듈 hooks.학생배지(학생ID) → [{id, 이름, 설명, 아이콘, 달성, 진행, 값, 기준}]
 * 학생이 참여하지 않는 모듈(학생참여 false)이나 배지가 없는 모듈은 빠집니다.
 */
function 학생배지묶음_(학생ID) {
  var 상태 = 모듈상태_(), 모듈 = [], 총달성 = 0, 총전체 = 0, 참여수 = 0, 달성모듈 = 0;
  MODULES.forEach(function (m) {
    if (!상태[m.key]) return;
    var h = 모듈훅_(m.key) || {};
    if (typeof h.학생배지 !== 'function') return;
    var 참여 = true;
    if (typeof h.학생참여 === 'function') { try { 참여 = !!h.학생참여(학생ID); } catch (e) { 참여 = false; } }
    if (!참여) return;
    var list = [];
    try { list = h.학생배지(학생ID) || []; } catch (e) { list = []; }
    if (!list.length) return;
    참여수++;
    var 달성 = list.filter(function (b) { return b.달성; }).length;
    if (달성) 달성모듈++;
    총달성 += 달성; 총전체 += list.length;
    모듈.push({ key: m.key, 이름: m.이름, 색: m.색, 아이콘: m.아이콘, 배지: list, 달성수: 달성, 전체수: list.length });
  });
  var 통합 = 통합배지.map(function (b) {
    var v = b[4] === '모듈수' ? 달성모듈 : b[4] === '배지수' ? 총달성 : (참여수 > 0 && 달성모듈 >= 참여수 ? 1 : 0);
    var 기준 = b[4] === '전부' ? 1 : b[5];
    return { id: b[0], 이름: b[1], 설명: b[4] === '전부' && 참여수 ? b[2] + ' (' + 참여수 + '개)' : b[2], 아이콘: b[3], 달성: v >= 기준 && (b[4] !== '전부' || 참여수 > 0), 진행: Math.min(100, Math.round(v / 기준 * 100)), 값: v, 기준: 기준 };
  });
  return { 모듈: 모듈, 통합: 통합, 총달성: 총달성 + 통합.filter(function (b) { return b.달성; }).length, 총전체: 총전체 + 통합.length, 참여수: 참여수 };
}

function s_badges(token) {
  var me = 학생확인_(token);
  return 학생배지묶음_(me.학생ID);
}

/** 교사: 학생 한 명의 종합 프로필 (카드 + 배지) */
function t_studentProfile(token, 학생ID) {
  교사확인_(token);
  var st = 학생찾기_(학생ID);
  if (!st) throw new Error('학생을 찾지 못했습니다.');
  var 상태 = 모듈상태_(), 카드 = [];
  MODULES.forEach(function (m) {
    if (!상태[m.key]) return;
    var h = 모듈훅_(m.key) || {}, 참여 = true;
    if (typeof h.학생참여 === 'function') { try { 참여 = !!h.학생참여(학생ID); } catch (e) { 참여 = false; } }
    if (typeof h.학생프로필 === 'function' && 참여) {
      try { var c = h.학생프로필(학생ID); if (c) { c.모듈 = m.key; 카드.push(c); } } catch (e) {}
    }
  });
  return { 학생: 학생공개_(st), 카드: 카드, 배지: 학생배지묶음_(학생ID) };
}

/** 교사: 한 반의 배지 현황표 */
function t_badgeSummary(token, 학년, 반) {
  교사확인_(token);
  var g = num_(학년) || 0, c = num_(반) || 0;
  var 학생 = 학생목록_(false).filter(function (s) { return (!g || s.학년 === g) && (!c || s.반 === c); });
  var 모듈키 = [], 모듈이름 = {};
  var rows = 학생.map(function (s) {
    var b = 학생배지묶음_(s.학생ID), 모듈별 = {};
    b.모듈.forEach(function (m) { 모듈별[m.key] = m.달성수 + '/' + m.전체수; if (모듈키.indexOf(m.key) < 0) { 모듈키.push(m.key); 모듈이름[m.key] = m.이름; } });
    return { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 모듈별: 모듈별, 통합: b.통합.filter(function (x) { return x.달성; }).length, 총달성: b.총달성, 총전체: b.총전체,
             최근: b.모듈.reduce(function (acc, m) { return acc.concat(m.배지.filter(function (x) { return x.달성; }).slice(-1).map(function (x) { return x.이름; })); }, []) };
  });
  return { 학생: rows, 모듈: 모듈키.map(function (k) { return { key: k, 이름: 모듈이름[k] }; }) };
}

/* ================= 홈 · 프로필 ================= */

/**
 * 교사 대시보드. 모듈마다 hooks.교사대시보드() 가 돌려주는 카드를 모읍니다.
 * 카드 = { 제목, 값, 단위, 설명, 배지(대기 건수 등), 이동:'모듈:페이지' }
 */
function t_home(token) { 교사확인_(token); return 홈자료_(); }
function 홈자료_() {
  var 학생 = 학생목록_(false);
  var 학년별 = {};
  학생.forEach(function (s) { 학년별[s.학년] = (학년별[s.학년] || 0) + 1; });
  var 카드 = [], 대기 = {};
  MODULES.forEach(function (m) {
    if (!모듈상태_()[m.key]) return;
    var h = 모듈훅_(m.key);
    if (!h || typeof h.교사대시보드 !== 'function') return;
    try {
      var r = h.교사대시보드() || {};
      (r.카드 || []).forEach(function (c) { c.모듈 = m.key; 카드.push(c); });
      if (r.대기) 대기[m.key] = r.대기;
    } catch (e) { 카드.push({ 모듈: m.key, 제목: m.이름, 값: '', 설명: '불러오지 못했습니다: ' + e.message }); }
  });
  return { 학생수: 학생.length, 학년별: 학년별, 미배정: 학생.filter(function (s) { return !s.반 || !s.번호; }).length,
           카드: 카드, 대기: 대기, 오늘: 오늘_() };
}

/** 학생 부팅: 프로필 카드 + 어느 모듈 메뉴를 보여 줄지 */
function s_boot(token) {
  var me = 학생확인_(token);
  var 상태 = 모듈상태_(), 카드 = [], 메뉴 = {};
  MODULES.forEach(function (m) {
    if (!상태[m.key]) { 메뉴[m.key] = false; return; }
    var h = 모듈훅_(m.key) || {};
    var 참여 = true;
    if (typeof h.학생참여 === 'function') { try { 참여 = !!h.학생참여(me.학생ID); } catch (e) { 참여 = false; } }
    // 학생메뉴 훅이 있으면 그 모듈이 직접 판단합니다 (예: 수행평가 — 상호평가를 켠 평가가 있을 때만 학생 메뉴가 생김)
    var 화면 = m.학생화면;
    if (typeof h.학생메뉴 === 'function') { try { 화면 = !!h.학생메뉴(me.학생ID); } catch (e) { 화면 = false; } }
    메뉴[m.key] = 화면 && 참여;
    if (typeof h.학생프로필 === 'function' && 참여) {
      try { var c = h.학생프로필(me.학생ID); if (c) { c.모듈 = m.key; 카드.push(c); } } catch (e) {}
    }
  });
  var row = 학생찾기_(me.학생ID);
  var 배지 = 학생배지묶음_(me.학생ID);
  return { 학생: me, 카드: 카드, 메뉴: 메뉴, 초기비번여부: row ? row.비번상태 === '초기' : false, 오늘: 오늘_(), 설정: 공개설정_(), 배지수: 배지.총달성, 배지전체: 배지.총전체 };
}

/* ================= 초기화 ================= */

function t_resetInfo(token) {
  교사확인_(token);
  var 모듈 = {};
  MODULES.forEach(function (m) {
    if (!모듈상태_()[m.key]) return;
    var h = 모듈훅_(m.key);
    if (h && typeof h.초기화정보 === 'function') { try { 모듈[m.key] = h.초기화정보(); } catch (e) { 모듈[m.key] = { 오류: e.message }; } }
  });
  return { 학생: 학생목록_(true).length, 모듈: 모듈 };
}

/**
 * 초기화. opts = { 학생: true(명단까지), 모듈: { PAPS: {...모듈별 옵션}, ... } }
 * 되돌릴 수 없으므로 확인 문구를 받습니다.
 */
function t_resetAll(token, opts, 확인문구) {
  교사확인_(token);
  if (str_(확인문구) !== '초기화') return { ok: false, message: '확인 칸에 초기화라고 입력해 주세요.' };
  opts = opts || {};
  return withLock_(function () {
    var res = { 모듈: {} };
    Object.keys(opts.모듈 || {}).forEach(function (key) {
      var h = 모듈훅_(key);
      if (h && typeof h.초기화 === 'function') { try { res.모듈[key] = h.초기화(opts.모듈[key]); } catch (e) { res.모듈[key] = '실패: ' + e.message; } }
    });
    if (opts.학생) { res.학생 = 시트비우기_(SHEET.학생); 캐시지우기_('학생'); }
    return { ok: true, 지움: res };
  }, 120000);
}
