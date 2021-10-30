function buildImportSideBar() {
  var ui = SpreadsheetApp.getUi();

  var htmlOutput = HtmlService
    .createTemplateFromFile('ImportFile')
    .evaluate()
    .setTitle('Import a File');

  ui.showSidebar(htmlOutput);
}

function buildSetupSideBar() {
  var ui = SpreadsheetApp.getUi();

  var htmlOutput = HtmlService
    .createTemplateFromFile('Admin')
    .evaluate()
    .setTitle('Set Up Report Sheet');

  ui.showSidebar(htmlOutput);
}

function convertFileUpload(file) {
  var data = Utilities.parseCsv(file);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var numSheets = ss.getNumSheets();
  var now = Utilities.formatDate(new Date(), 'America/Chicago', 'MM-dd-yyyy HH:mm:ss');
  var uploadSheet = ss.insertSheet().setName('Uploaded ' + now);
  uploadSheet.getRange(1,1, data.length, data[0].length).setValues(data);
  PropertiesService.getScriptProperties().setProperty('lastUploadedSheet', uploadSheet.getSheetId().toString());

  Logger.log('Uploaded ' + file);
  Logger.log('Created new sheet: ' + ss.getSheets().some( sheet => sheet.getSheetName() == uploadSheet.getSheetName()));
  Logger.log('Set property "lastUploadedSheet": ' + Boolean(PropertiesService.getScriptProperties().getProperty('lastUploadedSheet')));

  return uploadSheet.getSheetName();
}


function finalizeActiveSheets(reportHeaders) {
  var protectedSheetId = PropertiesService.getScriptProperties().getProperty('protectedSheet');
  var protectedSheet = getSheetById(protectedSheetId);
  var protectedSheetName = protectedSheet.getSheetName();
  var sheetProperties = JSON.parse(PropertiesService.getScriptProperties().getProperty(protectedSheetId));
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reorderFirst = ['primaryCase','primaryFirm'];
  var event = 'insert';

  var reportSheetId = sheetProperties['reportSheet'];
  if (reportSheetId) {
    var reportSheet = getSheetById(reportSheetId);
    var reportRenamed = 'Report Closed * ' + Utilities.formatDate(new Date(), 'America/Chicago', 'MM-dd-yyyy HH:mm:ss');
    reportSheet.setName(reportRenamed);
    event = 'update';
  }
  
  // Insert new report summary sheet //
  reportSheetId = ss.insertSheet('*REPORT SUMMARY*', 1).getSheetId();
  reportSheet = getSheetById(reportSheetId);
  var reportSheetName = reportSheet.getSheetName();

  // Set internal report columns for summary sheet //
  var internalReportCols = reportHeaders.slice();
  internalReportCols.push(sheetProperties['primaryKey']);
  internalReportCols.push('Timestamp');
  reportSheet.getRange(1, 1, 1, internalReportCols.length).setValues([reorderCols(reorderFirst, internalReportCols)]);
 
  // Set permissions //
  setPermissions(reportSheet);
  setPermissions(protectedSheet);
  
  // Set data validations //
  var reportColumns = reorderCols(reorderFirst, reportHeaders);
  var reportHeadersRange = reportSheet.getRange(1, 1, 1, reportSheet.getLastColumn());
  var protectedHeadersRange = protectedSheet.getRange(1, 1, 1, protectedSheet.getLastColumn());  
  var [pkIdx, pkRange, primaryKeys] = getColumnCustom(protectedSheet, 'primaryKey');
  
  setDataValidation(reportSheetId, reportHeadersRange);
  ss.setActiveSheet(protectedSheet);  
  setDataValidation(protectedSheetId, protectedHeadersRange);
  setDataValidation(protectedSheetId, pkRange);

  // Save script properties //
  sheetProperties['reportSheet'] = reportSheetId;
  PropertiesService.getScriptProperties().setProperty(protectedSheetId, JSON.stringify(sheetProperties));  // can't use variable for key on setProperties() //
  PropertiesService.getScriptProperties().setProperty('reportColumns', JSON.stringify(reportColumns));   // user-facing report cols //

  // set active sheets name and tab color //
  protectedSheet.setName('*ACTIVE* ' + protectedSheetName);
  protectedSheet.setTabColor('blue');
  reportSheet.setTabColor('blue');

  isReportSheet = JSON.parse(PropertiesService.getScriptProperties().getProperty(protectedSheetId)).hasOwnProperty('reportSheet');
  isReportColumns = PropertiesService.getScriptProperties().getProperty('reportColumns');
  isReportSheet ? Logger.log('Saved report sheet: ' + reportSheetId) : Logger.log('Saved report sheet: ' + reportSheetId);
  isReportColumns ? Logger.log('Saved user-facing report columns: ' + JSON.stringify(isReportColumns)) : Logger.log('Saved user-facing report columns: ' + Boolean(isReportColumns));

  return {event: [protectedSheetName, reportSheetName]};
}


function resetActiveSheets() {
  // protected sheet //
  var protectedSheetId = PropertiesService.getScriptProperties().getProperty('protectedSheet');
  var sheetProperties = JSON.parse(PropertiesService.getScriptProperties().getProperty(protectedSheetId));
  var protectedSheet = getSheetById(protectedSheetId);
  var protectedSheetName = protectedSheet.getSheetName();
  protectedSheet.getDataRange().clearDataValidations();
  protectedSheet.setName(protectedSheetName.split('*ACTIVE* ')[1]);
  protectedSheet.setTabColor(null);

  // report sheet //
  var reportSheetId = sheetProperties['reportSheet'];
  var reportSheet = getSheetById(reportSheetId);
  var reportRenamed = 'Report Closed ~ ' + Utilities.formatDate(new Date(), 'America/Chicago', 'MM-dd-yyyy HH:mm:ss');
  if (reportSheet) {
    reportSheet.setName(reportRenamed);
    reportSheet.getDataRange().clearDataValidations();
    reportSheet.setTabColor(null);
  };

  // delete or reset properties //
  delete sheetProperties['reportSheet'];
  
  var scriptProperties = PropertiesService.getScriptProperties().getProperties();
  var resetProperties = {'protectedSheet': '', protectedSheetId: JSON.stringify(sheetProperties), reportColumns:'[]'};
  for (key of Object.keys(scriptProperties)) {
    if (Object.keys(resetProperties).includes(key)) {
      PropertiesService.getScriptProperties().setProperty(key, resetProperties[key]);
    }
  }
  
  var isReset = !(PropertiesService.getScriptProperties().getProperty(protectedSheetId)['reportSheet'] && PropertiesService.getScriptProperties().getProperty('protectedSheet'));
  Logger.log('Active sheets reset: ' + isReset.toString());
  
  // added to handle user CTRL-Z on sheet deletion //  NEED THIS?

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rs = ss.getSheetByName('Report Summary');
  if (rs) {
    Logger.log('Active sheets reset: missing script property for Report Summary sheet');  // Must log before delete //
    rs.setName(reportRenamed);
  } 
}


