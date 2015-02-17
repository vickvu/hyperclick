(function() {
  "use strict";

  var regex = /\{([a-z0-9_\-,&?\/]+)\}/ig;
  $.facebox.settings.closeImage = chrome.extension.getURL('img/closelabel.png');
  $.facebox.settings.loadingImage = chrome.extension.getURL('img/loading.gif');

  var isTemplate = function(url) {
    return url.search(regex) >= 0;
  }

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

  var toggleValue = function(checkbox, input, param) {
    if (checkbox.is(':checked')) {
      input.removeAttr('disabled');
      param.value = input.val();
    } else {
      input.attr('disabled', 'disabled');
      param.value = null;
    }
  };

  var submitValues = function(form, urlInfo, targetInput, event) {
    //Populate values from form
    form.find('input[type=text]').each(function () {
      var $this = $(this);
      var paramName = $this.attr('name');
      if (urlInfo.params[paramName]) {
        if ($this.is(':disabled')) {
          urlInfo.params[paramName].value = null;
        } else {
          urlInfo.params[paramName].value = $this.val();
        }
      }
    });
    var url = createUrl(urlInfo);
    if (url.indexOf('//') == 0) {
      url = window.location.protocol + url;
    }
    chrome.runtime.sendMessage({type: 'navigate', target: targetInput.val(), url: url}, function(response) {
      $(document).trigger('close.facebox')
    });
    event.preventDefault();
  };

  var createForm = function(urlInfo) {
    var form = $(document.createElement('form'));
    var header = $(document.createElement('h2'));
    header.text('URL Template');
    form.append(header);
    for (var paramName in urlInfo.params) {
      if (urlInfo.params.hasOwnProperty(paramName)) {
        var checkbox = null;
        var param = urlInfo.params[paramName];
        var value = param.value;
        var optional = param.optional;
        var inputId = 'hyperlick_form_' + paramName;
        var dl = $(document.createElement('dl'));
        form.append(dl);
        var dt = $(document.createElement('dt'));
        dl.append(dt);
        var label = $(document.createElement('label'));
        label.attr('for', inputId);
        if (optional) {
          checkbox = $(document.createElement('input'));
          checkbox.attr('type', 'checkbox');
          label.append(checkbox);
          var span = $(document.createElement('span'));
          span.text(paramName +' (Optional)');
          label.append(span);
        } else {
          label.text(paramName +' (Required)');
        }
        dt.append(label);
        var dd = $(document.createElement('dd'));
        dl.append(dd);
        var input = $(document.createElement('input'));
        input.attr('type', 'text');
        input.attr('size', '30');
        input.attr('id', inputId);
        input.attr('name', paramName);
        input.val(value);
        if (optional) {
          input.attr('disabled', 'disabled');
          (function(param) {
            checkbox.on('click', toggleValue.bind(null, checkbox, input, param));
          })(param);
        }
        dd.append(input);
      }
    }
    var control = $(document.createElement('div'));
    control.addClass('control');
    form.append(control);
    var select = $(document.createElement('select'));
    control.append(select)
    var openSameTab = $(document.createElement('option'));
    openSameTab.attr('value', '');
    openSameTab.text('Open in same tab');
    select.append(openSameTab);
    var openNewTab = $(document.createElement('option'));
    openNewTab.attr('value', 'tab');
    openNewTab.text('Open in new tab');
    select.append(openNewTab);
    var openNewWindow = $(document.createElement('option'));
    openNewWindow.attr('value', 'window');
    openNewWindow.text('Open in new window');
    select.append(openNewWindow);
    var openIncognitoWindow = $(document.createElement('option'));
    openIncognitoWindow.attr('value', 'incognito');
    openIncognitoWindow.text('Open in incognito window');
    select.append(openIncognitoWindow);
    var open = $(document.createElement('button'));
    open.addClass('main');
    open.text('Open');
    open.on('click', submitValues.bind(null, form, urlInfo, select));
    control.append(open);
    $.facebox(form);
  }

  var linkOnClick = function(event) {
    var $this = $(this);
    var url = decodeURI($this.attr('href'));
    if (isTemplate(url)) {
      var urlInfo = $this.data('hyperclick-url-info');
      if (!urlInfo) {
        urlInfo = parseUrl(url);
        $this.data('hyperclick-url-info', urlInfo);
      }
      createForm(urlInfo);
      event.preventDefault();
    }
  };

  var refresh = function() {
    //Support for JSON Formatter
    $('#jfContent #formattedJson .kvov.objProp .s span').each(function() {
      var $this = $(this);
      var thisAnchor = $this.find('a');
      if (thisAnchor.length == 0) {
        var value = $this.text();
        if (value.indexOf('//') == 0) {
          var newAnchor = $(document.createElement('a'));
          newAnchor.attr('href', value);
          newAnchor.text(value);
          newAnchor.on('click', linkOnClick);
          newAnchor.data('hyperclicked-processed', true);
          $this.html(newAnchor);
        }
      } else if (!thisAnchor.data('hyperclicked-processed')) {
        thisAnchor.on('click', linkOnClick);
        thisAnchor.data('hyperclicked-processed', true);
      }
    });
    //Support for JSONView
    $('#json .type-string').each(function() {
      var $this = $(this);
      var thisAnchor = $this.next('a');
      if (thisAnchor.length == 0) {
        var value = $this.text();
        if (value.indexOf('"//') == 0) {
          var url = value.replace(/^"|"$/g,'');
          var newAnchor = $(document.createElement('a'));
          newAnchor.attr('href', url);
          newAnchor.text(url);
          newAnchor.on('click', linkOnClick);
          newAnchor.data('hyperclicked-processed', true);
          $this.html('"');
          $this.after(newAnchor);
          newAnchor.after('<span class="type-string">"</span>');
        }
      } else if (!thisAnchor.data('hyperclicked-processed')) {
        thisAnchor.on('click', linkOnClick);
        thisAnchor.data('hyperclicked-processed', true);
      }
    });
    //Support for JSON Viewer
    $('.language-json .token.string').each(function() {
      var $this = $(this);
      var value = $this.text();
      var thisAnchor = $this.find('.token.url-link');
      if (thisAnchor.length == 1 && !thisAnchor.data('hyperclicked-processed')) {
        var url = value.replace(/^"|"$/g,'');
        thisAnchor.attr('href', url);
        thisAnchor.text(url);
        thisAnchor.on('click', linkOnClick);
        thisAnchor.data('hyperclicked-processed', true);
        thisAnchor.detach();
        $this.html('"');
        $this.append(thisAnchor);
        $this.append('"');
      }
    });
    $('.language-json .token.comment').each(function() {
      var $this = $(this);
      var value = $this.text();
      var thisAnchor = $this.find('a');
      if (thisAnchor.length == 0) {
        if (value.search(/^"\/\/\w+/) == 0) {
          var url = value.replace(/^"/,'').replace(/",\s*$/,'');
          var newAnchor = $(document.createElement('a'));
          newAnchor.attr('href', url);
          newAnchor.addClass('token url-string');
          newAnchor.text(url);
          newAnchor.on('click', linkOnClick);
          newAnchor.data('hyperclicked-processed', true);
          $this.html('"');
          $this.append(newAnchor);
          $this.append('"');
          $this.removeClass('comment');
          $this.addClass('string');
          $this.after('<span class="token punctuation">,</span>')
        }
      }
    });
  };

  // create an observer instance
  var observer = new MutationObserver(refresh);
  observer.observe(document, {
    childList: true,
    subtree: true
  });
})();
