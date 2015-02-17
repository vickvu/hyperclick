(function () {

  "use strict" ;

  var regex = /\{([a-z0-9_\-,&?\/]+)\}/ig;

  var parseUrl = function(url) {
    var urlComps = [];
    var urlCompIndex = -1;
    var params = {};
    var lastIndex = 0;
    var result;
    while ((result = regex.exec(url)) !== null) {
      var urlComp = '';
      var paramName = result[1];
      var firstChar = paramName.charAt(0);
      urlCompIndex += 2;
      if (firstChar === '&' || firstChar === '?' || firstChar === '/') {
        urlComp = url.substring(lastIndex, result.index);
        var paramNames = paramName.substr(1).split(',');
        for (var paramNameIndex in paramNames) {
          params[paramNames[paramNameIndex]] = {
            value: null,
            optional: true,
            index: urlCompIndex,
            prefix: firstChar
          };
        }
      } else {
        urlComp = url.substring(lastIndex, result.index);
        params[paramName] = {
          value: '',
          optional: false,
          index: urlCompIndex
        };
      }
      urlComps.push(urlComp);
      urlComps.push('');
      lastIndex = regex.lastIndex;
    }
    if (lastIndex > 0) {
      urlComps.push(url.substring(lastIndex));
    }
    return {
      comps: urlComps,
      params: params
    }
  };

  var createUrl = function(urlInfo) {
    //Reconstruct the URL
    var retVal = [];
    for (var i = 0; i < urlInfo.comps.length; i++) {
      retVal.push(urlInfo.comps[i]);
    }
    for (var paramName in urlInfo.params) {
      if (urlInfo.params.hasOwnProperty(paramName)) {
        var index = urlInfo.params[paramName].index;
        if (urlInfo.params[paramName].value !== null) {
          var value = encodeURIComponent(urlInfo.params[paramName].value);
          var optional = urlInfo.params[paramName].optional;
          if (optional) {
            var prefix = urlInfo.params[paramName].prefix;
            if (prefix === '&' || prefix === '?') {
              if (retVal[index] === '') {
                retVal[index] = prefix + paramName + '=' + value;
              } else {
                retVal[index] += '&' + paramName + '=' + value;
              }
            } else if (prefix === '/') {
              retVal[index] += prefix + value;
            }
          } else {
            retVal[index] = value;
          }
        }
      }
    }
    return retVal.join('');
  };

  var navigateUrl = function(opts) {
    var url = createUrl(opts.urlInfo);
    if (url.indexOf('//') == 0) {
      url = opts.baseProtocol + url;
    }
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
    if (request.type == "parse") {
      sendResponse(parseUrl(request.url));
    } else if (request.type == "navigate") {
      sendResponse(navigateUrl({target: request.target, urlInfo: request.urlInfo, baseProtocol: request.baseProtocol}));
    }
  });
}());
