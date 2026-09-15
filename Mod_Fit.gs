/*******************************************************
 * 건강체력교실 모듈 (Mod_Fit.gs)
 *
 * 단독판 건강체력교실 관리 프로그램을 통합 뼈대 위로 옮긴 것입니다.
 *  - 학생 명단·비밀번호·로그인은 공통(Code.gs)이 맡고, 여기는 "참가 여부"만 둡니다.
 *  - 시트 이름은 체력_ 접두어, 설정은 공통 설정 시트의 체력.* 항목, 서버 함수는 fit_t_ / fit_s_ 접두어.
 *  - PAPS 연계는 같은 스프레드시트의 PAPS_기록 시트를 직접 읽습니다 (PAPS 모듈 이식 후 동작).
 *
 * 시트
 *   체력_참가자 : 학생ID, 선정사유, 상태(참가/제외), 등록일
 *   체력_운동종목 : 요소, 종목명, 단위, 기준량, 포인트, 사용
 *   체력_운동기록 : 기록ID, 입력일시, 날짜, 학생ID, 장소, 요소, 종목, 수치, 단위, 포인트, 소감, 상태, 확인일시, 교사메모, 사진ID, 사진썸네일ID
 *   체력_출석 : 출석ID, 날짜, 학생ID, 출석, 확인, 입력자, 입력일시
 *   체력_주간목표 : 학생ID, 주시작일, 목표횟수, 목표포인트, 수정일시
 *   체력_배지 : 배지ID, 이름, 설명, 조건, 기준값, 아이콘, 사용
 *   체력_지도계획 : 월, 주, 요소, 지도내용, 비고
 *   체력_활동사진 : 사진ID, 날짜, 설명, 파일ID, 썸네일ID, 파일명, 업로드일시
 *******************************************************/

var FIT = {
  참가자: '체력_참가자', 종목: '체력_운동종목', 기록: '체력_운동기록', 출석: '체력_출석',
  목표: '체력_주간목표', 배지: '체력_배지', 계획: '체력_지도계획', 사진: '체력_활동사진'
};
var FIT_H = {
  참가자: ['학생ID', '선정사유', '상태', '등록일'],
  종목:   ['요소', '종목명', '단위', '기준량', '포인트', '사용'],
  기록:   ['기록ID', '입력일시', '날짜', '학생ID', '장소', '요소', '종목', '수치', '단위',
           '포인트', '소감', '상태', '확인일시', '교사메모', '사진ID', '사진썸네일ID'],
  출석:   ['출석ID', '날짜', '학생ID', '출석', '확인', '입력자', '입력일시'],
  목표:   ['학생ID', '주시작일', '목표횟수', '목표포인트', '수정일시'],
  배지:   ['배지ID', '이름', '설명', '조건', '기준값', '아이콘', '사용'],
  계획:   ['월', '주', '요소', '지도내용', '비고'],
  사진:   ['사진ID', '날짜', '설명', '파일ID', '썸네일ID', '파일명', '업로드일시']
};

var FIT_요소순서 = ['심폐지구력', '근력·근지구력', '유연성', '순발력'];
var FIT_상태목록 = ['대기', '확인', '반려'];

/* 요소, 종목명, 단위, 기준량, 포인트, 사용 */
var FIT_기본종목 = [
  ['심폐지구력',    '줄넘기',                 '회', 100, 10, true],
  ['심폐지구력',    '달리기·빨리걷기',        '분',  10, 10, true],
  ['심폐지구력',    '계단 오르기',            '분',   5,  5, true],
  ['심폐지구력',    '왕복달리기 연습',        '회',  20, 10, true],
  ['심폐지구력',    '뉴스포츠 게임(심폐)',    '분',  30, 20, true],
  ['근력·근지구력', '윗몸말아올리기',         '회',  20, 10, true],
  ['근력·근지구력', '팔굽혀펴기',             '회',  10, 10, true],
  ['근력·근지구력', '플랭크',                 '초',  60, 10, true],
  ['근력·근지구력', '스쿼트',                 '회',  20, 10, true],
  ['근력·근지구력', '뉴스포츠 게임(근력)',    '분',  30, 20, true],
  ['유연성',        '앉아윗몸앞으로굽히기',   '분',   5, 10, true],
  ['유연성',        '전신 스트레칭',          '분',  10, 10, true],
  ['유연성',        '요가·브릿지',            '분',  10, 10, true],
  ['유연성',        '뉴스포츠 게임(유연성)',  '분',  30, 20, true],
  ['순발력',        '제자리멀리뛰기 연습',    '회',  10, 10, true],
  ['순발력',        '50m 달리기 연습',        '회',   3, 10, true],
  ['순발력',        '사이드스텝·버피',        '회',  20, 10, true],
  ['순발력',        '뉴스포츠 게임(순발력)',  '분',  30, 20, true]
];

/* 배지ID, 이름, 설명, 조건, 기준값, 아이콘, 사용 — 조건: 누적횟수 | 누적포인트 | 출석 | 가정운동 | 목표달성 | 연속달성 | 요소균형 */
var FIT_기본배지 = [
  ['B01', '첫 걸음',        '운동 기록을 처음 남겼어요',              '누적횟수',   1,    'shoe',           true],
  ['B02', '열 번의 힘',     '운동 기록 10회 달성',                    '누적횟수',   10,   'flame',          true],
  ['B03', '서른 번의 약속', '운동 기록 30회 달성',                    '누적횟수',   30,   'medal',          true],
  ['B04', '백 번의 도전',   '운동 기록 100회 달성',                   '누적횟수',   100,  'trophy',         true],
  ['B05', '포인트 100',     '누적 포인트 100점',                      '누적포인트', 100,  'coin',           true],
  ['B06', '포인트 500',     '누적 포인트 500점',                      '누적포인트', 500,  'coins',          true],
  ['B07', '포인트 1000',    '누적 포인트 1000점',                     '누적포인트', 1000, 'diamond',        true],
  ['B08', '출석왕',         '건강체력교실 10회 출석',                 '출석',       10,   'calendar-check', true],
  ['B09', '집에서도 쑥쑥',  '가정에서 운동 10회 기록',                '가정운동',   10,   'home-heart',     true],
  ['B10', '목표 달성!',     '주간 목표를 처음 달성했어요',            '목표달성',   1,    'target-arrow',   true],
  ['B11', '3주 연속',       '주간 목표를 3주 연속 달성',              '연속달성',   3,    'bolt',           true],
  ['B12', '골고루 튼튼',    '네 가지 체력요소를 각각 5회 이상 운동',  '요소균형',   5,    'puzzle',         true]
];

var FIT_기본계획 = [
  [7,  '1~2', '심폐지구력',    '심폐지구력을 기르는 뉴스포츠 게임', ''],
  [7,  '3~4', '심폐지구력',    '심폐지구력을 기르는 뉴스포츠 게임', ''],
  [9,  '1~2', '순발력',        '순발력을 기르는 뉴스포츠 게임', ''],
  [9,  '3~4', '순발력',        '순발력을 기르는 뉴스포츠 게임', ''],
  [10, '1~2', '유연성',        '유연성을 기르는 뉴스포츠 게임', ''],
  [10, '3~4', '유연성',        '유연성을 기르는 뉴스포츠 게임', ''],
  [11, '1~2', '근력·근지구력', '근력, 근지구력을 기르는 뉴스포츠 게임', ''],
  [11, '3~4', '근력·근지구력', '근력, 근지구력을 기르는 뉴스포츠 게임', ''],
  [12, '1~2', '심폐지구력',    '심폐지구력을 기르는 뉴스포츠 게임', ''],
  [12, '3~4', '심폐지구력',    '심폐지구력을 기르는 뉴스포츠 게임', '']
];

/* 공통 설정 시트에 '체력.항목' 으로 저장됩니다 */
function fit_기본설정_() {
  var y = new Date().getFullYear();
  return [
    ['대상학년',         '5,6',         'PAPS에서 대상자를 고를 학년'],
    ['대상등급',         '4,5',         '한 종목이라도 이 등급이면 대상'],
    ['비만판정',         '과체중,경도비만,고도비만', '체질량지수 판정이 이것이면 대상'],
    ['운영요일',         '월,금',       '건강체력교실 운영 요일'],
    ['운영시작',         y + '-07-01',  '운영 기간 시작'],
    ['운영종료',         y + '-12-13',  '운영 기간 끝'],
    ['운영시간',         '14:30~15:30', '화면에 표시만 됩니다'],
    ['운영장소',         '본교 운동장 및 강당', '결과 문서에 들어갈 장소'],
    ['주간목표횟수',     '3',           '학생이 따로 정하지 않았을 때의 주간 목표(기록 횟수)'],
    ['주간목표포인트',   '50',          '학생이 따로 정하지 않았을 때의 주간 목표(포인트)'],
    ['자동확인',         '교실',        '교실 | 전부 | 없음 — 교사 확인 없이 바로 인정할 기록'],
    ['기록당최대포인트', '50',          '한 번의 기록으로 받을 수 있는 최대 포인트'],
    ['하루최대기록',     '6',           '학생이 하루에 남길 수 있는 기록 수'],
    ['가정운동사진',     '선택',        '선택 | 필수 | 없음 — 집에서 한 운동에 사진 첨부']
  ];
}

/* ================= 공통 뼈대에 끼우는 훅 ================= */

function fit_hooks_() {
  return {
    준비확인: function () {
      return Object.keys(FIT).every(function (k) { return !!findSheet_(FIT[k]); });
    },
    준비: function () {
      var 만듦 = [];
      만듦 = 만듦.concat(시트준비_(FIT.참가자, FIT_H.참가자, { 색: '#E4F6F1' }));
      만듦 = 만듦.concat(시트준비_(FIT.종목, FIT_H.종목, { 색: '#E4F6F1', 기본행: FIT_기본종목, 체크박스열: ['사용'] }));
      만듦 = 만듦.concat(시트준비_(FIT.기록, FIT_H.기록, { 색: '#E4F6F1' }));
      만듦 = 만듦.concat(시트준비_(FIT.출석, FIT_H.출석, { 색: '#E4F6F1' }));
      만듦 = 만듦.concat(시트준비_(FIT.목표, FIT_H.목표, { 색: '#E4F6F1' }));
      만듦 = 만듦.concat(시트준비_(FIT.배지, FIT_H.배지, { 색: '#E4F6F1', 기본행: FIT_기본배지, 체크박스열: ['사용'] }));
      만듦 = 만듦.concat(시트준비_(FIT.계획, FIT_H.계획, { 색: '#E4F6F1', 기본행: FIT_기본계획 }));
      만듦 = 만듦.concat(시트준비_(FIT.사진, FIT_H.사진, { 색: '#E4F6F1' }));
      // 설정 항목 보충 (값은 건드리지 않음)
      var s = 설정_(), put = {}, 있음 = {};
      rows_(SHEET.설정).forEach(function (r) { 있음[str_(r.항목)] = true; });
      fit_기본설정_().forEach(function (r) { if (!있음['체력.' + r[0]]) put['체력.' + r[0]] = r[1]; });
      if (Object.keys(put).length) { 설정저장_(put); 만듦.push('건강체력교실 설정 ' + Object.keys(put).length + '항목'); }
      fit_캐시지우기_();
      return 만듦;
    },
    캐시지우기: fit_캐시지우기_,
    학생참여: function (학생ID) {
      return !!fit_참가자맵_(false)[학생ID];
    },
    교사대시보드: function () {
      var 오늘 = 오늘_(), 이번주 = 주시작_(오늘), s = fit_설정_();
      var 기록 = fit_기록전체_();
      var 대기 = 기록.filter(function (r) { return r.상태 === '대기'; }).length;
      var 명단 = fit_참가자목록_(false);
      var 이번주참여 = {};
      기록.forEach(function (r) { if (r.상태 !== '반려' && 주시작_(r.날짜) === 이번주) 이번주참여[r.학생ID] = true; });
      var 요일 = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
      var 운영일 = 목록_(s.운영요일).indexOf(요일) >= 0;
      var 카드 = [
        { 제목: '확인 기다리는 기록', 값: 대기, 단위: '건', 배지: 대기 || '', 설명: 대기 ? '학생이 남긴 가정 운동 기록' : '모두 확인했습니다', 이동: 'pending' },
        { 제목: '이번 주 참여', 값: Object.keys(이번주참여).length, 단위: '/ ' + 명단.length + '명', 설명: 운영일 ? '오늘은 운영일 (' + s.운영시간 + ')' : '운영 요일: ' + 목록_(s.운영요일).join('·'), 이동: 'dash' }
      ];
      return { 카드: 카드, 대기: 대기 };
    },
    학생프로필: function (학생ID) {
      if (!fit_참가자맵_(false)[학생ID]) return null;
      var y = fit_요약_(학생ID, fit_기록전체_(), fit_출석전체_(), fit_목표전체_(), fit_설정_(), fit_배지목록_());
      var w = y.이번주 || { 횟수: 0, 목표횟수: 3, 포인트: 0, 목표포인트: 50 };
      var p = Math.round((pct_(w.횟수, w.목표횟수) + pct_(w.포인트, w.목표포인트)) / 2);
      return {
        제목: '이번 주 목표 ' + w.횟수 + '/' + w.목표횟수 + '회 · ' + w.포인트 + '/' + w.목표포인트 + 'p',
        값: y.누적포인트, 단위: 'p', 진행: p,
        설명: '운동 기록 ' + y.누적횟수 + '회 · 배지 ' + y.배지수 + '개' + (y.대기수 ? ' · 확인 대기 ' + y.대기수 + '건' : ''),
        배지목록: y.배지.filter(function (b) { return b.달성; }).slice(-3).map(function (b) { return b.이름; }),
        알림: (function () {
          var 반려 = fit_기록전체_().filter(function (r) { return r.학생ID === 학생ID && r.상태 === '반려' && r.교사메모; }).slice(-1)[0];
          return 반려 ? '건강체력교실: ' + 반려.날짜 + ' ' + 반려.종목 + ' 기록에 선생님 메모가 있어요' : '';
        })(),
        요약: { 이름: '체력교실 포인트', 값: y.누적포인트, 단위: 'p' },
        이동: 'home'
      };
    },
    학생배지: function (학생ID) {
      if (!fit_참가자맵_(false)[학생ID]) return [];
      var y = fit_요약_(학생ID, fit_기록전체_(), fit_출석전체_(), fit_목표전체_(), fit_설정_(), fit_배지목록_());
      return y.배지.map(function (b) { return { id: 'FIT-' + b.배지ID, 이름: b.이름, 설명: b.설명, 아이콘: b.아이콘, 달성: b.달성, 진행: Math.min(100, Math.round((b.진행 || 0) / Math.max(1, b.기준값) * 100)), 값: b.진행, 기준: b.기준값 }; });
    },
    초기화정보: function () {
      var 기록 = rows_(FIT.기록);
      return [
        { key: '활동', 이름: '운동 기록·출석·주간 목표 (학생 인증 사진 포함)', 수: 기록.length + rows_(FIT.출석).length + rows_(FIT.목표).length },
        { key: '참가자', 이름: '참가 학생 목록 (공통 명단은 남음)', 수: rows_(FIT.참가자).length },
        { key: '사진', 이름: '활동 사진 (드라이브 파일도 휴지통으로)', 수: rows_(FIT.사진).length },
        { key: '계획', 이름: '지도 계획 → 기본값으로', 수: rows_(FIT.계획).length },
        { key: '종목배지', 이름: '운동 종목·배지 → 기본값으로', 수: rows_(FIT.종목).length + rows_(FIT.배지).length }
      ];
    },
    초기화: function (opts) {
      opts = opts || {};
      var 전부 = function () { return true; }, res = {};
      if (opts.활동 || opts.참가자) {
        var 파일들 = [];
        rows_(FIT.기록).forEach(function (r) { if (r.사진ID) 파일들.push(r.사진ID); if (r.사진썸네일ID) 파일들.push(r.사진썸네일ID); });
        fit_휴지통_(파일들);
        res.기록 = 행지우기_(FIT.기록, 전부); res.출석 = 행지우기_(FIT.출석, 전부); res.목표 = 행지우기_(FIT.목표, 전부);
      }
      if (opts.참가자) res.참가자 = 행지우기_(FIT.참가자, 전부);
      if (opts.사진) {
        var 파일2 = [];
        rows_(FIT.사진).forEach(function (p) { if (p.파일ID) 파일2.push(p.파일ID); if (p.썸네일ID) 파일2.push(p.썸네일ID); });
        fit_휴지통_(파일2);
        res.사진 = 행지우기_(FIT.사진, 전부);
      }
      if (opts.계획) { 시트비우기_(FIT.계획); appendRows_(FIT.계획, FIT_H.계획, FIT_기본계획.map(fit_행객체_(FIT_H.계획))); res.계획 = true; }
      if (opts.종목배지) {
        시트비우기_(FIT.종목); appendRows_(FIT.종목, FIT_H.종목, FIT_기본종목.map(fit_행객체_(FIT_H.종목)));
        시트비우기_(FIT.배지); appendRows_(FIT.배지, FIT_H.배지, FIT_기본배지.map(fit_행객체_(FIT_H.배지)));
        res.종목배지 = true;
      }
      fit_캐시지우기_();
      return res;
    },
    명단삭제후: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) { set[String(id)] = true; });
      var 맞나 = function (o) { return set[str_(o.학생ID)] === true; };
      var 파일들 = [];
      rows_(FIT.기록).forEach(function (r) { if (set[str_(r.학생ID)]) { if (r.사진ID) 파일들.push(r.사진ID); if (r.사진썸네일ID) 파일들.push(r.사진썸네일ID); } });
      fit_휴지통_(파일들);
      var n = { 참가자: 행지우기_(FIT.참가자, 맞나), 기록: 행지우기_(FIT.기록, 맞나), 출석: 행지우기_(FIT.출석, 맞나), 목표: 행지우기_(FIT.목표, 맞나) };
      fit_캐시지우기_();
      return n;
    }
  };
}

function fit_행객체_(headers) {
  return function (arr) { var o = {}; headers.forEach(function (h, i) { o[h] = arr[i]; }); return o; };
}
function pct_(a, b) { if (!b) return 0; return Math.max(0, Math.min(100, Math.round(a / b * 100))); }

/* ================= 설정 ================= */

function fit_설정_() {
  var all = 설정_(), out = {};
  fit_기본설정_().forEach(function (r) {
    var v = all['체력.' + r[0]];
    out[r[0]] = (v === undefined || v === null || v === '') ? r[1] : String(v);
  });
  out.학교명 = str_(all.학교명); out.지도교사 = str_(all.담당자);
  return out;
}

/** 화면에 내려보낼 설정 */
function fit_공개설정_() {
  var s = fit_설정_();
  return {
    운영요일: 목록_(s.운영요일), 운영시작: s.운영시작, 운영종료: s.운영종료, 운영시간: s.운영시간, 운영장소: s.운영장소,
    주간목표횟수: Number(s.주간목표횟수) || 3, 주간목표포인트: Number(s.주간목표포인트) || 50,
    자동확인: s.자동확인, 기록당최대포인트: Number(s.기록당최대포인트) || 50,
    하루최대기록: Number(s.하루최대기록) || 6, 가정운동사진: s.가정운동사진 || '선택',
    PAPS연결: !!findSheet_('PAPS_기록'),
    학교명: s.학교명, 지도교사: s.지도교사
  };
}

/* ================= 캐시 · 목록 ================= */

function fit_캐시지우기_() { 캐시지우기_('fit_cfg'); }

/** 종목·배지·계획을 한 번에 (자주 안 바뀌므로 캐시) */
function fit_cfg_() {
  return 캐시_('fit_cfg', function () {
    return {
      종목: rows_(FIT.종목).map(function (r) {
        return { 요소: str_(r.요소), 종목: str_(r.종목명), 단위: str_(r.단위) || '회', 기준량: num_(r.기준량) || 1, 포인트: num_(r.포인트) || 0, 사용: bool_(r.사용) };
      }).sort(function (a, b) { return FIT_요소순서.indexOf(a.요소) - FIT_요소순서.indexOf(b.요소); }),
      배지: rows_(FIT.배지).map(function (r) {
        return { 배지ID: str_(r.배지ID), 이름: str_(r.이름), 설명: str_(r.설명), 조건: str_(r.조건), 기준값: num_(r.기준값) || 1, 아이콘: str_(r.아이콘) || 'award', 사용: bool_(r.사용) };
      }),
      계획: rows_(FIT.계획).map(function (r) {
        return { 월: num_(r.월) || 0, 주: str_(r.주), 요소: str_(r.요소), 지도내용: str_(r.지도내용), 비고: str_(r.비고) };
      }).sort(function (a, b) { return a.월 - b.월 || a.주.localeCompare(b.주); })
    };
  });
}
function fit_종목목록_(전부) { return fit_cfg_().종목.filter(function (t) { return 전부 || t.사용; }); }
function fit_배지목록_() { return fit_cfg_().배지.filter(function (b) { return b.사용; }); }
function fit_계획목록_() { return fit_cfg_().계획; }
function fit_이번달계획_() { var 월 = new Date().getMonth() + 1; return fit_계획목록_().filter(function (p) { return p.월 === 월; }); }

/** 참가자 목록: 공통 명단과 합칩니다. 포함제외=true 면 제외된 학생도. 공통 명단에서 졸업·전출된 학생은 제외로 취급 */
function fit_참가자목록_(포함제외) {
  var 학생 = 학생맵_(true);
  return rows_(FIT.참가자).map(function (r) {
    var s = 학생[str_(r.학생ID)];
    if (!s) return null;
    var 상태 = str_(r.상태) === '제외' || s.상태 !== '재학' ? '제외' : '참가';
    return { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 성별: s.성별,
             선정사유: str_(r.선정사유), 상태: 상태, 등록일: 날짜정리_(r.등록일), 명단상태: s.상태, _row: r._row };
  }).filter(function (s) { return s && (포함제외 || s.상태 === '참가'); }).sort(학생정렬_);
}
function fit_참가자맵_(포함제외) {
  var m = {};
  fit_참가자목록_(포함제외).forEach(function (s) { m[s.학생ID] = s; });
  return m;
}

/** 학생 세션 + 참가자 확인 */
function fit_학생확인_(token) {
  var me = 학생확인_(token);
  if (!fit_참가자맵_(false)[me.학생ID]) throw new Error('건강체력교실 참가 학생이 아니에요. 선생님께 말씀드려요.');
  return me;
}

/* ================= 기록 읽기 ================= */

function fit_기록정리_(r) {
  return {
    기록ID: str_(r.기록ID), 입력일시: 시각문자_(r.입력일시), 날짜: 날짜정리_(r.날짜),
    학생ID: str_(r.학생ID), 장소: str_(r.장소) || '교실', 요소: str_(r.요소),
    종목: str_(r.종목), 수치: num_(r.수치) || 0, 단위: str_(r.단위),
    포인트: num_(r.포인트) || 0, 소감: str_(r.소감), 상태: str_(r.상태) || '대기',
    확인일시: 시각문자_(r.확인일시), 교사메모: str_(r.교사메모),
    사진ID: str_(r.사진ID), 사진썸네일ID: str_(r.사진썸네일ID), _row: r._row
  };
}
function fit_기록전체_() {
  return rows_(FIT.기록).map(fit_기록정리_).sort(function (a, b) {
    if (a.날짜 !== b.날짜) return a.날짜 < b.날짜 ? -1 : 1;
    return a.입력일시 < b.입력일시 ? -1 : 1;
  });
}
function fit_출석전체_() {
  return rows_(FIT.출석).map(function (r) {
    return { 출석ID: str_(r.출석ID), 날짜: 날짜정리_(r.날짜), 학생ID: str_(r.학생ID), 출석: str_(r.출석) || '출석',
             확인: bool_(r.확인), 입력자: str_(r.입력자), 입력일시: 시각문자_(r.입력일시), _row: r._row };
  });
}
function fit_목표전체_() {
  var out = {};
  rows_(FIT.목표).forEach(function (r) {
    var id = str_(r.학생ID), w = 날짜정리_(r.주시작일);
    if (!out[id]) out[id] = {};
    out[id][w] = { 목표횟수: num_(r.목표횟수) || 0, 목표포인트: num_(r.목표포인트) || 0 };
  });
  return out;
}

/* ================= 요약·배지 계산 (학생 한 명) ================= */

function fit_요약_(학생ID, 기록들, 출석들, 목표들, 설정, 배지들) {
  var 내기록 = 기록들.filter(function (r) { return r.학생ID === 학생ID && r.상태 !== '반려'; });
  var 인정 = 내기록.filter(function (r) { return r.상태 === '확인'; });
  var 대기 = 내기록.filter(function (r) { return r.상태 === '대기'; });
  var 내출석 = 출석들.filter(function (a) { return a.학생ID === 학생ID && a.출석 === '출석'; });
  var 내목표 = 목표들[학생ID] || {};
  var 기본횟수 = Number(설정.주간목표횟수) || 3, 기본포인트 = Number(설정.주간목표포인트) || 50;

  var 요소포인트 = {}, 요소횟수 = {};
  FIT_요소순서.forEach(function (f) { 요소포인트[f] = 0; 요소횟수[f] = 0; });
  var 총포인트 = 0, 가정횟수 = 0;
  인정.forEach(function (r) {
    총포인트 += r.포인트;
    if (요소포인트[r.요소] !== undefined) { 요소포인트[r.요소] += r.포인트; 요소횟수[r.요소]++; }
    if (r.장소 === '가정') 가정횟수++;
  });

  var 오늘 = 오늘_(), 이번주 = 주시작_(오늘);
  var 주맵 = {};
  인정.forEach(function (r) {
    var w = 주시작_(r.날짜);
    if (!주맵[w]) 주맵[w] = { 주시작: w, 횟수: 0, 포인트: 0 };
    주맵[w].횟수++; 주맵[w].포인트 += r.포인트;
  });
  var 첫주 = 인정.length ? 주시작_(인정[0].날짜) : 이번주;
  var 주별 = [];
  for (var w = 첫주; w <= 이번주; w = 날짜더하기_(w, 7)) {
    var g = 내목표[w] || {};
    var 목표횟수 = g.목표횟수 || 기본횟수, 목표포인트 = g.목표포인트 || 기본포인트;
    var x = 주맵[w] || { 주시작: w, 횟수: 0, 포인트: 0 };
    주별.push({ 주시작: w, 횟수: x.횟수, 포인트: x.포인트, 목표횟수: 목표횟수, 목표포인트: 목표포인트,
               달성: x.횟수 >= 목표횟수 && x.포인트 >= 목표포인트, 직접설정: !!내목표[w] });
    if (주별.length > 60) break;
  }
  var 달성주 = 주별.filter(function (x) { return x.달성; }).length;
  var 연속 = 0;
  for (var i = 주별.length - 1; i >= 0; i--) {
    if (주별[i].달성) 연속++;
    else if (주별[i].주시작 !== 이번주) break;
  }
  var 최소요소 = FIT_요소순서.reduce(function (m, f) { return Math.min(m, 요소횟수[f]); }, Infinity);
  if (최소요소 === Infinity) 최소요소 = 0;

  var 값 = { 누적횟수: 인정.length, 누적포인트: 총포인트, 출석: 내출석.length, 가정운동: 가정횟수,
             목표달성: 달성주, 연속달성: 연속, 요소균형: 최소요소 };
  var 배지 = (배지들 || []).map(function (b) {
    var v = 값[b.조건] === undefined ? 0 : 값[b.조건];
    return { 배지ID: b.배지ID, 이름: b.이름, 설명: b.설명, 아이콘: b.아이콘, 조건: b.조건, 기준값: b.기준값, 진행: v, 달성: v >= b.기준값 };
  });
  return {
    누적횟수: 인정.length, 누적포인트: 총포인트, 대기수: 대기.length,
    대기포인트: 대기.reduce(function (s, r) { return s + r.포인트; }, 0),
    요소포인트: 요소포인트, 요소횟수: 요소횟수, 출석수: 내출석.length, 가정횟수: 가정횟수,
    주별: 주별, 이번주: 주별[주별.length - 1], 달성주: 달성주, 연속달성: 연속,
    배지: 배지, 배지수: 배지.filter(function (b) { return b.달성; }).length
  };
}

/* ================= 교사 API ================= */

function fit_t_boot(token) {
  교사확인_(token);
  return { 종목: fit_종목목록_(true), 요소: FIT_요소순서, 설정: fit_공개설정_(), 오늘: 오늘_(),
           참가자: fit_참가자목록_(true).map(fit_참가자공개_) };
}
function fit_참가자공개_(s) {
  return { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 성별: s.성별, 선정사유: s.선정사유, 상태: s.상태, 등록일: s.등록일, 명단상태: s.명단상태 };
}

function fit_t_dashboard(token) {
  교사확인_(token);
  var 오늘 = 오늘_(), 이번주 = 주시작_(오늘);
  var 기록 = fit_기록전체_(), 출석 = fit_출석전체_(), 목표 = fit_목표전체_(), 설정 = fit_설정_(), 배지 = fit_배지목록_();
  var 명단 = fit_참가자목록_(false);
  var 대기 = 기록.filter(function (r) { return r.상태 === '대기'; });
  var 이번주기록 = 기록.filter(function (r) { return r.상태 !== '반려' && 주시작_(r.날짜) === 이번주; });
  var 이번주참여 = {};
  이번주기록.forEach(function (r) { 이번주참여[r.학생ID] = true; });
  var 오늘출석 = 출석.filter(function (a) { return a.날짜 === 오늘 && a.출석 === '출석'; });
  var 학생별 = 명단.map(function (s) {
    var y = fit_요약_(s.학생ID, 기록, 출석, 목표, 설정, 배지);
    return { 학생: { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름 },
             누적횟수: y.누적횟수, 누적포인트: y.누적포인트, 대기수: y.대기수, 이번주: y.이번주, 배지수: y.배지수, 출석수: y.출석수 };
  });
  var 이름맵 = {};
  명단.forEach(function (s) { 이름맵[s.학생ID] = s; });
  var 최근 = 기록.slice(-12).reverse().map(function (r) {
    var s = 이름맵[r.학생ID];
    r.학생 = s ? (s.학년 + '-' + s.반 + ' ' + s.이름) : '?'; delete r._row; return r;
  });
  return { 오늘: 오늘, 이번주: 이번주, 참가자수: 명단.length, 대기수: 대기.length, 이번주기록수: 이번주기록.length,
           이번주참여수: Object.keys(이번주참여).length, 오늘출석수: 오늘출석.length, 학생별: 학생별, 최근: 최근, 이번달계획: fit_이번달계획_() };
}

/* ---------- 참가자 ---------- */

function fit_t_getMembers(token) { 교사확인_(token); return fit_참가자목록_(true).map(fit_참가자공개_); }

/** 공통 명단에서 고른 학생을 참가자로. 목록 = [{학생ID, 사유}] */
function fit_t_addMembers(token, 목록) {
  교사확인_(token);
  return withLock_(function () {
    var 학생 = 학생맵_(true), 기존 = {};
    rows_(FIT.참가자).forEach(function (r) { 기존[str_(r.학생ID)] = r._row; });
    var 신규 = [], 갱신 = 0, 오늘 = 오늘_();
    (목록 || []).forEach(function (m) {
      var id = str_(m.학생ID);
      if (!학생[id]) return;
      var 사유 = Array.isArray(m.사유) ? m.사유.join(', ') : str_(m.사유) || '직접 등록';
      if (기존[id]) { setCells_(FIT.참가자, FIT_H.참가자, 기존[id], { 선정사유: 사유, 상태: '참가' }); 갱신++; }
      else 신규.push({ 학생ID: id, 선정사유: 사유, 상태: '참가', 등록일: 오늘 });
    });
    appendRows_(FIT.참가자, FIT_H.참가자, 신규);
    return { ok: true, 신규: 신규.length, 갱신: 갱신, 참가자: fit_참가자목록_(true).map(fit_참가자공개_) };
  });
}

function fit_t_saveMember(token, m) {
  교사확인_(token);
  return withLock_(function () {
    var row = null;
    rows_(FIT.참가자).forEach(function (r) { if (str_(r.학생ID) === str_(m.학생ID)) row = r._row; });
    if (!row) return { ok: false, message: '참가자를 찾지 못했습니다.' };
    setCells_(FIT.참가자, FIT_H.참가자, row, { 선정사유: str_(m.선정사유), 상태: str_(m.상태) === '제외' ? '제외' : '참가' });
    return { ok: true, 참가자: fit_참가자목록_(true).map(fit_참가자공개_) };
  });
}

function fit_t_setMemberStatus(token, 학생ID목록, 상태) {
  교사확인_(token);
  return withLock_(function () {
    var set = {}, n = 0;
    (학생ID목록 || []).forEach(function (id) { set[str_(id)] = true; });
    rows_(FIT.참가자).forEach(function (r) {
      if (!set[str_(r.학생ID)]) return;
      setCells_(FIT.참가자, FIT_H.참가자, r._row, { 상태: 상태 === '제외' ? '제외' : '참가' }); n++;
    });
    return { ok: true, 바뀐수: n, 참가자: fit_참가자목록_(true).map(fit_참가자공개_) };
  });
}

/** 참가자에서 완전히 빼고 기록·출석·목표도 지웁니다 (공통 명단은 남음) */
function fit_t_removeMembers(token, 학생ID목록, 확인문구) {
  교사확인_(token);
  if (str_(확인문구) !== '삭제') return { ok: false, message: '확인 칸에 삭제라고 입력해 주세요.' };
  return withLock_(function () {
    var res = fit_hooks_().명단삭제후(학생ID목록);
    return { ok: true, 지움: res, 참가자: fit_참가자목록_(true).map(fit_참가자공개_) };
  }, 30000);
}

/* ---------- PAPS 연계 (같은 스프레드시트의 PAPS_기록 시트) ---------- */

function fit_t_papsPreview(token, 회차) {
  교사확인_(token);
  if (!findSheet_('PAPS_기록')) return { ok: false, message: 'PAPS 모듈이 아직 없거나 PAPS 기록 시트가 없습니다. PAPS 모듈에서 기록을 입력한 뒤 다시 시도하세요.' };
  var 설정 = fit_설정_();
  var 기록 = rows_('PAPS_기록');
  var 회차들 = {};
  기록.forEach(function (r) { if (str_(r.회차)) 회차들[str_(r.회차)] = true; });
  var 회차목록 = Object.keys(회차들).sort();
  if (!회차 || !회차들[회차]) 회차 = 회차목록[회차목록.length - 1] || '';

  var 대상학년 = {}, 등급 = {}, 비만 = {};
  목록_(설정.대상학년).forEach(function (x) { 대상학년[String(Number(x))] = true; });
  목록_(설정.대상등급).forEach(function (x) { 등급[String(x)] = true; });
  목록_(설정.비만판정).forEach(function (x) { 비만[String(x)] = true; });

  var 사유 = {};
  기록.forEach(function (r) {
    if (str_(r.회차) !== 회차) return;
    var g = str_(r.등급);
    if (!g) return;
    var id = str_(r.학생ID);
    if (!사유[id]) 사유[id] = [];
    if (등급[g]) 사유[id].push(str_(r.종목) + ' ' + g + '등급');
    else if (비만[g]) 사유[id].push(g);
  });
  var 참가 = fit_참가자맵_(true);
  var 후보 = 학생목록_(false).filter(function (s) { return 대상학년[String(s.학년)]; }).map(function (s) {
    var 이유 = 사유[s.학생ID] || [];
    return { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 성별: s.성별, 사유: 이유,
             대상: 이유.length > 0, 측정함: !!사유[s.학생ID],
             이미참가: !!참가[s.학생ID] && 참가[s.학생ID].상태 !== '제외', 제외됨: !!참가[s.학생ID] && 참가[s.학생ID].상태 === '제외' };
  });
  return { ok: true, 회차목록: 회차목록, 회차: 회차, 후보: 후보, 대상수: 후보.filter(function (x) { return x.대상; }).length };
}

/* ---------- 기록 확인 ---------- */

function fit_기록에학생붙이기_(목록) {
  var 맵 = 학생맵_(true);
  목록.forEach(function (r) {
    var s = 맵[r.학생ID];
    r.학생 = s ? { 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름 } : { 학년: 0, 반: 0, 번호: 0, 이름: '(삭제됨)' };
    delete r._row;
  });
  return 목록;
}

function fit_t_getPending(token) {
  교사확인_(token);
  return fit_기록에학생붙이기_(fit_기록전체_().filter(function (r) { return r.상태 === '대기'; }));
}

function fit_t_getRecords(token, 시작, 끝, 학생ID) {
  교사확인_(token);
  return fit_기록에학생붙이기_(fit_기록전체_().filter(function (r) {
    if (시작 && r.날짜 < 시작) return false;
    if (끝 && r.날짜 > 끝) return false;
    if (학생ID && r.학생ID !== str_(학생ID)) return false;
    return true;
  }));
}

/** 확인/반려. 교실 기록을 확인하면 그 날 출석도 확인. 사진처리 = '삭제' | '보관' | '유지' */
function fit_t_review(token, 기록ID목록, 상태, 메모, 사진처리) {
  교사확인_(token);
  if (FIT_상태목록.indexOf(상태) < 0) return { ok: false, message: '상태가 올바르지 않습니다.' };
  var set = {};
  (기록ID목록 || []).forEach(function (id) { set[str_(id)] = true; });
  return withLock_(function () {
    var n = 0, 출석확인 = [], 사진대상 = [], now = 지금_();
    rows_(FIT.기록).forEach(function (r) {
      var id = str_(r.기록ID);
      if (!set[id]) return;
      setCells_(FIT.기록, FIT_H.기록, r._row, { 상태: 상태, 확인일시: now, 교사메모: str_(메모) });
      n++;
      if (상태 === '확인' && str_(r.장소) === '교실') 출석확인.push({ 날짜: 날짜정리_(r.날짜), 학생ID: str_(r.학생ID) });
      if (str_(r.사진ID)) 사진대상.push(id);
    });
    출석확인.forEach(function (a) { fit_출석기록_(a.날짜, a.학생ID, '출석', true, '교사'); });
    var 처리 = 사진처리 || '삭제';
    if (상태 === '반려') 처리 = '삭제';
    var 사진결과 = 사진대상.length && 처리 !== '유지' ? fit_기록사진처리_(사진대상, 처리) : { 처리수: 0 };
    return { ok: true, 처리수: n, 사진처리수: 사진결과.처리수, 사진처리: 처리 };
  }, 30000);
}

function fit_기록사진처리_(기록ID목록, 처리) {
  var set = {};
  (기록ID목록 || []).forEach(function (id) { set[str_(id)] = true; });
  var 명단 = 학생맵_(true), 보관행 = [], n = 0, now = 지금_();
  rows_(FIT.기록).forEach(function (r) {
    if (!set[str_(r.기록ID)]) return;
    var 사진ID = str_(r.사진ID), 썸ID = str_(r.사진썸네일ID);
    if (!사진ID) return;
    if (처리 === '보관') {
      var s = 명단[str_(r.학생ID)];
      var 설명 = '가정 운동 · ' + (s ? s.학년 + '-' + s.반 + ' ' + s.이름 : '') + ' · ' + str_(r.종목);
      var 이름 = '';
      try {
        var f = DriveApp.getFileById(사진ID);
        이름 = f.getName(); f.moveTo(fit_폴더_());
        if (썸ID) DriveApp.getFileById(썸ID).moveTo(fit_폴더_());
      } catch (e) {}
      보관행.push({ 사진ID: uuid_(), 날짜: 날짜정리_(r.날짜), 설명: 설명, 파일ID: 사진ID, 썸네일ID: 썸ID, 파일명: 이름, 업로드일시: now });
    } else {
      fit_휴지통_([사진ID, 썸ID]);
    }
    setCells_(FIT.기록, FIT_H.기록, r._row, { 사진ID: '', 사진썸네일ID: '' });
    n++;
  });
  appendRows_(FIT.사진, FIT_H.사진, 보관행);
  return { 처리수: n };
}

function fit_t_photoAction(token, 기록ID목록, 처리) {
  교사확인_(token);
  return withLock_(function () {
    return { ok: true, 처리수: fit_기록사진처리_(기록ID목록, 처리 === '보관' ? '보관' : '삭제').처리수 };
  }, 30000);
}

/* ---------- 출석 ---------- */

function fit_출석기록_(날짜, 학생ID, 출석, 확인, 입력자) {
  var hit = null;
  rows_(FIT.출석).forEach(function (r) { if (날짜정리_(r.날짜) === 날짜 && str_(r.학생ID) === 학생ID) hit = r; });
  if (출석 === '') { if (hit) sheet_(FIT.출석).deleteRow(hit._row); return; }
  var fields = { 날짜: 날짜, 학생ID: 학생ID, 출석: 출석, 확인: !!확인, 입력자: 입력자, 입력일시: 지금_() };
  if (hit) setCells_(FIT.출석, FIT_H.출석, hit._row, fields);
  else { fields.출석ID = uuid_(); appendRow_(FIT.출석, FIT_H.출석, fields); }
}

function fit_t_getAttendance(token, 시작, 끝) {
  교사확인_(token);
  var 설정 = fit_설정_();
  시작 = 날짜정리_(시작) || 날짜더하기_(오늘_(), -28);
  끝 = 날짜정리_(끝) || 오늘_();
  var 요일이름 = ['일', '월', '화', '수', '목', '금', '토'], 운영요일 = {};
  목록_(설정.운영요일).forEach(function (d) { 운영요일[d] = true; });
  var 날짜들 = {};
  for (var d = 시작; d <= 끝; d = 날짜더하기_(d, 1)) {
    var p = d.split('-').map(Number);
    if (운영요일[요일이름[new Date(p[0], p[1] - 1, p[2]).getDay()]]) 날짜들[d] = true;
  }
  var 표 = {};
  fit_출석전체_().forEach(function (a) {
    if (a.날짜 < 시작 || a.날짜 > 끝) return;
    날짜들[a.날짜] = true;
    if (!표[a.학생ID]) 표[a.학생ID] = {};
    표[a.학생ID][a.날짜] = { 출석: a.출석, 확인: a.확인, 입력자: a.입력자 };
  });
  return { 시작: 시작, 끝: 끝, 날짜들: Object.keys(날짜들).sort(), 표: 표, 참가자: fit_참가자목록_(false).map(fit_참가자공개_) };
}

function fit_t_setAttendance(token, 날짜, 학생ID, 출석) {
  교사확인_(token);
  return withLock_(function () { fit_출석기록_(날짜정리_(날짜) || 오늘_(), str_(학생ID), 출석, true, '교사'); return { ok: true }; });
}

function fit_t_confirmAttendance(token, 날짜) {
  교사확인_(token);
  return withLock_(function () {
    var n = 0;
    rows_(FIT.출석).forEach(function (r) {
      if (날짜정리_(r.날짜) !== 날짜 || bool_(r.확인)) return;
      setCells_(FIT.출석, FIT_H.출석, r._row, { 확인: true }); n++;
    });
    return { ok: true, 처리수: n };
  });
}

/* ---------- 누적 현황 · 상세 ---------- */

function fit_t_getSummary(token, 시작, 끝) {
  교사확인_(token);
  var 기록 = fit_기록전체_().filter(function (r) { return (!시작 || r.날짜 >= 시작) && (!끝 || r.날짜 <= 끝); });
  var 출석 = fit_출석전체_().filter(function (a) { return (!시작 || a.날짜 >= 시작) && (!끝 || a.날짜 <= 끝); });
  var 목표 = fit_목표전체_(), 설정 = fit_설정_(), 배지 = fit_배지목록_();
  var 행 = fit_참가자목록_(false).map(function (s) {
    var y = fit_요약_(s.학생ID, 기록, 출석, 목표, 설정, 배지);
    return { 학생: { 학생ID: s.학생ID, 학년: s.학년, 반: s.반, 번호: s.번호, 이름: s.이름, 선정사유: s.선정사유 },
             누적횟수: y.누적횟수, 누적포인트: y.누적포인트, 대기수: y.대기수, 요소포인트: y.요소포인트, 요소횟수: y.요소횟수,
             출석수: y.출석수, 가정횟수: y.가정횟수, 달성주: y.달성주, 배지수: y.배지수, 주별: y.주별 };
  });
  return { 행: 행, 요소: FIT_요소순서, 시작: 시작 || '', 끝: 끝 || '' };
}

function fit_t_getStudentDetail(token, 학생ID) {
  교사확인_(token);
  var 기록 = fit_기록전체_(), 출석 = fit_출석전체_();
  var y = fit_요약_(str_(학생ID), 기록, 출석, fit_목표전체_(), fit_설정_(), fit_배지목록_());
  y.기록 = 기록.filter(function (r) { return r.학생ID === str_(학생ID); }).reverse().map(function (r) { delete r._row; return r; });
  y.출석 = 출석.filter(function (a) { return a.학생ID === str_(학생ID); }).sort(function (a, b) { return a.날짜 < b.날짜 ? 1 : -1; }).map(function (a) { delete a._row; return a; });
  var s = fit_참가자맵_(true)[str_(학생ID)];
  y.학생 = s ? fit_참가자공개_(s) : null;
  return y;
}

/* ---------- 지도 계획 / 종목 / 배지 / 설정 ---------- */

function fit_t_getPlan(token) { 교사확인_(token); return fit_계획목록_(); }

function fit_t_savePlan(token, 목록) {
  교사확인_(token);
  return withLock_(function () {
    시트비우기_(FIT.계획);
    var rows = (목록 || []).filter(function (p) { return Number(p.월) && str_(p.지도내용); })
      .map(function (p) { return { 월: Number(p.월), 주: str_(p.주), 요소: str_(p.요소), 지도내용: str_(p.지도내용), 비고: str_(p.비고) }; });
    appendRows_(FIT.계획, FIT_H.계획, rows);
    fit_캐시지우기_();
    return { ok: true, 계획: fit_계획목록_() };
  });
}

function fit_t_saveEvents(token, 목록) {
  교사확인_(token);
  return withLock_(function () {
    var seen = {};
    var rows = (목록 || []).filter(function (t) {
      var n = str_(t.종목);
      if (!n || seen[n] || FIT_요소순서.indexOf(t.요소) < 0) return false;
      seen[n] = true; return true;
    }).map(function (t) { return { 요소: t.요소, 종목명: str_(t.종목), 단위: str_(t.단위) || '회', 기준량: Number(t.기준량) || 1, 포인트: Number(t.포인트) || 0, 사용: t.사용 !== false }; });
    if (!rows.length) return { ok: false, message: '종목이 하나도 없습니다.' };
    시트비우기_(FIT.종목);
    appendRows_(FIT.종목, FIT_H.종목, rows);
    var sh = sheet_(FIT.종목), have = ensureColumns_(FIT.종목, FIT_H.종목);
    sh.getRange(2, have.indexOf('사용') + 1, rows.length, 1).insertCheckboxes();
    fit_캐시지우기_();
    return { ok: true, 종목: fit_종목목록_(true) };
  });
}

function fit_t_getBadges(token) { 교사확인_(token); return fit_cfg_().배지; }

function fit_t_saveBadges(token, 목록) {
  교사확인_(token);
  return withLock_(function () {
    var rows = (목록 || []).filter(function (b) { return str_(b.이름); }).map(function (b, i) {
      return { 배지ID: str_(b.배지ID) || ('B' + ('0' + (i + 1)).slice(-2)), 이름: str_(b.이름), 설명: str_(b.설명),
               조건: str_(b.조건) || '누적횟수', 기준값: Number(b.기준값) || 1, 아이콘: str_(b.아이콘) || 'award', 사용: b.사용 !== false };
    });
    시트비우기_(FIT.배지);
    appendRows_(FIT.배지, FIT_H.배지, rows);
    if (rows.length) { var sh = sheet_(FIT.배지), have = ensureColumns_(FIT.배지, FIT_H.배지); sh.getRange(2, have.indexOf('사용') + 1, rows.length, 1).insertCheckboxes(); }
    fit_캐시지우기_();
    return { ok: true, 배지: fit_cfg_().배지 };
  });
}

function fit_t_getSettings(token) {
  교사확인_(token);
  var 지금 = fit_설정_();
  return fit_기본설정_().map(function (r) { return { 항목: r[0], 값: 지금[r[0]], 설명: r[2] }; });
}

function fit_t_saveSettings(token, 맵) {
  교사확인_(token);
  var put = {};
  fit_기본설정_().forEach(function (r) { if (맵[r[0]] !== undefined) put['체력.' + r[0]] = str_(맵[r[0]]); });
  설정저장_(put);
  return { ok: true, 설정: fit_공개설정_() };
}

/* ================= 활동 사진 · 결과 문서 ================= */

var FIT_FOLDER_KEY = 'FIT_PHOTO_FOLDER_ID';

function fit_폴더_() {
  var id = 속성_(FIT_FOLDER_KEY);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var parent = null;
  try { var parents = DriveApp.getFileById(ss_().getId()).getParents(); if (parents.hasNext()) parent = parents.next(); } catch (e) {}
  var folder = (parent || DriveApp).createFolder('건강체력교실 사진·결과물');
  속성저장_(FIT_FOLDER_KEY, folder.getId());
  return folder;
}

function fit_사진목록_() {
  return rows_(FIT.사진).map(function (r) {
    return { 사진ID: str_(r.사진ID), 날짜: 날짜정리_(r.날짜), 설명: str_(r.설명), 파일ID: str_(r.파일ID), 썸네일ID: str_(r.썸네일ID), 파일명: str_(r.파일명), 업로드일시: 시각문자_(r.업로드일시) };
  }).sort(function (a, b) { if (a.날짜 !== b.날짜) return a.날짜 < b.날짜 ? 1 : -1; return a.업로드일시 < b.업로드일시 ? 1 : -1; });
}

function fit_t_reportInfo(token) {
  교사확인_(token);
  return { 사진: fit_사진목록_(), 폴더URL: fit_폴더_().getUrl(), 설정: fit_공개설정_() };
}

function fit_t_uploadPhoto(token, m) {
  교사확인_(token);
  if (!m || !m.본문) return { ok: false, message: '사진 내용이 비어 있습니다.' };
  var folder = fit_폴더_();
  var 날짜 = 날짜정리_(m.날짜) || 오늘_();
  var 이름 = 날짜 + '_' + str_(m.파일명 || 'photo.jpg').replace(/[\\\/:*?"<>|]/g, '_');
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m.본문), m.타입 || 'image/jpeg', 이름));
  var thumb = m.썸네일 ? folder.createFile(Utilities.newBlob(Utilities.base64Decode(m.썸네일), 'image/jpeg', 'thumb_' + 이름)) : null;
  appendRow_(FIT.사진, FIT_H.사진, { 사진ID: uuid_(), 날짜: 날짜, 설명: str_(m.설명).slice(0, 200), 파일ID: file.getId(), 썸네일ID: thumb ? thumb.getId() : '', 파일명: 이름, 업로드일시: 지금_() });
  return { ok: true, 사진: fit_사진목록_() };
}

function fit_thumbs_(파일ID목록, 허용) {
  var out = {};
  (파일ID목록 || []).slice(0, 60).forEach(function (id) {
    if (허용 && !허용[id]) { out[id] = ''; return; }
    try { var blob = DriveApp.getFileById(id).getBlob(); out[id] = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()); }
    catch (e) { out[id] = ''; }
  });
  return out;
}
function fit_t_getThumbs(token, 파일ID목록) { 교사확인_(token); return fit_thumbs_(파일ID목록, null); }

function fit_t_updatePhoto(token, 사진ID, 날짜, 설명) {
  교사확인_(token);
  var hit = null;
  rows_(FIT.사진).forEach(function (r) { if (str_(r.사진ID) === str_(사진ID)) hit = r; });
  if (!hit) return { ok: false, message: '사진을 찾지 못했습니다.' };
  setCells_(FIT.사진, FIT_H.사진, hit._row, { 날짜: 날짜정리_(날짜) || 오늘_(), 설명: str_(설명).slice(0, 200) });
  return { ok: true, 사진: fit_사진목록_() };
}

function fit_t_deletePhoto(token, 사진ID) {
  교사확인_(token);
  var hit = fit_사진목록_().filter(function (p) { return p.사진ID === str_(사진ID); })[0];
  if (!hit) return { ok: false, message: '사진을 찾지 못했습니다.' };
  fit_휴지통_([hit.파일ID, hit.썸네일ID]);
  행지우기_(FIT.사진, function (o) { return str_(o.사진ID) === str_(사진ID); });
  return { ok: true, 사진: fit_사진목록_() };
}

function fit_휴지통_(파일ID들) {
  var n = 0;
  (파일ID들 || []).forEach(function (id) { if (!id) return; try { DriveApp.getFileById(String(id)).setTrashed(true); n++; } catch (e) {} });
  return n;
}

function fit_운영일_(시작, 끝, 출석들) {
  var 설정 = fit_설정_(), 요일이름 = ['일', '월', '화', '수', '목', '금', '토'], 운영요일 = {};
  목록_(설정.운영요일).forEach(function (d) { 운영요일[d] = true; });
  var set = {};
  for (var d = 시작; d <= 끝; d = 날짜더하기_(d, 1)) {
    var p = d.split('-').map(Number);
    if (운영요일[요일이름[new Date(p[0], p[1] - 1, p[2]).getDay()]]) set[d] = true;
  }
  (출석들 || []).forEach(function (a) { if (a.날짜 >= 시작 && a.날짜 <= 끝) set[a.날짜] = true; });
  return Object.keys(set).sort();
}
function fit_날짜표기_(ymd) {
  var p = ymd.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
  return p[1] + '.' + p[2] + '(' + ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] + ')';
}

/** 결과 문서(Google Docs). 옵션 = { 제목, 시작, 끝, 학교명, 지도교사, 서명부, 서명부형식('묶음'|'날짜별'), 사진, 출석있는날만, 이름가리기 } */
function fit_t_makeReport(token, 옵션) {
  교사확인_(token);
  옵션 = 옵션 || {};
  var 설정 = fit_설정_();
  var 시작 = 날짜정리_(옵션.시작) || 설정.운영시작, 끝 = 날짜정리_(옵션.끝) || 설정.운영종료;
  if (시작 > 끝) return { ok: false, message: '기간이 뒤집혀 있습니다.' };
  var 제목 = str_(옵션.제목) || '건강체력교실 운영 결과';
  var 학교명 = str_(옵션.학교명) || 설정.학교명, 지도교사 = str_(옵션.지도교사) || 설정.지도교사;
  var 이름 = 옵션.이름가리기 ? 이름가리기_ : function (n) { return n; };
  var 명단 = fit_참가자목록_(false), 출석 = fit_출석전체_();
  var 날짜들 = fit_운영일_(시작, 끝, 출석);
  if (옵션.출석있는날만) { var 있는날 = {}; 출석.forEach(function (a) { 있는날[a.날짜] = true; }); 날짜들 = 날짜들.filter(function (d) { return 있는날[d]; }); }
  var 출석표 = {};
  출석.forEach(function (a) { if (!출석표[a.학생ID]) 출석표[a.학생ID] = {}; 출석표[a.학생ID][a.날짜] = a.출석; });

  var doc = DocumentApp.create(제목 + ' (' + 시작 + '~' + 끝 + ')');
  var body = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(50).setMarginRight(50);
  body.appendParagraph(제목).setHeading(DocumentApp.ParagraphHeading.TITLE).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  var 개요 = [];
  if (학교명) 개요.push(학교명);
  개요.push('운영 기간: ' + 시작 + ' ~ ' + 끝);
  개요.push('운영 요일·시간: ' + 목록_(설정.운영요일).join('·') + ' ' + (설정.운영시간 || ''));
  if (설정.운영장소) 개요.push('장소: ' + 설정.운영장소);
  if (지도교사) 개요.push('지도교사: ' + 지도교사);
  개요.push('참가 학생: ' + 명단.length + '명 · 운영 회차: ' + 날짜들.length + '회');
  body.appendParagraph(개요.join('   |   ')).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setFontSize(9).setForegroundColor('#555555');

  body.appendParagraph('참가 학생').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var 명단행 = [['번호', '학년-반', '이름', '선정 사유']];
  명단.forEach(function (s, i) { 명단행.push([String(i + 1), s.학년 + '-' + s.반, 이름(s.이름), s.선정사유]); });
  fit_표꾸미기_(body.appendTable(명단행), [40, 60, 80, 0]);

  if (옵션.서명부 !== false && 날짜들.length) {
    if (옵션.서명부형식 === '날짜별') {
      날짜들.forEach(function (d) {
        body.appendPageBreak();
        body.appendParagraph(fit_날짜표기_(d) + ' 출석·서명부').setHeading(DocumentApp.ParagraphHeading.HEADING2);
        body.appendParagraph('운영 시간: ' + (설정.운영시간 || '') + '    장소: ' + (설정.운영장소 || '') + '    지도교사: ' + 지도교사).setFontSize(9);
        var 행 = [['번호', '학년-반', '이름', '출석', '서명']];
        명단.forEach(function (s, k) { var v = (출석표[s.학생ID] || {})[d] || ''; 행.push([String(k + 1), s.학년 + '-' + s.반, 이름(s.이름), v === '출석' ? '○' : v === '결석' ? '×' : '', '']); });
        var t = fit_표꾸미기_(body.appendTable(행), [40, 60, 90, 50, 0]);
        for (var r = 1; r < t.getNumRows(); r++) t.getRow(r).setMinimumHeight(26);
      });
    } else {
      var 묶음 = 6;
      for (var i = 0; i < 날짜들.length; i += 묶음) {
        var 조각 = 날짜들.slice(i, i + 묶음);
        body.appendPageBreak();
        body.appendParagraph('출석·서명부 (' + fit_날짜표기_(조각[0]) + ' ~ ' + fit_날짜표기_(조각[조각.length - 1]) + ')').setHeading(DocumentApp.ParagraphHeading.HEADING2);
        body.appendParagraph('출석한 회차의 칸에 학생이 서명합니다. 결석은 "결석"으로 표시되어 있습니다.').setFontSize(9).setForegroundColor('#555555');
        var 행2 = [['번호', '이름'].concat(조각.map(fit_날짜표기_))];
        명단.forEach(function (s, k) {
          var line = [String(k + 1), s.학년 + '-' + s.반 + ' ' + 이름(s.이름)];
          조각.forEach(function (d) { var v = (출석표[s.학생ID] || {})[d] || ''; line.push(v === '결석' ? '결석' : ''); });
          행2.push(line);
        });
        var 폭 = [36, 96]; 조각.forEach(function () { 폭.push(0); });
        var t2 = fit_표꾸미기_(body.appendTable(행2), 폭);
        for (var r2 = 1; r2 < t2.getNumRows(); r2++) t2.getRow(r2).setMinimumHeight(30);
      }
    }
  }

  var 사진수 = 0;
  if (옵션.사진 !== false) {
    var 사진들 = fit_사진목록_().filter(function (ph) { return ph.날짜 >= 시작 && ph.날짜 <= 끝; }).reverse();
    if (사진들.length) {
      body.appendPageBreak();
      body.appendParagraph('활동 사진').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var 날짜별 = {};
      사진들.forEach(function (ph) { (날짜별[ph.날짜] = 날짜별[ph.날짜] || []).push(ph); });
      Object.keys(날짜별).sort().forEach(function (d) {
        body.appendParagraph(fit_날짜표기_(d)).setHeading(DocumentApp.ParagraphHeading.HEADING3);
        var list = 날짜별[d];
        for (var i2 = 0; i2 < list.length; i2 += 2) {
          var tbl = body.appendTable([['', '']]);
          tbl.setBorderWidth(0);
          for (var c = 0; c < 2; c++) {
            var ph = list[i2 + c], cell = tbl.getRow(0).getCell(c);
            cell.setPaddingTop(4).setPaddingBottom(6).setPaddingLeft(4).setPaddingRight(4);
            if (!ph) continue;
            try {
              var img = cell.insertImage(0, DriveApp.getFileById(ph.파일ID).getBlob());
              var w = img.getWidth(), hgt = img.getHeight(), 목표폭 = 235;
              img.setWidth(목표폭).setHeight(Math.round(hgt * 목표폭 / w));
              사진수++;
            } catch (e) { cell.getChild(0).asParagraph().setText('(사진을 불러오지 못했습니다: ' + ph.파일명 + ')'); }
            if (ph.설명) cell.appendParagraph(ph.설명).setFontSize(9).setForegroundColor('#555555');
          }
        }
      });
    }
  }
  doc.saveAndClose();
  try { DriveApp.getFileById(doc.getId()).moveTo(fit_폴더_()); } catch (e) {}
  return { ok: true, url: doc.getUrl(), 이름: doc.getName(), 회차: 날짜들.length, 사진수: 사진수, 인원: 명단.length };
}

function fit_표꾸미기_(table, 폭) {
  table.setBorderWidth(0.75).setBorderColor('#999999');
  var head = table.getRow(0);
  for (var c = 0; c < head.getNumCells(); c++) head.getCell(c).setBackgroundColor('#E4F6F1').setBold(true);
  for (var r = 0; r < table.getNumRows(); r++) {
    for (var c2 = 0; c2 < table.getRow(r).getNumCells(); c2++) {
      var cell = table.getRow(r).getCell(c2);
      cell.setFontSize(10).setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(4).setPaddingRight(4);
      cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }
  (폭 || []).forEach(function (w, i) { if (w) table.setColumnWidth(i, w); });
  return table;
}

/* ================= 학생 API ================= */

function fit_s_boot(token) { return fit_학생화면_(fit_학생확인_(token)); }
function fit_s_refresh(token) { return fit_학생화면_(fit_학생확인_(token)); }

function fit_학생화면_(me) {
  var 기록 = fit_기록전체_(), 출석 = fit_출석전체_();
  var y = fit_요약_(me.학생ID, 기록, 출석, fit_목표전체_(), fit_설정_(), fit_배지목록_());
  var 내기록 = 기록.filter(function (r) { return r.학생ID === me.학생ID; }).reverse().map(function (r) { delete r._row; return r; });
  var 오늘 = 오늘_();
  return {
    학생: me, 종목: fit_종목목록_(false), 요소: FIT_요소순서, 설정: fit_공개설정_(), 오늘: 오늘,
    요약: y, 기록: 내기록.slice(0, 200),
    오늘기록수: 내기록.filter(function (r) { return r.날짜 === 오늘 && r.상태 !== '반려'; }).length,
    오늘출석: 출석.filter(function (a) { return a.학생ID === me.학생ID && a.날짜 === 오늘 && a.출석 === '출석'; }).length > 0,
    이번달계획: fit_이번달계획_(), 계획: fit_계획목록_()
  };
}

/** m = { 날짜, 장소, 종목, 수치, 소감, 출석, 사진:{본문,썸네일} } */
function fit_s_addRecord(token, m) {
  var me = fit_학생확인_(token);
  var 설정 = fit_설정_();
  var 날짜 = 날짜정리_(m.날짜) || 오늘_();
  if (날짜 > 오늘_()) return { ok: false, message: '미래 날짜에는 기록할 수 없어요.' };
  if (날짜 < 날짜더하기_(오늘_(), -14)) return { ok: false, message: '2주 이내의 운동만 기록할 수 있어요. 선생님께 말씀드리세요.' };
  var 장소 = (m.장소 === '가정') ? '가정' : '교실';
  var info = null;
  fit_종목목록_(false).forEach(function (t) { if (t.종목 === m.종목) info = t; });
  if (!info) return { ok: false, message: '지금 쓰지 않는 종목이에요.' };
  var v = Number(m.수치);
  if (!(v > 0)) return { ok: false, message: '얼마나 했는지 숫자로 적어 주세요.' };
  if (v > info.기준량 * 50) return { ok: false, message: '숫자가 너무 커요. 다시 확인해 주세요.' };
  var 최대 = Number(설정.기록당최대포인트) || 50;
  var 포인트 = Math.min(최대, Math.max(1, Math.round(v / info.기준량 * info.포인트)));
  var 자동 = String(설정.자동확인 || '교실');
  var 상태 = (자동 === '전부' || (자동 === '교실' && 장소 === '교실')) ? '확인' : '대기';
  var 소감 = str_(m.소감).slice(0, 200);
  var 사진옵션 = String(설정.가정운동사진 || '선택');
  var 사진 = (사진옵션 !== '없음' && m.사진 && m.사진.본문) ? m.사진 : null;
  if (장소 === '가정' && 사진옵션 === '필수' && !사진) return { ok: false, message: '집에서 한 운동은 사진을 함께 올려 주세요.' };

  var r = withLock_(function () {
    var 오늘수 = rows_(FIT.기록).filter(function (r) { return str_(r.학생ID) === me.학생ID && 날짜정리_(r.날짜) === 날짜 && str_(r.상태) !== '반려'; }).length;
    var 하루최대 = Number(설정.하루최대기록) || 6;
    if (오늘수 >= 하루최대) return { ok: false, message: '하루에 ' + 하루최대 + '개까지만 기록할 수 있어요.' };
    var 사진ID = '', 썸네일ID = '';
    if (사진) {
      try { var f = fit_학생사진저장_(me, 날짜, 사진); 사진ID = f.사진ID; 썸네일ID = f.썸네일ID; }
      catch (e) { return { ok: false, message: '사진을 저장하지 못했어요. 다시 시도해 주세요. (' + e.message + ')' }; }
    }
    var now = 지금_();
    appendRow_(FIT.기록, FIT_H.기록, { 기록ID: uuid_(), 입력일시: now, 날짜: 날짜, 학생ID: me.학생ID, 장소: 장소, 요소: info.요소, 종목: info.종목,
      수치: v, 단위: info.단위, 포인트: 포인트, 소감: 소감, 상태: 상태, 확인일시: 상태 === '확인' ? now : '', 교사메모: '', 사진ID: 사진ID, 사진썸네일ID: 썸네일ID });
    if (장소 === '교실' && m.출석) fit_출석기록_(날짜, me.학생ID, '출석', 상태 === '확인', '학생');
    return null;
  });
  if (r) return r;
  var out = fit_학생화면_(me);
  out.ok = true; out.포인트 = 포인트; out.상태 = 상태;
  return out;
}

function fit_s_deleteRecord(token, 기록ID) {
  var me = fit_학생확인_(token);
  return withLock_(function () {
    var 지울사진 = [];
    var n = 행지우기_(FIT.기록, function (o) {
      var hit = str_(o.기록ID) === str_(기록ID) && str_(o.학생ID) === me.학생ID && (str_(o.상태) === '대기' || 날짜정리_(o.날짜) === 오늘_());
      if (hit) 지울사진.push(o.사진ID, o.사진썸네일ID);
      return hit;
    });
    fit_휴지통_(지울사진);
    var out = fit_학생화면_(me);
    out.ok = n > 0; out.message = n > 0 ? '' : '선생님이 이미 확인한 기록은 지울 수 없어요.';
    return out;
  });
}

function fit_s_saveGoal(token, 목표횟수, 목표포인트) {
  var me = fit_학생확인_(token);
  var 횟수 = Math.max(1, Math.min(30, Math.round(Number(목표횟수) || 0)));
  var 포인트 = Math.max(10, Math.min(2000, Math.round(Number(목표포인트) || 0)));
  var 주 = 주시작_(오늘_());
  withLock_(function () {
    var hit = null;
    rows_(FIT.목표).forEach(function (r) { if (str_(r.학생ID) === me.학생ID && 날짜정리_(r.주시작일) === 주) hit = r; });
    var f = { 학생ID: me.학생ID, 주시작일: 주, 목표횟수: 횟수, 목표포인트: 포인트, 수정일시: 지금_() };
    if (hit) setCells_(FIT.목표, FIT_H.목표, hit._row, f); else appendRow_(FIT.목표, FIT_H.목표, f);
  });
  var out = fit_학생화면_(me);
  out.ok = true;
  return out;
}

function fit_학생사진저장_(me, 날짜, 사진) {
  var parent = fit_폴더_();
  var it = parent.getFoldersByName('학생 운동 사진');
  var folder = it.hasNext() ? it.next() : parent.createFolder('학생 운동 사진');
  var 이름 = 날짜 + '_' + me.학년 + '-' + me.반 + '-' + me.번호 + '_' + me.이름 + '.jpg';
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(사진.본문), 'image/jpeg', 이름));
  var thumb = 사진.썸네일 ? folder.createFile(Utilities.newBlob(Utilities.base64Decode(사진.썸네일), 'image/jpeg', 'thumb_' + 이름)) : null;
  return { 사진ID: file.getId(), 썸네일ID: thumb ? thumb.getId() : '' };
}

function fit_s_getThumbs(token, 파일ID목록) {
  var me = fit_학생확인_(token);
  var 허용 = {};
  rows_(FIT.기록).forEach(function (r) {
    if (str_(r.학생ID) !== me.학생ID) return;
    if (r.사진ID) 허용[str_(r.사진ID)] = true;
    if (r.사진썸네일ID) 허용[str_(r.사진썸네일ID)] = true;
  });
  return fit_thumbs_(파일ID목록, 허용);
}

function fit_s_checkIn(token) {
  var me = fit_학생확인_(token);
  withLock_(function () { fit_출석기록_(오늘_(), me.학생ID, '출석', false, '학생'); });
  var out = fit_학생화면_(me);
  out.ok = true;
  return out;
}
