function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {};

    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = (e && e.parameter) ? e.parameter : {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var menu = data.menu || '';
    var volter = data.volter || '익명';
    var now = new Date();
    var timestamp = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    if (menu) {
      sheet.appendRow([timestamp, menu, volter]);
      return ContentService.createTextOutput(JSON.stringify({ result: "success", menu: menu, volter: volter }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: "메뉴가 없습니다." }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var menu = (e && e.parameter) ? e.parameter.menu : null;
    var volter = (e && e.parameter && e.parameter.volter) ? e.parameter.volter : '익명';
    var now = new Date();
    var timestamp = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    if (menu) {
      sheet.appendRow([timestamp, menu, volter]);
      return ContentService.createTextOutput(JSON.stringify({ result: "success", menu: menu, volter: volter }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("점심 메뉴 투표 Web App이 정상 작동 중입니다.");
  } catch (error) {
    return ContentService.createTextOutput("오류: " + error.toString());
  }
}
