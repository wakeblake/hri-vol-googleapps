function onInstall(e) {
  onOpen(e);
}


function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createAddonMenu();
  menu.addItem('Import a file', 'buildImportSideBar');
  menu.addItem('Activate Sheets', 'buildSetupSideBar');
  menu.addItem('Validate Emails', 'checkEmails');
  menu.addItem('Reset', 'resetExtension');
  menu.addToUi();

  var adminUserExists = PropertiesService.getScriptProperties().getProperty('adminUser');
  //var superUserExists = PropertiesService.getScriptProperties().getProperty('superUser');
  if ( !(adminUserExists) ) {
    var adminUser = 'humanrightsinitiativentx@gmail.com'; //SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail()  // THIS SHOULD BE LAYNE //
    //var superUser = 'blake.holleman@gmail.com';  // CAN'T BE AN ALIAS ... can only owner access apps script? //
    setScriptProperty('adminUser', adminUser);
  }

  var exceptions = PropertiesService.getScriptProperties().getProperty('exceptions');
  if ( !(exceptions) ) {
    setScriptProperty('exceptions', {});
  }

  // TODO deprecate this? //
  //setScriptProperty('adminLoggerUrl', 'https://docs.google.com/spreadsheets/d/1LCiLZ4PO7BC2lFVO0m_lvEncqOqpJKdScwyKpWF9-qo/edit#gid=0')
}


function onEditInstallable(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = e.range.getSheet();
  var sheetId = sheet.getSheetId().toString();
  var a1Range = e.range.getA1Notation();
  var a1List = getCommaSepRange(a1Range);
  var dataList = a1List.map(a1 => sheet.getRange(a1).getDisplayValue());
  var cellValidList = a1List.map(a1 => sheet.getRange(a1).getDataValidation());
  var cellValidationText;
  var rejected = [];
  
  // Handles admin edits of protected cells //

  try {
    a1List.length == dataList.length && dataList.length == cellValidList.length;
  } catch {
    Logger.log('Unequal length of converted ranges');
  }
  
  for (var i=0; i < a1List.length; i++) {
    
    // non-validated cells //
    if (!cellValidList[i]) {
      //isInvalidCell(sheetId, a1List[i], 'edit');
    }


    // validated non-editable cells //                                              

    if ( cellValidList[i] && !cellValidList[i].getAllowInvalid() ) {
      cellValidationText = cellValidList[i].getCriteriaValues()[0];
      if ( !(dataList[i] == cellValidationText) ) {
        Logger.log([dataList[i], cellValidationText]);
        rejected.push( [a1List[i], cellValidationText] );
      }
    }
  }

  // validated non-editable - reset value and alert //

  if (rejected.length) {
    raiseAlert(
      'You are attempting to edit the following protected cells:  ' + 
      JSON.stringify(rejected.map(i => i[0])),
      'If you would like to edit these cells, run "Activate Sheets" from the Extensions menu, then click "Update".'
    );

    for (var i=0; i < rejected.length; i++) {
      [a1, text] = rejected[i];
      sheet.getRange(a1).setValue(text);
    }
    Logger.log('Edited range includes validation errors. Reset the following cells to: ' + JSON.stringify(rejected));
  }
}


function onChangeInstallable(e) {
  // sheet deletion - delete and reset properties //
  if (e.changeType == 'REMOVE_GRID') {
    var scriptProperties = PropertiesService.getScriptProperties().getProperties();
    var propertyKeys = Object.keys(scriptProperties);
    var reId = /^\d+$/;

    for (var pk of propertyKeys) {
      var isMatch = reId.test(pk);
      var sheetExists = isMatch ? Boolean(getSheetById(pk)) : true;
      if (!sheetExists) {
        var isProtectedSheet = PropertiesService.getScriptProperties().getProperty('protectedSheet') == pk ? true : false;
        PropertiesService.getScriptProperties().deleteProperty(pk);
        isProtectedSheet ? setScriptProperty('protectedSheet', '') : null;
      }
    }
  }
  
  if (['REMOVE_ROW','REMOVE_COLUMN','INSERT_ROW','INSERT_COLUMN'].includes(e.changeType)) {
    Logger.log(JSON.stringify(e));
    Logger.log(e.changeType);
    var sheetId = SpreadsheetApp.getActiveSheet().getSheetId().toString();
    var protectedSheetId = PropertiesService.getScriptProperties().getProperty('protectedSheet');
    var reportSheetId = PropertiesService.getScriptProperties().getProperty(protectedSheetId) ? 
      JSON.parse(PropertiesService.getScriptProperties().getProperty(protectedSheetId))['reportSheet'] : 
      null;

    (sheetId == protectedSheetId) || (sheetId == reportSheetId) ? 
      raiseAlert('Warning!', 'Inserting or deleting rows or columns on an active sheet may create downstream errors.  Please CTRL-Z to undo these changes.') :
      null;
  }
  
}




