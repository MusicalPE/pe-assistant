/*******************************************************
 * 새 버전 알림 (Updater.gs)
 *
 * 이 프로그램은 "라이브러리" 방식으로 배포됩니다.
 *   원본 스크립트(라이브러리) ← 코드 전부.  선생님(관리자)이 고쳐서 "새 버전"으로 저장
 *   각 학교 스프레드시트   ← 껍데기(Shell.gs) 하나 + 라이브러리 연결
 * 새 버전이 나오면 GitHub 의 manifest.json 에 적어 두고, 프로그램은 그것을 읽어 "새 버전 N 이 있어요"라고 알립니다.
 * 실제 적용은 각 학교에서: 편집기 → 라이브러리 버전 바꾸기 → 배포 관리 → 새 버전. (구글이 스크립트가 스스로를 고치는 것을
 * 기본 프로젝트에서는 막아 두어 자동 교체는 할 수 없습니다)
 *
 * manifest.json: { "version": "1.0.0", "libraryVersion": 3, "date": "...", "notes": "..." }
 *******************************************************/

var 업데이트_저장소 = 'MusicalPE/pe-assistant';   // GitHub "아이디/저장소" — '_속성' 시트의 UPDATE_REPO 가 있으면 그것을 씀
var 업데이트_경로 = 'main';

function 업데이트주소_() {
  var p = '';
  try { p = 속성_('UPDATE_REPO') || ''; } catch (e) {}
  return 'https://raw.githubusercontent.com/' + (p || 업데이트_저장소) + '/' + 업데이트_경로 + '/';
}

/** "0.8.1" 과 "0.10.0" 비교. a<b → -1, 같음 0, a>b → 1 */
function 버전비교_(a, b) {
  var pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** 최신 버전 정보. 캐시 6시간 (force 면 새로 읽음, 오류는 5분만 기억). 실패해도 예외 대신 { 오류 } */
function 업데이트_확인_(force) {
  if (!force) { var c = 캐시읽기_('update_check'); if (c) return c; }
  var out;
  try {
    var res = UrlFetchApp.fetch(업데이트주소_() + 'manifest.json?t=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('업데이트 정보를 읽지 못했습니다 (' + res.getResponseCode() + ')');
    var m = JSON.parse(res.getContentText());
    if (!m.version) throw new Error('manifest.json 형식이 잘못되었습니다.');
    out = { 현재: APP_VERSION, 최신: String(m.version), 라이브러리버전: m.libraryVersion || null, 날짜: m.date || '', 메모: m.notes || '',
            새버전: 버전비교_(APP_VERSION, m.version) < 0, 확인시각: 지금_() };
  } catch (e) {
    out = { 현재: APP_VERSION, 최신: '', 새버전: false, 오류: e.message, 확인시각: 지금_() };
  }
  try { 캐시쓰기_('update_check', out, out.오류 ? 300 : 21600); } catch (e2) {}
  return out;
}

/** 편집기에서 ▶ 실행하면 권한 승인창이 뜹니다. 로그에 최신 버전 정보가 찍히면 성공 */
function 권한승인() {
  var r = 업데이트_확인_(true);
  Logger.log(r.오류 ? '아직 안 됨: ' + r.오류 : '성공 — 저장소 최신 v' + r.최신 + ' (지금 v' + r.현재 + ')');
  return r;
}

/** 새 버전을 적용하는 순서 (화면·메뉴에서 같이 씀) */
function 업데이트_안내문_(info) {
  return '적용 순서 (2분):\n' +
    '1. 스프레드시트 → 확장 프로그램 → Apps Script\n' +
    '2. 왼쪽 "라이브러리" 옆 PE 를 눌러 버전을 ' + (info && info.라이브러리버전 ? info.라이브러리버전 : '가장 큰 숫자') + ' 로 바꾸고 저장\n' +
    '3. 오른쪽 위 배포 → 배포 관리 → 연필 → 버전 "새 버전" → 배포\n' +
    '자료는 그대로이고 주소도 그대로입니다.';
}

/* ---------- 스프레드시트 메뉴 ---------- */

function 업데이트확인() {
  var ui = SpreadsheetApp.getUi();
  var info = 업데이트_확인_(true);
  if (info.오류) { ui.alert('업데이트 확인 실패', info.오류 + '\n\n주소: ' + 업데이트주소_(), ui.ButtonSet.OK); return; }
  if (!info.새버전) { ui.alert('최신 버전입니다', '지금 버전 v' + info.현재 + ' 이 최신입니다.' + (info.최신 ? ' (저장소 v' + info.최신 + ')' : ''), ui.ButtonSet.OK); return; }
  ui.alert('새 버전 v' + info.최신, 'v' + info.현재 + ' → v' + info.최신 + (info.날짜 ? ' (' + info.날짜 + ')' : '') + '\n\n' + (info.메모 || '') + '\n\n' + 업데이트_안내문_(info), ui.ButtonSet.OK);
}

/* ---------- 교사 화면 API ---------- */

function t_updateCheck(token, force) { 교사확인_(token); var i = 업데이트_확인_(!!force); i.주소 = 업데이트주소_(); i.안내 = 업데이트_안내문_(i); return i; }
