/*******************************************************
 * 줄넘기 모듈 (Mod_Rope.gs) — 교사 + 학생
 *
 * 단독판 줄넘기 기록 프로그램의 "개념"만 가져와 통합 뼈대 위에 새로 쓴 모듈입니다.
 *  - 하루에 여러 번 입력 → 각각 한 줄로 쌓여 그날 횟수가 누적됩니다 (덮어쓰기 없음).
 *  - 학생 입력은 대기 → 교사 확인(또는 설정으로 자동 확인) → 그래프·순위에 반영.
 *  - 하루 목표(개인), 학급 공동 목표, 개인 기록·누적에 따른 배지(학생), 학급 간 목표 달성률 순위(교사).
 *  - 단순 건강활동 기록용이라 차시 운영은 두지 않습니다.
 *  - 학생 명단·로그인은 공통. 대상 학년은 설정 `줄넘기.대상학년`(비우면 전체).
 *
 * 시트
 *   줄넘기_기록 : 기록ID, 입력일시, 날짜, 시각, 학생ID, 횟수, 상태(대기/확인/반려/짝대기/짝반려), 확인일시, 입력자(학생/교사), 메모,
 *                 짝학생ID, 짝확인일시, 짝메모, 사진파일ID, 사진썸네일ID, 사진파일명,  ← 짝 체크 (v1.6)
 *                 종류                                                          ← 줄넘기 종류 (v1.6, 단독판 1.4)
 *   줄넘기_급수 : 학생ID, 급수, 항목, 통과일, 입력자   ← 급수 인증 (v3.1.9) · 급수표는 ROPE_급수기본 또는 _속성 줄넘기.급수표
 *
 * 짝 체크 (선택) : 설정 줄넘기.짝체크 가 Y 이면 학생이 기록을 넣을 때 같은 반 짝을 고릅니다.
 *   학생 입력 → 짝대기 → 짝이 "맞아요"(사진은 선택) → 대기 → 교사 확인 → 확인.   짝이 "아니에요" 면 짝반려.
 *   최종 확인은 언제나 교사. 자동확인 Y 이면 짝이 맞다고 한 순간 확인으로.
 *
 * 설정(공통 설정 시트) : 줄넘기.하루목표, 줄넘기.대상학년, 줄넘기.자동확인, 줄넘기.하루최대입력, 줄넘기.한번최대횟수, 줄넘기.학급목표,
 *                        줄넘기.짝체크, 줄넘기.짝사진, 줄넘기.짝사진보관
 * 응원 문구 : 스크립트 속성 GEMINI_KEY 가 있으면 Gemini, 없으면 기본 문구
 *******************************************************/

var ROPE = { 기록: '줄넘기_기록', 급수: '줄넘기_급수' };
var ROPE_H = { 기록: ['기록ID', '입력일시', '날짜', '시각', '학생ID', '횟수', '상태', '확인일시', '입력자', '메모',
                     '짝학생ID', '짝확인일시', '짝메모', '사진파일ID', '사진썸네일ID', '사진파일명', '종류'],
               급수: ['학생ID', '급수', '항목', '통과일', '입력자'] };   // 급수 인증 (v3.1.9): 누가 몇 급 몇 번 항목을 언제 통과했는지 한 줄씩
var ROPE_기본종류 = '모아뛰기,엇갈아뛰기,이중뛰기,십자뛰기';
var ROPE_종류없음 = '(종류 없음)';   // 종류 기능이 생기기 전에 넣은 기록
var ROPE_FOLDER_KEY = 'ROPE_PHOTO_FOLDER_ID';
var ROPE_PHOTO_MAX = 6 * 1024 * 1024;

/* 배지: [id, 이름, 설명, 아이콘, 기준 종류, 기준값]  — 기준 종류: 누적 | 달성일 | 연속(최장) | 기록일 | 하루최고 */
var ROPE_배지 = [
  ['R01', '첫 줄넘기',      '첫 기록을 남겼어요',            'shoe',        '기록일', 1],
  ['R02', '천 번의 점프',   '누적 1,000회',                  'flame',       '누적', 1000],
  ['R03', '오천 번의 점프', '누적 5,000회',                  'medal',       '누적', 5000],
  ['R04', '만 번의 점프',   '누적 10,000회',                 'trophy',      '누적', 10000],
  ['R05', '삼만 점프 마스터', '누적 30,000회',               'diamond',     '누적', 30000],
  ['R06', '목표 달성!',     '하루 목표를 처음 넘었어요',     'target-arrow', '달성일', 1],
  ['R07', '열 번의 목표',   '하루 목표 10일 달성',           'target',      '달성일', 10],
  ['R08', '서른 번의 목표', '하루 목표 30일 달성',           'award',       '달성일', 30],
  ['R09', '3일 연속',       '3일 연속 기록',                 'bolt',        '연속', 3],
  ['R10', '일주일 연속',    '7일 연속 기록',                 'calendar-check', '연속', 7],
  ['R11', '한 달 연속',     '30일 연속 기록',                'crown',       '연속', 30],
  ['R12', '꾸준한 발걸음',  '기록한 날 20일',                'walk',        '기록일', 20],
  ['R13', '꾸준함의 힘',    '기록한 날 50일',                'mountain',    '기록일', 50],
  ['R14', '하루 500',       '하루에 500회',                  'rocket',      '하루최고', 500],
  ['R15', '하루 1000',      '하루에 1,000회',                'star',        '하루최고', 1000]
];
var ROPE_색 = '#FFEDE7';
var ROPE_상태 = ['대기', '확인', '반려', '짝대기', '짝반려'];   // 짝대기 = 짝 확인 기다림, 짝반려 = 짝이 아니라고 함
var ROPE_GEMINI_KEY = 'GEMINI_KEY';

function rope_기본설정_() {
  return [
    ['하루목표',     '100', '학생 한 명의 하루 목표 횟수'],
    ['대상학년',     '',    '줄넘기 메뉴를 보여 줄 학년 (예: 3,4,5,6 / 비우면 전체)'],
    ['자동확인',     'N',   'Y 면 학생이 입력한 기록을 교사 확인 없이 바로 인정'],
    ['하루최대입력', '10',  '학생이 하루에 입력할 수 있는 기록 수'],
    ['한번최대횟수', '3000', '한 번에 입력할 수 있는 최대 횟수 (오타 방지)'],
    ['학급목표',     '5000', '학급 공동 목표 (반 전체 누적 횟수)'],
    ['짝체크',       'N',    'Y 면 학생이 기록을 넣을 때 같은 반 짝을 고르고, 짝이 맞다고 한 뒤 교사가 최종 확인 (선생님이 짝 체크로 활동하는 날만 켜세요)'],
    ['짝사진',       'Y',    'Y 면 짝이 확인할 때 사진(줄넘기 계수기 화면 등)을 선택으로 올릴 수 있음'],
    ['짝사진보관',   '유지', '유지 | 확인후삭제 — 교사가 확인한 뒤 사진 파일을 드라이브에 둘지, 휴지통으로 보낼지'],
    ['종류사용',     'Y',    'Y 면 학생이 기록을 넣을 때 줄넘기 종류(모아뛰기·이중뛰기 …)를 고름'],
    ['종류',         ROPE_기본종류, '줄넘기 종류 목록 (쉼표로 구분, 최대 20개). 위에서부터 순서대로 선택지·그래프에 나옴'],
    ['판정기주소',   'https://musicalpe.github.io/jump-rope-checker/', '카메라 줄넘기 판정기 페이지 주소 (https). 비우면 학생 화면에 "카메라로 뛰기" 버튼이 안 나옴'],
    ['판정기최소',   '10',   '판정기가 보낸 기록을 받을 최소 횟수 (그보다 적으면 기록하지 않음)'],
    ['판정기민감도', '10',   '판정기 민감도 6~16 (작을수록 살짝 떠도 셈, 클수록 높이 떠야 셈). 학생은 못 바꿈'],
    ['체력합산',     'N',    'Y 면 건강체력교실에서 카메라로 뛴 줄넘기도 줄넘기 기록에 함께 넣음 (한 운동이 두 모듈에 기록됨)'],
    ['급수사용',     'Y',    'Y 면 급수 인증(한국줄넘기협회 급수표) 메뉴와 학생 화면의 "나의 급수"를 씀 (v3.1.9)'],
    ['급수메인',     'Y',    'Y 면 학급 현황·학생 화면에 우리 반 급수 분포를 보여 줌'],
    ['여행코스',     '',     '우리 반 줄넘기 여행 코스: busan(서울→부산) | korea(국토 한 바퀴) | jeju(서울→제주) | earth(지구 한 바퀴) · 비우면 안 씀. 줄넘기 1회 = 1m'],
    ['여행시작일',   '',     '여행 거리를 세기 시작한 날 (yyyy-mm-dd · 비우면 모든 확인 기록)']
  ];
}

/* 급수표 기본값 — 한국줄넘기협회 급수 (줄넘기 기록 관리 2.2 와 같음). 학교에 맞게 고치면 _속성 줄넘기.급수표 에 저장 */
var ROPE_급수기본 = [
  { 이름: '흰',   색: '#FFFFFF', 항목: [['양발 모아 뛰기', '100'], ['번갈아 스텝', '50'], ['엇걸어 풀어 스텝', '10'], ['이중 뛰기', '20'], ['뒤로 뛰기', '30']] },
  { 이름: '노랑', 색: '#FFD60A', 항목: [['양발 모아 뛰기', '150'], ['번갈아 스텝', '70'], ['엇걸어 풀어 스텝', '20'], ['이중 뛰기', '30'], ['뒤로 뛰기', '50']] },
  { 이름: '초록', 색: '#1E8E3E', 항목: [['이중 뛰기', '50'], ['솔개 뛰기', '1'], ['송골매 뛰기', '1'], ['옆 떨쳐 앞으로 뛰기', ''], ['옆 떨쳐 엇걸어 스텝', ''], ['옆 떨쳐 EB', '4'], ['뒤로 이중 뛰기', '5']] },
  { 이름: '파랑', 색: '#2F56C8', 항목: [['이중 뛰기', '70'], ['솔개 뛰기', '5'], ['송골매 뛰기', '5'], ['1.5옆 떨쳐 앞으로 뛰기', ''], ['옆 떨쳐 엇걸어 스텝', ''], ['옆 떨쳐 EB', '10'], ['뒤로 이중 뛰기', '20']] },
  { 이름: '밤',   색: '#6B2A20', 항목: [['이중 뛰기', '100'], ['솔개 뛰기', '10'], ['송골매 뛰기', '10'], ['1.5중 옆 떨쳐 연결', '1'], ['뒤로 이중 뛰기', '30']] },
  { 이름: '주황', 색: '#F07C1E', 항목: [['이중 뛰기', '120'], ['솔개 뛰기', '15'], ['송골매 뛰기', '15'], ['1.5중 옆 떨쳐 연결', '2'], ['뒤로 이중 뛰기', '40']] },
  { 이름: '빨강', 색: '#E01B1B', 항목: [['이중 뛰기', '150'], ['십자매 뛰기', '2'], ['1.5중 옆 떨쳐 연결', '10'], ['뒤로 이중 뛰기', '50']] },
  { 이름: '검은', 색: '#1A1A1A', 항목: [['이중 뛰기', '100'], ['십자매 뛰기', '5'], ['1.5중 옆 떨쳐 연결', '10'], ['TS / 토드연결', '5회/2회'], ['뒤로 이중 뛰기', '60']] },
  { 이름: '와이어', 색: '#9CA3AF', 항목: [['이중 뛰기', '300'], ['3중 뛰기', '10'], ['TS 스텝', '10'], ['TS 이중 뛰기', '2'], ['토드 연결', '5'], ['뒤로 이중 뛰기', '20']] }
];
var ROPE_급수표KEY = '줄넘기.급수표';
/* 우리 반 줄넘기 여행 코스 — 1회 = 1m. 정거장: [이름, km] */
var ROPE_여행코스 = {
  busan: { 이름: '서울 → 부산', km: 400, 정거장: [['서울', 0], ['수원', 30], ['천안', 85], ['대전', 150], ['김천', 230], ['대구', 290], ['부산', 400]] },
  korea: { 이름: '국토 한 바퀴', km: 1200, 정거장: [['서울', 0], ['강릉', 230], ['포항', 490], ['부산', 600], ['목포', 860], ['전주', 1000], ['서울', 1200]] },
  jeju:  { 이름: '서울 → 제주 (배 타고)', km: 560, 정거장: [['서울', 0], ['대전', 150], ['광주', 300], ['목포', 370], ['제주', 560]] },
  earth: { 이름: '지구 한 바퀴', km: 40075, 정거장: [['출발', 0], ['서울→부산 거리 10번', 4000], ['베이징~모스크바쯤', 10000], ['반 바퀴', 20037], ['3/4', 30056], ['한 바퀴', 40075]] }
};

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function rope_hooks_() {
  return {
    준비확인: function () { return !!findSheet_(ROPE.기록); },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(ROPE.기록, ROPE_H.기록, { 색: ROPE_색 }));
      ensureColumns_(ROPE.기록, ROPE_H.기록);   // 예전 판 시트에 짝 체크 열 보충
      var put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      rope_기본설정_().forEach(function (r) { if (!있음['줄넘기.' + r[0]]) put['줄넘기.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('줄넘기 설정 ' + Object.keys(put).length + '항목'); }
      rope_캐시지우기_();
      return 만듦;
    },
    캐시지우기: rope_캐시지우기_,
    학생참여: function (학생ID) {
      var s = rope_설정_(), st = 학생찾기_(학생ID);
      if (!st) return false;
      return !s.대상학년.length || s.대상학년.indexOf(Number(st.학년)) >= 0;
    },
    교사대시보드: function () {
      var 기록 = rope_기록전체_(), 오늘 = 오늘_(), s = rope_설정_();
      var 대기 = 기록.filter(function (r) { return r.상태 === '대기'; }).length;
      var 짝대기 = 기록.filter(function (r) { return r.상태 === '짝대기'; }).length;
      var 오늘합 = {}, 오늘총 = 0;
      기록.forEach(function (r) { if (r.상태 === '확인' && r.날짜 === 오늘) { 오늘합[r.학생ID] = (오늘합[r.학생ID] || 0) + r.횟수; 오늘총 += r.횟수; } });
      var 달성 = Object.keys(오늘합).filter(function (id) { return 오늘합[id] >= s.하루목표; }).length;
      var 반들 = rope_학급비교_(rope_학급현황_(0, 0, 기록, s), s), top = 반들[0];
      return {
        카드: [
          { 제목: '확인 기다리는 줄넘기 기록', 값: 대기, 단위: '건', 배지: 대기 || '', 설명: (대기 ? '학생이 입력한 횟수를 확인해 주세요' : '모두 확인했습니다') + (짝대기 ? ' · 짝 확인 중 ' + 짝대기 + '건' : ''), 이동: 'pending' },
          { 제목: '오늘 줄넘기', 값: 오늘총, 단위: '회', 설명: Object.keys(오늘합).length + '명 기록 · 목표 ' + s.하루목표 + '회 달성 ' + 달성 + '명' + (top && top.달성률 ? ' · 달성률 1위 ' + top.학년 + '-' + top.반 + ' (' + top.달성률 + '%)' : ''), 이동: 'dash' }
        ],
        대기: 대기
      };
    },
    학생프로필: function (학생ID) {
      var y = rope_학생요약_(학생ID, rope_기록전체_(), rope_설정_());
      return {
        제목: '오늘 ' + y.오늘 + ' / ' + y.하루목표 + '회', 값: y.누적, 단위: '회', 진행: rope_pct_(y.오늘, y.하루목표),
        설명: '기록한 날 ' + y.기록일수 + '일 · 연속 ' + y.연속 + '일' + (y.대기 ? ' · 확인 대기 ' + y.대기 + '건' : ''),
        알림: y.반려 ? '줄넘기: 반려된 기록이 ' + y.반려 + '건 있어요. 선생님께 물어보세요' : '',
        배지목록: rope_배지_(y).filter(function (b) { return b.달성; }).slice(-3).map(function (b) { return b.이름; }),
        요약: { 이름: '줄넘기 누적', 값: y.누적, 단위: '회' }, 이동: 'home'
      };
    },
    학생배지: function (학생ID) {
      var y = rope_학생요약_(학생ID, rope_기록전체_(), rope_설정_());
      return rope_배지_(y).map(function (b) { return { id: 'ROPE-' + b.id, 이름: b.이름, 설명: b.설명, 아이콘: b.아이콘, 달성: b.달성, 진행: b.진행, 값: b.값, 기준: b.기준 }; });
    },
    초기화정보: function () {
      return [{ key: '기록', 이름: '줄넘기 기록 (학생 입력·교사 입력 모두 · 짝 확인 사진 파일도 휴지통으로)', 수: rows_(ROPE.기록).length },
              { key: '급수', 이름: '줄넘기 급수 인증 (통과한 항목 · 급수표는 그대로)', 수: rows_(ROPE.급수).length }];
    },
    초기화: function (opts) {
      opts = opts || {};
      var res = {};
      if (opts.기록) {
        var 파일 = [];
        rope_기록전체_().forEach(function (r) { 파일.push(r.사진파일ID, r.사진썸네일ID); });
        rope_휴지통_(파일);
        res.기록 = 시트비우기_(ROPE.기록);
      }
      if (opts.급수 && findSheet_(ROPE.급수)) res.급수 = 시트비우기_(ROPE.급수);
      rope_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var n = 행지우기_(ROPE.기록, function (o) { return set[str_(o.학생ID)] === true; });
      var m = 행지우기_(ROPE.급수, function (o) { return set[str_(o.학생ID)] === true; });   // 급수 인증도 함께 (v3.1.9)
      rope_캐시지우기_();
      return { 기록: n, 급수: m };
    },
    /** 학교급이 바뀌면 대상 학년을 비워 전체 학년으로 (지난 학교급의 학년 번호가 남지 않게) */
    학교급변경: function (급) {
      설정저장_({ '줄넘기.대상학년': '' });
      rope_캐시지우기_();
      return ['줄넘기 대상 학년 → 전체'];
    }
  };
}

/* ================= 설정 · 읽기 ================= */

function rope_설정_() {
  var all = 설정_(), out = {};
  rope_기본설정_().forEach(function (r) { var v = all['줄넘기.' + r[0]]; out[r[0]] = (v === undefined || v === null || v === '') ? r[1] : String(v); });
  return {
    하루목표: Math.max(1, num_(out.하루목표) || 100),
    대상학년: 목록_(out.대상학년).map(Number).filter(function (g) { return g >= 1 && g <= 학교급_().최대학년; }),
    자동확인: str_(out.자동확인).toUpperCase() === 'Y' && !nat_설정_().on,   // 전국 현황판 참여 중엔 늘 선생님 확인 (v3.1.8)
    하루최대입력: Math.max(1, num_(out.하루최대입력) || 10),
    한번최대횟수: Math.max(1, num_(out.한번최대횟수) || 3000),
    학급목표: Math.max(0, num_(out.학급목표) || 0),
    짝체크: str_(out.짝체크).toUpperCase() === 'Y',
    짝사진: str_(out.짝사진).toUpperCase() !== 'N',
    짝사진보관: str_(out.짝사진보관) === '확인후삭제' ? '확인후삭제' : '유지',
    종류사용: str_(out.종류사용).toUpperCase() !== 'N',
    종류: rope_종류정리_(out.종류),
    판정기주소: /^https:\/\//.test(str_(out.판정기주소)) ? str_(out.판정기주소) : '',
    판정기최소: Math.max(1, Math.min(1000, num_(out.판정기최소) || 10)),
    판정기민감도: Math.max(6, Math.min(16, num_(out.판정기민감도) || 10)),
    체력합산: str_(out.체력합산).toUpperCase() === 'Y',
    급수사용: str_(out.급수사용).toUpperCase() !== 'N',
    급수메인: str_(out.급수메인).toUpperCase() !== 'N',
    여행코스: ROPE_여행코스[str_(out.여행코스)] ? str_(out.여행코스) : '',
    여행시작일: 날짜정리_(out.여행시작일) || '',
    학년도: str_(all.학년도)
  };
}
/** 화면용 여행 정보 (코스를 안 골랐으면 null). 총: 시작일 이후 확인 합계 */
function rope_여행_(s, 총) {
  if (!s.여행코스) return null;
  var c = ROPE_여행코스[s.여행코스];
  return { 코스: s.여행코스, 이름: c.이름, km: c.km, 정거장: c.정거장, 시작일: s.여행시작일, 총: 총 || 0 };
}
function rope_캐시지우기_() { 캐시지우기_('rope_rec'); 캐시지우기_('rope_lv'); }
/** 종류 목록 정리: 쉼표·줄바꿈으로 나누고 빈 것·중복 제거, 최대 20개 */
function rope_종류정리_(v) {
  var seen = {}, out = [];
  (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).forEach(function (x) {
    x = str_(x).slice(0, 20);
    if (!x || x === ROPE_종류없음 || seen[x]) return;
    seen[x] = true; out.push(x);
  });
  return out.slice(0, 20);
}
function rope_시각_(v) {
  if (v instanceof Date) return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  var m = str_(v).match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function rope_pct_(a, b) { if (!b) return 0; return Math.max(0, Math.min(100, Math.round(a / b * 100))); }

function rope_기록전체_() {
  return 캐시_('rope_rec', function () {
    return rows_(ROPE.기록).map(function (r) {
      return { 기록ID: str_(r.기록ID), 입력일시: 시각문자_(r.입력일시), 날짜: 날짜정리_(r.날짜), 시각: rope_시각_(r.시각), 학생ID: str_(r.학생ID),
               횟수: Math.max(0, Math.round(num_(r.횟수) || 0)), 상태: ROPE_상태.indexOf(str_(r.상태)) >= 0 ? str_(r.상태) : '대기',
               확인일시: 시각문자_(r.확인일시), 입력자: str_(r.입력자) || '학생', 메모: str_(r.메모),
               짝학생ID: str_(r.짝학생ID), 짝확인일시: 시각문자_(r.짝확인일시), 짝메모: str_(r.짝메모),
               사진파일ID: str_(r.사진파일ID), 사진썸네일ID: str_(r.사진썸네일ID), 사진파일명: str_(r.사진파일명), 종류: str_(r.종류), _row: r._row };
    }).filter(function (r) { return r.기록ID && r.날짜 && r.학생ID; })
      .sort(function (a, b) { return (a.날짜 + a.시각 + a.입력일시).localeCompare(b.날짜 + b.시각 + b.입력일시); });
  });
}

/* 날짜 map → 오늘 기준 연속 일수 (오늘 기록이 없으면 어제부터 셈) */
function rope_연속_(날짜맵, 오늘) {
  var d = 날짜맵[오늘] ? 오늘 : 날짜더하기_(오늘, -1), n = 0;
  while (날짜맵[d]) { n++; d = 날짜더하기_(d, -1); if (n > 400) break; }
  return n;
}
function rope_최장연속_(날짜맵) {
  var days = Object.keys(날짜맵).sort(), best = 0, run = 0, prev = null;
  days.forEach(function (d) { run = (prev && 날짜더하기_(prev, 1) === d) ? run + 1 : 1; if (run > best) best = run; prev = d; });
  return best;
}

/** 학생 한 명 요약 (확인된 기록 기준) */
function rope_학생요약_(학생ID, 기록, s) {
  var 오늘 = 오늘_(), 주 = 주시작_(오늘), 날짜맵 = {}, 누적 = 0, 오늘합 = 0, 주합 = 0, 대기 = 0, 반려 = 0, 목표달성일 = 0, 종류별 = {}, 날짜종류 = {};
  기록.forEach(function (r) {
    if (r.학생ID !== 학생ID) return;
    if (r.상태 === '대기' || r.상태 === '짝대기') { 대기++; return; }
    if (r.상태 === '반려' || r.상태 === '짝반려') { 반려++; return; }
    누적 += r.횟수; 날짜맵[r.날짜] = (날짜맵[r.날짜] || 0) + r.횟수;
    var t = r.종류 || ROPE_종류없음;
    종류별[t] = (종류별[t] || 0) + r.횟수;
    (날짜종류[r.날짜] = 날짜종류[r.날짜] || {})[t] = (날짜종류[r.날짜][t] || 0) + r.횟수;
    if (r.날짜 === 오늘) 오늘합 += r.횟수;
    if (주시작_(r.날짜) === 주) 주합 += r.횟수;
  });
  var 하루최고 = 0;
  Object.keys(날짜맵).forEach(function (d) { if (날짜맵[d] >= s.하루목표) 목표달성일++; if (날짜맵[d] > 하루최고) 하루최고 = 날짜맵[d]; });
  return { 누적: 누적, 오늘: 오늘합, 이번주: 주합, 하루목표: s.하루목표, 기록일수: Object.keys(날짜맵).length, 연속: rope_연속_(날짜맵, 오늘), 최장연속: rope_최장연속_(날짜맵),
           목표달성일: 목표달성일, 하루최고: 하루최고, 대기: 대기, 반려: 반려, 날짜별: 날짜맵, 종류별: 종류별, 날짜종류: 날짜종류 };
}

/** 요약 → 배지 목록 [{id, 이름, 설명, 아이콘, 달성, 값, 기준}] */
function rope_배지_(y) {
  var 값 = { 누적: y.누적, 달성일: y.목표달성일, 연속: y.최장연속, 기록일: y.기록일수, 하루최고: y.하루최고 };
  return ROPE_배지.map(function (b) {
    var v = 값[b[4]] || 0;
    return { id: b[0], 이름: b[1], 설명: b[2], 아이콘: b[3], 종류: b[4], 기준: b[5], 값: v, 달성: v >= b[5], 진행: Math.min(100, Math.round(v / b[5] * 100)) };
  });
}

/** 학급 순위·현황 (확인된 기록). 학년·반이 0이면 전체 */
function rope_학급현황_(학년, 반, 기록, s) {
  var 오늘 = 오늘_(), 주 = 주시작_(오늘);
  var 학생 = 학생목록_(false).filter(function (st) { return (!학년 || st.학년 === Number(학년)) && (!반 || st.반 === Number(반)); })
    .filter(function (st) { return !s.대상학년.length || s.대상학년.indexOf(st.학년) >= 0; });
  var by = {};
  학생.forEach(function (st) { by[st.학생ID] = { 학생ID: st.학생ID, 학년: st.학년, 반: st.반, 번호: st.번호, 이름: st.이름, 누적: 0, 오늘: 0, 이번주: 0, 날짜맵: {}, 대기: 0, 종류별: {} }; });
  var 본종류 = {}, 여행총 = 0, 여행시작 = s.여행코스 ? s.여행시작일 : null;
  기록.forEach(function (r) {
    var o = by[r.학생ID]; if (!o) return;
    if (r.상태 === '대기' || r.상태 === '짝대기') { o.대기++; return; }
    if (r.상태 !== '확인') return;
    if (여행시작 !== null && (!여행시작 || r.날짜 >= 여행시작)) 여행총 += r.횟수;
    o.누적 += r.횟수; o.날짜맵[r.날짜] = (o.날짜맵[r.날짜] || 0) + r.횟수;
    var t = r.종류 || ROPE_종류없음; o.종류별[t] = (o.종류별[t] || 0) + r.횟수; 본종류[t] = true;
    if (r.날짜 === 오늘) o.오늘 += r.횟수;
    if (주시작_(r.날짜) === 주) o.이번주 += r.횟수;
  });
  var list = 학생.map(function (st) {
    var o = by[st.학생ID], 달성일 = 0;
    Object.keys(o.날짜맵).forEach(function (d) { if (o.날짜맵[d] >= s.하루목표) 달성일++; });
    return { 학생ID: o.학생ID, 학년: o.학년, 반: o.반, 번호: o.번호, 이름: o.이름, 누적: o.누적, 오늘: o.오늘, 이번주: o.이번주,
             기록일수: Object.keys(o.날짜맵).length, 연속: rope_연속_(o.날짜맵, 오늘), 최장연속: rope_최장연속_(o.날짜맵), 목표달성일: 달성일, 대기: o.대기, 종류별: o.종류별 };
  });
  // 그래프·필터에 보일 종류: 설정 순서 + (설정에서 빠진 이름·종류 없음은 뒤에)
  var 종류들 = s.종류.slice();
  Object.keys(본종류).forEach(function (t) { if (종류들.indexOf(t) < 0) 종류들.push(t); });
  var 총 = 0, 오늘총 = 0, 달성 = 0;
  list.forEach(function (o) { 총 += o.누적; 오늘총 += o.오늘; if (o.오늘 >= s.하루목표) 달성++; });
  // 왕: 가장 큰 값. 같은 값이면 공동 1위 — 공동: [{이름,학년,반}] 모두 (v3.1.9)
  var top = function (key) {
    var best = null; list.forEach(function (o) { if (o[key] > 0 && (!best || o[key] > best[key])) best = o; });
    if (!best) return null;
    var 공동 = list.filter(function (o) { return o[key] === best[key]; }).sort(function (a, b) { return (a.학년 - b.학년) || (a.반 - b.반) || (a.번호 - b.번호); }).map(function (o) { return { 이름: o.이름, 학년: o.학년, 반: o.반 }; });
    return { 이름: 공동[0].이름, 학년: 공동[0].학년, 반: 공동[0].반, 값: best[key], 공동: 공동 };
  };
  return { 학생: list, 종류들: 종류들, 총: 총, 오늘총: 오늘총, 달성: 달성, 오늘기록인원: list.filter(function (o) { return o.오늘 > 0; }).length,
           왕: { 오늘: top('오늘'), 이번주: top('이번주'), 연속: top('연속'), 누적: top('누적') }, 여행: rope_여행_(s, 여행총) };
}

/** 학급별 비교 (오늘 목표 달성률 순). 현황.학생을 학년-반으로 묶음 */
function rope_학급비교_(현황, s) {
  var by = {};
  현황.학생.forEach(function (o) {
    var k = o.학년 + '-' + o.반, g = by[k] || (by[k] = { 학년: o.학년, 반: o.반, 인원: 0, 오늘달성: 0, 오늘기록: 0, 오늘총: 0, 누적: 0, 기록일합: 0 });
    g.인원++; g.누적 += o.누적; g.오늘총 += o.오늘; g.기록일합 += o.기록일수;
    if (o.오늘 > 0) g.오늘기록++;
    if (o.오늘 >= s.하루목표) g.오늘달성++;
  });
  return Object.keys(by).map(function (k) {
    var g = by[k];
    g.달성률 = g.인원 ? Math.round(g.오늘달성 / g.인원 * 100) : 0;
    g.평균 = g.인원 ? Math.round(g.누적 / g.인원) : 0;
    g.평균기록일 = g.인원 ? Math.round(g.기록일합 / g.인원 * 10) / 10 : 0;
    return g;
  }).sort(function (a, b) { return (b.달성률 - a.달성률) || (b.오늘총 - a.오늘총) || (b.평균 - a.평균) || (a.학년 - b.학년) || (a.반 - b.반); });
}

/* ================= 응원 문구 ================= */

var ROPE_문구 = [
  '오늘의 작은 도약이 내일의 큰 성장을 만들어요!',
  '꾸준함이 실력이에요. 오늘도 줄넘기 한 번 더!',
  '땀 흘린 만큼 튼튼해지는 우리 친구들, 최고예요!',
  '어제보다 한 번 더! 나와의 약속을 지켜 봐요.',
  '건강한 습관은 매일의 반복에서 시작돼요.',
  '넘어져도 괜찮아요. 다시 줄을 잡는 게 진짜 실력이에요.'
];
var ROPE_GEMINI_ERR_KEY = 'GEMINI_LAST_ERROR';
/** 쓸 수 있는 Gemini 모델 이름을 고릅니다. 모델이 은퇴해도 프로그램을 고치지 않아도 되도록
    ListModels 로 목록을 읽어 가장 새 flash 모델을 고르고, 안 되는 모델(404·"no longer available")은 6시간 동안 피합니다. */
function rope_gemini막힌모델_() { try { return JSON.parse(캐시읽기_('rope_gemini_blocked') || '[]'); } catch (e) { return []; } }
function rope_gemini모델막기_(name, 초) {
  var list = rope_gemini막힌모델_(); if (list.indexOf(name) < 0) list.push(name);
  try { 캐시쓰기_('rope_gemini_blocked', JSON.stringify(list), 초 || 21600); } catch (e) {}
  캐시지우기_('rope_gemini_model');
}
function rope_gemini버전_(name) { var m = String(name).match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }
function rope_gemini모델_(key, 다시) {
  if (!다시) { var c = 캐시읽기_('rope_gemini_model'); if (c) return c; }
  var 막힘 = rope_gemini막힌모델_(), 목록 = [];
  try {
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + key, { muteHttpExceptions: true });
    var j = JSON.parse(res.getContentText());
    목록 = (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0; })
      .map(function (m) { return String(m.name).replace(/^models\//, ''); })
      .filter(function (n) { return 막힘.indexOf(n) < 0 && !/preview|exp|image|tts|live|audio|thinking|embedding/.test(n); });
  } catch (e) {}
  var 최신 = function (arr) { return arr.sort(function (a, b) { return rope_gemini버전_(b) - rope_gemini버전_(a) || a.length - b.length; })[0]; };
  var pick = 최신(목록.filter(function (n) { return /^gemini-[\d.]+-flash$/.test(n); }))
    || 최신(목록.filter(function (n) { return /flash/.test(n); }))
    || 최신(목록.filter(function (n) { return /^gemini-/.test(n); }))
    || (막힘.indexOf('gemini-2.5-flash') < 0 ? 'gemini-2.5-flash' : 'gemini-flash-latest');
  try { 캐시쓰기_('rope_gemini_model', pick, 86400); } catch (e) {}
  return pick;
}
function rope_gemini호출_(key, prompt, 시도, 모델) {
  시도 = 시도 || 0;
  var model = 모델 || rope_gemini모델_(key, 시도 > 0);
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key,
    { method: 'post', contentType: 'application/json', payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), muteHttpExceptions: true });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code === 503 || code === 429 || code === 500) {
    // 일시적 혼잡: 잠깐 쉬고 같은 모델로 한 번 더
    Utilities.sleep(1500);
    res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key,
      { method: 'post', contentType: 'application/json', payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), muteHttpExceptions: true });
    code = res.getResponseCode(); body = res.getContentText();
  }
  if (code !== 200) {
    var msg = ''; try { msg = JSON.parse(body).error.message; } catch (e) { msg = body.slice(0, 200); }
    if (시도 < 3) {
      if (code === 404 || /no longer available|not found|deprecated/i.test(msg)) {
        // 모델이 은퇴했거나 새 사용자에게 막힘: 6시간 피하고, 구글이 권한 모델이 있으면 그것을 먼저 써 봅니다
        rope_gemini모델막기_(model);
        var hint = msg.match(/models\/([\w.-]+)/g), 권장 = null;
        (hint || []).forEach(function (h) { var n = h.replace('models/', ''); if (n !== model && !권장) 권장 = n; });
        return rope_gemini호출_(key, prompt, 시도 + 1, 권장);
      }
      if (code === 503 || code === 429 || code === 500) {
        // 계속 혼잡하면 그 모델을 10분만 피하고 다음으로 새 모델로
        rope_gemini모델막기_(model, 600);
        return rope_gemini호출_(key, prompt, 시도 + 1, null);
      }
    }
    throw new Error(model + ': HTTP ' + code + ' ' + msg);
  }
  var json = JSON.parse(body);
  var text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0].text;
  if (!text) throw new Error(model + ': 응답에 문장이 없습니다.');
  if (모델) { try { 캐시쓰기_('rope_gemini_model', model, 86400); } catch (e) {} }   // 권장 모델이 됐으면 기억
  return String(text).trim();
}
function rope_응원문구_(현황) {
  var key = '';
  try { key = 속성_(ROPE_GEMINI_KEY) || ''; } catch (e) {}
  if (key && 현황) {
    var cached = 캐시읽기_('rope_ai_' + 오늘_());
    if (cached) return cached;
    try {
      var prompt = '너는 ' + 학교급_().학생 + '들의 줄넘기 운동을 지도하는 체육 선생님이다.\n현재 ' + 현황.학생.length + '명의 학생이 참여했고 누적 줄넘기 총 횟수는 ' + 현황.총 + '회, 오늘은 ' + 현황.오늘기록인원 + '명이 ' + 현황.오늘총 + '회를 뛰었다.\n' +
        (현황.왕.누적 ? '누적 1위는 ' + 현황.왕.누적.이름 + ' 학생(' + 현황.왕.누적.값 + '회)이다.\n' : '') +
        '학생들을 격려하고 꾸준한 운동 습관을 만들어 주는 한 문장짜리 응원 문구를 한국어 존댓말(~해요)로 작성해줘. 따옴표나 설명 없이 문장 하나만 출력해.';
      var text = rope_gemini호출_(key, prompt, false).slice(0, 120);
      캐시쓰기_('rope_ai_' + 오늘_(), text, 3600 * 6);
      try { 속성저장_(ROPE_GEMINI_ERR_KEY, null); } catch (e2) {}
      return text;
    } catch (e) {
      try { 속성저장_(ROPE_GEMINI_ERR_KEY, (지금_() + ' ' + e.message).slice(0, 300)); } catch (e3) {}
    }
  }
  var d = 오늘_().split('-').map(Number);
  return ROPE_문구[(d[1] * 31 + d[2]) % ROPE_문구.length];
}
/** 교사: 지금 바로 문구를 만들어 봅니다 (키 확인용). 캐시를 지우고 새로 부릅니다 */
function rope_t_testGemini(token) {
  교사확인_(token);
  if (!rope_gemini여부_()) throw new Error('Gemini 키가 없습니다.');
  캐시지우기_('rope_ai_' + 오늘_()); 캐시지우기_('rope_gemini_model'); 캐시지우기_('rope_gemini_blocked');
  var 현황 = rope_학급현황_(0, 0, rope_기록전체_(), rope_설정_());
  var text = rope_응원문구_(현황);
  var err = ''; try { err = 속성_(ROPE_GEMINI_ERR_KEY) || ''; } catch (e) {}
  return { 문구: text, 오류: err, 모델: 캐시읽기_('rope_gemini_model') || '' };
}

/* ================= 기록 쓰기 (공통) ================= */

function rope_기록추가_(학생ID, 날짜, 시각, 횟수, 상태, 입력자, 메모, 종류) {
  var now = 지금_();
  var rec = { 기록ID: makeId_('R'), 입력일시: now, 날짜: 날짜, 시각: 시각, 학생ID: 학생ID, 횟수: 횟수, 상태: 상태, 확인일시: 상태 === '확인' ? now : '', 입력자: 입력자, 메모: str_(메모).slice(0, 100), 종류: str_(종류).slice(0, 20) };
  appendRow_(ROPE.기록, ROPE_H.기록, rec);
  rope_캐시지우기_();
  return rec;
}

/* ================= 교사 API ================= */

function rope_t_boot(token) {
  교사확인_(token);
  var s = rope_설정_();
  var 기록 = rope_기록전체_();
  nat_자동보고_();
  return { 설정: s, 오늘: 오늘_(), 대기: 기록.filter(function (r) { return r.상태 === '대기'; }).length, 짝대기: 기록.filter(function (r) { return r.상태 === '짝대기'; }).length, nat: nat_공개_() };
}

/** 학급 현황. 학년·반 0 이면 전체 */
function rope_t_getClass(token, 학년, 반) {
  교사확인_(token);
  var s = rope_설정_(), 기록 = rope_기록전체_();
  var 현황 = rope_학급현황_(num_(학년) || 0, num_(반) || 0, 기록, s);
  현황.문구 = rope_응원문구_(현황);
  현황.하루목표 = s.하루목표; 현황.학급목표 = s.학급목표;
  현황.학급비교 = rope_학급비교_(현황, s);
  // 최근 14일 학급 합계 (그래프용)
  var 오늘 = 오늘_(), 일별 = [], set = {};
  현황.학생.forEach(function (o) { set[o.학생ID] = true; });
  for (var i = 13; i >= 0; i--) { var d = 날짜더하기_(오늘, -i); 일별.push({ 날짜: d, 횟수: 0, 인원: 0 }); }
  var idx = {}; 일별.forEach(function (x, i) { idx[x.날짜] = i; });
  var 인원 = {};
  기록.forEach(function (r) { if (r.상태 === '확인' && set[r.학생ID] && idx[r.날짜] !== undefined) { 일별[idx[r.날짜]].횟수 += r.횟수; (인원[r.날짜] = 인원[r.날짜] || {})[r.학생ID] = true; } });
  일별.forEach(function (x) { x.인원 = Object.keys(인원[x.날짜] || {}).length; });
  현황.일별 = 일별;
  현황.급수 = s.급수사용 ? rope_급수분포_(현황.학생) : null;   // v3.1.9
  return 현황;
}

function rope_t_getPending(token) {
  교사확인_(token);
  var 학생 = 학생맵_(true);
  return rope_기록전체_().filter(function (r) { return r.상태 === '대기' || r.상태 === '짝대기'; }).map(function (r) {
    var st = 학생[r.학생ID] || {}, pr = r.짝학생ID ? (학생[r.짝학생ID] || {}) : null;
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 입력일시: r.입력일시, 학생ID: r.학생ID, 학년: st.학년 || '', 반: st.반 || '', 번호: st.번호 || '', 이름: st.이름 || '(삭제된 학생)', 횟수: r.횟수, 메모: r.메모, 종류: r.종류,
             상태: r.상태, 짝학생ID: r.짝학생ID, 짝이름: pr ? (pr.이름 || '(삭제된 학생)') : '', 짝확인일시: r.짝확인일시, 짝메모: r.짝메모,
             사진파일ID: r.사진파일ID, 사진썸네일ID: r.사진썸네일ID };
  }).sort(function (a, b) { return (a.학년 - b.학년) || (a.반 - b.반) || (a.번호 - b.번호) || a.날짜.localeCompare(b.날짜); });
}

/** 상태 바꾸기. ids 배열, 상태 '확인' | '반려' | '대기', 메모(선택, 반려 사유) */
function rope_t_setStatus(token, ids, 상태, 메모) {
  교사확인_(token);
  if (ROPE_상태.indexOf(상태) < 0) throw new Error('상태가 잘못되었습니다.');
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  var now = 지금_(), n = 0, s = rope_설정_(), 날짜모음 = [];
  return withLock_(function () {
    rows_(ROPE.기록).forEach(function (r) {
      if (!set[str_(r.기록ID)]) return;
      var f = { 상태: 상태, 확인일시: 상태 === '대기' ? '' : now };
      if (메모 !== undefined && 메모 !== null && 상태 === '반려') f.메모 = str_(메모).slice(0, 100);
      if (상태 === '확인' && s.짝사진보관 === '확인후삭제' && (r.사진파일ID || r.사진썸네일ID)) {
        rope_휴지통_([str_(r.사진파일ID), str_(r.사진썸네일ID)]);
        f.사진파일ID = ''; f.사진썸네일ID = ''; f.사진파일명 = '';
      }
      setCells_(ROPE.기록, ROPE_H.기록, r._row, f); n++; if (상태 === '확인') 날짜모음.push(날짜정리_(r.날짜));
    });
    rope_캐시지우기_();
    nat_하루보고_(날짜모음);
    var 기록 = rope_기록전체_();
    return { ok: true, 처리: n, 대기: 기록.filter(function (r) { return r.상태 === '대기'; }).length, 짝대기: 기록.filter(function (r) { return r.상태 === '짝대기'; }).length };
  });
}

/** 교사 입력 (바로 확인). rows = [{학생ID, 횟수}], 날짜·시각 공통 */
function rope_t_addRecords(token, 날짜, 시각, rows, 메모, 종류) {
  교사확인_(token);
  날짜 = 날짜정리_(날짜) || 오늘_(); 시각 = rope_시각_(시각);
  var s = rope_설정_(), 공통종류 = str_(종류).slice(0, 20);
  if (s.종류사용 && s.종류.length && !공통종류) throw new Error('줄넘기 종류를 골라 주세요.');
  var 학생 = 학생맵_(false), objs = [], now = 지금_();
  (rows || []).forEach(function (r) {
    var id = str_(r.학생ID), n = Math.round(num_(r.횟수) || 0);
    if (!학생[id] || n <= 0) return;
    objs.push({ 기록ID: makeId_('R') + Math.floor(Math.random() * 90 + 10), 입력일시: now, 날짜: 날짜, 시각: 시각, 학생ID: id, 횟수: n, 상태: '확인', 확인일시: now, 입력자: '교사', 메모: str_(메모).slice(0, 100), 종류: str_(r.종류).slice(0, 20) || 공통종류 });
  });
  if (!objs.length) throw new Error('입력된 횟수가 없습니다.');
  return withLock_(function () {
    appendRows_(ROPE.기록, ROPE_H.기록, objs);
    rope_캐시지우기_();
    nat_하루보고_([날짜]);
    return { ok: true, 추가: objs.length };
  });
}

/** 학생 한 명의 기록 전체 (교사 관리용) */
function rope_t_getStudent(token, 학생ID) {
  교사확인_(token);
  var st = 학생찾기_(학생ID);
  if (!st) throw new Error('학생을 찾지 못했습니다.');
  var 기록 = rope_기록전체_().filter(function (r) { return r.학생ID === 학생ID; }).map(function (r) {
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 횟수: r.횟수, 상태: r.상태, 입력자: r.입력자, 메모: r.메모, 입력일시: r.입력일시, 종류: r.종류,
             짝학생ID: r.짝학생ID, 짝확인일시: r.짝확인일시, 사진파일ID: r.사진파일ID, 사진썸네일ID: r.사진썸네일ID };
  }).reverse();
  var s = rope_설정_();
  return { 학생: 학생공개_(st), 기록: 기록, 요약: rope_학생요약_(학생ID, rope_기록전체_(), s), 종류: s.종류 };
}

function rope_t_updateRecord(token, 기록ID, 횟수, 상태, 메모, 종류) {
  교사확인_(token);
  var n = Math.round(num_(횟수) || 0);
  if (n <= 0) throw new Error('횟수는 1 이상이어야 합니다.');
  if (ROPE_상태.indexOf(상태) < 0) 상태 = '확인';
  var hit = rows_(ROPE.기록).filter(function (r) { return str_(r.기록ID) === str_(기록ID); })[0];
  if (!hit) throw new Error('기록을 찾지 못했습니다.');
  var f = { 횟수: n, 상태: 상태, 확인일시: 상태 === '대기' ? '' : 지금_(), 메모: str_(메모).slice(0, 100) };
  if (종류 !== undefined && 종류 !== null) f.종류 = str_(종류) === ROPE_종류없음 ? '' : str_(종류).slice(0, 20);
  setCells_(ROPE.기록, ROPE_H.기록, hit._row, f);
  rope_캐시지우기_();
  nat_하루보고_([날짜정리_(hit.날짜)]);   // 상태가 어느 쪽으로 바뀌든 그날 합계를 다시 보냄
  return { ok: true };
}

function rope_t_deleteRecords(token, ids) {
  교사확인_(token);
  var set = {}; (ids || []).forEach(function (id) { set[str_(id)] = true; });
  var 파일 = [], 날짜모음 = [];
  rope_기록전체_().forEach(function (r) { if (set[r.기록ID]) { 파일.push(r.사진파일ID, r.사진썸네일ID); if (r.상태 === '확인') 날짜모음.push(r.날짜); } });
  rope_휴지통_(파일);
  var n = 행지우기_(ROPE.기록, function (o) { return set[str_(o.기록ID)] === true; });
  rope_캐시지우기_();
  nat_하루보고_(날짜모음);
  return { ok: true, 지움: n };
}

function rope_t_saveSettings(token, map) {
  교사확인_(token);
  map = map || {};
  var put = {};
  if (map.하루목표 !== undefined) put['줄넘기.하루목표'] = String(Math.max(1, Math.min(100000, num_(map.하루목표) || 100)));
  if (map.대상학년 !== undefined) put['줄넘기.대상학년'] = (Array.isArray(map.대상학년) ? map.대상학년 : 목록_(map.대상학년)).map(Number).filter(function (g) { return g >= 1 && g <= 학교급_().최대학년; }).join(',');
  if (map.자동확인 !== undefined) {
    if (map.자동확인 && nat_설정_().on) throw new Error('전국 현황판에 참여 중에는 학생 입력 자동 확인을 켤 수 없어요. 선생님이 확인한 기록만 현황판에 올라가요.');
    put['줄넘기.자동확인'] = map.자동확인 ? 'Y' : 'N';
  }
  if (map.하루최대입력 !== undefined) put['줄넘기.하루최대입력'] = String(Math.max(1, Math.min(50, num_(map.하루최대입력) || 10)));
  if (map.한번최대횟수 !== undefined) put['줄넘기.한번최대횟수'] = String(Math.max(1, Math.min(100000, num_(map.한번최대횟수) || 3000)));
  if (map.학급목표 !== undefined) put['줄넘기.학급목표'] = String(Math.max(0, num_(map.학급목표) || 0));
  if (map.짝체크 !== undefined) put['줄넘기.짝체크'] = map.짝체크 ? 'Y' : 'N';
  if (map.짝사진 !== undefined) put['줄넘기.짝사진'] = map.짝사진 ? 'Y' : 'N';
  if (map.짝사진보관 !== undefined) put['줄넘기.짝사진보관'] = str_(map.짝사진보관) === '확인후삭제' ? '확인후삭제' : '유지';
  if (map.종류사용 !== undefined) put['줄넘기.종류사용'] = map.종류사용 ? 'Y' : 'N';
  if (map.판정기주소 !== undefined) { var u = str_(map.판정기주소); if (u && !/^https:\/\//.test(u)) throw new Error('판정기 주소는 https:// 로 시작해야 해요.'); put['줄넘기.판정기주소'] = u || ' '; }
  if (map.판정기최소 !== undefined) put['줄넘기.판정기최소'] = String(Math.max(1, Math.min(1000, num_(map.판정기최소) || 10)));
  if (map.판정기민감도 !== undefined) put['줄넘기.판정기민감도'] = String(Math.max(6, Math.min(16, num_(map.판정기민감도) || 10)));
  if (map.체력합산 !== undefined) put['줄넘기.체력합산'] = map.체력합산 ? 'Y' : 'N';
  if (map.급수사용 !== undefined) put['줄넘기.급수사용'] = map.급수사용 ? 'Y' : 'N';
  if (map.급수메인 !== undefined) put['줄넘기.급수메인'] = map.급수메인 ? 'Y' : 'N';
  if (map.여행코스 !== undefined) put['줄넘기.여행코스'] = ROPE_여행코스[str_(map.여행코스)] ? str_(map.여행코스) : ' ';
  if (map.여행시작일 !== undefined) put['줄넘기.여행시작일'] = 날짜정리_(map.여행시작일) || ' ';
  if (map.종류 !== undefined) {
    var 목록 = rope_종류정리_(map.종류);
    if (!목록.length && map.종류사용 !== false) throw new Error('줄넘기 종류를 한 개 이상 적어 주세요. (종류를 쓰지 않으려면 "종류 고르기"를 끄세요)');
    put['줄넘기.종류'] = 목록.join(',');
  }
  if (Object.keys(put).length) 설정저장_(put);
  if (map.geminiKey !== undefined) {
    var k = str_(map.geminiKey);
    속성저장_(ROPE_GEMINI_KEY, k || null);
    속성저장_(ROPE_GEMINI_ERR_KEY, null);
    캐시지우기_('rope_ai_' + 오늘_()); 캐시지우기_('rope_gemini_model'); 캐시지우기_('rope_gemini_blocked');
  }
  return { ok: true, 설정: rope_설정_(), gemini: rope_gemini여부_() };
}
function rope_gemini여부_() { try { return !!속성_(ROPE_GEMINI_KEY); } catch (e) { return false; } }
function rope_gemini오류_() { try { return 속성_(ROPE_GEMINI_ERR_KEY) || ''; } catch (e) { return ''; } }
function rope_t_getSettings(token) { 교사확인_(token); return { 설정: rope_설정_(), gemini: rope_gemini여부_(), geminiError: rope_gemini오류_(), geminiModel: 캐시읽기_('rope_gemini_model') || '' }; }

/* ================= 급수 인증 (v3.1.9 · 줄넘기 기록 관리 2.2 의 급수 인증을 옮김) =================
   · 급수표(이름·색·항목·기준)는 ROPE_급수기본, 학교가 고치면 _속성 줄넘기.급수표 (JSON)
   · 시트 줄넘기_급수 에는 "누가 몇 급(0~) 몇 번 항목(0~)을 언제 통과했는지"만 한 줄씩 (첫 저장 때 만들어짐)
   · 지금 급수 = 앞 급수부터 모든 항목을 통과한 만큼 (rope_급수계산_). 앞 급수를 못 딴 학생은 화면에서 잠김 */
function rope_급수표_() {
  var t = null;
  try { t = JSON.parse(속성_(ROPE_급수표KEY) || 'null'); } catch (e) { t = null; }
  var 표 = rope_급수표정리_(t);
  return { 표: 표.length ? 표 : ROPE_급수기본, 사용자표: 표.length > 0 };
}
/** 급수표 검사·정리: [{이름, 색, 항목:[[이름, 기준]]}] 최대 15급, 급마다 항목 1~12 */
function rope_급수표정리_(t) {
  if (!Array.isArray(t)) return [];
  var out = [];
  t.slice(0, 15).forEach(function (l) {
    if (!l) return;
    var 이름 = str_(l.이름 || l.name).replace(/\s*줄넘기$/, '').slice(0, 10), 색 = str_(l.색 || l.color);
    var 항목 = (Array.isArray(l.항목) ? l.항목 : Array.isArray(l.items) ? l.items : []).slice(0, 12).map(function (it) {
      return Array.isArray(it) ? [str_(it[0]).slice(0, 30), str_(it[1]).slice(0, 12)] : [str_(it).slice(0, 30), ''];
    }).filter(function (it) { return it[0]; });
    if (!이름 || !항목.length) return;
    out.push({ 이름: 이름, 색: /^#[0-9a-fA-F]{6}$/.test(색) ? 색 : '#CCCCCC', 항목: 항목 });
  });
  return out;
}
/** { 학생ID: [[급수, 항목, 통과일], ...] } — 캐시 */
function rope_급수통과_() {
  return 캐시_('rope_lv', function () {
    var out = {};
    rows_(ROPE.급수).forEach(function (r) {
      var id = str_(r.학생ID); if (!id) return;
      (out[id] = out[id] || []).push([num_(r.급수), num_(r.항목), 날짜정리_(r.통과일) || str_(r.통과일).slice(0, 10)]);
    });
    return out;
  });
}
/** 학생 한 명: { 급수: 딴 급수 번호(-1 = 아직), 다음: 도전 중 급수 번호, 끝: 모두 땄는지, 통과: {"급수|항목": 날짜}, 날짜: {급수: 딴 날} } */
function rope_급수계산_(표, 줄들) {
  var map = {}; (줄들 || []).forEach(function (r) { map[r[0] + '|' + r[1]] = r[2] || ''; });
  var 급수 = -1, 날짜 = {};
  for (var i = 0; i < 표.length; i++) {
    var 항목 = 표[i].항목 || [], 전부 = true, 마지막 = '';
    if (!항목.length) break;
    for (var j = 0; j < 항목.length; j++) { var d = map[i + '|' + j]; if (d === undefined) { 전부 = false; break; } if (d > 마지막) 마지막 = d; }
    if (!전부) break;
    급수 = i; 날짜[i] = 마지막;
  }
  return { 급수: 급수, 다음: Math.min(급수 + 1, 표.length - 1), 끝: 급수 >= 표.length - 1, 통과: map, 날짜: 날짜 };
}
/** 학생 목록의 급수 분포: [{급수:i, 이름, 색, 학생:[{학생ID,이름,학년,반,번호}]}] (아직 없음은 급수 -1) */
function rope_급수분포_(학생들) {
  var T = rope_급수표_(), 통과 = rope_급수통과_(), by = {};
  학생들.forEach(function (st) { var lv = rope_급수계산_(T.표, 통과[st.학생ID]).급수; (by[lv] = by[lv] || []).push({ 학생ID: st.학생ID, 이름: st.이름, 학년: st.학년, 반: st.반, 번호: st.번호 }); });
  var out = [];
  for (var i = T.표.length - 1; i >= -1; i--) out.push({ 급수: i, 이름: i < 0 ? '아직 없음' : T.표[i].이름, 색: i < 0 ? '' : T.표[i].색, 학생: by[i] || [] });
  return out;
}
/** 교사: 급수표 + 통과 기록 전체 (급수 인증 화면) */
function rope_t_levelsGet(token) {
  교사확인_(token);
  var T = rope_급수표_(), s = rope_설정_();
  return { 표: T.표, 사용자표: T.사용자표, 통과: rope_급수통과_(), 급수사용: s.급수사용, 급수메인: s.급수메인, 오늘: 오늘_() };
}
/** 교사: 통과 저장. changes = [{ 학생ID, 급수, 항목, 통과: true|false, 날짜? }] — 통과는 한 줄 추가(있으면 그대로), 취소는 그 줄 삭제 */
function rope_t_levelsSave(token, changes) {
  교사확인_(token);
  var T = rope_급수표_(), 학생 = 학생맵_(true), 오늘 = 오늘_();
  return withLock_(function () {
    if (!findSheet_(ROPE.급수)) 시트준비_(ROPE.급수, ROPE_H.급수, { 색: ROPE_색 });
    var 있음 = {}; rows_(ROPE.급수).forEach(function (r) { 있음[str_(r.학생ID) + '|' + num_(r.급수) + '|' + num_(r.항목)] = true; });
    var 추가 = [], 지울 = {};
    (Array.isArray(changes) ? changes : []).slice(0, 2000).forEach(function (c) {
      var id = str_(c && c.학생ID), lv = Math.round(num_(c.급수)), it = Math.round(num_(c.항목));
      if (!학생[id] || !(lv >= 0 && lv < T.표.length) || !(it >= 0 && it < T.표[lv].항목.length)) return;
      var k = id + '|' + lv + '|' + it;
      if (c.통과) { if (있음[k]) return; 있음[k] = true; 추가.push({ 학생ID: id, 급수: lv, 항목: it, 통과일: 날짜정리_(c.날짜) || 오늘, 입력자: '교사' }); }
      else if (있음[k]) 지울[k] = true;
    });
    var 지운수 = Object.keys(지울).length ? 행지우기_(ROPE.급수, function (o) { return 지울[str_(o.학생ID) + '|' + num_(o.급수) + '|' + num_(o.항목)] === true; }) : 0;
    if (추가.length) appendRows_(ROPE.급수, ROPE_H.급수, 추가);
    rope_캐시지우기_();
    return { ok: true, 추가: 추가.length, 삭제: 지운수, 통과: rope_급수통과_() };
  });
}
/** 교사: 급수표 바꾸기 (null 이면 기본표로) */
function rope_t_levelsTable(token, 표) {
  교사확인_(token);
  if (표 === null || 표 === undefined || (Array.isArray(표) && !표.length)) { 속성지우기_(ROPE_급수표KEY); }
  else {
    var 정리 = rope_급수표정리_(표);
    if (!정리.length) throw new Error('급수표를 읽을 수 없어요. 급수마다 이름과 항목 한 개 이상이 필요해요.');
    속성저장_(ROPE_급수표KEY, JSON.stringify(정리));
  }
  rope_캐시지우기_();
  var T = rope_급수표_();
  return { ok: true, 표: T.표, 사용자표: T.사용자표 };
}

/* ================= 전국 현황판 참여 (v3.1.7 · 승인 규칙 v3.1.8) =================
   · 참여 중에는 "학생 입력 자동 확인"이 꺼짐(켤 수 없음) — 선생님이 확인한 기록과 카메라 기록만 현황판에 올라감
   줄넘기 기록 관리(MusicalPE/jumprope)의 수집기·현황판에 이 학교의 날짜별 합계를 보냅니다. 두 프로그램 학교가 같은 현황판에서 겨룹니다.
   · 수집기 주소는 https://musicalpe.github.io/jumprope/national.json 의 collector (6시간 캐시) — 코드에 박아 두지 않음
   · 서버(Apps Script)에서 보냄 → 학교 키·담당 교사는 학생·브라우저에 안 드러남
   · 보내는 것: 가린 이름·학년·날짜별 '확인' 합계·등록 학생 수. 보내지 않는 것: 실명·반·번호·학생ID·비밀번호
   · 설정은 _속성(학교 시트)에: 줄넘기.현황판 = {on,key,name,showName,teacher,contact,lastFull} */
var NAT_BASE = 'https://musicalpe.github.io/jumprope/', NAT_KEY = '줄넘기.현황판';
function nat_sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { var v = (b + 256) % 256; return (v < 16 ? '0' : '') + v.toString(16); }).join('');
}
function nat_publicId_(key) { return nat_sha_('jr-school|' + key).slice(0, 10); }
function nat_studentKey_(key, 학생ID) { return nat_sha_('jr-student|' + key + '|' + 학생ID).slice(0, 10); }
function nat_mask_(n) {
  var c = Array.from(String(n || '').trim());
  if (c.length <= 1) return c.join('');
  if (c.length === 2) return c[0] + '*';
  return c[0] + new Array(c.length - 1).join('*') + c[c.length - 1];
}
function nat_설정_() {
  var o = {}; try { o = JSON.parse(속성_(NAT_KEY) || '{}') || {}; } catch (e) { o = {}; }
  return { on: !!o.on, key: str_(o.key), name: str_(o.name), showName: o.showName !== false, teacher: str_(o.teacher), contact: str_(o.contact), lastFull: str_(o.lastFull), lastErr: str_(o.lastErr) };
}
function nat_설정저장_(o) { 속성저장_(NAT_KEY, JSON.stringify(o)); }
/** 교사 화면용 (키는 안 보냄) */
function nat_공개_(o) {
  o = o || nat_설정_();
  var pid = o.key ? nat_publicId_(o.key) : '';
  return { on: o.on, name: o.name, showName: o.showName, teacher: o.teacher, contact: o.contact, lastFull: o.lastFull, lastErr: o.lastErr, publicId: pid,
           board: pid ? NAT_BASE + 'board.html?me=' + pid : NAT_BASE + 'board.html', hall: pid ? NAT_BASE + 'hall.html?me=' + pid : NAT_BASE + 'hall.html' };
}
function nat_수집기주소_(다시) {
  if (!다시) { var c = 캐시읽기_('nat_collector'); if (c) return c; }
  var res = UrlFetchApp.fetch(NAT_BASE + 'national.json?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('현황판 설정(national.json)을 읽지 못했어요 (' + res.getResponseCode() + ')');
  var u = str_(JSON.parse(res.getContentText()).collector);
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) throw new Error('수집기 주소가 올바르지 않아요.');
  try { 캐시쓰기_('nat_collector', u, 21600); } catch (e) {}
  return u;
}
function nat_호출_(fn, arg) {
  var url = nat_수집기주소_(false), res, body;
  for (var i = 0; i < 2; i++) {
    res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify({ fn: fn, args: [arg] }), followRedirects: true, muteHttpExceptions: true });
    body = res.getContentText();
    if (res.getResponseCode() === 200 && /^\s*\{/.test(body)) break;
    url = nat_수집기주소_(true);   // 주소가 바뀌었을 수 있음 — 새로 읽고 한 번 더
  }
  var j; try { j = JSON.parse(body); } catch (e) { throw new Error('수집기 응답을 읽지 못했어요 (' + res.getResponseCode() + ')'); }
  if (!j.ok) throw new Error(str_(j.error) || '수집기가 거절했어요');
  return j.result;
}
/** 이번 달+지난 달(또는 날짜 하나)의 날짜별 학생 합계 — '확인' 만 */
function nat_days_(o, 날짜들) {
  var 학생 = 학생맵_(false), s = rope_설정_(), 오늘 = 오늘_();
  var y = Number(오늘.slice(0, 4)), m = Number(오늘.slice(5, 7)), 이달 = 오늘.slice(0, 7), 지난달 = (m === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (m - 1)).slice(-2));
  var only = null; if (날짜들 && 날짜들.length) { only = {}; 날짜들.forEach(function (d) { only[str_(d)] = true; }); }
  var byDay = {};
  rope_기록전체_().forEach(function (r) {
    if (r.상태 !== '확인' || !r.날짜 || r.날짜 > 오늘) return;
    var ym = r.날짜.slice(0, 7); if (ym !== 이달 && ym !== 지난달) return;
    if (only && !only[r.날짜]) return;
    var st = 학생[r.학생ID]; if (!st || (s.대상학년.length && s.대상학년.indexOf(Number(st.학년)) < 0)) return;
    var d = byDay[r.날짜] || (byDay[r.날짜] = {}), e = d[r.학생ID] || (d[r.학생ID] = { st: st, n: 0, cam: 0 });
    e.n += r.횟수; if (r.입력자 === '카메라') e.cam += r.횟수;
  });
  if (only) Object.keys(only).forEach(function (d) { if (!byDay[d]) byDay[d] = {}; });   // 그날 기록이 다 지워졌으면 빈 날로 덮어씀
  return Object.keys(byDay).sort().slice(-70).map(function (d) {
    return { date: d, students: Object.keys(byDay[d]).map(function (id) { var e = byDay[d][id];
      return [nat_studentKey_(o.key, id), nat_mask_(e.st.이름), String(e.st.학년).slice(0, 4), Math.min(30000, e.n), Math.min(30000, e.cam)]; }).slice(0, 1200) };
  });
}
/** 등록 학생 수 (대상 학년만) — 전체와 학년별 (학년별은 수집기 4판의 학년별 순위용, v3.1.9) */
function nat_등록수_() {
  var s = rope_설정_(), by = {}, n = 0;
  학생목록_(false).forEach(function (st) {
    if (s.대상학년.length && s.대상학년.indexOf(Number(st.학년)) < 0) return;
    n++; var g = String(st.학년).slice(0, 4); by[g] = (by[g] || 0) + 1;
  });
  return { 전체: n, 학년별: by };
}
/** 보고. 날짜들이 없으면 전체(이번 달+지난 달). 돌려주는 값: 보낸 날 수 */
function nat_보고_(날짜들) {
  var o = nat_설정_(); if (!o.on || !o.key) return 0;
  var days = nat_days_(o, 날짜들), 등록 = nat_등록수_();
  var payload = { key: o.key, showName: !!o.showName, name: o.showName ? o.name : '', schoolName: o.name, teacher: o.teacher, contact: o.contact,
                  registered: 등록.전체, registeredByGrade: 등록.학년별, app: 'pe-assistant ' + APP_VERSION, days: days };
  nat_호출_('report', payload);
  if (!날짜들) { o.lastFull = 지금_(); } o.lastErr = ''; nat_설정저장_(o);
  return days.length;
}
/** 기록이 '확인'이 된 뒤 — 그날 하루치만, 실패해도 조용히. 2분에 한 번만 (몰릴 때) */
function nat_하루보고_(날짜들) {
  try {
    var o = nat_설정_(); if (!o.on || !o.key) return;
    var uniq = {}; (날짜들 || []).forEach(function (d) { if (d) uniq[str_(d)] = true; });
    var list = Object.keys(uniq); if (!list.length) return;
    var cache = CacheService.getScriptCache(), k = 'nat_q_' + ck_(list.join(','));
    if (cache.get(k)) return; cache.put(k, '1', 120);
    nat_보고_(list);
  } catch (e) { try { var o2 = nat_설정_(); o2.lastErr = (지금_() + ' ' + e.message).slice(0, 200); nat_설정저장_(o2); } catch (e2) {} }
}
/** 교사가 줄넘기 화면을 열 때: 마지막 전체 보고 후 1시간 지났으면 전체 한 번 더 (조용히) */
function nat_자동보고_() {
  try {
    var o = nat_설정_(); if (!o.on || !o.key) return;
    if (o.lastFull && Date.now() - new Date(o.lastFull.replace(' ', 'T') + ':00+09:00').getTime() < 3600e3) return;
    nat_보고_(null);
  } catch (e) { try { var o2 = nat_설정_(); o2.lastErr = (지금_() + ' ' + e.message).slice(0, 200); nat_설정저장_(o2); } catch (e2) {} }
}
function rope_t_natGet(token) { 교사확인_(token); return nat_공개_(); }
/** map = { on, name, showName, teacher, contact } · 켜면 바로 전체 보고, 끄면 leave */
function rope_t_natSave(token, map) {
  교사확인_(token); map = map || {};
  var o = nat_설정_(), 켬 = !!map.on;
  if (map.name !== undefined) o.name = str_(map.name).slice(0, 40);
  if (map.showName !== undefined) o.showName = !!map.showName;
  if (map.teacher !== undefined) o.teacher = str_(map.teacher).slice(0, 30);
  if (map.contact !== undefined) o.contact = str_(map.contact).slice(0, 60);
  if (!o.name) o.name = str_(설정_().학교명).slice(0, 40);
  if (켬 && (!o.name || !o.teacher)) return { ok: false, message: '참여하려면 학교 이름과 담당 교사를 적어 주세요.' };
  var 결과 = { ok: true };
  if (켬) {
    if (!o.key) o.key = Utilities.getUuid();
    o.on = true; nat_설정저장_(o);
    if (str_(설정_()['줄넘기.자동확인']).toUpperCase() === 'Y') { 설정저장_({ '줄넘기.자동확인': 'N' }); 결과.자동확인끔 = true; }   // 승인 없는 기록은 현황판에 못 올라가게
    try { 결과.보낸날 = nat_보고_(null); 결과.message = '보냈어요. (' + 결과.보낸날 + '일치) 현황판에는 몇 분 안에 반영됩니다.'; }
    catch (e) { o = nat_설정_(); o.lastErr = (지금_() + ' ' + e.message).slice(0, 200); nat_설정저장_(o); 결과.ok = false; 결과.message = '설정은 저장했지만 보내지 못했어요: ' + e.message; }
  } else {
    var 있었음 = o.on && o.key;
    o.on = false; nat_설정저장_(o);
    if (있었음) { try { nat_호출_('leave', { key: o.key }); 결과.message = '현황판에서 우리 학교 기록을 지웠습니다.'; } catch (e) { 결과.message = '참여는 껐지만 현황판에서 지우지 못했어요: ' + e.message + ' — 다시 켰다 끄면 다시 시도해요.'; } }
    else 결과.message = '저장했습니다.';
  }
  결과.nat = nat_공개_(); return 결과;
}
function rope_t_natSend(token) {
  교사확인_(token);
  var o = nat_설정_(); if (!o.on) return { ok: false, message: '먼저 참여를 켜 주세요.' };
  try { var n = nat_보고_(null); return { ok: true, message: '보냈어요. (' + n + '일치) 현황판에는 몇 분 안에 반영됩니다.', nat: nat_공개_() }; }
  catch (e) { o = nat_설정_(); o.lastErr = (지금_() + ' ' + e.message).slice(0, 200); nat_설정저장_(o); return { ok: false, message: '보내지 못했어요: ' + e.message, nat: nat_공개_() }; }
}
/** 교사: 기록실(지난 달)에서 우리 학교가 받은 순위 — 상장 인쇄용 (v3.1.9)
 *  돌려주는 값: { 달목록: ['2026-09', …], 달: '2026-09', 상: [{ 종류: '학교'|'학생'|'학교안', 순위, 제목, 값, 학생?: {학년,반,번호,이름} }] }
 *  학생 키(sha)는 서버에서 우리 학생과 맞춰 실명으로 바꿉니다 — 키는 밖으로 나가지 않음 */
function rope_t_natHall(token, 달) {
  교사확인_(token);
  var o = nat_설정_(); if (!o.key) return { 달목록: [], 달: '', 상: [], message: '전국 현황판에 참여한 적이 없어요.' };
  var url = nat_수집기주소_(false) + '?api=hall' + (달 ? '&month=' + encodeURIComponent(str_(달)) : '');
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var j; try { j = JSON.parse(res.getContentText()); } catch (e) { throw new Error('기록실을 읽지 못했어요 (' + res.getResponseCode() + ')'); }
  if (!j.ok) throw new Error(str_(j.error) || '기록실을 읽지 못했어요');
  var r = j.result || {}, m = r.month, pid = nat_publicId_(o.key);
  var out = { 달목록: r.list || [], 달: m ? m.month : '', 상: [] };
  if (!m) { out.message = '아직 기록실에 오른 달이 없어요. (달이 끝나야 기록실에 올라가요)'; return out; }
  var 키맵 = {}; 학생목록_(true).forEach(function (st) { 키맵[nat_studentKey_(o.key, st.학생ID)] = { 학년: st.학년, 반: st.반, 번호: st.번호, 이름: st.이름 }; });
  var 종류 = { total: ['학교 합계', function (s) { return Number(s.total).toLocaleString() + '회'; }], avg: ['1인당 평균', function (s) { return Number(s.avg).toLocaleString() + '회'; }], rate: ['참여율', function (s) { return s.rate + '%'; }] };
  Object.keys(종류).forEach(function (k) {
    ((m.schools || {})[k] || []).forEach(function (s) { if (s.pid === pid) out.상.push({ 종류: '학교', 순위: s.rank, 제목: 종류[k][0], 값: 종류[k][1](s) }); });
  });
  (m.students || []).forEach(function (x) {
    var st = x.k && 키맵[x.k]; if (!(st || x.pid === pid)) return;
    out.상.push({ 종류: '학생', 순위: x.rank, 제목: '학생 순위 전국', 값: Number(x.c).toLocaleString() + '회', 학생: st || { 이름: x.n, 학년: x.g } });
  });
  var ins = (m.inSchool || []).filter(function (s) { return s.pid === pid; })[0];
  if (ins) { var rank = 0; (ins.top || []).forEach(function (x, i) { rank = (i > 0 && ins.top[i - 1].c === x.c) ? rank : i + 1; out.상.push({ 종류: '학교안', 순위: rank, 제목: '우리 학교', 값: Number(x.c).toLocaleString() + '회', 학생: 키맵[x.k] || { 이름: x.n, 학년: x.g } }); }); }
  if (!out.상.length) out.message = out.달 + ' 기록실에 우리 학교가 없어요.';
  return out;
}

/* ================= 학생 API ================= */

function rope_s_view_(me) {
  var s = rope_설정_(), 기록 = rope_기록전체_();
  var y = rope_학생요약_(me.학생ID, 기록, s);
  var 오늘 = 오늘_(), 학생 = 학생맵_(true);
  var 이름 = function (id) { var st = 학생[id]; return st ? st.이름 : ''; };
  var 내기록 = 기록.filter(function (r) { return r.학생ID === me.학생ID; }).map(function (r) {
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 횟수: r.횟수, 상태: r.상태, 입력자: r.입력자, 메모: r.메모, 종류: r.종류,
             짝학생ID: r.짝학생ID, 짝이름: r.짝학생ID ? 이름(r.짝학생ID) : '', 짝확인일시: r.짝확인일시, 짝메모: r.짝메모, 사진썸네일ID: r.사진썸네일ID, 사진파일ID: r.사진파일ID };
  });
  var 오늘입력 = 내기록.filter(function (r) { return r.날짜 === 오늘 && r.입력자 === '학생'; }).length;
  var 반 = rope_학급현황_(me.학년, me.반, 기록, s);
  // 짝 체크: 같은 반 친구 목록 + 나에게 온 확인 요청 수
  var 짝후보 = [], 짝요청수 = 0;
  if (s.짝체크) {
    짝후보 = 학생목록_(false).filter(function (st) { return st.학생ID !== me.학생ID && Number(st.학년) === Number(me.학년) && Number(st.반) === Number(me.반); })
      .sort(function (a, b) { return a.번호 - b.번호; }).map(function (st) { return { 학생ID: st.학생ID, 이름: st.이름, 번호: st.번호 }; });
    짝요청수 = 기록.filter(function (r) { return r.짝학생ID === me.학생ID && r.상태 === '짝대기'; }).length;
  }
  return {
    학생: me, 오늘: 오늘, 설정: { 하루목표: s.하루목표, 하루최대입력: s.하루최대입력, 한번최대횟수: s.한번최대횟수, 자동확인: s.자동확인, 학급목표: s.학급목표, 짝체크: s.짝체크, 짝사진: s.짝사진,
                            종류사용: s.종류사용 && s.종류.length > 0, 종류: s.종류, 판정기주소: s.판정기주소, 판정기민감도: s.판정기민감도 },
    앱URL: 앱주소_(),
    요약: y, 기록: 내기록.slice().reverse(), 오늘입력: 오늘입력, 배지: rope_배지_(y),
    학급: { 총: 반.총, 오늘총: 반.오늘총, 인원: 반.학생.length, 오늘기록인원: 반.오늘기록인원, 달성: 반.달성, 학급목표: s.학급목표, 진행: rope_pct_(반.총, s.학급목표) },
    짝후보: 짝후보, 짝요청수: 짝요청수,
    급수: s.급수사용 ? rope_s_급수_(me, 반) : null,   // v3.1.9 나의 급수 + (급수메인) 우리 반 급수 분포
    여행: 반.여행,
    문구: rope_응원문구_(반),
    현황판: (function () { var o = nat_설정_(); return o.on && o.key ? NAT_BASE + 'board.html?me=' + nat_publicId_(o.key) : ''; })()   // 참여 중이면 학생 화면에 링크만 (키는 안 보냄)
  };
}
function rope_s_boot(token) { return rope_s_view_(학생확인_(token)); }
/** 학생 화면의 급수: 나의 급수·다음 도전 항목(통과 여부) + 우리 반 분포(이름 없이 수만) */
function rope_s_급수_(me, 반) {
  var T = rope_급수표_(), 통과 = rope_급수통과_(), s = rope_설정_();
  var my = rope_급수계산_(T.표, 통과[me.학생ID]);
  var 다음 = T.표[my.다음] || null;
  var out = {
    표: T.표.map(function (l) { return { 이름: l.이름, 색: l.색 }; }),
    급수: my.급수, 급수이름: my.급수 >= 0 ? T.표[my.급수].이름 : '', 급수색: my.급수 >= 0 ? T.표[my.급수].색 : '', 딴날: my.날짜[my.급수] || '', 끝: my.끝,
    다음: 다음 && !my.끝 ? { 번호: my.다음, 이름: 다음.이름, 색: 다음.색, 항목: 다음.항목.map(function (it, j) { return { 이름: it[0], 기준: it[1], 통과: my.통과[my.다음 + '|' + j] !== undefined }; }) } : null
  };
  if (s.급수메인) {
    var 분포 = {}; 반.학생.forEach(function (st) { var lv = rope_급수계산_(T.표, 통과[st.학생ID]).급수; 분포[lv] = (분포[lv] || 0) + 1; });
    out.반분포 = 분포;
  }
  return out;
}

/** 학생 기록 입력. m = { 횟수, 시각?, 메모? } — 날짜는 오늘로 고정 */
function rope_s_addRecord(token, m) {
  var me = 학생확인_(token);
  m = m || {};
  var s = rope_설정_(), n = Math.round(num_(m.횟수) || 0);
  if (n <= 0) throw new Error('횟수를 1 이상 입력해 주세요.');
  if (n > s.한번최대횟수) throw new Error('한 번에 ' + s.한번최대횟수 + '회까지 입력할 수 있어요. 여러 번 나눠서 넣어 주세요.');
  var 오늘 = 오늘_();
  var 오늘입력 = rope_기록전체_().filter(function (r) { return r.학생ID === me.학생ID && r.날짜 === 오늘 && r.입력자 === '학생'; }).length;
  if (오늘입력 >= s.하루최대입력) throw new Error('오늘은 ' + s.하루최대입력 + '번까지만 입력할 수 있어요.');
  var 시각 = rope_시각_(m.시각) || 지금_().slice(11);
  var 종류 = '';
  if (s.종류사용 && s.종류.length) {
    종류 = str_(m.종류);
    if (!종류) throw new Error('줄넘기 종류를 골라 주세요.');
    if (s.종류.indexOf(종류) < 0) throw new Error('목록에 없는 종류예요. 다시 골라 주세요.');
  }
  var 짝 = null;
  if (s.짝체크) {
    var pid = str_(m.짝학생ID);
    if (!pid) throw new Error('확인해 줄 짝을 골라 주세요.');
    if (pid === me.학생ID) throw new Error('자기 자신은 짝이 될 수 없어요.');
    짝 = 학생찾기_(pid);
    if (!짝 || Number(짝.학년) !== Number(me.학년) || Number(짝.반) !== Number(me.반)) throw new Error('같은 반 친구를 짝으로 골라 주세요.');
  }
  return withLock_(function () {
    var rec = rope_기록추가_(me.학생ID, 오늘, 시각, n, 짝 ? '짝대기' : (s.자동확인 ? '확인' : '대기'), '학생', m.메모, 종류);
    if (짝) { setCells_(ROPE.기록, ROPE_H.기록, rope_행찾기_(rec.기록ID)._row, { 짝학생ID: 짝.학생ID }); rope_캐시지우기_(); }
    if (rec.상태 === '확인') nat_하루보고_([오늘]);
    var v = rope_s_view_(me);
    v.방금 = { 기록ID: rec.기록ID, 횟수: n, 상태: rec.상태, 짝이름: 짝 ? 짝.이름 : '' };
    return v;
  });
}
/* ================= 카메라 판정기 (외부 페이지) API — ?api=rope_x_… ================= */

/** 판정기가 처음 열릴 때: 누구인지 + 오늘 상황. p = { t: 학생 토큰 } */
function rope_x_who(p) {
  var me = 학생확인_(p.t), s = rope_설정_();
  if (!rope_hooks_().학생참여(me.학생ID)) throw new Error('줄넘기 대상 학년이 아니에요.');
  var 오늘 = 오늘_(), 오늘합 = 0;
  rope_기록전체_().forEach(function (r) { if (r.학생ID === me.학생ID && r.날짜 === 오늘 && r.상태 === '확인') 오늘합 += r.횟수; });
  return { 이름: me.이름, 학년: me.학년, 반: me.반, 번호: me.번호, 오늘: 오늘합, 하루목표: s.하루목표, 최소: s.판정기최소, 최대: s.한번최대횟수,
           종류: s.종류사용 ? s.종류 : [], 학교명: str_(설정_().학교명) };
}
/** 건강체력교실에서 카메라로 뛴 것을 줄넘기 기록에도 (설정 줄넘기.체력합산 = Y 일 때). 실패해도 조용히 */
function rope_체력합산_(me, n, 메모) {
  try {
    var s = rope_설정_(); if (!s.체력합산) return false;
    if (!모듈상태_().ROPE || !rope_hooks_().학생참여(me.학생ID)) return false;
    if (n < s.판정기최소 || n > s.한번최대횟수) return false;
    var 종류 = s.종류사용 && s.종류.length ? s.종류[0] : '';
    rope_기록추가_(me.학생ID, 오늘_(), 지금_().slice(11), n, '확인', '카메라', '건강체력교실 · ' + 메모, 종류);
    return true;
  } catch (e) { return false; }
}
/** 판정기가 보낸 결과를 기록으로. p = { t, count, sec?, hand?, norope?, kind?, ver? } — 카메라가 센 횟수라 바로 확인 상태 */
function rope_x_save(p) {
  var me = 학생확인_(p.t), s = rope_설정_();
  if (!rope_hooks_().학생참여(me.학생ID)) throw new Error('줄넘기 대상 학년이 아니에요.');
  var n = Math.round(num_(p.count) || 0);
  if (n < s.판정기최소) throw new Error(s.판정기최소 + '회 이상일 때만 기록해요. (이번 ' + n + '회)');
  if (n > s.한번최대횟수) throw new Error('한 번에 ' + s.한번최대횟수 + '회까지만 기록할 수 있어요.');
  var 오늘 = 오늘_();
  var 오늘카메라 = rope_기록전체_().filter(function (r) { return r.학생ID === me.학생ID && r.날짜 === 오늘 && r.입력자 === '카메라'; }).length;
  if (오늘카메라 >= Math.max(s.하루최대입력, 10)) throw new Error('오늘은 카메라 기록을 더 넣을 수 없어요.');
  var 종류 = '';
  if (s.종류사용 && s.종류.length) { 종류 = str_(p.kind); if (s.종류.indexOf(종류) < 0) 종류 = s.종류[0]; }
  var sec = Math.round(num_(p.sec) || 0), hand = Math.round(num_(p.hand) || 0), norope = Math.round(num_(p.norope) || 0);
  var 메모 = '카메라 판정' + (p.ver ? ' v' + str_(p.ver).replace(/^v/, '') : '') + (sec ? ' · ' + Math.floor(sec / 60) + '분 ' + (sec % 60) + '초' : '') +
             (hand ? ' · 팔만 돌림 ' + hand + '초' : '') + (norope ? ' · 줄 없이 뜀 ' + norope + '회' : '');
  return withLock_(function () {
    var rec = rope_기록추가_(me.학생ID, 오늘, 지금_().slice(11), n, '확인', '카메라', 메모, 종류);
    nat_하루보고_([오늘]);
    var 오늘합 = 0;
    rope_기록전체_().forEach(function (r) { if (r.학생ID === me.학생ID && r.날짜 === 오늘 && r.상태 === '확인') 오늘합 += r.횟수; });
    return { 기록ID: rec.기록ID, 횟수: n, 종류: 종류, 오늘: 오늘합, 하루목표: s.하루목표, 달성: 오늘합 >= s.하루목표 };
  });
}

function rope_행찾기_(기록ID) {
  var hit = rows_(ROPE.기록).filter(function (r) { return str_(r.기록ID) === str_(기록ID); })[0];
  if (!hit) throw new Error('기록을 찾지 못했습니다.');
  return hit;
}

/** 대기 중인 내 기록 지우기 (확인된 기록은 교사만) */
function rope_s_deleteRecord(token, 기록ID) {
  var me = 학생확인_(token);
  var hit = rope_기록전체_().filter(function (r) { return r.기록ID === str_(기록ID) && r.학생ID === me.학생ID; })[0];
  if (!hit) throw new Error('기록을 찾지 못했습니다.');
  if (hit.상태 !== '대기' && hit.상태 !== '짝대기' && hit.상태 !== '짝반려') throw new Error('선생님이 이미 확인한 기록은 지울 수 없어요.');
  rope_휴지통_([hit.사진파일ID, hit.사진썸네일ID]);
  행지우기_(ROPE.기록, function (o) { return str_(o.기록ID) === hit.기록ID; });
  rope_캐시지우기_();
  return rope_s_view_(me);
}

/* ================= 짝 체크 (학생) ================= */

/** 나에게 온 확인 요청 (짝대기) */
function rope_s_peerRequests(token) {
  var me = 학생확인_(token);
  var s = rope_설정_(), 학생 = 학생맵_(true);
  var list = rope_기록전체_().filter(function (r) { return r.짝학생ID === me.학생ID && r.상태 === '짝대기'; }).map(function (r) {
    var st = 학생[r.학생ID] || {};
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 횟수: r.횟수, 메모: r.메모, 종류: r.종류, 학생ID: r.학생ID, 이름: st.이름 || '친구', 번호: st.번호 || '' };
  }).sort(function (a, b) { return (b.날짜 + b.시각).localeCompare(a.날짜 + a.시각); });
  // 내가 확인해 준 것 (최근 20건)
  var 내가확인 = rope_기록전체_().filter(function (r) { return r.짝학생ID === me.학생ID && r.상태 !== '짝대기'; }).slice(-20).reverse().map(function (r) {
    var st = 학생[r.학생ID] || {};
    return { 기록ID: r.기록ID, 날짜: r.날짜, 시각: r.시각, 횟수: r.횟수, 상태: r.상태, 종류: r.종류, 이름: st.이름 || '친구', 짝확인일시: r.짝확인일시, 사진썸네일ID: r.사진썸네일ID, 사진파일ID: r.사진파일ID };
  });
  return { 짝체크: s.짝체크, 짝사진: s.짝사진, 요청: list, 확인한것: 내가확인, 오늘: 오늘_() };
}

/** 짝의 답. p = { 기록ID, confirm(bool), 메모, media:{ 타입, 본문(base64 jpeg), 썸네일(base64 jpeg), 파일명 } } */
function rope_s_peerRespond(token, p) {
  var me = 학생확인_(token);
  p = p || {};
  var s = rope_설정_(), confirm = !!p.confirm, media = rope_사진검사_(p.media, s);
  return withLock_(function () {
    var row = rope_행찾기_(p.기록ID);
    if (str_(row.짝학생ID) !== me.학생ID) throw new Error('나에게 온 요청이 아니에요.');
    if (str_(row.상태) !== '짝대기') throw new Error('이미 처리되었거나 취소된 요청이에요.');
    var now = 지금_();
    var f = { 상태: confirm ? (s.자동확인 ? '확인' : '대기') : '짝반려', 짝확인일시: now, 짝메모: str_(p.메모).slice(0, 60) };
    if (confirm && s.자동확인) f.확인일시 = now;
    if (media) {
      var who = 학생찾기_(str_(row.학생ID)) || {};
      try { var saved = rope_사진저장_(who, me, media, str_(row.날짜)); f.사진파일ID = saved.파일ID; f.사진썸네일ID = saved.썸네일ID; f.사진파일명 = saved.파일명; }
      catch (e) { throw new Error('사진을 저장하지 못했어요. 다시 시도해 주세요. (' + e.message + ')'); }
    }
    setCells_(ROPE.기록, ROPE_H.기록, row._row, f);
    rope_캐시지우기_();
    if (f.상태 === '확인') nat_하루보고_([str_(row.날짜)]);
    return { ok: true, 상태: f.상태, 사진: !!media };
  });
}

/** 파일 → data URL. 학생은 자기 기록 + 자기가 확인해 준 기록의 사진만 */
function rope_s_getMedia(token, ids) {
  var me = 학생확인_(token), 허용 = {};
  rope_기록전체_().forEach(function (r) {
    if (r.학생ID !== me.학생ID && r.짝학생ID !== me.학생ID) return;
    if (r.사진파일ID) 허용[r.사진파일ID] = true;
    if (r.사진썸네일ID) 허용[r.사진썸네일ID] = true;
  });
  return rope_파일데이터_(ids, 허용);
}
function rope_t_getMedia(token, ids) { 교사확인_(token); return rope_파일데이터_(ids, null); }

/** 교사: 사진 파일만 지우기 (기록은 그대로) */
function rope_t_deleteMedia(token, 기록ID) {
  교사확인_(token);
  return withLock_(function () {
    var row = rope_행찾기_(기록ID);
    var n = rope_휴지통_([str_(row.사진파일ID), str_(row.사진썸네일ID)]);
    setCells_(ROPE.기록, ROPE_H.기록, row._row, { 사진파일ID: '', 사진썸네일ID: '', 사진파일명: '' });
    rope_캐시지우기_();
    return { ok: true, 지운파일: n };
  });
}
/** 교사: 사진 현황 */
function rope_t_mediaInfo(token) {
  교사확인_(token);
  var n = 0; rope_기록전체_().forEach(function (r) { if (r.사진파일ID) n++; });
  var url = ''; try { if (n) url = rope_폴더_().getUrl(); } catch (e) {}
  return { 파일수: n, 폴더URL: url };
}

/* ---------- 사진 저장 (드라이브) ---------- */
function rope_사진검사_(m, s) {
  if (!m || !m.본문) return null;
  if (!s.짝사진) return null;
  var 타입 = str_(m.타입) || 'image/jpeg';
  if (!/^image\//.test(타입)) throw new Error('사진 파일만 올릴 수 있어요.');
  var bytes = Math.round(String(m.본문).length * 0.75);
  if (bytes > ROPE_PHOTO_MAX) throw new Error('사진이 너무 커요 (' + Math.round(bytes / 1048576) + 'MB).');
  return { 타입: 타입, 본문: m.본문, 썸네일: str_(m.썸네일), 파일명: str_(m.파일명) };
}
function rope_폴더_() {
  var id = 속성_(ROPE_FOLDER_KEY);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var parent = null;
  try { var parents = DriveApp.getFileById(ss_().getId()).getParents(); if (parents.hasNext()) parent = parents.next(); } catch (e) {}
  var folder = (parent || DriveApp).createFolder('줄넘기 짝 확인 사진');
  속성저장_(ROPE_FOLDER_KEY, folder.getId());
  return folder;
}
function rope_사진저장_(who, peer, media, 날짜) {
  var folder = rope_폴더_();
  var 이름 = (날짜 || 오늘_()) + '_' + (who.학년 || '') + '-' + (who.반 || '') + '-' + (who.번호 || '') + '_' + str_(who.이름 || who.학생ID) + '_줄넘기.jpg';
  이름 = 이름.replace(/[\\\/:*?"<>|]/g, '_');
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(media.본문), media.타입, 이름));
  try { file.setDescription('줄넘기 ' + str_(who.이름) + ' · 확인 ' + str_(peer.이름) + ' · ' + 지금_()); } catch (e) {}
  var thumb = media.썸네일 ? folder.createFile(Utilities.newBlob(Utilities.base64Decode(media.썸네일), 'image/jpeg', 'thumb_' + 이름)) : null;
  return { 파일ID: file.getId(), 썸네일ID: thumb ? thumb.getId() : '', 파일명: 이름 };
}
function rope_휴지통_(ids) {
  var n = 0;
  (ids || []).forEach(function (id) { if (!id) return; try { DriveApp.getFileById(String(id)).setTrashed(true); n++; } catch (e) {} });
  return n;
}
function rope_파일데이터_(ids, 허용) {
  var out = {};
  (ids || []).slice(0, 60).forEach(function (id) {
    id = String(id);
    if (허용 && !허용[id]) { out[id] = ''; return; }
    try { var blob = DriveApp.getFileById(id).getBlob(); out[id] = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()); }
    catch (e) { out[id] = ''; }
  });
  return out;
}
