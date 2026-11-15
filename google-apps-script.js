/**
 * [구글 스프레드시트 Apps Script 코드]
 * 
 * 1. 스프레드시트(점심 메뉴 투표) 상단 메뉴에서:
 *    [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 아래 코드를 그대로 붙여넣기 후 저장 (Ctrl + S)
 * 3. 우측 상단 [배포] > [새 배포] 클릭
 * 4. 톱니바퀴 아이콘 클릭 > [웹 앱] 선택
 *    - 설명: 점심 메뉴 투표 API
 *    - 다음 사용자 권한으로 실행: 나(내 계정)
 *    - 액세스 권한이 있는 사용자: "모든 사용자(Anyone)"  <-- 매우 중요!
 * 5. [배포] 클릭 후 [액세스 승인] 진행
 * 6. 생성된 "웹 앱 URL" (https://script.google.com/macros/s/.../exec)을 복사하여
 *    투표 웹 화면의 [⚙️ 연동 설정]에 등록해 주세요.
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {};
    
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter || {};
    }

    var now = new Date();
    var formattedDate = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    var menu = data.menu || '';
    var volter = data.volter || '익명';

    if (menu) {
      sheet.appendRow([formattedDate, menu, volter]);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        timestamp: formattedDate,
        menu: menu,
        volter: volter
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        result: 'error',
        message: '메뉴 정보가 누락되었습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var menu = e.parameter ? e.parameter.menu : null;
    var volter = (e.parameter && e.parameter.volter) ? e.parameter.volter : '익명';
    var now = new Date();
    var formattedDate = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    if (menu) {
      sheet.appendRow([formattedDate, menu, volter]);
      
      var callback = e.parameter.callback;
      var response = { result: 'success', timestamp: formattedDate, menu: menu, volter: volter };
      
      if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(response) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput('점심 메뉴 투표 Web App이 정상 작동 중입니다.');
  } catch (error) {
    return ContentService.createTextOutput('Error: ' + error.toString());
  }
}
