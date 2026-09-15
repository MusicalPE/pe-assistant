/*******************************************************
 * 체육교사 보조 프로그램 — 껍데기 (Shell.gs)
 *
 * 이 스프레드시트에 들어가는 유일한 스크립트 파일입니다. 실제 프로그램은 "라이브러리" PE 에 있고,
 * 이 파일은 요청을 라이브러리로 넘겨주기만 합니다. 앞으로 이 파일은 바뀌지 않습니다.
 *
 * 설치: 편집기 왼쪽 "라이브러리 +" → 스크립트 ID 붙여넣기 → 버전 "가장 큰 숫자" → 식별자 PE → 추가
 * 새 버전 적용: 라이브러리 PE 의 버전 숫자를 올리고 저장 → 배포 → 배포 관리 → 연필 → 새 버전 → 배포
 *******************************************************/

function ctx_() {
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return { url: url };
}

/** 웹앱 입구 */
function doGet(e) {
  var c = ctx_();
  try { c.legacyProps = PropertiesService.getScriptProperties().getProperties(); } catch (x) {}   // 옛 방식에서 올라온 경우 비밀번호 등 이사
  return PE.doGet(e, c);
}

/** 화면이 부르는 모든 서버 함수는 이 하나를 거쳐 라이브러리로 갑니다 */
function rpc(name, args) { return PE.rpc(name, args, ctx_()); }

/** 스프레드시트 메뉴 (항목이 부르는 함수는 아래에 같은 이름으로 있어야 함) */
function onOpen() { PE.메뉴만들기(); }
function 상태점검() { PE.상태점검(); }
function 초기설정() { PE.초기설정(); }
function 교사비밀번호초기화() { PE.교사비밀번호초기화(); }
function 캐시비우기() { PE.캐시비우기(); }
function 업데이트확인() { PE.업데이트확인(); }
function 권한승인() { return PE.권한승인(); }
