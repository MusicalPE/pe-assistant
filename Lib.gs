/*******************************************************
 * 체육교사 보조 프로그램 — 공통 도구 (Lib.gs)
 *
 * 모든 모듈(Mod_*.gs)이 함께 쓰는 함수만 둡니다.
 *  - 시트 읽기·쓰기 helper (열은 1행 머리글 이름으로 찾음)
 *  - 서버 캐시 (CacheService, 실행을 넘어 살아 있음)
 *  - 잠금, ID, 날짜, 해시, 문자열·숫자 정리
 *
 * 원칙
 *  - 서버 반환값은 문자열·숫자·불리언·null만 (Date 객체 반환 금지)
 *  - 시트 이름은 SHEET 상수로만 부르고, 열 순서에 기대지 않음
 *******************************************************/

/* ================= 스프레드시트 ================= */

var SS_ = null;
function ss_() {
  if (SS_) return SS_;
  var id = str_(typeof SS_ID !== 'undefined' ? SS_ID : '');
  if (id) {
    try { SS_ = SpreadsheetApp.openById(id); }
    catch (e) { throw new Error('SS_ID로 스프레드시트를 열 수 없습니다. ID와 편집 권한을 확인하세요.'); }
  } else {
    SS_ = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!SS_) throw new Error('이 스크립트가 스프레드시트에 연결되어 있지 않습니다. 스프레드시트에서 확장 프로그램 > Apps Script로 만들거나 Code.gs 맨 위 SS_ID를 넣으세요.');
  return SS_;
}

/** 시트 찾기 (이름 앞뒤 공백 차이 허용). 없으면 null */
function findSheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].getName()).trim() === name) return all[i];
  }
  return null;
}

function sheet_(name) {
  var sh = findSheet_(name);
  if (sh) return sh;
  throw new Error('"' + name + '" 시트를 찾지 못했습니다. 웹앱을 다시 열면 자동으로 만들어집니다.');
}

/**
 * 시트를 머리글 기준 객체 배열로 읽습니다.
 * 첫 번째 열이 빈 행은 건너뜁니다. 각 행에 _row(시트 행번호)를 붙입니다.
 */
function rows_(name) {
  var sh = findSheet_(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === '') continue;
    var o = { _row: r + 1 };
    for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = values[r][c];
    out.push(o);
  }
  return out;
}

/** 시트 1행 머리글 배열. 코드가 쓰는 머리글(HEADERS[key])이 없으면 뒤에 붙여 줍니다. */
function ensureColumns_(name, headers) {
  var sh = sheet_(name);
  var lastCol = sh.getLastColumn();
  var have = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  while (have.length && have[have.length - 1] === '') have.pop();
  var added = false;
  (headers || []).forEach(function (h) {
    if (have.indexOf(h) < 0) { have.push(h); added = true; }
  });
  if (added) sh.getRange(1, 1, 1, have.length).setValues([have]);
  return have;
}

/** 객체 한 줄을 머리글에 맞춰 맨 아래에 추가 */
function appendRow_(name, headers, obj) {
  var have = ensureColumns_(name, headers);
  var row = have.map(function (h) { return (obj[h] === undefined || obj[h] === null) ? '' : obj[h]; });
  sheet_(name).appendRow(row);
  return row;
}

/** 여러 줄을 한 번에 추가 */
function appendRows_(name, headers, objs) {
  if (!objs || !objs.length) return 0;
  var have = ensureColumns_(name, headers);
  var rows = objs.map(function (obj) {
    return have.map(function (h) { return (obj[h] === undefined || obj[h] === null) ? '' : obj[h]; });
  });
  var sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, have.length).setValues(rows);
  return rows.length;
}

/** 특정 행의 일부 열만 고칩니다. fields = { 머리글: 값 } */
function setCells_(name, headers, rowNum, fields) {
  var have = ensureColumns_(name, headers);
  var sh = sheet_(name);
  Object.keys(fields).forEach(function (h) {
    var c = have.indexOf(h);
    if (c >= 0) sh.getRange(rowNum, c + 1).setValue(fields[h]);
  });
}

/**
 * 조건에 맞는 행을 지웁니다. 남길 행만 다시 쓰므로 행이 밀리지 않습니다.
 * 지운 행 수를 돌려줍니다.
 */
function 행지우기_(name, 지울까) {
  var sh = findSheet_(name);
  if (!sh) return 0;
  var last = sh.getLastRow(), cols = sh.getLastColumn();
  if (last < 2 || !cols) return 0;
  var values = sh.getRange(1, 1, last, cols).getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  var keep = [], 지운수 = 0;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === '') continue;
    var o = {};
    head.forEach(function (h, i) { if (h) o[h] = values[r][i]; });
    if (지울까(o)) 지운수++; else keep.push(values[r]);
  }
  if (!지운수) return 0;
  sh.getRange(2, 1, last - 1, cols).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, cols).setValues(keep);
  return 지운수;
}

/** 시트의 자료 행을 모두 지웁니다 (머리글은 남김) */
function 시트비우기_(name) {
  var sh = findSheet_(name);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;
  sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 1)).clearContent();
  return last - 1;
}

/**
 * 시트가 없으면 만들고 머리글을 씁니다. 이미 있으면 빠진 머리글만 뒤에 붙입니다.
 * 돌려주는 값: 새로 만든 것들의 설명 배열
 */
function 시트준비_(name, headers, opt) {
  opt = opt || {};
  var ss = ss_(), 만듦 = [];
  var sh = findSheet_(name);
  if (!sh) { sh = ss.insertSheet(name); 만듦.push(name + ' 시트'); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var before = sh.getLastColumn();
    ensureColumns_(name, headers);
    if (sh.getLastColumn() > before) 만듦.push(name + ' 시트 열 추가');
  }
  sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length))
    .setFontWeight('bold').setBackground(opt.색 || '#E3F2EF');
  sh.setFrozenRows(1);
  // 날짜를 문자열 그대로 두려고 날짜 열은 텍스트 서식
  var have = ensureColumns_(name, headers);
  have.forEach(function (h, i) {
    if (/날짜|주시작일|등록일|설정일|일시$/.test(h) && !/입력일시|확인일시|처리일시|신청 일시|업로드일시|수정일시/.test(h)) {
      sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    }
  });
  if (opt.기본행 && sh.getLastRow() < 2 && opt.기본행.length) {
    sh.getRange(2, 1, opt.기본행.length, opt.기본행[0].length).setValues(opt.기본행);
    만듦.push(name + ' 기본값 ' + opt.기본행.length + '줄');
  }
  if (opt.체크박스열) {
    opt.체크박스열.forEach(function (h) {
      var c = have.indexOf(h);
      if (c >= 0 && sh.getLastRow() > 1) sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).insertCheckboxes();
    });
  }
  return 만듦;
}

/* ================= 서버 캐시 ================= */
/* CacheService 값 하나는 100KB까지. 큰 것은 조각으로 나눠 저장합니다. */

var CACHE_TTL_ = 21600;   // 6시간
var CACHE_CHUNK_ = 90000;

function 캐시쓰기_(key, obj, ttl) {
  var cache = CacheService.getScriptCache();
  var s = JSON.stringify(obj);
  if (s.length <= CACHE_CHUNK_) {
    cache.put('c_' + key, s, ttl || CACHE_TTL_);
    cache.remove('c_' + key + '_n');
    return;
  }
  var n = Math.ceil(s.length / CACHE_CHUNK_), all = {};
  for (var i = 0; i < n; i++) all['c_' + key + '_' + i] = s.substr(i * CACHE_CHUNK_, CACHE_CHUNK_);
  all['c_' + key + '_n'] = String(n);
  cache.putAll(all, ttl || CACHE_TTL_);
  cache.remove('c_' + key);
}

function 캐시읽기_(key) {
  var cache = CacheService.getScriptCache();
  var one = cache.get('c_' + key);
  if (one) { try { return JSON.parse(one); } catch (e) { return null; } }
  var n = Number(cache.get('c_' + key + '_n'));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push('c_' + key + '_' + i);
  var parts = cache.getAll(keys), s = '';
  for (var j = 0; j < n; j++) {
    if (!parts[keys[j]]) return null;
    s += parts[keys[j]];
  }
  try { return JSON.parse(s); } catch (e) { return null; }
}

function 캐시지우기_(key) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('c_' + key + '_n')) || 0;
  var keys = ['c_' + key, 'c_' + key + '_n'];
  for (var i = 0; i < n; i++) keys.push('c_' + key + '_' + i);
  cache.removeAll(keys);
}

/** 캐시에 있으면 그것을, 없으면 fn()으로 만들어 캐시에 넣고 돌려줍니다. */
function 캐시_(key, fn, ttl) {
  var v = 캐시읽기_(key);
  if (v !== null && v !== undefined) return v;
  v = fn();
  try { 캐시쓰기_(key, v, ttl); } catch (e) {}
  return v;
}

/* ================= 잠금 · ID ================= */

function withLock_(fn, waitMs) {
  var lock = LockService.getScriptLock();
  lock.waitLock(waitMs || 20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function makeId_(prefix) {
  return (prefix || '') + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100);
}

function uuid_() { return Utilities.getUuid(); }

/* ================= 날짜 ================= */

var TZ_ = null;
function tz_() {
  if (!TZ_) { try { TZ_ = ss_().getSpreadsheetTimeZone() || 'Asia/Seoul'; } catch (e) { TZ_ = 'Asia/Seoul'; } }
  return TZ_;
}

function 오늘_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function 지금_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'); }
function ymd_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); }

/** 어떤 값이든 'yyyy-MM-dd' 문자열로. 못 알아보면 '' */
function 날짜정리_(v) {
  if (v instanceof Date) return ymd_(v);
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return '';
}

/** 일시를 'yyyy-MM-dd HH:mm' 문자열로 */
function 시각문자_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm');
  return String(v || '');
}

function 날짜더하기_(ymd, n) {
  var p = ymd.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/** 'yyyy-MM-dd' → 그 주 월요일 */
function 주시작_(ymd) {
  var p = ymd.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  var day = d.getDay();
  return 날짜더하기_(ymd, day === 0 ? -6 : 1 - day);
}

/* ================= 문자열 · 숫자 · 해시 ================= */

function str_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return 시각문자_(v);
  return String(v).trim();
}

function num_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v).toUpperCase() === 'Y'; }

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/** 목록 설정값('월,금' / '5 6') → 배열 */
function 목록_(v) {
  return str_(v).split(/[,\s]+/).filter(function (x) { return x !== ''; });
}

/** 알림창을 띄울 수 없는 실행 환경에서도 죽지 않게 */
function 알림_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** 이름 가리기: 홍길동 → 홍*동 */
function 이름가리기_(n) {
  n = str_(n);
  if (n.length <= 1) return n;
  if (n.length === 2) return n.charAt(0) + '*';
  return n.charAt(0) + new Array(n.length - 1).join('*') + n.charAt(n.length - 1);
}
