/*******************************************************
 * 자동 업데이트 (Updater.gs)
 *
 * GitHub 저장소에 올려 둔 최신 파일을 받아 이 Apps Script 프로젝트의 파일을 갈아 끼우고,
 * 새 버전을 만들어 기존 웹앱 배포에 연결합니다 (주소는 그대로).
 *
 *  - 자료(스프레드시트)는 건드리지 않습니다. 코드 파일만 바뀝니다.
 *  - 바꾸기 전 지금 코드를 드라이브에 JSON 으로 백업하고, "이전 버전으로 되돌리기"로 복구할 수 있습니다.
 *  - 조건: 구글 계정 설정에서 "Google Apps Script API" 를 켜야 합니다 (https://script.google.com/home/usersettings)
 *          appsscript.json 의 oauthScopes 에 script.projects · script.deployments 가 있어야 합니다.
 *          권한이 늘어난 뒤 승인창이 안 뜨면: 편집기에서 권한승인() 실행 → 그래도 안 되면 myaccount.google.com/permissions 에서
 *          이 프로젝트의 액세스를 삭제하고 다시 실행하면 승인창이 새로 뜹니다.
 *
 * 저장소 구조 (raw.githubusercontent.com 으로 읽습니다)
 *   MusicalPE/pe-assistant/main/manifest.json   { version, date, notes, files:[{ name:'Code.gs', type:'SERVER_JS' }, …] }
 *   MusicalPE/pe-assistant/main/Code.gs … (manifest 에 적힌 파일들)
 *******************************************************/

var 업데이트_저장소 = 'MusicalPE/pe-assistant';   // GitHub "아이디/저장소" — 스크립트 속성 UPDATE_REPO 가 있으면 그것을 씀
var 업데이트_경로 = 'main';                       // 브랜치 (파일은 저장소 맨 위에)
var 업데이트_백업키 = 'UPDATE_BACKUP_FILE_ID';
var 업데이트_마지막manifest_ = null;

function 업데이트주소_() {
  var p = '';
  try { p = PropertiesService.getScriptProperties().getProperty('UPDATE_REPO') || ''; } catch (e) {}
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

/** 최신 버전 정보. 캐시 6시간 (force 면 새로 읽음). 실패해도 예외 대신 { 오류 } */
function 업데이트_확인_(force) {
  if (!force) { var c = 캐시읽기_('update_check'); if (c) return c; }
  var out;
  try {
    var res = UrlFetchApp.fetch(업데이트주소_() + 'manifest.json?t=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('업데이트 정보를 읽지 못했습니다 (' + res.getResponseCode() + ')');
    var m = JSON.parse(res.getContentText());
    if (!m.version || !Array.isArray(m.files)) throw new Error('manifest.json 형식이 잘못되었습니다.');
    out = { 현재: APP_VERSION, 최신: String(m.version), 날짜: m.date || '', 메모: m.notes || '', 새버전: 버전비교_(APP_VERSION, m.version) < 0, 파일수: m.files.length, 확인시각: 지금_() };
    업데이트_마지막manifest_ = m;   // 실행 때 같은 manifest 를 씀 (GitHub 캐시가 어긋나 두 번 읽은 값이 달라지는 일 방지)
  } catch (e) {
    out = { 현재: APP_VERSION, 최신: '', 새버전: false, 오류: e.message, 확인시각: 지금_() };
  }
  try { 캐시쓰기_('update_check', out, out.오류 ? 300 : 21600); } catch (e2) {}   // 오류는 5분만 기억
  return out;
}

/** 편집기에서 ▶ 실행하면 권한 승인창이 뜹니다 (처음 설치·권한이 늘어난 뒤에 한 번). 로그에 최신 버전 정보가 찍히면 성공 */
function 권한승인() {
  var r = 업데이트_확인_(true);
  Logger.log(r.오류 ? '아직 안 됨: ' + r.오류 : '성공 — 저장소 최신 v' + r.최신 + ' (지금 v' + r.현재 + ')');
  return r;
}

/* ---------- Apps Script API ---------- */

function 업데이트_api_(method, path, body) {
  var res = UrlFetchApp.fetch('https://script.googleapis.com/v1/' + path, {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: body ? JSON.stringify(body) : undefined
  });
  var code = res.getResponseCode(), txt = res.getContentText();
  if (code >= 200 && code < 300) return txt ? JSON.parse(txt) : {};
  var msg = txt;
  try { msg = JSON.parse(txt).error.message || txt; } catch (e) {}
  if (code === 403 && /Apps Script API|has not been used|PERMISSION_DENIED|disabled/i.test(msg)) {
    throw new Error('구글 계정에서 Apps Script API 가 꺼져 있습니다. https://script.google.com/home/usersettings 에서 "Google Apps Script API" 를 켠 뒤 1분쯤 지나 다시 해 주세요.');
  }
  if (code === 403 && /insufficient|scope/i.test(msg)) {
    throw new Error('권한이 부족합니다. appsscript.json 의 oauthScopes 에 script.projects · script.deployments 가 있는지 확인하고, 배포를 새로 승인해 주세요.');
  }
  throw new Error('Apps Script API 오류 (' + code + '): ' + msg);
}

function 업데이트_파일형식_(name) {
  if (/\.gs$/.test(name)) return 'SERVER_JS';
  if (/\.html$/.test(name)) return 'HTML';
  if (/\.json$/.test(name)) return 'JSON';
  return null;
}
function 업데이트_파일이름_(name) { return name.replace(/\.(gs|html|json)$/, ''); }

/**
 * 업데이트 실행. 돌려주는 값: { ok, 이전, 새버전, 파일수, 배포수, 백업파일ID, 메시지 }
 * 흐름: manifest → 파일 내려받기 → 지금 코드 백업 → 프로젝트 내용 교체 → 새 버전 → 배포 갱신 → 캐시 비우기
 */
function 업데이트_실행_() {
  var base = 업데이트주소_();
  var info = 업데이트_확인_(true);
  if (info.오류) throw new Error(info.오류);
  var manifest = 업데이트_마지막manifest_;
  if (!manifest) throw new Error('업데이트 정보를 다시 읽지 못했습니다. 잠시 뒤 다시 해 주세요.');
  var 새버전 = String(manifest.version);
  if (버전비교_(APP_VERSION, 새버전) >= 0) throw new Error('이미 v' + APP_VERSION + ' 입니다 (저장소 v' + 새버전 + ').');
  var files = manifest.files.filter(function (f) { return f && f.name && 업데이트_파일형식_(f.name); });
  if (!files.length) throw new Error('manifest.json 에 파일 목록이 없습니다.');

  // 1) 새 파일 내려받기 (한 번에). GitHub 캐시가 아직 옛 파일을 주면 잠깐 기다렸다 최대 4번 다시 받음
  var 새파일 = {}, 받은버전 = '';
  for (var 시도 = 1; 시도 <= 4; 시도++) {
    var reqs = files.map(function (f) { return { url: base + encodeURIComponent(f.name) + '?v=' + encodeURIComponent(새버전) + '&t=' + Date.now(), muteHttpExceptions: true }; });
    var ress = UrlFetchApp.fetchAll(reqs);
    새파일 = {};
    ress.forEach(function (r, i) {
      if (r.getResponseCode() !== 200) throw new Error(files[i].name + ' 을(를) 내려받지 못했습니다 (' + r.getResponseCode() + ')');
      var src = r.getContentText();
      if (!src || src.length < 20) throw new Error(files[i].name + ' 내용이 비어 있습니다.');
      새파일[files[i].name] = src;
    });
    받은버전 = ((새파일['Code.gs'] || '').match(/APP_VERSION = '([^']*)'/) || [])[1] || '';
    if (받은버전 === 새버전) break;
    if (시도 < 4) Utilities.sleep(8000);
  }
  if (받은버전 !== 새버전) {
    throw new Error('저장소 파일이 아직 새 버전으로 갱신되지 않았습니다 (Code.gs v' + 받은버전 + ', manifest v' + 새버전 + '). GitHub 반영에 몇 분 걸릴 수 있으니 5분 뒤 다시 눌러 주세요.');
  }

  // 2) 지금 코드 읽고 백업
  var scriptId = ScriptApp.getScriptId();
  var cur = 업데이트_api_('get', 'projects/' + scriptId + '/content');
  var 백업ID = '';
  try {
    var bf = DriveApp.createFile('체육교사보조_업데이트전_백업_v' + APP_VERSION + '_' + 오늘_() + '.json', JSON.stringify({ 버전: APP_VERSION, 저장: 지금_(), files: cur.files }), 'application/json');
    백업ID = bf.getId();
    PropertiesService.getScriptProperties().setProperty(업데이트_백업키, 백업ID);
  } catch (e) { throw new Error('백업 파일을 만들지 못해 중단했습니다: ' + e.message); }

  // 3) 파일 합치기: 저장소 파일은 새 내용으로, 저장소에 없는 파일(선생님이 따로 넣은 것)은 그대로 둠
  var byName = {};
  (cur.files || []).forEach(function (f) { byName[f.name + '|' + f.type] = f; });
  var out = [], seen = {};
  files.forEach(function (f) {
    var type = 업데이트_파일형식_(f.name), name = 업데이트_파일이름_(f.name);
    out.push({ name: name, type: type, source: 새파일[f.name] });
    seen[name + '|' + type] = true;
  });
  (cur.files || []).forEach(function (f) { if (!seen[f.name + '|' + f.type]) out.push({ name: f.name, type: f.type, source: f.source }); });
  if (!out.some(function (f) { return f.type === 'JSON' && f.name === 'appsscript'; })) throw new Error('appsscript.json 이 없어 중단했습니다.');

  // 4) 프로젝트 내용 교체
  업데이트_api_('put', 'projects/' + scriptId + '/content', { files: out });

  // 5) 새 버전 → 웹앱 배포 갱신 (HEAD 배포는 건너뜀)
  var ver = 업데이트_api_('post', 'projects/' + scriptId + '/versions', { description: 'v' + 새버전 + ' 자동 업데이트 (' + 오늘_() + ')' });
  var deps = 업데이트_api_('get', 'projects/' + scriptId + '/deployments?pageSize=50');
  var 갱신 = 0;
  (deps.deployments || []).forEach(function (d) {
    var cfg = d.deploymentConfig || {};
    if (!cfg.versionNumber) return;                        // HEAD(테스트) 배포
    업데이트_api_('put', 'projects/' + scriptId + '/deployments/' + d.deploymentId,
      { deploymentConfig: { scriptId: scriptId, versionNumber: ver.versionNumber, manifestFileName: 'appsscript', description: cfg.description || ('v' + 새버전) } });
    갱신++;
  });

  // 6) 캐시 비우기 (새 코드가 시트를 다시 확인하도록)
  try { 캐시비우기_조용히_(); } catch (e) {}
  return { ok: true, 이전: APP_VERSION, 새버전: 새버전, 파일수: files.length, 배포수: 갱신, 백업파일ID: 백업ID,
           메시지: 'v' + APP_VERSION + ' → v' + 새버전 + ' 업데이트 완료. 파일 ' + files.length + '개, 배포 ' + 갱신 + '개 갱신.' + (갱신 ? '' : ' (웹앱 배포가 없어 코드만 바꿨습니다. 배포 → 새 배포를 해 주세요)') };
}

/** 마지막 백업으로 되돌리기 */
function 업데이트_되돌리기_() {
  var id = PropertiesService.getScriptProperties().getProperty(업데이트_백업키);
  if (!id) throw new Error('되돌릴 백업이 없습니다.');
  var data = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
  if (!data.files || !data.files.length) throw new Error('백업 파일이 비어 있습니다.');
  var scriptId = ScriptApp.getScriptId();
  업데이트_api_('put', 'projects/' + scriptId + '/content', { files: data.files.map(function (f) { return { name: f.name, type: f.type, source: f.source }; }) });
  var ver = 업데이트_api_('post', 'projects/' + scriptId + '/versions', { description: 'v' + data.버전 + ' 으로 되돌림 (' + 오늘_() + ')' });
  var deps = 업데이트_api_('get', 'projects/' + scriptId + '/deployments?pageSize=50'), 갱신 = 0;
  (deps.deployments || []).forEach(function (d) {
    var cfg = d.deploymentConfig || {};
    if (!cfg.versionNumber) return;
    업데이트_api_('put', 'projects/' + scriptId + '/deployments/' + d.deploymentId, { deploymentConfig: { scriptId: scriptId, versionNumber: ver.versionNumber, manifestFileName: 'appsscript', description: cfg.description || '' } });
    갱신++;
  });
  try { 캐시비우기_조용히_(); } catch (e) {}
  return { ok: true, 버전: data.버전, 배포수: 갱신, 메시지: 'v' + data.버전 + ' 코드로 되돌렸습니다. 배포 ' + 갱신 + '개 갱신.' };
}

function 캐시비우기_조용히_() {
  캐시지우기_('설정'); 캐시지우기_('학생'); 캐시지우기_('update_check');
  if (typeof 준비플래그_ !== 'undefined') 캐시지우기_(준비플래그_);
  MODULES.forEach(function (m) {
    var h = 모듈훅_(m.key);
    if (h && typeof h.캐시지우기 === 'function') { try { h.캐시지우기(); } catch (e) {} }
  });
}

/* ---------- 스프레드시트 메뉴 ---------- */

function 업데이트확인() {
  var ui = SpreadsheetApp.getUi();
  var info = 업데이트_확인_(true);
  if (info.오류) { ui.alert('업데이트 확인 실패', info.오류 + '\n\n주소: ' + 업데이트주소_(), ui.ButtonSet.OK); return; }
  if (!info.새버전) { ui.alert('최신 버전입니다', '지금 버전 v' + info.현재 + ' 이 최신입니다.' + (info.최신 ? ' (저장소 v' + info.최신 + ')' : ''), ui.ButtonSet.OK); return; }
  var r = ui.alert('새 버전 v' + info.최신, 'v' + info.현재 + ' → v' + info.최신 + (info.날짜 ? ' (' + info.날짜 + ')' : '') + '\n\n' + (info.메모 || '') +
    '\n\n자료(시트)는 그대로 두고 프로그램 파일만 바꿉니다. 바꾸기 전 지금 코드를 드라이브에 백업합니다.\n업데이트할까요?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  try {
    var res = 업데이트_실행_();
    ui.alert('업데이트 완료', res.메시지 + '\n\n열려 있던 프로그램 화면은 새로 고침해 주세요.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('업데이트 실패', e.message, ui.ButtonSet.OK);
  }
}

function 업데이트되돌리기() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('이전 버전으로 되돌리기', '마지막 업데이트 직전에 백업한 코드로 되돌립니다. 자료는 그대로입니다. 계속할까요?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  try { ui.alert('완료', 업데이트_되돌리기_().메시지, ui.ButtonSet.OK); }
  catch (e) { ui.alert('실패', e.message, ui.ButtonSet.OK); }
}

/* ---------- 교사 화면 API ---------- */

function t_updateCheck(token, force) { 교사확인_(token); var i = 업데이트_확인_(!!force); i.주소 = 업데이트주소_(); return i; }
function t_updateRun(token) { 교사확인_(token); return 업데이트_실행_(); }
function t_updateRollback(token) { 교사확인_(token); return 업데이트_되돌리기_(); }
