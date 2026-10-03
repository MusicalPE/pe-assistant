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

var APP_VERSION = '3.1.3';

/* 새 화면(GitHub) 과 주고받는 서버 기능 번호. 서버 입구(?api=rpc·doPost·조각 올리기 등)가 바뀔 때만 올립니다.
   새 화면은 ?api=info 로 이 번호를 읽고, 기대보다 낮으면 그 기능을 숨깁니다. (판 번호와 따로) */
var SERVER_API = 4;   // 1: 입구(lib 37) · 2: 조각 올리기 whole(모든 인자를 통째로 조각) (lib 38) · 3: 세특 초안·새 학년도 (lib 40) · 4: 세특 AI·지우기·AI 키 (lib 41~42)
var 새화면기본주소 = 'https://musicalpe.github.io/pe-app/';

/* 판별 바뀐 내용 — 설정 → 업데이트 칸의 "이번 판에서 바뀐 것" 과 지난 판 보기에 씁니다.
   새 판을 낼 때 맨 앞에 한 항목을 더하고, tools/make-release.js 가 이 표를 manifest.json 의 history 로도 내보냅니다. */
var APP_HISTORY = [
  { version: '3.1.3', lib: 43, date: '2026-10-03', notes: '사용 학교 알림 (설정 → 업데이트 아래): 하루 한 번 "이 프로그램을 쓰고 있어요" 신호를 만든 선생님께 보내요. 기본은 익명(무작위 학교 번호·판·학교급·켠 모듈 수·화면 방식)이고, "학교 이름도 알리기"를 고른 학교만 이름을 함께 보내요. GitHub 사용량·서버 확충을 준비하고 업데이트를 꾸준히 이어 가기 위한 것이에요. 학생 이름·기록·비밀번호는 각 학교 스프레드시트에만 있어 보낼 수도 모을 수도 없고, "알리지 않기"로 끌 수 있어요.' },
  { version: '3.1.2', lib: 42, date: '2026-10-03', notes: 'AI 키를 설정 한 곳에서(설정 → AI 키 · 시험해 보기) — 줄넘기 응원 문구·매트 퀴즈 문제·세특이 모두 이 키를 쓰고, 앞으로 생길 AI 기능도 여기 키를 써요. 줄넘기 설정에 넣어 둔 키는 그대로 쓰여요.' },
  { version: '3.1.1', lib: 41, date: '2026-10-03', notes: '세특 초안에 "AI로 다듬기" — AI 키가 있으면 학생마다 기록 사실로 서로 다른 문장을 써 줘요. 학생 한 명씩, 또는 고른 학생(안 고르면 반 전체)을 차례로. 선생님이 칸에 쓴 관찰 내용을 가장 먼저 살리고, 이름·성별·학교는 보내지 않으며, 기록에 없는 일은 지어내지 않게 했어요. 쓴 글은 바로 저장되고 "초안으로"로 언제든 되돌릴 수 있어요.\n세특 초안: 학생을 골라 글 지우기(빈칸으로 저장 — 다시 불러와도 빈칸).\n선생님이 로그인하면 새 소식 창 — 판이 바뀌면 "이번에 바뀐 것"을 한 번, 학교 프로그램(라이브러리) 새 버전이 나와 있으면 적용 방법을 함께 안내(적용할 때까지 7일에 한 번).' },
  { version: '3.1.0', lib: 40, date: '2026-10-01', notes: '세특 초안 (홈 → 세특 초안): 학년·반을 고르면 이번 학년도 기록(수행평가 특기사항·PAPS·줄넘기·건강체력교실·FMS·색깔 매트, 고르면 스포츠클럽)으로 학생마다 체육 세부능력 및 특기사항 초안 문장을 만들어요. 고쳐 쓴 글은 세특_초안 시트에 저장되고, 글자·나이스 바이트 수가 보이며, 반 전체를 표로 복사할 수 있어요.\n새 학년도 시작 (설정 → 새 학년도 시작): 학년도 바꾸기·재학생 학년 올리기(마지막 학년 졸업)·이미 졸업·전출한 학생 정리(고르면)를 한 번에. 시작 전에 시트 보관본(사본)을 자동으로 만들고, 끝나면 이어서 할 일을 안내해요.\n여러 학교가 같은 시간에 저장해도 서로 기다리지 않게 저장 잠금을 학교마다 따로. 홈 현황을 2분 동안 기억해 빨라짐(기록이 바뀌면 바로 새로).\n초기화 화면에 한꺼번에 고르기(모든 기록 · 명단까지 전부 · 모듈마다 "이 모듈 모두"). 휴대폰·태블릿에서 위 메뉴를 누르면 그 메뉴 첫 화면이 바로 열림. 색깔 매트 놀이터 설정·끝 화면이 밝은 카드 톤으로(게임 중 화면은 검은 바탕 그대로).' },
  { version: '3.0.2', lib: 39, date: '2026-10-01', notes: '교사 로그인이 빨라졌어요 — 로그인하면 화면이 먼저 뜨고, 홈의 모듈 현황 카드는 그 뒤에 채워져요(예전엔 카드를 다 만든 뒤에야 들어가서 몇 초씩 걸림).\n학생이 로그인하자마자 모듈을 누르면 빈 화면이 남던 것 수정(줄넘기·건강체력교실·매트·PAPS·FMS·수행평가).\n학생용 주소 QR 이 화면 방식을 따라가요("새 화면"이면 찍자마자 새 화면). QR 인쇄가 빈 종이로 나오던 것 수정.\n색깔 매트 놀이터: 게임 화면에 Made by 도장, 게임 중 휴대폰 "뒤로"를 누르면 게임이 닫히고 음악도 멈춤.' },
  { version: '3.0.1', lib: 38, date: '2026-09-30', notes: '설정 → 접속 주소에 학생용 주소 QR 코드가 생겼습니다. 새 태블릿·핸드폰에서 카메라로 찍으면 바로 열리고, "QR 인쇄"로 교실에 붙여 둘 수 있어요(학교마다 자기 주소로 그려짐).\n업데이트 칸의 "지금 버전"이 라이브러리를 올린 뒤에도 몇 시간 동안 옛 번호로 보이던 것 수정.\n(새 화면) 껍데기에 doPost 가 없는 학교에서도 큰 저장(여러 줄 한꺼번에 저장·사진+썸네일)이 조각으로 온전히 올라가게 서버 입구를 넓혔습니다.' },
  { version: '3.0.0', lib: 37, date: '2026-09-30', notes: '새 화면(GitHub)을 위한 서버 입구 — 화면은 GitHub 한 곳에서, 저장은 지금처럼 학교 시트에서 하는 3.0 의 첫 단계입니다. 지금 화면은 그대로이고, 새로 생긴 것은 뒤에서만 동작합니다.\n설정 → 화면 방식: "기존 화면"(기본) | "새 화면". 새 화면을 고르면 학교 앱 주소로 들어온 사람에게 "새 화면으로 열기" 버튼을 보여 줍니다(주소·즐겨찾기 그대로). 문제가 생기면 여기서 기존으로 되돌리거나, 주소 뒤에 ?classic=1 을 붙이면 기존 화면이 열립니다. 새 화면이 준비되기 전에는 고를 수 없게 막혀 있습니다.\n껍데기(Shell.gs)에 doPost 한 줄이 늘었습니다 — 새 화면에서 사진·영상을 올릴 때 씁니다. 안 넣어도 지금 화면은 그대로 동작하지만, 새 화면에서는 사진이 느리게(조각으로) 올라가고 영상은 올릴 수 없습니다.' },
  { version: '2.4.0', lib: 36, date: '2026-09-29', notes: '건강체력교실에 카메라 줄넘기 — 운동 기록에서 "집에서 · 줄넘기"를 고르면 "카메라로 뛰기" 버튼이 나오고, 판정기가 센 횟수가 건강체력교실 기록(가정·줄넘기·바로 확인·포인트 계산)으로 들어옵니다. 줄넘기 설정의 "건강체력교실에서 카메라로 뛴 줄넘기도 줄넘기 기록에 함께 넣기" 스위치를 켜면 줄넘기 누적·배지에도 잡힙니다(기본은 꺼짐). 판정기 v0.6 필요.' },
  { version: '2.3.3', lib: 35, date: '2026-09-29', notes: '줄넘기 카메라 판정기 v0.5 에 맞춤 — 판정기 민감도를 줄넘기 설정(6~16)에서 선생님이 정하고 학생은 못 바꿈. 판정기는 이제 머리부터 발까지 다 보일 때만 세고(앉아서 들썩이거나 너무 가까이 서면 "뒤로 물러서요"), 엉덩이·머리·발이 같이 떴을 때만 1회.' },
  { version: '2.3.2', lib: 34, date: '2026-09-29', notes: '색깔 매트 놀이터 점프 배지가 "함께 점프 5001000"처럼 하나로 붙어 나오던 것 수정 — 설정 시트가 "500,1000"을 숫자 5,001,000 으로 바꿔 읽던 문제. 설정 값 칸을 글자 서식으로 저장하고, 이미 그렇게 저장된 학교는 기본값(500·1000회)으로 읽습니다.' },
  { version: '2.3.1', lib: 33, date: '2026-09-29', notes: '줄넘기 "카메라로 뛰기" 뒤 판정기 창에서 앱으로 돌아오면 기록을 자동으로 다시 불러옵니다(새로고침 안 해도 오늘 내 기록·원 그래프에 바로 반영).' },
  { version: '2.3.0', lib: 32, date: '2026-09-29', notes: '색깔 매트 놀이터 — 학생 게임 목록을 한 줄에 4개씩 배치(색깔 점프 카드도 다른 카드와 같은 크기, 게임이 늘어도 마지막 줄이 4개가 찰 때까지 그 줄에 채움). 용암 매트 난이도 개편(단독판 v1.7): 1~4단계는 매트 그림에 용암(1칸→2칸) · 5~6단계는 그림 없이 "용암: 빨강"처럼 글자만 · 7~8단계는 글자 색도 사라짐(용암은 최대 2칸이라 남은 칸만 보고는 못 뜀).\n연상 점프에 "우리 반 그림"이 생겼습니다 — 교사 메뉴 "우리 반 그림"에 급식 사진·교실 물건·AI 그림 등을 올리고 떠오르는 색(1~2개)을 정하면, 연상 점프 설정의 "그림 종류"에서 고를 수 있어요. 그림 보고 점프 → 정답 칸 확인 → 다음 그림(자동 넘기기 또는 화면 눌러 넘기기). 그림은 드라이브 폴더 "색깔 매트 놀이터 그림"에, 시트 MAT_그림에는 파일 ID만(첫 그림을 올릴 때 시트가 자동으로 생김). 단독판 v1.8 과 같은 내용.\n줄넘기에 "카메라로 뛰기" — 카메라가 관절 움직임을 보고 진짜 뛴 횟수를 세는 판정기 페이지(별도 웹 페이지)를 학생 화면에서 새 창으로 열고, 끝내면 그 횟수가 "카메라 판정" 기록으로 바로 확인 상태로 들어옵니다(줄넘기 설정 → 카메라 판정기 주소·최소 횟수, 온라인판 전용). 외부 페이지가 부르는 JSON 문(?api=)이 라이브러리에 생겼고 껍데기는 그대로입니다.' },
  { version: '2.2.0', lib: 31, date: '2026-09-29', notes: '색깔 매트 놀이터(단독판 v1.6 반영)에 게임 두 가지가 늘어 10종이 됐습니다. ① 가장 기본이 되는 "색깔 점프"(목록 맨 앞, "처음이라면 여기부터") — 화면 전체가 한 가지 색으로 바뀌면 그 색 칸으로 점프, 8단계 × 30초, "2개"를 고르면 화면이 반으로 나뉘어 왼발·오른발로 밟음(매트 위치 그림 켜기 가능). ② "용암 매트" — 용암으로 변한 칸은 밟지 않고 안전한 칸에서 계속 콩콩 뛰다가 용암이 바뀌면 재빨리 옮김, 1~3단계 용암 1칸 · 4~6단계 2칸 · 7~8단계 3칸(마지막엔 한 칸에서 두 발 모아), 바뀌기 직전 테두리 깜빡임과 경고음.' },
  { version: '2.1.0', lib: 29, date: '2026-09-28', notes: '색깔 매트 놀이터에 여덟 번째 게임 "얼음 스텝"(음악이 나오는 동안 춤추다 멈추면 화면의 색 칸으로 뛰어가 얼음! 보통부터 자세 미션, 어려움은 두 색 = 두 발)과 배경 음악 고르기를 넣었습니다. 기본 음악 4종(신나는 댄스·행진곡·동요풍·전자음·매번 랜덤), "내 음악 파일"(MP3 등을 이 기기 브라우저에 저장, 단계가 오르면 최대 1.3배 빨라짐), "유튜브 링크"(영상·재생목록 주소, 화면 구석의 작은 플레이어에 재생/정지만 맡김 · 인터넷 필요). 리듬 스텝은 박자를 맞춰야 해서 기본 음악만 씁니다. 게임 탐험가 배지는 8종 기준.\n홈의 모듈 목록에서 "사용" 글자가 줄바꿈되던 것 수정.' },
  { version: '2.0.0', lib: 24, date: '2026-09-24', notes: '여덟 번째 모듈 색깔 매트 놀이터: 4색 매트 체육 게임 7종(색깔 스트룹·기억력 스텝·리듬 스텝·방향 점프·퀴즈 점프·연상 점프·손발 트위스터)을 학생이 직접 실행하고, 실제로 뛴 시간과 점프 횟수를 누적합니다. "짝과 함께"는 단계마다 짝이 "뛰고 있어요!" 버튼으로 확인(맞고 틀림은 판정하지 않음), "혼자 연습"도 연습 기록으로 누적. 한 판이 끝나면 역할 바꾸기.\n교사: 학급 현황(순위)·학생 상세·게임 통계·짝 배정(학생이 고름/교사가 배정)·수업 모드(프로젝터, 반 전체 수업 기록 일괄 저장)·퀴즈 문제 은행(AI 문제 받기 → 검토·승인, 직접 입력, 학생 제안)·설정(최소 시간, 확인 버튼 시간, 게임 켜고 끄기, 배지 기준). 학생 첫 화면에 총 운동 시간 카드와 배지.\n퀴즈 문제 은행은 교과(체육·국어·수학·사회·과학·영어·도덕·기타)를 고를 수 있고, 체육 영역은 2022 개정 교육과정(운동·스포츠·표현)을 따릅니다. 연상 점프에 "두 가지 색 물건"(수박 → 초록+빨강, 두 발로 두 칸) 선택.' },
  { version: '1.7.2', lib: 19, date: '2026-09-23', notes: '팀·모둠 짜기: 반을 여러 개 골라 합쳐서 나눌 수 있습니다(학년·반 합반 수업). 합친 팀은 학생 이름 앞에 반이 붙고, 저장한 팀에는 어느 반을 합쳤는지 표시됩니다.' },
  { version: '1.7.1', lib: 18, date: '2026-09-23', notes: '팀·모둠 짜기: 저장하면 결과 칸이 비워져 바로 새로 나눌 수 있습니다(저장한 것은 "저장한 팀" 탭에서 다시 열기·고치기). 저장한 팀 목록에 인쇄 버튼.' },
  { version: '1.7.0', lib: 17, date: '2026-09-23', notes: '수업 도우미 → 팀·모둠 짜기: 반을 고르고 팀 수(2~6) 또는 모둠 인원(2~6명)을 정하면 성별과 체력(PAPS 종목별 등급 평균, 회차·종목 선택)이 고르게 섞이도록 나눕니다. 조건 걸기(꼭 같은 팀 · 같은 팀 금지 · 주장 지정), 다시 섞기, 학생을 끌어서 옮기기, 팀 이름 바꾸기, 인쇄.\n나눈 팀은 이름을 붙여 저장(수업_팀 · 수업_팀원 시트)하고 "학생 화면에 우리 팀 보이기"를 켜면 학생 첫 화면에 우리 팀 카드(팀 이름·함께하는 친구·주장)가 나옵니다. 저장한 팀은 나중에 불러와 고칠 수 있습니다.\n휴대폰 화면 정리: 위 줄에 모듈 탭, 아래 줄에 고른 모듈의 메뉴가 나오는 두 줄 메뉴로 세로 스크롤이 줄었습니다. 상단 바의 로그아웃은 아이콘만, 긴 이름은 줄임표로. 오프라인판도 휴대폰 크기에 맞게 보입니다.' },
  { version: '1.6.0', lib: 16, date: '2026-09-21', notes: '줄넘기 종류: 학생이 기록을 넣을 때 모아뛰기·엇갈아뛰기·이중뛰기·십자뛰기 등 종류를 고릅니다(줄넘기 설정에서 목록 편집, 끌 수도 있음). 학급 현황은 종류별로 걸러 보고, 학생 그래프에는 종류별 누적선이 함께 나옵니다.\n줄넘기 짝 체크 (선택): 선생님이 켠 날에는 학생이 기록을 넣을 때 같은 반 짝을 고르고, 짝이 "맞아요"라고 해야 선생님께 옵니다. 짝은 계수기 숫자 등을 사진으로 남길 수 있고(선택), 최종 확인은 언제나 선생님이 합니다.\n설정 → 업데이트 칸에 "이번 판에서 바뀐 것"과 "지난 판 보기"가 생겼습니다. 오프라인판에도 나옵니다.\n줄넘기 AI 응원 문구: Gemini 모델이 은퇴하거나 새 사용자에게 막혀도 목록에서 가장 새 flash 모델을 자동으로 골라 쓰고, 구글이 권한 모델이 있으면 그것을 바로 씁니다. 설정에 "지금 문구 만들어 보기"와 최근 오류 표시.' },
  { version: '1.5.3', lib: 12, date: '2026-09-18', notes: '교내 리그전 종목 선택 상자에서 "직접 입력…"을 맨 아래로, 맨 위에 "종목 고르기…". 바로 직접 입력을 골라도 입력칸이 열립니다.' },
  { version: '1.5.2', lib: 11, date: '2026-09-18', notes: '교내 리그전 참가 단위를 반 대항 · 팀 대항 · 개인전 세 가지로. 팀 대항은 팀 이름과 주장(명단에서 고르기), 개인전은 참가 학생을 명단에서 한꺼번에 고르기.\n종목 직접 입력 칸의 자동완성 목록 제거.' },
  { version: '1.5.1', lib: 10, date: '2026-09-18', notes: '교내 리그전 종목을 목록에서 고르기(게임형 수업 종목 + 스포츠클럽 종목, 직접 입력 가능). 대상은 전교·학년 체크로 자동 입력.' },
  { version: '1.5.0', lib: 9, date: '2026-09-18', notes: '스포츠클럽 교내 리그전: 클럽 활동과 따로 도는 학교 전체 리그. 회차 안에 종목 여러 개, 종목마다 참가 명단, 라운드로빈 대진 자동 생성, 주 1회 날짜 채우기, 스코어 → 승점·득실·순위, 기록 경기(최고 기록), 회차 시상 요약, 계획서용 일정표·결과 순위표·게시용 대진표(인쇄·Word).\n(오프라인판) 저장 설정 메뉴에 "다른 폴더로 바꾸기".' },
  { version: '1.4.0', lib: 8, date: '2026-09-18', notes: '수행평가 상호평가: 평가마다 켜고 끄기, 짝은 학생이 고르거나 선생님이 배정, 짝이 기준 체크 + 한마디 + 사진·영상 → 선생님이 보고 단계 반영. 학생에게는 진행 상태와 짝이 찍어 준 자료만 보입니다.\nPAPS 붙여넣기 일괄 입력(엑셀·한글 표 → 머리글 자동 인식 → 여러 종목·여러 반 한 번에).\n공통 화면이 색상 테마를 따르지 않던 문제, 불러오는 중 로그아웃하면 나던 오류 수정.' },
  { version: '1.3.0', lib: 5, date: '2026-09-17', notes: '화면 색상 테마 8가지(설정 → 프로그램·학교). FMS 짝 인증 사진·영상(짝이 확인할 때 첨부, 교사 승인 화면에서 재생, 도전한 학생도 다시 보기).' },
  { version: '1.2.0', lib: 3, date: '2026-09-15', notes: '수행평가 모듈(교사 전용): 학년별 평가 계획, 반별 단계 체크·특기사항, 결과 조회, 결과표·종합표·빈 채점표 인쇄.' }
];
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
  { key: 'CLASS', 이름: '수업 도우미',  설명: '지금 수업·출석·특이사항·시간표·수업 계획·명렬표 출력·팀·모둠 짜기 (교사 전용)', 아이콘: 'clock-play', 색: 'violet', 학생화면: false, hooks: 'class_hooks_' },
  { key: 'EVAL',  이름: '수행평가',     설명: '평가 계획·단계별 체크·특기사항·결과표 출력 · 상호평가(짝 확인 → 교사 반영). 결과는 학생에게 보이지 않음', 아이콘: 'checkbox', 색: 'plum', 학생화면: false, hooks: 'eval_hooks_' },
  { key: 'PAPS', 이름: 'PAPS',        설명: '학생건강체력평가 기록·등급·나이스 내보내기',   아이콘: 'stopwatch',  색: 'sky',   학생화면: true,  hooks: 'paps_hooks_' },
  { key: 'FIT',  이름: '건강체력교실', 설명: '참가 학생의 운동 기록·출석·포인트·배지',       아이콘: 'heartbeat',  색: 'mint',  학생화면: true,  hooks: 'fit_hooks_'  },
  { key: 'ROPE', 이름: '줄넘기',       설명: '줄넘기 횟수 누적·승인·학급 공동 목표',          아이콘: 'jump-rope',  색: 'coral', 학생화면: true,  hooks: 'rope_hooks_' },
  { key: 'MAT',  이름: '색깔 매트 놀이터', 설명: '4색 매트 체육 게임 10종 — 학생이 직접 실행, 짝 확인·연습 기록 누적·배지·퀴즈 문제 은행', 아이콘: 'layout-grid', 색: 'orange', 학생화면: true, hooks: 'mat_hooks_' },
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
    ['테마',         '민트',          '로그인·메인 화면 색상 테마: ' + 테마들.join(' | ')],
    ['화면방식',     '기존',          '기존 | 새 화면 — 새 화면이면 이 앱 주소로 들어온 사람에게 GitHub 새 화면 버튼을 보여 줍니다. 문제가 생기면 기존으로 (주소 뒤 ?classic=1 은 언제나 기존 화면)'],
    ['새화면주소',   '',              '비워 두면 기본 새 화면(' + 새화면기본주소 + '). https 주소만'],
    ['사용알림',     '익명',          '익명 | 학교 이름 | 끔 — 만든 선생님에게 하루 한 번 "이 프로그램을 쓰고 있어요" 신호(학생 정보는 보내지 않음). 익명: 무작위 번호·판·학교급·모듈 수만, 학교 이름: 학교 이름도 함께']
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
  var p = (e && e.parameter) || {};
  if (p.api) return 입구API_.test(p.api) ? 입구GET_(p) : 외부API_(e);   // 새 화면 입구 | 다른 페이지(줄넘기 판정기 등)가 JSON 으로 부르는 문
  속성이사_(ctx && ctx.legacyProps);
  var 준비결과 = 준비_();
  var 설정 = 설정_();
  if (화면방식_(설정) === '새 화면' && !p.classic) return 넘겨주기화면_(p, 설정);   // ?classic=1 이면 기존 화면 (탈출구)
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

/**
 * 외부 페이지용 JSON API. ?api=rope_x_save&t=학생토큰&count=120 처럼 GET 으로 부르고 { ok, data | error } 를 돌려줍니다.
 * 이름이 모듈_x_이름 꼴인 함수만 부를 수 있고, 함수는 (params) 객체 하나를 받습니다. 학생 토큰은 앱에서 로그인한 세션 그대로.
 * (껍데기의 doGet 이 그대로 넘겨주므로 껍데기를 바꾸지 않아도 됩니다. ContentService 응답이라 다른 주소(https)에서 fetch 로 읽을 수 있음)
 */
function 외부API_(e) {
  var out;
  try {
    var name = String(e.parameter.api || '');
    if (!/^[a-z]+_x_[A-Za-z0-9]+$/.test(name)) throw new Error('허용되지 않은 요청입니다: ' + name);
    var f = 전역_()[name];
    if (typeof f !== 'function') throw new Error('함수를 찾지 못했습니다: ' + name);
    var p = {};
    Object.keys(e.parameter).forEach(function (k) { if (k !== 'api') p[k] = e.parameter[k]; });
    out = { ok: true, data: f(p) };
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ================= 새 화면(GitHub) 입구 =================
   새 화면은 https 주소(GitHub Pages)에서 fetch 로 이 웹앱을 부릅니다. 응답은 모두 { ok, data | error, ms } JSON.
     GET  ?api=info                      학교·판·모듈·테마 (첫 부팅)
     GET  ?api=ping                      빈 요청 (연결 확인)
     GET  ?api=rpc&fn=<이름>&args=<JSON>  작은 요청 — 기존 rpc 분배기 그대로 (이름 규칙 검사 포함)
     POST {fn, args} (text/plain)        큰 요청(사진·영상)·비밀번호 — 껍데기의 doPost 가 넘겨줌
     GET  ?api=up_chunk / up_commit      껍데기에 doPost 가 없을 때: 큰 자료를 조각으로 나눠 보낸 뒤 서버에서 합쳐 실행
   웹앱이 이미 익명 공개이고 같은 rpc 분배기를 쓰므로 새로 열리는 함수는 없습니다. */
var 입구API_ = /^(info|ping|rpc|up_chunk|up_commit)$/;
var 조각표시_ = '__UP__';          // 조각으로 올린 자료가 들어갈 자리
var 조각시간_ = 1200;              // 조각은 20분 동안 캐시에
var 조각최대_ = 12 * 1024 * 1024;   // 조각으로 합칠 수 있는 최대 크기 (base64 글자, 약 9MB 파일) — 영상은 doPost 로

function JSON응답_(fn) {
  var t0 = Date.now(), out;
  try { out = { ok: true, data: fn() }; }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  out.ms = Date.now() - t0;
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function 입구GET_(p) {
  return JSON응답_(function () {
    switch (p.api) {
      case 'ping': return { t: Date.now(), SERVER_API: SERVER_API };
      case 'info': return 입구정보_();
      case 'rpc': return rpc(String(p.fn || ''), p.args ? JSON.parse(p.args) : [], CTX_);
      case 'up_chunk': return 조각받기_(p);
      case 'up_commit': return 조각합치기_(p);
    }
    throw new Error('알 수 없는 요청: ' + p.api);
  });
}

/** 껍데기: function doPost(e) { return PE.doPost(e, ctx_()); }  본문 JSON { fn, args } */
function doPost(e, ctx) {
  ctx설정_(ctx);
  return JSON응답_(function () {
    var body = e && e.postData && e.postData.contents;
    if (!body) throw new Error('보낸 내용이 비어 있습니다.');
    var m = JSON.parse(body);
    return rpc(String(m.fn || ''), Array.isArray(m.args) ? m.args : [], CTX_);
  });
}

/** 새 화면 첫 부팅: 서버 기능 번호·판·이름·테마·켜진 모듈 (로그인 전이라 학생 정보 없음) */
function 입구정보_() {
  준비_();
  var s = 설정_();
  return {
    SERVER_API: SERVER_API, 판: APP_VERSION,
    제목: str_(s.프로그램이름) || 기본프로그램이름, 학생용이름: str_(s.학생용이름) || 기본학생용이름, 학교명: str_(s.학교명),
    테마: 테마_(s.테마), 모듈: 모듈상태_(), 화면방식: 화면방식_(s), 앱주소: 앱주소_()
  };
}

/* ---------- 조각 올리기 (껍데기에 doPost 가 없는 학교) ----------
   라이브러리의 스크립트 캐시는 모든 학교가 함께 쓰므로 문서 캐시(학교 시트)를 먼저 쓰고, 키에는 학교 표시(ck_)를 붙입니다. */
function 조각캐시_() {
  try { var c = CacheService.getDocumentCache(); if (c) return c; } catch (e) {}
  return CacheService.getScriptCache();
}
function 조각번호_(id) {
  id = String(id || '');
  if (!/^[A-Za-z0-9]{8,40}$/.test(id)) throw new Error('올리기 번호가 잘못됐습니다.');
  return id;
}
function 조각키_(id, i) { return 'UP_' + ck_(id + '_' + i); }

/** ?api=up_chunk&id=<올리기번호>&i=<순서>&d=<base64 조각> */
function 조각받기_(p) {
  var id = 조각번호_(p.id), i = Number(p.i), d = String(p.d || '');
  if (!(i >= 0 && i < 5000)) throw new Error('조각 순서가 잘못됐습니다.');
  if (d.length > 90000) throw new Error('조각이 너무 큽니다.');
  조각캐시_().put(조각키_(id, i), d, 조각시간_);
  return { i: i, n: d.length };
}

/** ?api=up_commit&id=&n=<조각 수>&fn=&args=<JSON, 자료 자리에 "__UP__"> → { result } | { missing:[…] }
    whole=1 (SERVER_API 2): 합친 자료가 인자 배열 JSON 전체(UTF-8 → 웹 안전 base64) — 긴 글자가 없는 큰 저장(여러 줄 표 등)이나 사진+썸네일도 그대로 */
function 조각합치기_(p) {
  var id = 조각번호_(p.id), n = Number(p.n);
  if (!(n >= 1 && n <= 5000)) throw new Error('조각 수가 잘못됐습니다.');
  var cache = 조각캐시_(), keys = [], got = {}, i;
  for (i = 0; i < n; i++) keys.push(조각키_(id, i));
  for (i = 0; i < keys.length; i += 100) {
    var part = cache.getAll(keys.slice(i, i + 100));
    Object.keys(part).forEach(function (k) { got[k] = part[k]; });
  }
  var missing = [], size = 0;
  keys.forEach(function (k, j) { if (got[k] === undefined || got[k] === null) missing.push(j); else size += got[k].length; });
  if (missing.length) return { missing: missing };
  if (size > 조각최대_) throw new Error('조각으로 올리기엔 너무 큽니다. 선생님께 껍데기(Shell.gs)에 doPost 를 넣어 달라고 말씀해 주세요.');
  var data = keys.map(function (k) { return got[k]; }).join('');
  var args;
  if (p.whole) {   // 인자 배열 JSON 을 UTF-8 → base64(웹 안전) 로 보냄: 한글이 주소에서 9배로 불어나지 않게
    args = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8'));
    if (!Array.isArray(args)) throw new Error('보낸 자료 모양이 잘못됐습니다.');
  }
  else args = 조각끼우기_(p.args ? JSON.parse(p.args) : [], data);
  var res = rpc(String(p.fn || ''), args, CTX_);
  for (i = 0; i < keys.length; i += 100) cache.removeAll(keys.slice(i, i + 100));
  return { result: res };
}
function 조각끼우기_(v, data) {
  if (v === 조각표시_) return data;
  if (Array.isArray(v)) return v.map(function (x) { return 조각끼우기_(x, data); });
  if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = 조각끼우기_(v[k], data); }); return o; }
  return v;
}

/* ---------- 화면 방식 (기존 | 새 화면) ---------- */
/* 사용 학교 알림 (v3.1.3): 하루 한 번, 업데이트 확인 때 manifest.json 의 usage 주소로 짧은 신호. 학생 정보는 보내지 않음 */
var 사용알림방식들 = ['익명', '학교 이름', '끔'];
function 사용알림방식_(s) { var v = str_((s || 설정_()).사용알림); return 사용알림방식들.indexOf(v) >= 0 ? v : '익명'; }
function 사용알림_(주소, 라이브러리) {
  try {
    if (!주소 || !/^https:\/\/script\.google(usercontent)?\.com\//.test(주소)) return;
    var s = 설정_(), 방식 = 사용알림방식_(s); if (방식 === '끔') return;
    var 오늘 = 오늘_(); if (속성_('사용알림.날짜') === 오늘) return;
    var id = 속성_('사용알림.ID'); if (!id) { id = Utilities.getUuid().replace(/-/g, '').slice(0, 12); 속성저장_('사용알림.ID', id); }
    var 켬 = 모듈상태_(), 모듈수 = Object.keys(켬).filter(function (k) { return 켬[k]; }).length;
    var q = { id: id, v: APP_VERSION, lib: 라이브러리 || '', lvl: 학교급_().급, mods: 모듈수, screen: 화면방식_(s) === '새 화면' ? 'new' : 'classic' };
    if (방식 === '학교 이름') q.name = str_(s.학교명).slice(0, 40);
    var qs = Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
    속성저장_('사용알림.날짜', 오늘);   // 실패해도 하루 한 번만 시도
    UrlFetchApp.fetch(주소 + (주소.indexOf('?') < 0 ? '?' : '&') + qs, { muteHttpExceptions: true, followRedirects: true });
  } catch (e) {}
}
function 화면방식_(s) { return str_((s || 설정_()).화면방식) === '새 화면' ? '새 화면' : '기존'; }
function 새화면주소_(s) {
  var u = str_((s || 설정_()).새화면주소);
  if (!/^https:\/\/[^\s"'<>]+$/.test(u)) u = 새화면기본주소;
  return /\/$/.test(u) ? u : u + '/';
}

/** 화면방식 = 새 화면: 학교 앱 주소로 들어온 사람에게 새 화면 버튼을 보여 줌. 구글 웹앱 틀 안에서는 자동 이동이 막혀서(0단계 시험) 누르는 버튼이 기본 */
function 넘겨주기화면_(p, 설정) {
  var app = 앱주소_(), teacher = p.page === 'teacher';
  var go = 새화면주소_(설정) + '?app=' + encodeURIComponent(app) + (teacher ? '&page=teacher' : '');
  var classic = app + '?classic=1' + (teacher ? '&page=teacher' : '');
  var 이름 = teacher ? (str_(설정.프로그램이름) || 기본프로그램이름) : (str_(설정.학생용이름) || 기본학생용이름);
  var h = function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  // (문서 틀 태그는 HtmlService 가 붙임 — 오프라인 빌드가 head·body 닫는 태그를 찾아 끼워 넣으므로 여기엔 쓰지 않음)
  var html = '<style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F2FAF7;color:#16232E;font:16px/1.6 "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;padding:20px;box-sizing:border-box}' +
    '.box{max-width:460px;width:100%;background:#fff;border:1px solid #D7EAE3;border-radius:20px;padding:30px 26px;text-align:center;box-shadow:0 14px 40px -18px rgba(22,35,46,.25)}' +
    'h1{font-size:22px;margin:0 0 4px}p{margin:6px 0;color:#557069;font-size:15px}' +
    'a.go{display:block;margin:22px 0 12px;background:#14A085;color:#fff;text-decoration:none;font-weight:800;font-size:21px;padding:18px;border-radius:16px}' +
    'a.go:active{transform:scale(.98)}a.sub{color:#557069;font-size:13px}.school{color:#14A085;font-weight:800;font-size:14px}</style>' +
    '<div class="box">' + (str_(설정.학교명) ? '<div class="school">' + h(설정.학교명) + '</div>' : '') +
    '<h1>' + h(이름) + '</h1><p>새 화면에서 열려요. 아래 버튼을 눌러 주세요.</p>' +
    '<a class="go" href="' + h(go) + '" target="_top">새 화면으로 열기</a>' +
    '<p style="font-size:13px">이 주소와 즐겨찾기는 앞으로도 그대로 쓰면 돼요.</p>' +
    '<p style="margin-top:14px"><a class="sub" href="' + h(classic) + '" target="_top">새 화면이 안 열리면 → 기존 화면으로 열기</a></p></div>';
  return HtmlService.createHtmlOutput(html).setTitle(이름).addMetaTag('viewport', 'width=device-width, initial-scale=1')
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
  if (!빠짐) {   // 새 판에서 늘어난 설정 항목(예: 화면방식)이 시트에 없으면 채움 — 판이 바뀐 뒤 첫 접속 때 한 번만 확인
    var 있음 = {}; rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
    if (기본설정_().some(function (r) { return !있음[r[0]]; })) 모듈빠짐 = true;
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
    // 값 칸은 글자 서식으로: "500,1000" 같은 목록을 시트가 숫자 5,001,000 으로 바꿔 버리는 것을 막음
    if (rowOf[k]) sh.getRange(rowOf[k], 2).setNumberFormat('@').setValue(v);
    else { var r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, 3).setNumberFormat('@').setValues([[k, v, 설명[k] || '']]); rowOf[k] = r; }
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
    테마: 테마_(s.테마), 테마목록: 테마들.slice(),
    화면방식: 화면방식_(s), 새화면주소: 새화면주소_(s), SERVER_API: SERVER_API, 사용알림: 사용알림방식_(s)
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
  try { res.boot = t_boot(토큰); } catch (e) {}   // 로그인 한 번에 부팅 자료까지. 홈 카드(모듈 8개 현황, 가장 무거움)는 화면이 뜬 뒤 따로 불러옴 — 로그인이 몇 초 빨라짐
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
    업데이트: (typeof 업데이트_확인_ === 'function') ? 업데이트_확인_(false) : null,
    판내역: APP_HISTORY
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
  if (map.화면방식 !== undefined) {
    if (['기존', '새 화면'].indexOf(str_(map.화면방식)) < 0) return { ok: false, message: '화면 방식은 기존 또는 새 화면입니다.' };
    put.화면방식 = str_(map.화면방식);
  }
  if (map.사용알림 !== undefined) {
    if (사용알림방식들.indexOf(str_(map.사용알림)) < 0) return { ok: false, message: '사용 알림은 익명·학교 이름·끔 중 하나입니다.' };
    put.사용알림 = str_(map.사용알림);
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
/** 홈 현황은 모든 모듈을 훑어 2초쯤 걸려서 2분 동안 기억해 둡니다. 기록이 바뀌면(잠금 쓰기 — withLock_) 바로 지웁니다. (v3.1) */
var 홈캐시초_ = 120;
function t_home(token) { 교사확인_(token); return 캐시_('home', 홈자료_, 홈캐시초_); }
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

/* ================= 새 학년도 시작 (v3.1) =================
   학년도 +1 · 재학생 학년 올리기(마지막 학년은 졸업) · (고르면) 졸업·전출 학생 정리 · 시작 전 시트 보관본.
   기록은 학생ID로 이어지고, 학년도가 붙는 기록(수업·수행평가·PAPS·매트·클럽)은 새 학년도에 새로 시작합니다. */
function 새학년도정보_() {
  var s = 설정_(), Y = num_(s.학년도) || new Date().getFullYear(), 최대 = 학교급_().최대학년;
  var 학생 = 학생목록_(true), 재학 = 학생.filter(function (x) { return x.상태 === '재학'; });
  var 학년별 = {};
  재학.forEach(function (x) { 학년별[x.학년] = (학년별[x.학년] || 0) + 1; });
  return {
    학년도: Y, 다음: Y + 1, 최대학년: 최대, 학년별: 학년별, 재학: 재학.length,
    올림: 재학.filter(function (x) { return x.학년 < 최대; }).length,
    졸업: 재학.filter(function (x) { return x.학년 >= 최대; }).length,
    이미떠남: 학생.filter(function (x) { return x.상태 !== '재학'; }).length,
    반없음: 재학.filter(function (x) { return !x.반 || !x.번호; }).length,
    지난실행: 속성_('새학년도.' + (Y + 1)) || '', 이번실행: 속성_('새학년도.' + Y) || '',
    학교이름: str_(s.학교명) || ss_().getName()
  };
}
function t_newYearInfo(token) { 교사확인_(token); return 새학년도정보_(); }

/** opts = { 보관본: true, 졸업생정리: false } · 확인문구 '새 학년도' */
function t_newYearRun(token, opts, 확인문구) {
  교사확인_(token);
  opts = opts || {};
  if (str_(확인문구).replace(/\s/g, '') !== '새학년도') return { ok: false, message: '확인 칸에 새 학년도 라고 입력해 주세요.' };
  var info = 새학년도정보_(), out = { ok: true, 이전: info.학년도, 학년도: info.다음 };
  if (opts.보관본 !== false) {
    try {
      var 사본 = ss_().copy(info.학교이름 + ' 체육 기록 (' + info.학년도 + '학년도 보관본)');
      out.보관본 = 사본.getUrl();
    } catch (e) {
      return { ok: false, message: '보관본(시트 사본)을 만들지 못해 멈췄어요: ' + e.message + ' — 스프레드시트에서 파일 → 사본 만들기로 직접 만든 뒤 "보관본 만들기"를 끄고 다시 실행해 주세요.' };
    }
  }
  return withLock_(function () {
    var 최대 = info.최대학년, 올림 = 0, 졸업 = 0, 지움 = 0;
    // 1. 졸업·전출 정리 (고른 경우) — 이번에 졸업할 학생은 남겨 두고, 이미 떠난 학생만
    if (opts.졸업생정리) {
      var 떠난 = {};
      학생목록_(true).forEach(function (x) { if (x.상태 !== '재학') 떠난[x.학생ID] = true; });
      var ids = Object.keys(떠난);
      if (ids.length) {
        지움 = 행지우기_(SHEET.학생, function (r) { return 떠난[str_(r.학생ID)]; });
        MODULES.forEach(function (m) {
          var h = 모듈훅_(m.key);
          if (h && typeof h.명단삭제후 === 'function') { try { h.명단삭제후(ids); } catch (e) {} }
        });
        캐시지우기_('학생');
      }
    }
    // 2. 학년 올리기
    학생목록_(true).forEach(function (x) {
      if (x.상태 !== '재학') return;
      if (x.학년 >= 최대) { setCells_(SHEET.학생, HEADERS.학생, x._row, { 상태: '졸업', 수정일시: 지금_() }); 졸업++; }
      else { setCells_(SHEET.학생, HEADERS.학생, x._row, { 학년: x.학년 + 1, 반: '', 번호: '', 수정일시: 지금_() }); 올림++; }
    });
    캐시지우기_('학생');
    // 3. 학년도 바꾸기 + 모든 캐시 비우기 (학년도로 거르는 모듈 캐시가 있음)
    설정저장_({ 학년도: String(info.다음) });
    캐시지우기_('설정'); 캐시지우기_(준비플래그_);
    MODULES.forEach(function (m) { var h = 모듈훅_(m.key); if (h && typeof h.캐시지우기 === 'function') { try { h.캐시지우기(); } catch (e) {} } });
    속성저장_('새학년도.' + info.다음, 지금_());
    out.올림 = 올림; out.졸업 = 졸업; out.지움 = 지움;
    out.설정 = 공개설정_();
    var r = 명단응답_(); out.학생 = r.학생; out.명단 = r;
    return out;
  }, 120000);
}

/* ================= 체육 세특 초안 (v3.1) =================
   모듈 기록(이번 학년도 3월 ~ 다음 해 2월)을 모아 학생마다 초안 문장을 만듭니다. AI 없이 틀 문장 — 선생님이 고쳐 쓰는 출발점.
   고친 글은 '세특_초안' 시트에 학년도별로 저장됩니다. */
var SETEUK = '세특_초안', SETEUK_H = ['학생ID', '학년도', '이름', '내용', '수정일시'];
var SETEUK_모듈 = ['EVAL', 'PAPS', 'ROPE', 'FIT', 'FMS', 'MAT', 'CLUB'];

function 세특기간_(Y) { return { 시작: Y + '-03-01', 끝: (Y + 1) + '-02-31' }; }
function 세특고르기_(arr, seed) { var h = 0; String(seed).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 9973; }); return arr[h % arr.length]; }
function 세특마침_(t) { t = str_(t).replace(/\s+/g, ' ').trim(); if (!t) return ''; return /[.!?。]$/.test(t) ? t : t + '.'; }
function 세특시간_(초) { var m = Math.round((초 || 0) / 60); return m >= 60 ? Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '') : m + '분'; }

/** 반 전체 학생의 모듈별 조각: { 학생ID: [{모듈, 이름, 글, 근거}] } */
function 세특재료_(학생들, 쓸모듈, Y) {
  var 기간 = 세특기간_(Y), 상태 = 모듈상태_(), out = {}, 이름 = {};
  MODULES.forEach(function (m) { 이름[m.key] = m.이름; });
  학생들.forEach(function (s) { out[s.학생ID] = []; });
  var 안 = function (d) { d = str_(d).slice(0, 10); return d && d >= 기간.시작 && d <= 기간.끝; };
  var 넣기 = function (id, key, 글, 근거) { if (글) out[id].push({ 모듈: key, 이름: 이름[key] || key, 글: 세특마침_(글), 근거: 근거 || '' }); };
  var 켬 = function (k) { return 상태[k] && 쓸모듈.indexOf(k) >= 0; };

  if (켬('EVAL')) try {
    var 계획 = {}; eval_계획목록_().forEach(function (p) { 계획[p.id] = p; });
    rows_(EVAL.결과).forEach(function (r) {
      var id = str_(r.학생ID); if (!out[id] || str_(r.학년도) !== String(Y)) return;
      var p = 계획[str_(r.평가ID)]; if (!p) return;
      var 특기 = str_(r.특기사항), 단계 = str_(r.단계), i = p.라벨.indexOf(단계), 대상 = p.평가요소 || p.평가명;
      var 글 = 특기;
      if (!글 && i >= 0) {
        var 위 = i === 0, 아래 = i === p.라벨.length - 1;
        글 = 위 ? 세특고르기_(["'" + 대상 + "' 활동에서 정확하고 안정된 수행 능력을 보임", "'" + 대상 + "'에서 동작의 원리를 이해하고 능숙하게 수행함"], id + p.id)
           : 아래 ? "'" + 대상 + "'에 끝까지 성실하게 참여하며 꾸준히 연습함"
           : "'" + 대상 + "' 활동에 적극적으로 참여하여 동작을 익힘";
      }
      넣기(id, 'EVAL', 글, p.평가명 + (단계 ? ' · ' + 단계 : ''));
    });
  } catch (e) {}

  if (켬('PAPS')) try {
    var ps = paps_설정_(), 종목 = paps_종목목록_();
    학생들.forEach(function (s) {
      if (ps.대상학년.indexOf(Number(s.학년)) < 0) return;
      var 기록 = paps_학생기록_(s.학생ID, String(Y));
      var 회차들 = ps.회차.filter(function (r) { return 기록[r] && Object.keys(기록[r]).length; });
      if (!회차들.length) return;
      var 첫 = 기록[회차들[0]], 끝 = 기록[회차들[회차들.length - 1]], 오른 = [], 등급들 = [];
      종목.forEach(function (t) {
        var a = 첫[t.종목], b = 끝[t.종목];
        if (b && b.등급 !== '' && !isNaN(Number(b.등급))) 등급들.push(Number(b.등급));
        if (회차들.length > 1 && a && b && Number(b.등급) < Number(a.등급)) 오른.push(t.종목);
      });
      var 평균 = 등급들.length ? 등급들.reduce(function (x, y) { return x + y; }, 0) / 등급들.length : null;
      var 글 = '';
      if (오른.length) 글 = '학생건강체력평가에서 ' + 오른.slice(0, 2).join('·') + ' 종목의 등급을 높이는 등 체력 향상을 위해 꾸준히 노력함';
      else if (평균 !== null && 평균 <= 2) 글 = '학생건강체력평가 여러 종목에서 고르게 우수한 체력을 보임';
      else if (평균 !== null) 글 = '학생건강체력평가에 성실히 참여하며 자신의 체력 상태를 확인하고 목표를 세움';
      넣기(s.학생ID, 'PAPS', 글, 회차들.join('→') + (평균 !== null ? ' · 평균 ' + Math.round(평균 * 10) / 10 + '등급' : '') + (오른.length ? ' · 오른 종목 ' + 오른.join(', ') : ''));
    });
  } catch (e) {}

  if (켬('ROPE')) try {
    var rs = rope_설정_(), 줄 = rope_기록전체_().filter(function (r) { return 안(r.날짜); });
    학생들.forEach(function (s) {
      var y = rope_학생요약_(s.학생ID, 줄, rs);
      if (!y.기록일수) return;
      var 종류 = Object.keys(y.종류별 || {}).filter(function (k) { return k !== ROPE_종류없음; }).sort(function (a, b) { return y.종류별[b] - y.종류별[a]; });
      var 글 = '줄넘기 기록을 ' + y.기록일수 + '일 동안 스스로 남기며 누적 ' + y.누적.toLocaleString() + '회를 ' + (종류.length > 1 ? '뛰었고, ' + 종류.slice(0, 2).join('·') + ' 등 여러 기술에 도전함' : '뛰며 꾸준히 연습함');
      if (y.최장연속 >= 7) 글 += '. 최장 ' + y.최장연속 + '일 연속으로 기록할 만큼 꾸준함이 돋보임';
      넣기(s.학생ID, 'ROPE', 글, '기록 ' + y.기록일수 + '일 · 누적 ' + y.누적 + '회 · 하루 최고 ' + y.하루최고 + '회 · 최장 연속 ' + y.최장연속 + '일');
    });
  } catch (e) {}

  if (켬('FIT')) try {
    var 참가 = fit_참가자맵_(false), 운동 = fit_기록전체_().filter(function (r) { return r.상태 === '확인' && 안(r.날짜); });
    학생들.forEach(function (s) {
      if (!참가[s.학생ID]) return;
      var 내 = 운동.filter(function (r) { return r.학생ID === s.학생ID; });
      if (!내.length) return;
      var 요소 = {}, 가정 = 0;
      내.forEach(function (r) { 요소[r.요소] = (요소[r.요소] || 0) + 1; if (r.장소 === '가정') 가정++; });
      var 많은 = Object.keys(요소).filter(Boolean).sort(function (a, b) { return 요소[b] - 요소[a]; })[0];
      var 글 = '건강체력교실에 참여하여 ' + 내.length + '회의 운동 기록을 스스로 관리하' + (많은 ? '고, 특히 ' + 많은 + ' 운동에 꾸준히 참여함' : '며 체력 관리 습관을 기름');
      if (가정 >= 3) 글 += '. 가정에서도 ' + 가정 + '회 운동하며 생활 속 운동을 실천함';
      넣기(s.학생ID, 'FIT', 글, '확인된 기록 ' + 내.length + '회 · 가정 ' + 가정 + '회' + (많은 ? ' · 많이 한 요소 ' + 많은 : ''));
    });
  } catch (e) {}

  if (켬('FMS')) try {
    var app = fms_appData_(), 단계 = {}, 기술 = {};
    app.levels.forEach(function (l) { 단계[l.id] = l; });
    app.skills.forEach(function (k) { 기술[k.id] = k.name; });
    var 승인 = {};
    rows_(FMS.배지).map(fms_배지객체_).forEach(function (a) {
      if (!out[a.studentId] || a.status !== FMS_STATUS.OK || !안(a.decidedAt || a.at)) return;
      var l = 단계[a.levelId]; if (!l) return;
      var m = 승인[a.studentId] = 승인[a.studentId] || {};
      m[l.skillId] = Math.max(m[l.skillId] || 0, l.step || 1);
    });
    Object.keys(승인).forEach(function (id) {
      var ks = Object.keys(승인[id]).sort(function (a, b) { return 승인[id][b] - 승인[id][a]; });
      var 이름들 = ks.map(function (k) { return 기술[k]; }).filter(Boolean);
      if (!이름들.length) return;
      넣기(id, 'FMS', '기본 움직임 기술 도전에서 ' + 이름들.slice(0, 3).join('·') + (이름들.length > 3 ? ' 등 ' : ' ') + 이름들.length + '개 기술의 단계를 통과하며 움직임의 정확성을 높임',
        ks.map(function (k) { return 기술[k] + ' ' + 승인[id][k] + '단계'; }).join(', '));
    });
  } catch (e) {}

  if (켬('MAT')) try {
    var 매트 = mat_기록전체_().filter(function (r) { return !r.날짜 || 안(r.날짜); });
    학생들.forEach(function (s) {
      var y = mat_학생요약_(s.학생ID, 매트);
      if (!y.판수) return;
      var 함께 = y.함께.시간, 연습 = y.연습.시간;
      if (함께 + 연습 < 300) return;   // 5분 미만은 빼기
      var 글 = 함께 >= 연습
        ? '색깔 매트 활동에서 친구와 짝을 이루어 서로의 움직임을 확인해 주며 ' + 세특시간_(함께) + ' 동안 즐겁게 참여함'
        : '색깔 매트 활동을 스스로 ' + 세특시간_(연습) + ' 동안 연습하며 민첩성과 순발력을 기름';
      넣기(s.학생ID, 'MAT', 글, '함께 ' + 세특시간_(함께) + ' · 연습 ' + 세특시간_(연습) + ' · ' + y.판수 + '판');
    });
  } catch (e) {}

  if (켬('CLUB')) try {
    club_클럽목록_().forEach(function (c) {
      if (str_(c.학년도) && str_(c.학년도) !== String(Y)) return;
      c.참가자.forEach(function (m) {
        if (!out[m.학생ID]) return;
        var 분 = 0, 횟수 = 0;
        c.활동.forEach(function (a) { if (a.참여.indexOf(m.학생ID) >= 0) { 횟수++; 분 += a.분; } });
        if (!횟수) return;
        넣기(m.학생ID, 'CLUB', (c.이름 || '스포츠클럽') + '(' + c.종목 + ')에서 ' + 횟수 + '회 활동하며 협동심과 경기 규칙을 지키는 태도를 기름', 횟수 + '회 · ' + Math.round(분 / 60 * 10) / 10 + '시간 (창의적 체험활동에 더 맞을 수 있음)');
      });
    });
  } catch (e) {}
  return out;
}

function 세특저장맵_(Y) {
  var m = {};
  if (!findSheet_(SETEUK)) return m;
  rows_(SETEUK).forEach(function (r) { if (str_(r.학년도) === String(Y)) m[str_(r.학생ID)] = { 내용: str_(r.내용), 수정일시: 시각문자_(r.수정일시), _row: r._row }; });
  return m;
}

/** 학년·반의 초안. 모듈들 = ['EVAL','PAPS',...] (없으면 클럽 빼고 전부) */
function t_seteukDraft(token, 학년, 반, 모듈들) {
  교사확인_(token);
  var Y = num_(설정_().학년도) || new Date().getFullYear();
  var 학생 = 학생목록_(false).filter(function (s) { return s.학년 === Number(학년) && s.반 === Number(반); })
    .sort(function (a, b) { return (a.번호 || 99) - (b.번호 || 99); });
  var 쓸 = (모듈들 && 모듈들.length) ? 모듈들 : SETEUK_모듈.filter(function (k) { return k !== 'CLUB'; });
  var 재료 = 세특재료_(학생, 쓸, Y), 저장 = 세특저장맵_(Y);
  var 순서 = {}; SETEUK_모듈.forEach(function (k, i) { 순서[k] = i; });
  var 상태 = 모듈상태_(), 쓸수있는 = SETEUK_모듈.filter(function (k) { return 상태[k]; });
  return {
    학년도: Y, AI: !!세특키_(), 모듈: 쓸수있는.map(function (k) { var m = MODULES.filter(function (x) { return x.key === k; })[0]; return { key: k, 이름: m ? m.이름 : k, 켬: 쓸.indexOf(k) >= 0 }; }),
    학생: 학생.map(function (s) {
      var 조각 = (재료[s.학생ID] || []).sort(function (a, b) { return 순서[a.모듈] - 순서[b.모듈]; });
      var sv = 저장[s.학생ID];
      return { 학생ID: s.학생ID, 번호: s.번호, 이름: s.이름, 조각: 조각,
               초안: 조각.map(function (c) { return c.글; }).join(' '),
               저장: sv ? sv.내용 : '', 저장있음: !!sv, 수정일시: sv ? sv.수정일시 : '' };
    })
  };
}

function t_seteukSave(token, 학생ID, 내용) {
  교사확인_(token);
  var Y = String(num_(설정_().학년도) || new Date().getFullYear()), id = str_(학생ID);
  var s = 학생찾기_(id); if (!s) return { ok: false, message: '학생을 찾을 수 없습니다.' };
  내용 = String(내용 === undefined || 내용 === null ? '' : 내용).slice(0, 3000);
  return withLock_(function () {
    시트준비_(SETEUK, SETEUK_H);
    var sv = 세특저장맵_(Y)[id], now = 지금_();
    if (sv) setCells_(SETEUK, SETEUK_H, sv._row, { 이름: s.이름, 내용: 내용, 수정일시: now });
    else appendRow_(SETEUK, SETEUK_H, { 학생ID: id, 학년도: Y, 이름: s.이름, 내용: 내용, 수정일시: now });
    return { ok: true, 수정일시: now };
  });
}

/** 고른 학생들의 세특 글 지우기 — 빈칸으로 저장(다시 불러와도 빈칸, "초안으로"를 누르면 기록 초안) (v3.1.1) */
function t_seteukClear(token, ids) {
  교사확인_(token);
  var Y = String(num_(설정_().학년도) || new Date().getFullYear()), now = 지금_();
  return withLock_(function () {
    시트준비_(SETEUK, SETEUK_H);
    var m = 세특저장맵_(Y), 새것 = [], n = 0;
    (ids || []).forEach(function (id) {
      id = str_(id); var s = 학생찾기_(id); if (!s) return;
      if (m[id]) setCells_(SETEUK, SETEUK_H, m[id]._row, { 내용: '', 수정일시: now });
      else 새것.push({ 학생ID: id, 학년도: Y, 이름: s.이름, 내용: '', 수정일시: now });
      n++;
    });
    if (새것.length) appendRows_(SETEUK, SETEUK_H, 새것);
    return { ok: true, count: n, 수정일시: now };
  });
}

/* ---------- 세특 AI 다듬기 (v3.1.1) ----------
   Gemini 키(줄넘기 응원 문구·매트 퀴즈와 같은 키, _속성 GEMINI_KEY)가 있으면 학생마다 기록 사실로 다른 문장을 써 줍니다.
   이름·성별·학교는 보내지 않고, 기록에 없는 일은 지어내지 말라고 묶어 둡니다. 결과는 선생님이 읽고 고치는 초안. */
var SETEUK_KEY = 'GEMINI_KEY';
function 세특키_() { return AI키_(); }
/* ---------- AI 키 한 곳 (설정 → AI 키) (v3.1.1) ----------
   줄넘기 응원 문구 · 매트 퀴즈 문제 · 세특 AI 다듬기, 그리고 앞으로 생길 AI 기능이 모두 이 키(_속성 GEMINI_KEY) 하나를 씁니다. */
var AI_KEY = 'GEMINI_KEY', AI_ERR = 'GEMINI_LAST_ERROR';
function AI키_() { try { return 속성_(AI_KEY) || ''; } catch (e) { return ''; } }
function t_aiInfo(token) {
  교사확인_(token);
  var k = AI키_();
  return { 키: !!k, 끝: k ? k.slice(-4) : '', 모델: 캐시읽기_('rope_gemini_model') || '', 오류: (function () { try { return 속성_(AI_ERR) || ''; } catch (e) { return ''; } })() };
}
function t_aiKey(token, key) {
  교사확인_(token);
  key = str_(key);
  if (key && !/^[A-Za-z0-9_\-]{20,80}$/.test(key)) return { ok: false, message: '키 모양이 아니에요. aistudio.google.com 에서 받은 키를 그대로 붙여 넣어 주세요.' };
  속성저장_(AI_KEY, key || null); 속성저장_(AI_ERR, null);
  캐시지우기_('rope_ai_' + 오늘_()); 캐시지우기_('rope_gemini_model'); 캐시지우기_('rope_gemini_blocked');
  var out = t_aiInfo(token); out.ok = true; return out;
}
function t_seteukKey(token, key) { var r = t_aiKey(token, key); return r.ok ? { ok: true, 키: r.키 } : r; }   // 3.1.1 초기 화면 호환
/** 키가 실제로 되는지 짧게 물어봅니다 */
function t_aiTest(token) {
  교사확인_(token);
  var k = AI키_(); if (!k) return { ok: false, message: '키가 없어요.' };
  try {
    var t = rope_gemini호출_(k, '체육 수업을 시작하는 초등학생들에게 건네는 짧은 인사 한 문장을 존댓말로 써 줘. 문장만.', 0);
    try { 속성저장_(AI_ERR, null); } catch (e2) {}
    return { ok: true, 답: String(t).slice(0, 120), 모델: 캐시읽기_('rope_gemini_model') || '' };
  } catch (e) {
    var m = (e && e.message) || String(e);
    try { 속성저장_(AI_ERR, (지금_() + ' ' + m).slice(0, 300)); } catch (e3) {}
    return { ok: false, message: /API key not valid|API_KEY_INVALID/i.test(m) ? '키가 맞지 않아요. 복사할 때 앞뒤가 빠지지 않았는지 확인해 주세요.' : /429|quota|RESOURCE_EXHAUSTED/i.test(m) ? '지금은 사용량이 꽉 찼어요. 1분쯤 뒤 다시 해 보세요.' : m.slice(0, 200) };
  }
}
function 세특AI글_(조각, 선생님글, 이름, 한도, seed) {
  var 지움 = function (t) { t = str_(t); if (이름) t = t.split(이름).join('').split(이름.slice(1)).join(''); return t; };
  var 사실 = 조각.map(function (c) { return '- ' + c.이름 + ': ' + 지움(c.글) + (c.근거 ? ' (기록: ' + 지움(c.근거).replace(/\s*·\s*(매우잘함|잘함|보통|노력요함|상|중|하)(?=\s*(·|$))/g, '') + ')' : ''); });
  var 최대 = Math.round(한도 * 0.85), 최소 = Math.round(한도 * 0.45);
  var 말투 = ['꾸준함과 성장 과정이 드러나게', '구체적인 활동 장면이 그려지게', '친구와의 협력과 태도가 드러나게', '스스로 도전하는 모습이 드러나게'][seed % 4];
  return '너는 ' + 학교급_().이름 + ' 체육 교사로서 학교생활기록부의 "체육 교과 세부능력 및 특기사항"을 쓴다.\n' +
    '아래는 한 학생의 이번 학년도 체육 활동 기록이다. 이 사실만 바탕으로 한 문단을 써라.\n' +
    '규칙:\n' +
    '1. 학생 이름·성별·학교 이름을 쓰지 않는다. 주어 없이 쓴다.\n' +
    '2. 기록에 없는 사건·수치·대회·수상은 절대 지어내지 않는다. 태도와 성장은 기록에서 자연스럽게 읽히는 만큼만 쓴다.\n' +
    '3. PAPS 등급 숫자, 순위, 평가 단계 이름(상·중·하, 잘함 등)은 쓰지 않는다. 횟수·시간은 꼭 필요할 때만 쓴다.\n' +
    '4. 문장 끝은 "~함.", "~임.", "~보임."처럼 명사형으로 끝낸다. 존댓말·느낌표·따옴표·목록 기호·줄바꿈을 쓰지 않는다.\n' +
    '5. 공백 포함 ' + 최소 + '~' + 최대 + '자.\n' +
    '6. 같은 반 다른 학생 글과 겹치지 않도록 첫 문장과 표현을 새로 고르고, ' + 말투 + ' 쓴다.\n' +
    (str_(선생님글) ? '\n[선생님이 쓴 글 — 이 내용과 관찰을 가장 먼저 살려서 다듬기]\n' + 지움(선생님글) + '\n' : '') +
    '\n[활동 기록]\n' + (사실.length ? 사실.join('\n') : '- (모듈 기록 없음)') + '\n\n문단만 출력해.';
}
/** 한 학생의 AI 초안. 선생님글 = 지금 칸의 글(기록에서 만든 초안과 다르면 그것을 살려 다듬음) */
function t_seteukAI(token, 학생ID, 모듈들, 한도, 선생님글) {
  교사확인_(token);
  var key = 세특키_();
  if (!key) return { ok: false, message: 'AI 키가 없어요. 설정 → AI 키에서 넣어 주세요.' };
  var s = 학생찾기_(str_(학생ID)); if (!s) return { ok: false, message: '학생을 찾을 수 없습니다.' };
  var Y = num_(설정_().학년도) || new Date().getFullYear();
  var 쓸 = (모듈들 && 모듈들.length) ? 모듈들 : SETEUK_모듈.filter(function (k) { return k !== 'CLUB'; });
  var 조각 = 세특재료_([s], 쓸, Y)[s.학생ID] || [];
  var 초안 = 조각.map(function (c) { return c.글; }).join(' ');
  var 내글 = str_(선생님글); if (내글 === 초안) 내글 = '';
  if (!조각.length && !내글) return { ok: false, message: '이번 학년도 기록이 없어 AI가 쓸 재료가 없어요. 관찰한 내용을 먼저 몇 마디 써 주세요.' };
  한도 = Math.max(150, Math.min(1500, num_(한도) || 500));
  var seed = 0; String(s.학생ID).split('').forEach(function (c) { seed += c.charCodeAt(0); });
  try {
    var t = rope_gemini호출_(key, 세특AI글_(조각, 내글, s.이름, 한도, seed), 0);
    t = String(t).replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').replace(/^[-*•]\s*/gm, '').replace(/\s*\n+\s*/g, ' ').trim();
    if (s.이름) t = t.split(s.이름).join('');
    return { ok: true, 글: t };
  } catch (e) {
    var m = e.message || String(e);
    return { ok: false, message: /429|quota|RESOURCE_EXHAUSTED/i.test(m) ? 'AI 사용량이 잠시 꽉 찼어요. 1분쯤 뒤에 다시 해 주세요.' : 'AI가 글을 쓰지 못했어요: ' + m.slice(0, 160), 바쁨: /429|quota|RESOURCE_EXHAUSTED/i.test(m) };
  }
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
