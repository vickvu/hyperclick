(function () {

  "use strict" ;

  var navigateUrl = function(opts) {
    var url = opts.url;
    if (opts.target) {
      if (opts.target == 'tab') {
        //Open in new tab
        chrome.tabs.create({url: url});
      } else if (opts.target == 'window') {
        //Open in new window
        chrome.windows.create({url: url});
      } else if (opts.target == 'incognito') {
        //Open in incognito window
        chrome.windows.getAll(function(windows) {
          var incognitoWindow = null;
          for (var i = 0; i < windows.lenth || incognitoWindow == null; i++) {
            if (windows[i].incognito) {
              incognitoWindow = windows[i];
            }
          }
          if (incognitoWindow) {
            chrome.tabs.create({windowId: incognitoWindow.id, url: url});
          } else {
            chrome.windows.create({url: url, incognito: true});
          }
        });
      }
    } else {
      //Open in the same tab
      chrome.tabs.update({url: url});
    }
    return url;
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'navigate') {
      sendResponse(navigateUrl({target: request.target, url: request.url}));
    }
  });
}());
