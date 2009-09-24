/*  Prototype JavaScript framework, version 1.6.1
 *  (c) 2005-2009 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {
  Version: '1.6.1',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    return {
      IE:             !!window.attachEvent && !isOpera,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile.*Safari/.test(ua)
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,
    SelectorsAPI: !!document.querySelector,
    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div');
      var form = document.createElement('form');
      var isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },
  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {
  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0; i < properties.length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype;
    var properties = Object.keys(source);

    if (!Object.keys({ toString: true }).length) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames().first() == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString;

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(object) {
    var type = typeof object;
    switch (type) {
      case 'undefined':
      case 'function':
      case 'unknown': return;
      case 'boolean': return object.toString();
    }

    if (object === null) return 'null';
    if (object.toJSON) return object.toJSON();
    if (isElement(object)) return;

    var results = [];
    for (var property in object) {
      var value = toJSON(object[property]);
      if (!isUndefined(value))
        results.push(property.toJSON() + ': ' + value);
    }

    return '{' + results.join(', ') + '}';
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    var results = [];
    for (var property in object)
      results.push(property);
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) == "[object Array]";
  }


  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return typeof object === "function";
  }

  function isString(object) {
    return _toString.call(object) == "[object String]";
  }

  function isNumber(object) {
    return _toString.call(object) == "[object Number]";
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        toJSON,
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());


Date.prototype.toJSON = function() {
  return '"' + this.getUTCFullYear() + '-' +
    (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
    this.getUTCDate().toPaddedString(2) + 'T' +
    this.getUTCHours().toPaddedString(2) + ':' +
    this.getUTCMinutes().toPaddedString(2) + ':' +
    this.getUTCSeconds().toPaddedString(2) + 'Z"';
};


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img');
    var matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift());
        var value = pair.length > 1 ? pair.join('=') : pair[0];
        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    var parts = this.split('-'), len = parts.length;
    if (len == 1) return parts[0];

    var camelized = this.charAt(0) == '-'
      ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1)
      : parts[0];

    for (var i = 1; i < len; i++)
      camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);

    return camelized;
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function toJSON() {
    return this.inspect(true);
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = this.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
    return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON();
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.indexOf(pattern) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.lastIndexOf(pattern) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim ? String.prototype.trim : strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    toJSON:         toJSON,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3];
      var pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;
      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();
function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}

function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator) {
    for (var i = 0, length = this.length; i < length; i++)
      iterator(this[i]);
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline !== false ? this : this.toArray())._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function toJSON() {
    var results = [];
    this.each(function(object) {
      var value = Object.toJSON(object);
      if (!Object.isUndefined(value)) results.push(value);
    });
    return '[' + results.join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect,
    toJSON:    toJSON
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }

  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }

  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values))
          return results.concat(values.map(toQueryPair.curry(key)));
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function toJSON() {
    return Object.toJSON(this.toObject());
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toJSON,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function toJSON() {
    return isFinite(this) ? this.toString() : 'null';
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    toJSON:         toJSON,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isString(this.options.parameters))
      this.options.parameters = this.options.parameters.toQueryParams();
    else if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.clone(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params['_method'] = this.method;
      this.method = 'post';
    }

    this.parameters = params;

    if (params = Object.toQueryString(params)) {
      if (this.method == 'get')
        this.url += (this.url.include('?') ? '&' : '?') + params;
      else if (/Konqueror|Safari|KHTML/.test(navigator.userAgent))
        params += '&_=';
    }

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300);
  },

  getStatus: function() {
    try {
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if(readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});



function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!window.Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}


(function(global) {

  var SETATTRIBUTE_IGNORES_NAME = (function(){
    var elForm = document.createElement("form");
    var elInput = document.createElement("input");
    var root = document.documentElement;
    elInput.setAttribute("name", "test");
    elForm.appendChild(elInput);
    root.appendChild(elForm);
    var isBuggy = elForm.elements
      ? (typeof elForm.elements.test == "undefined")
      : null;
    root.removeChild(elForm);
    elForm = elInput = null;
    return isBuggy;
  })();

  var element = global.Element;
  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;
    if (SETATTRIBUTE_IGNORES_NAME && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }
    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));
    return Element.writeAttribute(cache[tagName].cloneNode(false), attributes);
  };
  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;
})(this);

Element.cache = { };
Element.idCounter = 1;

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },


  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();

    function update(element, content) {
      element = $(element);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (SELECT_ELEMENT_INNERHTML_BUGGY || TABLE_ELEMENT_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(), attribute = pair.last();
      var value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property) {
    element = $(element);
    var elements = [];
    while (element = element[property])
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    if (!(element = $(element).firstChild)) return [];
    while (element && element.nodeType != 1) element = element.nextSibling;
    if (element) return [element].concat($(element).nextSiblings());
    return [];
  },

  previousSiblings: function(element) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    if (Object.isString(selector))
      selector = new Selector(selector);
    return selector.match($(element));
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Selector.findElement(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.previousElementSibling(element));
    var previousSiblings = Element.previousSiblings(element);
    return Object.isNumber(expression) ? previousSiblings[expression] :
      Selector.findElement(previousSiblings, expression, index);
  },

  next: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.nextElementSibling(element));
    var nextSiblings = Element.nextSiblings(element);
    return Object.isNumber(expression) ? nextSiblings[expression] :
      Selector.findElement(nextSiblings, expression, index);
  },


  select: function(element) {
    var args = Array.prototype.slice.call(arguments, 1);
    return Selector.findChildElements(element, args);
  },

  adjacent: function(element) {
    var args = Array.prototype.slice.call(arguments, 1);
    return Selector.findChildElements(element.parentNode, args).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  getDimensions: function(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');
    if (display != 'none' && display != null) // Safari bug
      return {width: element.offsetWidth, height: element.offsetHeight};

    var els = element.style;
    var originalVisibility = els.visibility;
    var originalPosition = els.position;
    var originalDisplay = els.display;
    els.visibility = 'hidden';
    if (originalPosition != 'fixed') // Switching fixed to absolute causes issues in Safari
      els.position = 'absolute';
    els.display = 'block';
    var originalWidth = element.clientWidth;
    var originalHeight = element.clientHeight;
    els.display = originalDisplay;
    els.position = originalPosition;
    els.visibility = originalVisibility;
    return {width: originalWidth, height: originalHeight};
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  cumulativeOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  positionedOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (element.tagName.toUpperCase() == 'BODY') break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  absolutize: function(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') == 'absolute') return element;

    var offsets = Element.positionedOffset(element);
    var top     = offsets[1];
    var left    = offsets[0];
    var width   = element.clientWidth;
    var height  = element.clientHeight;

    element._originalLeft   = left - parseFloat(element.style.left  || 0);
    element._originalTop    = top  - parseFloat(element.style.top || 0);
    element._originalWidth  = element.style.width;
    element._originalHeight = element.style.height;

    element.style.position = 'absolute';
    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.width  = width + 'px';
    element.style.height = height + 'px';
    return element;
  },

  relativize: function(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') == 'relative') return element;

    element.style.position = 'relative';
    var top  = parseFloat(element.style.top  || 0) - (element._originalTop || 0);
    var left = parseFloat(element.style.left || 0) - (element._originalLeft || 0);

    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.height = element._originalHeight;
    element.style.width  = element._originalWidth;
    return element;
  },

  cumulativeScrollOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  getOffsetParent: function(element) {
    if (element.offsetParent) return $(element.offsetParent);
    if (element == document.body) return $(element);

    while ((element = element.parentNode) && element != document.body)
      if (Element.getStyle(element, 'position') != 'static')
        return $(element);

    return $(document.body);
  },

  viewportOffset: function(forElement) {
    var valueT = 0, valueL = 0;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;

      if (element.offsetParent == document.body &&
        Element.getStyle(element, 'position') == 'absolute') break;

    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (!Prototype.Browser.Opera || (element.tagName && (element.tagName.toUpperCase() == 'BODY'))) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);

    return Element._returnOffset(valueL, valueT);
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source);

    element = $(element);
    var delta = [0, 0];
    var parent = null;
    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'left': case 'top': case 'right': case 'bottom':
          if (proceed(element, 'position') === 'static') return null;
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getOffsetParent = Element.Methods.getOffsetParent.wrap(
    function(proceed, element) {
      element = $(element);
      try { element.offsetParent }
      catch(e) { return $(document.body) }
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);
      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    }
  );

  $w('positionedOffset viewportOffset').each(function(method) {
    Element.Methods[method] = Element.Methods[method].wrap(
      function(proceed, element) {
        element = $(element);
        try { element.offsetParent }
        catch(e) { return Element._returnOffset(0,0) }
        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);
        var offsetParent = element.getOffsetParent();
        if (offsetParent && offsetParent.getStyle('position') === 'fixed')
          offsetParent.setStyle({ zoom: 1 });
        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );
  });

  Element.Methods.cumulativeOffset = Element.Methods.cumulativeOffset.wrap(
    function(proceed, element) {
      try { element.offsetParent }
      catch(e) { return Element._returnOffset(0,0) }
      return proceed(element);
    }
  );

  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className';
    var forProp = 'for';

    var el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div');
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');
            var f;

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if(element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };

  Element.Methods.cumulativeOffset = function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == document.body)
        if (Element.getStyle(element, 'position') == 'absolute') break;

      element = element.offsetParent;
    } while (element);

    return Element._returnOffset(valueL, valueT);
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next();
      var fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html) {
  var div = new Element('div'), t = Element._insertionTranslations.tags[tagName];
  if (t) {
    div.innerHTML = t[0] + html + t[1];
    t[2].times(function() { div = div.firstChild });
  } else div.innerHTML = html;
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'))

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2);
        var el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

Element.hasAttribute = function(element, attribute) {
  if (element.hasAttribute) return element.hasAttribute(attribute);
  return Element.Methods.Simulated.hasAttribute(element, attribute);
};

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName);
    var proto = element['__proto__'] || element.constructor.prototype;
    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = [Element.Storage.UID++];
      uid = element._prototypeUID[0];
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  }
});
/* Portions of the Selector class are derived from Jack Slocum's DomQuery,
 * part of YUI-Ext version 0.40, distributed under the terms of an MIT-style
 * license.  Please see http://www.yui-ext.com/ for more information. */

var Selector = Class.create({
  initialize: function(expression) {
    this.expression = expression.strip();

    if (this.shouldUseSelectorsAPI()) {
      this.mode = 'selectorsAPI';
    } else if (this.shouldUseXPath()) {
      this.mode = 'xpath';
      this.compileXPathMatcher();
    } else {
      this.mode = "normal";
      this.compileMatcher();
    }

  },

  shouldUseXPath: (function() {

    var IS_DESCENDANT_SELECTOR_BUGGY = (function(){
      var isBuggy = false;
      if (document.evaluate && window.XPathResult) {
        var el = document.createElement('div');
        el.innerHTML = '<ul><li></li></ul><div><ul><li></li></ul></div>';

        var xpath = ".//*[local-name()='ul' or local-name()='UL']" +
          "//*[local-name()='li' or local-name()='LI']";

        var result = document.evaluate(xpath, el, null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        isBuggy = (result.snapshotLength !== 2);
        el = null;
      }
      return isBuggy;
    })();

    return function() {
      if (!Prototype.BrowserFeatures.XPath) return false;

      var e = this.expression;

      if (Prototype.Browser.WebKit &&
       (e.include("-of-type") || e.include(":empty")))
        return false;

      if ((/(\[[\w-]*?:|:checked)/).test(e))
        return false;

      if (IS_DESCENDANT_SELECTOR_BUGGY) return false;

      return true;
    }

  })(),

  shouldUseSelectorsAPI: function() {
    if (!Prototype.BrowserFeatures.SelectorsAPI) return false;

    if (Selector.CASE_INSENSITIVE_CLASS_NAMES) return false;

    if (!Selector._div) Selector._div = new Element('div');

    try {
      Selector._div.querySelector(this.expression);
    } catch(e) {
      return false;
    }

    return true;
  },

  compileMatcher: function() {
    var e = this.expression, ps = Selector.patterns, h = Selector.handlers,
        c = Selector.criteria, le, p, m, len = ps.length, name;

    if (Selector._cache[e]) {
      this.matcher = Selector._cache[e];
      return;
    }

    this.matcher = ["this.matcher = function(root) {",
                    "var r = root, h = Selector.handlers, c = false, n;"];

    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i = 0; i<len; i++) {
        p = ps[i].re;
        name = ps[i].name;
        if (m = e.match(p)) {
          this.matcher.push(Object.isFunction(c[name]) ? c[name](m) :
            new Template(c[name]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.matcher.push("return h.unique(n);\n}");
    eval(this.matcher.join('\n'));
    Selector._cache[this.expression] = this.matcher;
  },

  compileXPathMatcher: function() {
    var e = this.expression, ps = Selector.patterns,
        x = Selector.xpath, le, m, len = ps.length, name;

    if (Selector._cache[e]) {
      this.xpath = Selector._cache[e]; return;
    }

    this.matcher = ['.//*'];
    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i = 0; i<len; i++) {
        name = ps[i].name;
        if (m = e.match(ps[i].re)) {
          this.matcher.push(Object.isFunction(x[name]) ? x[name](m) :
            new Template(x[name]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.xpath = this.matcher.join('');
    Selector._cache[this.expression] = this.xpath;
  },

  findElements: function(root) {
    root = root || document;
    var e = this.expression, results;

    switch (this.mode) {
      case 'selectorsAPI':
        if (root !== document) {
          var oldId = root.id, id = $(root).identify();
          id = id.replace(/([\.:])/g, "\\$1");
          e = "#" + id + " " + e;
        }

        results = $A(root.querySelectorAll(e)).map(Element.extend);
        root.id = oldId;

        return results;
      case 'xpath':
        return document._getElementsByXPath(this.xpath, root);
      default:
       return this.matcher(root);
    }
  },

  match: function(element) {
    this.tokens = [];

    var e = this.expression, ps = Selector.patterns, as = Selector.assertions;
    var le, p, m, len = ps.length, name;

    while (e && le !== e && (/\S/).test(e)) {
      le = e;
      for (var i = 0; i<len; i++) {
        p = ps[i].re;
        name = ps[i].name;
        if (m = e.match(p)) {
          if (as[name]) {
            this.tokens.push([name, Object.clone(m)]);
            e = e.replace(m[0], '');
          } else {
            return this.findElements(document).include(element);
          }
        }
      }
    }

    var match = true, name, matches;
    for (var i = 0, token; token = this.tokens[i]; i++) {
      name = token[0], matches = token[1];
      if (!Selector.assertions[name](element, matches)) {
        match = false; break;
      }
    }

    return match;
  },

  toString: function() {
    return this.expression;
  },

  inspect: function() {
    return "#<Selector:" + this.expression.inspect() + ">";
  }
});

if (Prototype.BrowserFeatures.SelectorsAPI &&
 document.compatMode === 'BackCompat') {
  Selector.CASE_INSENSITIVE_CLASS_NAMES = (function(){
    var div = document.createElement('div'),
     span = document.createElement('span');

    div.id = "prototype_test_id";
    span.className = 'Test';
    div.appendChild(span);
    var isIgnored = (div.querySelector('#prototype_test_id .test') !== null);
    div = span = null;
    return isIgnored;
  })();
}

Object.extend(Selector, {
  _cache: { },

  xpath: {
    descendant:   "//*",
    child:        "/*",
    adjacent:     "/following-sibling::*[1]",
    laterSibling: '/following-sibling::*',
    tagName:      function(m) {
      if (m[1] == '*') return '';
      return "[local-name()='" + m[1].toLowerCase() +
             "' or local-name()='" + m[1].toUpperCase() + "']";
    },
    className:    "[contains(concat(' ', @class, ' '), ' #{1} ')]",
    id:           "[@id='#{1}']",
    attrPresence: function(m) {
      m[1] = m[1].toLowerCase();
      return new Template("[@#{1}]").evaluate(m);
    },
    attr: function(m) {
      m[1] = m[1].toLowerCase();
      m[3] = m[5] || m[6];
      return new Template(Selector.xpath.operators[m[2]]).evaluate(m);
    },
    pseudo: function(m) {
      var h = Selector.xpath.pseudos[m[1]];
      if (!h) return '';
      if (Object.isFunction(h)) return h(m);
      return new Template(Selector.xpath.pseudos[m[1]]).evaluate(m);
    },
    operators: {
      '=':  "[@#{1}='#{3}']",
      '!=': "[@#{1}!='#{3}']",
      '^=': "[starts-with(@#{1}, '#{3}')]",
      '$=': "[substring(@#{1}, (string-length(@#{1}) - string-length('#{3}') + 1))='#{3}']",
      '*=': "[contains(@#{1}, '#{3}')]",
      '~=': "[contains(concat(' ', @#{1}, ' '), ' #{3} ')]",
      '|=': "[contains(concat('-', @#{1}, '-'), '-#{3}-')]"
    },
    pseudos: {
      'first-child': '[not(preceding-sibling::*)]',
      'last-child':  '[not(following-sibling::*)]',
      'only-child':  '[not(preceding-sibling::* or following-sibling::*)]',
      'empty':       "[count(*) = 0 and (count(text()) = 0)]",
      'checked':     "[@checked]",
      'disabled':    "[(@disabled) and (@type!='hidden')]",
      'enabled':     "[not(@disabled) and (@type!='hidden')]",
      'not': function(m) {
        var e = m[6], p = Selector.patterns,
            x = Selector.xpath, le, v, len = p.length, name;

        var exclusion = [];
        while (e && le != e && (/\S/).test(e)) {
          le = e;
          for (var i = 0; i<len; i++) {
            name = p[i].name
            if (m = e.match(p[i].re)) {
              v = Object.isFunction(x[name]) ? x[name](m) : new Template(x[name]).evaluate(m);
              exclusion.push("(" + v.substring(1, v.length - 1) + ")");
              e = e.replace(m[0], '');
              break;
            }
          }
        }
        return "[not(" + exclusion.join(" and ") + ")]";
      },
      'nth-child':      function(m) {
        return Selector.xpath.pseudos.nth("(count(./preceding-sibling::*) + 1) ", m);
      },
      'nth-last-child': function(m) {
        return Selector.xpath.pseudos.nth("(count(./following-sibling::*) + 1) ", m);
      },
      'nth-of-type':    function(m) {
        return Selector.xpath.pseudos.nth("position() ", m);
      },
      'nth-last-of-type': function(m) {
        return Selector.xpath.pseudos.nth("(last() + 1 - position()) ", m);
      },
      'first-of-type':  function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-of-type'](m);
      },
      'last-of-type':   function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-last-of-type'](m);
      },
      'only-of-type':   function(m) {
        var p = Selector.xpath.pseudos; return p['first-of-type'](m) + p['last-of-type'](m);
      },
      nth: function(fragment, m) {
        var mm, formula = m[6], predicate;
        if (formula == 'even') formula = '2n+0';
        if (formula == 'odd')  formula = '2n+1';
        if (mm = formula.match(/^(\d+)$/)) // digit only
          return '[' + fragment + "= " + mm[1] + ']';
        if (mm = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
          if (mm[1] == "-") mm[1] = -1;
          var a = mm[1] ? Number(mm[1]) : 1;
          var b = mm[2] ? Number(mm[2]) : 0;
          predicate = "[((#{fragment} - #{b}) mod #{a} = 0) and " +
          "((#{fragment} - #{b}) div #{a} >= 0)]";
          return new Template(predicate).evaluate({
            fragment: fragment, a: a, b: b });
        }
      }
    }
  },

  criteria: {
    tagName:      'n = h.tagName(n, r, "#{1}", c);      c = false;',
    className:    'n = h.className(n, r, "#{1}", c);    c = false;',
    id:           'n = h.id(n, r, "#{1}", c);           c = false;',
    attrPresence: 'n = h.attrPresence(n, r, "#{1}", c); c = false;',
    attr: function(m) {
      m[3] = (m[5] || m[6]);
      return new Template('n = h.attr(n, r, "#{1}", "#{3}", "#{2}", c); c = false;').evaluate(m);
    },
    pseudo: function(m) {
      if (m[6]) m[6] = m[6].replace(/"/g, '\\"');
      return new Template('n = h.pseudo(n, "#{1}", "#{6}", r, c); c = false;').evaluate(m);
    },
    descendant:   'c = "descendant";',
    child:        'c = "child";',
    adjacent:     'c = "adjacent";',
    laterSibling: 'c = "laterSibling";'
  },

  patterns: [
    { name: 'laterSibling', re: /^\s*~\s*/ },
    { name: 'child',        re: /^\s*>\s*/ },
    { name: 'adjacent',     re: /^\s*\+\s*/ },
    { name: 'descendant',   re: /^\s/ },

    { name: 'tagName',      re: /^\s*(\*|[\w\-]+)(\b|$)?/ },
    { name: 'id',           re: /^#([\w\-\*]+)(\b|$)/ },
    { name: 'className',    re: /^\.([\w\-\*]+)(\b|$)/ },
    { name: 'pseudo',       re: /^:((first|last|nth|nth-last|only)(-child|-of-type)|empty|checked|(en|dis)abled|not)(\((.*?)\))?(\b|$|(?=\s|[:+~>]))/ },
    { name: 'attrPresence', re: /^\[((?:[\w-]+:)?[\w-]+)\]/ },
    { name: 'attr',         re: /\[((?:[\w-]*:)?[\w-]+)\s*(?:([!^$*~|]?=)\s*((['"])([^\4]*?)\4|([^'"][^\]]*?)))?\]/ }
  ],

  assertions: {
    tagName: function(element, matches) {
      return matches[1].toUpperCase() == element.tagName.toUpperCase();
    },

    className: function(element, matches) {
      return Element.hasClassName(element, matches[1]);
    },

    id: function(element, matches) {
      return element.id === matches[1];
    },

    attrPresence: function(element, matches) {
      return Element.hasAttribute(element, matches[1]);
    },

    attr: function(element, matches) {
      var nodeValue = Element.readAttribute(element, matches[1]);
      return nodeValue && Selector.operators[matches[2]](nodeValue, matches[5] || matches[6]);
    }
  },

  handlers: {
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        a.push(node);
      return a;
    },

    mark: function(nodes) {
      var _true = Prototype.emptyFunction;
      for (var i = 0, node; node = nodes[i]; i++)
        node._countedByPrototype = _true;
      return nodes;
    },

    unmark: (function(){

      var PROPERTIES_ATTRIBUTES_MAP = (function(){
        var el = document.createElement('div'),
            isBuggy = false,
            propName = '_countedByPrototype',
            value = 'x'
        el[propName] = value;
        isBuggy = (el.getAttribute(propName) === value);
        el = null;
        return isBuggy;
      })();

      return PROPERTIES_ATTRIBUTES_MAP ?
        function(nodes) {
          for (var i = 0, node; node = nodes[i]; i++)
            node.removeAttribute('_countedByPrototype');
          return nodes;
        } :
        function(nodes) {
          for (var i = 0, node; node = nodes[i]; i++)
            node._countedByPrototype = void 0;
          return nodes;
        }
    })(),

    index: function(parentNode, reverse, ofType) {
      parentNode._countedByPrototype = Prototype.emptyFunction;
      if (reverse) {
        for (var nodes = parentNode.childNodes, i = nodes.length - 1, j = 1; i >= 0; i--) {
          var node = nodes[i];
          if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
        }
      } else {
        for (var i = 0, j = 1, nodes = parentNode.childNodes; node = nodes[i]; i++)
          if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
      }
    },

    unique: function(nodes) {
      if (nodes.length == 0) return nodes;
      var results = [], n;
      for (var i = 0, l = nodes.length; i < l; i++)
        if (typeof (n = nodes[i])._countedByPrototype == 'undefined') {
          n._countedByPrototype = Prototype.emptyFunction;
          results.push(Element.extend(n));
        }
      return Selector.handlers.unmark(results);
    },

    descendant: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, node.getElementsByTagName('*'));
      return results;
    },

    child: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        for (var j = 0, child; child = node.childNodes[j]; j++)
          if (child.nodeType == 1 && child.tagName != '!') results.push(child);
      }
      return results;
    },

    adjacent: function(nodes) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        var next = this.nextElementSibling(node);
        if (next) results.push(next);
      }
      return results;
    },

    laterSibling: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, Element.nextSiblings(node));
      return results;
    },

    nextElementSibling: function(node) {
      while (node = node.nextSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    previousElementSibling: function(node) {
      while (node = node.previousSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    tagName: function(nodes, root, tagName, combinator) {
      var uTagName = tagName.toUpperCase();
      var results = [], h = Selector.handlers;
      if (nodes) {
        if (combinator) {
          if (combinator == "descendant") {
            for (var i = 0, node; node = nodes[i]; i++)
              h.concat(results, node.getElementsByTagName(tagName));
            return results;
          } else nodes = this[combinator](nodes);
          if (tagName == "*") return nodes;
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName.toUpperCase() === uTagName) results.push(node);
        return results;
      } else return root.getElementsByTagName(tagName);
    },

    id: function(nodes, root, id, combinator) {
      var targetNode = $(id), h = Selector.handlers;

      if (root == document) {
        if (!targetNode) return [];
        if (!nodes) return [targetNode];
      } else {
        if (!root.sourceIndex || root.sourceIndex < 1) {
          var nodes = root.getElementsByTagName('*');
          for (var j = 0, node; node = nodes[j]; j++) {
            if (node.id === id) return [node];
          }
        }
      }

      if (nodes) {
        if (combinator) {
          if (combinator == 'child') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (targetNode.parentNode == node) return [targetNode];
          } else if (combinator == 'descendant') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Element.descendantOf(targetNode, node)) return [targetNode];
          } else if (combinator == 'adjacent') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Selector.handlers.previousElementSibling(targetNode) == node)
                return [targetNode];
          } else nodes = h[combinator](nodes);
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node == targetNode) return [targetNode];
        return [];
      }
      return (targetNode && Element.descendantOf(targetNode, root)) ? [targetNode] : [];
    },

    className: function(nodes, root, className, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      return Selector.handlers.byClassName(nodes, root, className);
    },

    byClassName: function(nodes, root, className) {
      if (!nodes) nodes = Selector.handlers.descendant([root]);
      var needle = ' ' + className + ' ';
      for (var i = 0, results = [], node, nodeClassName; node = nodes[i]; i++) {
        nodeClassName = node.className;
        if (nodeClassName.length == 0) continue;
        if (nodeClassName == className || (' ' + nodeClassName + ' ').include(needle))
          results.push(node);
      }
      return results;
    },

    attrPresence: function(nodes, root, attr, combinator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      if (nodes && combinator) nodes = this[combinator](nodes);
      var results = [];
      for (var i = 0, node; node = nodes[i]; i++)
        if (Element.hasAttribute(node, attr)) results.push(node);
      return results;
    },

    attr: function(nodes, root, attr, value, operator, combinator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      if (nodes && combinator) nodes = this[combinator](nodes);
      var handler = Selector.operators[operator], results = [];
      for (var i = 0, node; node = nodes[i]; i++) {
        var nodeValue = Element.readAttribute(node, attr);
        if (nodeValue === null) continue;
        if (handler(nodeValue, value)) results.push(node);
      }
      return results;
    },

    pseudo: function(nodes, name, value, root, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      if (!nodes) nodes = root.getElementsByTagName("*");
      return Selector.pseudos[name](nodes, value, root);
    }
  },

  pseudos: {
    'first-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.previousElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'last-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.nextElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'only-child': function(nodes, value, root) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!h.previousElementSibling(node) && !h.nextElementSibling(node))
          results.push(node);
      return results;
    },
    'nth-child':        function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root);
    },
    'nth-last-child':   function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true);
    },
    'nth-of-type':      function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, false, true);
    },
    'nth-last-of-type': function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true, true);
    },
    'first-of-type':    function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, false, true);
    },
    'last-of-type':     function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, true, true);
    },
    'only-of-type':     function(nodes, formula, root) {
      var p = Selector.pseudos;
      return p['last-of-type'](p['first-of-type'](nodes, formula, root), formula, root);
    },

    getIndices: function(a, b, total) {
      if (a == 0) return b > 0 ? [b] : [];
      return $R(1, total).inject([], function(memo, i) {
        if (0 == (i - b) % a && (i - b) / a >= 0) memo.push(i);
        return memo;
      });
    },

    nth: function(nodes, formula, root, reverse, ofType) {
      if (nodes.length == 0) return [];
      if (formula == 'even') formula = '2n+0';
      if (formula == 'odd')  formula = '2n+1';
      var h = Selector.handlers, results = [], indexed = [], m;
      h.mark(nodes);
      for (var i = 0, node; node = nodes[i]; i++) {
        if (!node.parentNode._countedByPrototype) {
          h.index(node.parentNode, reverse, ofType);
          indexed.push(node.parentNode);
        }
      }
      if (formula.match(/^\d+$/)) { // just a number
        formula = Number(formula);
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.nodeIndex == formula) results.push(node);
      } else if (m = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
        if (m[1] == "-") m[1] = -1;
        var a = m[1] ? Number(m[1]) : 1;
        var b = m[2] ? Number(m[2]) : 0;
        var indices = Selector.pseudos.getIndices(a, b, nodes.length);
        for (var i = 0, node, l = indices.length; node = nodes[i]; i++) {
          for (var j = 0; j < l; j++)
            if (node.nodeIndex == indices[j]) results.push(node);
        }
      }
      h.unmark(nodes);
      h.unmark(indexed);
      return results;
    },

    'empty': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (node.tagName == '!' || node.firstChild) continue;
        results.push(node);
      }
      return results;
    },

    'not': function(nodes, selector, root) {
      var h = Selector.handlers, selectorType, m;
      var exclusions = new Selector(selector).findElements(root);
      h.mark(exclusions);
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node._countedByPrototype) results.push(node);
      h.unmark(exclusions);
      return results;
    },

    'enabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node.disabled && (!node.type || node.type !== 'hidden'))
          results.push(node);
      return results;
    },

    'disabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.disabled) results.push(node);
      return results;
    },

    'checked': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.checked) results.push(node);
      return results;
    }
  },

  operators: {
    '=':  function(nv, v) { return nv == v; },
    '!=': function(nv, v) { return nv != v; },
    '^=': function(nv, v) { return nv == v || nv && nv.startsWith(v); },
    '$=': function(nv, v) { return nv == v || nv && nv.endsWith(v); },
    '*=': function(nv, v) { return nv == v || nv && nv.include(v); },
    '~=': function(nv, v) { return (' ' + nv + ' ').include(' ' + v + ' '); },
    '|=': function(nv, v) { return ('-' + (nv || "").toUpperCase() +
     '-').include('-' + (v || "").toUpperCase() + '-'); }
  },

  split: function(expression) {
    var expressions = [];
    expression.scan(/(([\w#:.~>+()\s-]+|\*|\[.*?\])+)\s*(,|$)/, function(m) {
      expressions.push(m[1].strip());
    });
    return expressions;
  },

  matchElements: function(elements, expression) {
    var matches = $$(expression), h = Selector.handlers;
    h.mark(matches);
    for (var i = 0, results = [], element; element = elements[i]; i++)
      if (element._countedByPrototype) results.push(element);
    h.unmark(matches);
    return results;
  },

  findElement: function(elements, expression, index) {
    if (Object.isNumber(expression)) {
      index = expression; expression = false;
    }
    return Selector.matchElements(elements, expression || '*')[index || 0];
  },

  findChildElements: function(element, expressions) {
    expressions = Selector.split(expressions.join(','));
    var results = [], h = Selector.handlers;
    for (var i = 0, l = expressions.length, selector; i < l; i++) {
      selector = new Selector(expressions[i].strip());
      h.concat(results, selector.findElements(element));
    }
    return (l > 1) ? h.unique(results) : results;
  }
});

if (Prototype.Browser.IE) {
  Object.extend(Selector.handlers, {
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        if (node.tagName !== "!") a.push(node);
      return a;
    }
  });
}

function $$() {
  return Selector.findChildElements(document, $A(arguments));
}

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit;

    var data = elements.inject({ }, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          if (key in result) {
            if (!Object.isArray(result[key])) result[key] = [result[key]];
            result[key].push(value);
          }
          else result[key] = value;
        }
      }
      return result;
    });

    return options.hash ? data : Object.toQueryString(data);
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    form.findFirstElement().activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = {
  input: function(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return Form.Element.Serializers.inputSelector(element, value);
      default:
        return Form.Element.Serializers.textarea(element, value);
    }
  },

  inputSelector: function(element, value) {
    if (Object.isUndefined(value)) return element.checked ? element.value : null;
    else element.checked = !!value;
  },

  textarea: function(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  },

  select: function(element, value) {
    if (Object.isUndefined(value))
      return this[element.type == 'select-one' ?
        'selectOne' : 'selectMany'](element);
    else {
      var opt, currentValue, single = !Object.isArray(value);
      for (var i = 0, length = element.length; i < length; i++) {
        opt = element.options[i];
        currentValue = this.optionValue(opt);
        if (single) {
          if (currentValue == value) {
            opt.selected = true;
            return;
          }
        }
        else opt.selected = value.include(currentValue);
      }
    }
  },

  selectOne: function(element) {
    var index = element.selectedIndex;
    return index >= 0 ? this.optionValue(element.options[index]) : null;
  },

  selectMany: function(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(this.optionValue(opt));
    }
    return values;
  },

  optionValue: function(opt) {
    return Element.extend(opt).hasAttribute('value') ? opt.value : opt.text;
  }
};

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;

  var _isButton;
  if (Prototype.Browser.IE) {
    var buttonMap = { 0: 1, 1: 4, 2: 2 };
    _isButton = function(event, code) {
      return event.button === buttonMap[code];
    };
  } else if (Prototype.Browser.WebKit) {
    _isButton = function(event, code) {
      switch (code) {
        case 0: return event.which == 1 && !event.metaKey;
        case 1: return event.which == 1 && event.metaKey;
        default: return false;
      }
    };
  } else {
    _isButton = function(event, code) {
      return event.which ? (event.which === code + 1) : (event.button === code);
    };
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);
    if (!expression) return element;
    var elements = [element].concat(element.ancestors());
    return Selector.findElement(elements, expression, 0);
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }

  Event.Methods = {
    isLeftClick: isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick: isRightClick,

    element: element,
    findElement: findElement,

    pointer: pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };


  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (Prototype.Browser.IE) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover': element = event.fromElement; break;
        case 'mouseout':  element = event.toElement;   break;
        default: return null;
      }
      return Element.extend(element);
    }

    Object.extend(methods, {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    });

    Event.extend = function(event, element) {
      if (!event) return false;
      if (event._extendedByPrototype) return event;

      event._extendedByPrototype = Prototype.emptyFunction;
      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      return Object.extend(event, methods);
    };
  } else {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
    Event.extend = Prototype.K;
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        responder = function(event) {
          Event.extend(event, element);
          handler.call(element, event);
        };
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K;

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      var translations = { mouseenter: "mouseover", mouseleave: "mouseout" };
      return eventName in translations ? translations[eventName] : eventName;
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onfilterchange", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) return element;

    if (eventName && !handler) {
      var responders = registry.get(eventName);

      if (Object.isUndefined(responders)) return element;

      responders.each( function(r) {
        Element.stopObserving(element, eventName, r.handler);
      });
      return element;
    } else if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key, responders = pair.value;

        responders.each( function(r) {
          Element.stopObserving(element, eventName, r.handler);
        });
      });
      return element;
    }

    var responders = registry.get(eventName);

    if (!responders) return;

    var responder = responders.find( function(r) { return r.handler === handler; });
    if (!responder) return element;

    var actualEventName = _getDOMEventName(eventName);

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onfilterchange",  responder);
      }
    } else {
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', true, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onfilterchange';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }


  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/


// Copyright (c) 2005-2008 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
// Contributors:
//  Justin Palmer (http://encytemedia.com/)
//  Mark Pilgrim (http://diveintomark.org/)
//  Martin Bialasinki
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// converts rgb() and #xxx to #xxxxxx format,
// returns self (or first argument) if not convertable
String.prototype.parseColor = function() {
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {
    var cols = this.slice(4,this.length-1).split(',');
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);
  } else {
    if (this.slice(0,1) == '#') {
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();
      if (this.length==7) color = this.toLowerCase();
    }
  }
  return (color.length==7 ? color : (arguments[0] || this));
};

/*--------------------------------------------------------------------------*/

Element.collectTextNodes = function(element) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ?
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);
  element.setStyle({fontSize: (percent/100) + 'em'});
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

/*--------------------------------------------------------------------------*/

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + .5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + .75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + .5;
    },
    pulse: function(pos, pulses) {
      return (-Math.cos((pos*((pulses||5)-.5)*2)*Math.PI)/2) + .5;
    },
    spring: function(pos) {
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6));
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';

    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character),
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') ||
        Object.isFunction(element)) &&
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;

    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect) {
    element = $(element);
    effect = (effect || 'appear').toLowerCase();
    var options = Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, arguments[2] || { });
    Effect[element.visible() ?
      Effect.PAIRS[effect][1] : Effect.PAIRS[effect][0]](element, options);
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

/* ------------- core effects ------------- */

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();

    var position = Object.isString(effect.options.queue) ?
      effect.options.queue : effect.options.queue.position;

    switch(position) {
      case 'front':
        // move unstarted effects after this effect
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        // start effect after last queued effect has finished
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }

    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);

    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++)
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;

    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    function codeForEvent(options,eventName){
      return (
        (options[eventName+'Internal'] ? 'this.options.'+eventName+'Internal(this);' : '') +
        (options[eventName] ? 'this.options.'+eventName+'(this);' : '')
      );
    }
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;

    this.render = (function() {
      function dispatch(effect, eventName) {
        if (effect.options[eventName + 'Internal'])
          effect.options[eventName + 'Internal'](effect);
        if (effect.options[eventName])
          effect.options[eventName](effect);
      }

      return function(pos) {
        if (this.state === "idle") {
          this.state = "running";
          dispatch(this, 'beforeSetup');
          if (this.setup) this.setup();
          dispatch(this, 'afterSetup');
        }
        if (this.state === "running") {
          pos = (this.options.transition(pos) * this.fromToDelta) + this.options.from;
          this.position = pos;
          dispatch(this, 'beforeUpdate');
          if (this.update) this.update(pos);
          dispatch(this, 'afterUpdate');
        }
      };
    })();

    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish();
        this.event('afterFinish');
        return;
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(),
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) :
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    // make this work on IE on elements without 'layout'
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

// for backwards compatibility
Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element,
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');

    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));

    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;

    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));

    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;

    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    // Prevent executing on elements not in the layout flow
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    // Disable background image during the effect
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    // init color calculations
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
  scrollOffsets = document.viewport.getScrollOffsets(),
  elementOffsets = $(element).cumulativeOffset();

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()); }
  );
};

/* ------------- combination effects ------------- */

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) {
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity});
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  // force Safari to render floated elements properly
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show();
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = {
    opacity: element.getInlineOpacity(),
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200,
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }),
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ],
     Object.extend({ duration: 1.0,
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element);
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false,
      scaleX: false,
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      }
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, {
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) {
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      });
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }),
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned();
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        }
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}); }}); }}); }}); }}); }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  // SlideDown need to have the content of the element wrapped in a container element with fixed height!
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false,
    scaleX: false,
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

// Bug in opera makes the TD containing this element expand for a instance after finish
Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, {
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping();
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping();
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var initialMoveX, initialMoveY;
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0;
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }

  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01,
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width },
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show();
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle);
             }
           }, options)
      );
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }

  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping();
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { },
    oldOpacity = element.getInlineOpacity(),
    transition = options.transition || Effect.Transitions.linear,
    reverser   = function(pos){
      return 1 - transition((-Math.cos((pos*(options.pulses||5)*2)*Math.PI)/2) + .5);
    };

  return new Effect.Opacity(element,
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, {
      scaleContent: false,
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });

    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        };
      }
    }
    this.start(options);
  },

  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 );
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return {
        style: property.camelize(),
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0),
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      );
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] =
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) +
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' +
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');

Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }

  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]);
  });

  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(results, property) {
      results[property] = css[property];
      return results;
    });
    if (!styles.opacity) styles.opacity = element.getOpacity();
    return styles;
  };
}

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element);
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) {
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    };
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each(
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);

// Place your application-specific JavaScript functions and classes here
// This file is automatically included by javascript_include_tag :defaults

// for those w/o console...  sad.
if (typeof(console) == 'undefined') {
  var Console = Class.create({
    initialize: function() {
      this._logs = [];
      this._timers = {};
      var host = window.location.host;
      if (host.match(/localhost|\.local|10\.0\.2\.2/))
        document.observe('keydown', this.dumpLog.bindAsEventListener(this));
    },

    dumpLog: function(e) {
      // ctrl-` dumps the log in an alert
      if (e.ctrlKey && e.keyCode == 192) {
        alert(this._logs.join("\n"));
        this._logs = [];
      }
    },

    log: function(obj) {
      this._logs.push(obj);
    },

    warn: function(obj) {
      this.log(obj);
    },

    time: function(name) {
      this._timers[name] = new Date();
    },

    timeEnd: function(name) {
      var ms = new Date() - this._timers[name];
      this.log(name + ': ' + ms + 'ms');

      this._timers[name] = null;
    }
  });

  console = new Console();
}

// Setup scriptaculous defaults
if (typeof(Effect) != "undefined" && Effect.DefaultOptions) {
  // speed up animations
  Effect.DefaultOptions.duration = 0.2;
}

// strftime from http://redhanded.hobix.com/inspect/showingPerfectTime.html
/* other support functions -- thanks, ecmanaut! */
(function() {
  var strftime_funks = {
    local: false,
    quarter: function( m, q ){ return q + (Math.floor(m/3) + 1); },
    zeropad: function( n, nz ){ return (nz || n>9) ? n : '0'+n; },
    a: function(t)    { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][(this.local ? t.getDay() : t.getUTCDay())]; },
    A: function(t)    { return ['Sunday','Monday','Tuedsay','Wednesday','Thursday','Friday','Saturday'][(this.local ? t.getDay() : t.getUTCDay())]; },
    b: function(t)    { return ['Jan','Feb','Mar','Apr','May','Jun', 'Jul','Aug','Sep','Oct','Nov','Dec'][(this.local ? t.getMonth() : t.getUTCMonth())]; },
    B: function(t)    { return ['January','February','March','April','May','June', 'July','August',
        'September','October','November','December'][(this.local ? t.getMonth() : t.getUTCMonth())]; },
    c: function(t)    { return t.toString(); },
    d: function(t,nz) { return this.zeropad((this.local ? t.getDate() : t.getUTCDate()), nz); },
    e: function(t)    { return (this.local ? t.getDate() : t.getUTCDate()); },
    H: function(t,nz) { return this.zeropad((this.local ? t.getHours() : t.getUTCHours()), nz); },
    I: function(t,nz) { return this.zeropad(this.l(t), nz); },
    l: function(t)    { return 12 - (24 - (this.local ? t.getHours() : t.getUTCHours())) % 12; },
    m: function(t,nz) { return this.zeropad((this.local ? t.getMonth() : t.getUTCMonth())+1, nz); }, // month-1
    M: function(t,nz) { return this.zeropad((this.local ? t.getMinutes() : t.getUTCMinutes()), nz); },
    p: function(t)    { return this.H(t) < 12 ? 'AM' : 'PM'; },
    P: function(t)    { return this.H(t) < 12 ? 'am' : 'pm'; },
    q: function(t)    { return this.quarter((this.local ? t.getMonth() : t.getUTCMonth()), "Q"); },
    Q: function(t)    { return this.quarter((this.local ? t.getMonth() : t.getUTCMonth()), "Quarter "); },
    S: function(t,nz) { return this.zeropad((this.local ? t.getSeconds() : t.getUTCSeconds()), nz); },
    w: function(t)    { return (this.local ? t.getDay() : t.getUTCDay()); }, // 0..6 == sun..sat
    y: function(t,nz) { return this.zeropad(this.Y(t) % 100, nz); },
    Y: function(t)    { return (this.local ? t.getFullYear() : t.getUTCFullYear()); },
    '%': function(t)  { return '%'; }
  };

  // standardize the times that timeplot uses
  Object.extend(Date.prototype, {
    strftime: function(fmt, local) {
      var t = this;
      for (var s in strftime_funks) {
        strftime_funks.local = local;
          if (s.length == 1 ) {
            fmt = fmt.replace('%' + s, strftime_funks[s](t));
            fmt = fmt.replace('%-1' + s, strftime_funks[s](t, true));
          }
      }
      return fmt;
    },

    toLocaleTimeString: function() {
      return this.strftime('%l:%M%p');
    },

    toLocaleDateString: function() {
      return this.strftime('%b %e, %Y');
    }

  });

  Object.extend(String.prototype, {
    toDate: function() {
      try {
        var dateTime = this.gsub(/[TZ]/, ' ').split(/ /);
        var date = dateTime[0].split('-');
        return (new Date(date[1]+'/'+date[2]+'/'+date[0]+' '+dateTime[1]));
      } catch(e) {
        return(false);
      }
    }
  });

  Date.prototype.toLocaleString = function(separator) {
    if (!this.localeString) {
      this.localeString = this.toLocaleDateString()
      if (this.getHours() != 0 || this.getMinutes() != 0) {
        separator = separator || ' ';
        this.localeString += separator + this.toLocaleTimeString();
      }
    }

    return this.localeString;
  };
})();

// a wonky binary search (wonky = it could use some generalizing)
Object.extend(Array.prototype, {
  bsearch: function(x, attr) {
    var lo = 0, hi = this.length;
    while (lo < hi) { // binary search
      var mid = Math.floor((lo + hi) / 2), val = this[mid][attr];
      if (x < val)
        lo = mid + 1;
      else
        hi = mid;
    }

    if (!this[lo] || this[lo-1] &&
      x - this[lo][attr] > this[lo-1][attr] - x)
      lo--;

    return lo;
  }
});
// another wonky binary search that returns the index of the closest value
Object.extend(Array.prototype, {
  findClosest : function(value){
    var high = this.length, low = -1, m;
    while (high - low > 1) {
      m = high + low >> 1;
      if (this[m] < value) {
        low = m;
      }
      else {
        high = m;
      }
    }
    if ((high == this.length) || ((this[high] != value) && (Math.abs(value - this[high]) >= Math.abs(value - this[high-1])))) {
      high--;
    }
    return(high);
 }
});

// a helper function to create more dynamic object literals
// $h('key'+i, value) => { key1: value }
var $h = function() {
  var constructor = function() {
    var k = null, args = arguments[0];
    for (var i = 0; i < args.length; i++) {
      if (k == null) {
        k = args[i];
      } else {
        this[k] = args[i];
        k = null;
      }
    }
  };

  return new constructor(arguments);
};

Hash.prototype.slice = function() {
  var newHash = $H();
  for (var i = 0; i < arguments.length; i++) {
    newHash.set(arguments[i], this.get(arguments[i]));
  }
  return newHash;
};

// allow for scrollwheel event capture
// http://andrewdupont.net/2207/11/07/pseudo-custom-events-in-prototype-16/
(function() {
  var wheel = function(event) {
    var deltaX, deltaY;

    // normalize the delta
    if('wheelDeltaY' in event) {        // WebKit
      deltaY = event.wheelDeltaY / 120;
    } else if (event.wheelDelta) {      // IE & Opera
      deltaY = event.wheelDelta / 120;
    } else if (event.detail) {          // Firefox (W3C)
      deltaY = -event.detail;
    }
    if (event.wheelDeltaX) {
      deltaX = event.wheelDeltaX / 120;
    } else if (event.axis && event.axis == event.HORIZONTAL_AXIS) {  // FF 3.5
      deltaX = -event.detail;
      deltaY = 0;
    }
    if (!deltaX && !deltaY) { return; }

    var el = Event.element(event);
    if(el && 'fire' in el) {
      var customEvent = Event.element(event).fire("mouse:wheel", {
        delta: {x: deltaX, y: deltaY},
        pointer: Event.pointer(event)
      });
      if (customEvent.stopped) { Event.stop(event); }
    }
  }
  document.observe("mousewheel",     wheel);
  document.observe("DOMMouseScroll", wheel);
})();


/*jslint browser: true, laxbreak: true */
var Swivel = {
  keyDown: function() {
    return Prototype.Browser.Gecko ? 'keypress' : 'keydown';
  },

  safeColor: function(color) {
    // already in #rrggbb format?
    if (!color || color.match(/[0-9a-f]{6}/i)) return color;
    // HACK: IE really dislikes rgba
    var m = color.toLowerCase().match(/^(rgba?|hsla?)\(([\s\.\-,%0-9]+)\)/);
    if(m){
      var c = m[2].split(/\s*,\s*/), l = c.length, t = m[1];
      if((t == "rgb" && l == 3) || (t == "rgba" && l == 4)){
        var r = c[0];
        if(r.charAt(r.length - 1) == "%"){
          // 3 rgb percentage values
          var a = c.map(function(x){
            return parseFloat(x) * 2.56;
          });
          if(l == 4){ a[3] = c[3]; }
          return this._colorFromArray(a);
        }
        return this._colorFromArray(c);
      }
      if((t == "hsl" && l == 3) || (t == "hsla" && l == 4)){
        // normalize hsl values
        var H = ((parseFloat(c[0]) % 360) + 360) % 360 / 360,
          S = parseFloat(c[1]) / 100,
          L = parseFloat(c[2]) / 100,
          // calculate rgb according to the algorithm
          // recommended by the CSS3 Color Module
          m2 = L <= 0.5 ? L * (S + 1) : L + S - L * S,
          m1 = 2 * L - m2,
          a = [this._hue2rgb(m1, m2, H + 1 / 3) * 256,
            this._hue2rgb(m1, m2, H) * 256, this._hue2rgb(m1, m2, H - 1 / 3) * 256, 1];
        if(l == 4){ a[3] = c[3]; }
        return this._colorFromArray(a);
      }
    }
    return null;  // dojo.Color
  },

  _colorFromArray: function(a) {
    // summary: returns a css color string in hexadecimal representation
    var arr = a.slice(0, 3).map(function(x){
      var s = parseInt(x).toString(16);
      return s.length < 2 ? "0" + s : s;
    });
    return "#" + arr.join("");  // String
  },

  // stolen from dojo for now
  _hue2rgb: function(m1, m2, h){
    if(h < 0){ ++h; }
    if(h > 1){ --h; }
    var h6 = 6 * h;
    if(h6 < 1){ return m1 + (m2 - m1) * h6; }
    if(2 * h < 1){ return m2; }
    if(3 * h < 2){ return m1 + (m2 - m1) * (2 / 3 - h) * 6; }
    return m1;
  },

  sanitizeAsDate: function(text, defaultValue) {
    var today = new Date();
    // could be 2008-04-20 or 2008 format
    text = String(text);
    text = text.replace(/-/g,'/');
    if (text.match(/^\d{4}$/)) text = text+"/01/01";
    if (text.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
      text = text.split('/');
      var year = text.last();
      if (year < (today.getYear() % 100) + 50)
        text[text.length-1] = Number(year) + 2000;
      else
        text[text.length-1] = Number(year) + 1900;
      text = text.join('/');
    }
    if (text.match(/^\d{1,2}\/\d{4}$/)) { // 04/2009
      var slash = text.indexOf('/');
      text = text.slice(0, slash) + '/1' + text.slice(slash);
    }
    if (!text.match(/\d{4}/)) text = text + " " + today.getFullYear();
    var number = Date.parse(text + " GMT"); // remove time zone-ness
    if (isNaN(number)) return defaultValue;
    return number;
  },

  splitFontString: function(font) {
    if (typeof(font) == 'string') {
      var split = font.split(' ', 5);
      font = { size: parseInt(split[3]), family: split[4] };
    }
    return font;
  },

  createFontString: function(hash) {
    var size = hash.size || 10;
    var family = hash.family || "verdana";
    return "normal normal normal " + size + "px " + family;
  },

  createSelect: function(name, options, selectAction) {
    var select = new Element('select', { name: name, id: name });
    options.each(function(args) {
      var option = null;
      if (Object.isArray(args)) {
        var attributes = { value: (typeof(args[1]) == 'object') ? Object.toJSON(args[1]) : args[1] };
        if (args.size() == 3)
          Object.extend(attributes, args[2]);
        option = new Element('option', attributes).update(args[0]);
      } else {
        option = new Element('option', { disabled: 'disabled' }).update('&nbsp;');
      }
      select.appendChild(option);
    });
    if (selectAction) select.onchange = selectAction.bind(select);
    return select;
  }
};

Swivel.CopyRangeList = Class.create({
  initialize: function() {
    this._ranges = [];
  },

  push: function(range) {
    this._ranges.push(range);
  },

  reset: function() {
    this._ranges.invoke('setNoCells');
  }

});

Swivel.copyRanges = new Swivel.CopyRangeList();

Event.observe(window, 'blur', function() {
  Swivel.copyRanges.reset();
  Swivel.clipboard = null;
});

Swivel.commentManagerList = {};

Swivel.CommentManager = Class.create({
  initialize: function(options) {
    this._assetType = options.assetType;
    this._assetId = options.assetId;
    this._commentOrder = options.commentOrder;
    this._personId = options.personId;
    this._domId = this._assetType + '_' + this._assetId;
    Swivel.commentManagerList[this._domId] = this;
    if (this._personId) {
      document.observe('dom:loaded', this._positionCommentBox.bindAsEventListener(this));
    }
  },

  rearrange: function(order) {
    if (order == this._commentOrder) { return; }

    this._commentOrder = order;
    this._updatePersonPreference(this._commentOrder);
    this._positionCommentBox();

    $$('#comments_' + this._domId + ' .comment').reverse().each(function(c) {
      $('comments_'+ this._domId).insert(c);
    }, this);

    $("asc_" + this._domId).toggleClassName('disabled');
    $("desc_" + this._domId).toggleClassName('disabled');
  },

  _positionCommentBox: function() {
    if (!this._personId) { return; }
    if (this._commentOrder == 'desc'){
      $('comments_header_' + this._domId).insert({after: $('new_comment_' + this._domId)});
      $('new_comment_' + this._domId).insert({before: $('add_a_note_' + this._domId)});
    } else {
      $('comments_' + this._domId).insert({after: $('new_comment_' + this._domId)});
      $('new_comment_' + this._domId).insert({after: $('add_a_note_' + this._domId)});
    }
  },

  _updatePersonPreference: function() {
    var url =  '/people/' + this._personId + '.json';
    var params = { "person[comment_order]": this._commentOrder };
    Object.extend(params, Swivel.AuthenticityToken);
    new Ajax.Request(url, {
      method: 'put',
      parameters: params
    });
  },

  showComments: function() {
    $('comment_section_' + this._domId).blindDown();
    $('show_comment_' + this._domId).hide();
    if ($$('#comments_' + this._domId +' .comment').size() == 0) {
      $('new_comment_' + this._domId).show();
      $('add_a_note_' + this._domId).hide();
    }
  },

  hideComments: function() {
    var size = $$('#comments_'+this._domId+' .comment').size();
    $('comment_section_' + this._domId).blindUp();
    $('show_comment_' + this._domId).innerHTML = size + " notes on this " + this._assetType;
    $('show_comment_' + this._domId).show();
    $('new_comment_'+ this._domId).hide();
  },

  toggleNewCommentForm: function() {
    new Effect.toggle('new_comment_' + this._domId, 'blind', {
      afterFinish: function() {
        if (this._commenOrder == 'asc') {
          new Effect.ScrollTo($$('#new_comment_' + this._domId + ' input[type=submit]').first());
        }
        $('comment_body_' + this._domId).activate();
      }.bind(this)
    });
    $('add_a_note_' + this._domId).hide();
  },

  insertNewComment: function(t) {
    var insert = 'top', position = 0;
    if (this._commentOrder == 'asc') {
      insert = 'bottom';
      position = -1;
    }
    var last = $$('#comments_' + this._domId + ' .comment').slice(position)[0];

    var next = (last && last.hasClassName('even')) ? 'odd' : 'even';

    $('comments_' + this._domId).insert($h(insert, t.responseText));

    this.cancelNewComment();
    var size = $$('#comments_' + this._domId + ' .comment').size();
    $('comment_count_'+ this._domId).update(size);
    // color it correctly
    if (next == 'odd') {
      last = $$('#comments_' + this._domId + ' .comment').slice(position)[0];
      last.removeClassName('even');
      last.addClassName('odd');
    }
  },

  cancelNewComment: function() {
    $('new_comment_' + this._domId).blindUp();
    $('new_comment_' + this._domId).reset();
    $('add_a_note_' + this._domId).show();
  },

  failNewComment: function(t) {
    new Swivel.NoticeDialog(t.responseText);
  }

});

Swivel.getCommentManager = function(id) { return (Swivel.commentManagerList[id]); }

Swivel.connect = function(src, srcMethod, dest, destMethod, options) {
  if (!src || !src[srcMethod]) return;

  options = options || {};
  var fn = src[srcMethod], observers = { before: [], after: [] };
  if (!fn._observers) {
    var replacement = function() {
      var before = observers.before, after = observers.after,
          i, d, method;
      // before
      for (i = 0; i < before.length; i++) {
        d = before[i];
        method = d.method;
        if (typeof(method) != 'function')
          method = d.obj[d.method];
        method.apply(d.obj, arguments);
      }

      // call the original function
      var r = fn.apply(src, arguments);

      // after
      for (i = 0; i < after.length; i++) {
        d = after[i];
        method = d.method;
        if (typeof(method) != 'function')
          method = d.obj[d.method];
        method.apply(d.obj, arguments);
      }

      return r;
    };
    replacement._observers = observers;

    src[srcMethod] = replacement;
  } else {
    observers = fn._observers;
  }

  var list = options.before ? observers.before : observers.after;
  return list.push({ obj: dest, method: destMethod });
};
Swivel.disconnect = function(src, srcMethod, handle) {
  var fn = src && src[srcMethod];
  if (fn && fn._observers) {
    [fn._observers.before, fn._observers.after].each(function(observers) {
      var i = observers.indexOf(handle);
      if (i != -1)
        observers.splice(i, 1);
    });
  }
};

Swivel.status = function(msg, options) {
  var s = $('status');

  if (options && options.loading)
    msg = '<img src="/images/icons/progress_sm.gif" class="progress" /> ' + msg;
  s.update(msg);

  if (!s.visible())
    s.appear();
};

Swivel.Undoable = Class.create({
  initialize: function(obj, initFn) {
    this._obj = obj;
    this._obj.undo = this._undo.bind(this);
    this._obj.redo = this._redo.bind(this);

    this._stack = new Swivel.Undoable.Stack();
    this._callbacks = [];

    if (initFn) { initFn(this); }
  },
  observe: function(method, fn) {
    Swivel.connect(this._obj, method, this, function() {
      var obj = this._obj, args = arguments;
      this._defaultRedo = function() { obj[method].apply(obj, args); };
      fn.apply(obj, args);
    }, {before: true});
  },
  undo: function(undo, options) {
    if (!this._isUndoing) {
      var action = Object.extend({
        undo: undo,
        redo: this._defaultRedo
      }, options);
      this._stack.push(action);
    }
  },
  callback: function(callback) {
    this._callbacks.push(callback);
  },

  // private
  _undo: function() {
    this._isUndoing = true;
    try {
      if (this._stack.canDown()) {
        this._stack.down().undo.apply(this._obj);
        this._callbacks.each(function(c) { c(); });
      }
    } finally {
      this._isUndoing = false;
    }
  },
  _redo: function() {
    this._isUndoing = true;
    try {
      if (this._stack.canUp()) {
        this._stack.up().redo.apply(this._obj);
        this._callbacks.each(function(c) { c(); });
      }
    } finally {
      this._isUndoing = false;
    }
  }
});

Swivel.Undoable.Stack = Class.create({
  initialize: function() {
    this._stack = [];
    this._index = -1;
  },

  push: function(obj) {
    this._stack = this._stack.slice(0, this._index+1);  // clear pending redos
    this._stack.push(obj);
    this._index++;
  },

  canDown: function() {
    return this._index >= 0;
  },
  down: function() {
    return this._stack[this._index--];
  },
  canUp: function() {
    return this._stack[this._index + 1];
  },
  up: function() {
    return this._stack[++this._index];
  }
});

Swivel.UndoManager = Class.create({
  initialize: function() {
    this._stack = new Swivel.Undoable.Stack();
  },
  addUndoable: function(undoable) {
    Swivel.connect(undoable, 'undo', this, function() {
      if (this._isUndoing) return;
      this._stack.push(undoable);
    });
  },

  undo: function() {
    if (!this._stack.canDown()) return;

    this._isUndoing = true;
    try { this._stack.down()._undo(); }
    finally { this._isUndoing = false; }
  },

  redo: function() {
    if (!this._stack.canUp()) return;

    this._isUndoing = true;
    try { this._stack.up()._redo(); }
    finally { this._isUndoing = false; }
  }
});


Swivel.Tabs = Class.create({
  initialize: function(div, options) {
    this.callbacks = { };

    document.observe('dom:loaded', (function() {
      this.container = $(div);
      this.panels = { };
      this.container.select('.content > div').each(function(p) {
        this.panels['#' + p.id] = p;
        p.addClassName(p.id);
        p.id = '';  // TODO: this is pretty iff-y, but prevents the browser from jumping.  use class names instead?
      }, this);

      this.tabs = this.container.select('ul.tabs a');
      this.tabs.each(function(a) {
        a.observe('click', this.activate.bind(this, a.hash));
      }, this);

      this.list = this.container.down('ul.tabs');
      if (options && options.cleanWhitespace)
        this.list.cleanWhitespace();
      if (this.list.getWidth() < this.list.scrollWidth)
        this.setupScrolling();
      var hash = window.location.hash;
      if (!this.panels[hash]) hash = this.tabs[0].hash;
      this.activate(hash);
    }).bind(this));
  },

  activate: function(hash) {
    // highlight the right tab
    this.tabs.each(function(a) {
      if (a.hash == hash)
        $(a.parentNode).addClassName('selected');
      else
        $(a.parentNode).removeClassName('selected');
    });

    // show the right panel
    $H(this.panels).values().invoke('hide');
    this.panels[hash].show();
    if ($('saving_progress'))
      $('saving_progress').setStyle({display : 'none'});

    // fire off any events
    // TODO: thread?
    if (this.callbacks[hash])
      this.callbacks[hash].call();
  },

  observe: function(id, callback) {
    this.callbacks['#' + id] = callback;
  },

  remove: function(id) {
    var tab = this.tabs.find(function(t) { return t.hash == '#' + id; });
    this.panels['#' + id].fade({afterFinish: (function() {
      $(tab.parentNode).remove();

      this.tabs = this.tabs.without(tab);
      this.activate(window.location.hash = this.tabs[0].hash);
    }).bind(this)});
  },

  setupScrolling: function() {
    var arrows = new Element('div', { 'class': 'arrows' }).
      insert(new Element('a', { href: '#', onclick: 'return false;', 'class': 'button' }).
        update('<img src="/images/icons/left_arrow.png"/>').
        observe('click', this.scroll.curry(-1).bind(this))).
      insert(new Element('a', { href: '#', onclick: 'return false;', 'class': 'button' }).
        update('<img src="/images/icons/right_arrow.png"/>').
        observe('click', this.scroll.curry(1).bind(this)));

    this.list.insert({ before: arrows });
  },

  scroll: function(direction) {
    direction = direction || 1;
    var t = new Effect.Tween(this.list,
      this.list.scrollLeft,
      this.list.scrollLeft + direction * this.list.getWidth(),
      'scrollLeft');
  }
});

Swivel.Dialog = Class.create({
  initialize: function(div, options) {
    this.options = {};
    this.options.chrome = (options && options.chrome !== undefined) ? options.chrome : true;
    this.options.modal = (options && options.modal !== undefined) ? options.modal : false;
    this.options.topPosition = (options && options.topPosition !== undefined) ? options.topPosition : false;

    if(this.options.chrome) {
      // setup a dialog container
      var dialog = new Element("div", {
        'class': 'dialog'
      });

      this.div = new Element("div", {
        'class': 'dialog_container',
        'style': 'display: none'
      }).update(dialog);
    } else {
      this.div = $(div);
    }
    this.div.setStyle({zIndex : 101});

    $(document.body).insert(this.div);

    // must come after body insertion (annoying)
    if(this.options.chrome) {
      dialog.update($(div));
      $(div).show();
    }

    if (this.do_show)
      this.show();
  },

  show: function(options) {
    if (!this.div) {
      this.do_show = true;
      return;
    }

    if(this.options.modal) {
      this.blocker = new Element('div', { 'class' : 'blocker' });
      $(document.body).insert(this.blocker);

      $w('keypress keydown mousedown mousemove click dblclick').each(function(e) {
        this.blocker.observe(e, Event.stop);
      }, this);
      //$(document.body).insert(this.blocker);
      this.div.observe('mousemove', Event.stop);

      var scrollHeight = $(document.body).scrollHeight;
      if (scrollHeight > this.blocker.getHeight())
        this.blocker.setStyle({ height: scrollHeight + 'px' });
    }

    var offset = document.viewport.getScrollOffsets();
    var panel_dim = this.div.getDimensions();
    var viewport_dim = $(document.viewport).getDimensions();

    var parentOffset =  Element.cumulativeOffset(this.div.getOffsetParent());
    var topPos = offset[1] - parentOffset[1] +
      (viewport_dim.height - panel_dim.height) / 4;

    var leftPos = offset[0] - parentOffset[0] +
      (viewport_dim.width - panel_dim.width) / 2;

    if (this.options.topPosition !== false) {
      topPos = this.options.topPosition;
    }

    this.div.setStyle({
      top: topPos + "px",
      left: leftPos + "px"
    });

    this._show(options);
  },

  _show: function(options) {
    this.div.appear(options);
  },

  hide: function() {
    this._hide();
    if (this.blocker) {
      this.blocker.remove();
      this.div.stopObserving('mousemove', Event.stop);

      this.blocker = null;
    }
    this.div.select('form').each(Form.reset);
  },

  _hide:function(){
    this.div.hide();
  },

  toggle: function() {
    if (this.div.visible()) {
      this.hide();
    } else {
      this.show();
    }
  }
});

Swivel.NoticeDialog = Class.create(Swivel.Dialog, {
  initialize: function($super, msg, delay, callback) {
    var div = new Element('div', { style: 'display: none;' }).
      update('<p>' + msg + '</p>');

    this.teardown = function() {
      this.hide();
      if (callback) callback();
    }.bind(this);

    var closeButton = new Element('input', { type: 'button', value: 'Close' }).
      observe('click', this.teardown.curry());
    div.insert(closeButton);

    $super(div);

    this.show({
      afterFinish: function() { closeButton.focus(); }
    });
    this.hide.bind(this).delay(delay || 5.5);
  }
});

Swivel.SheetDialog = Class.create(Swivel.Dialog, {
  initialize: function($super, div, callback, options) {
    var container = new Element('div', { 'class': 'sheet-dialog' }).hide();
    $(document.body).insert(container);

    div = $(div);
    container.update(div);

    options = Object.extend({ chrome: false, modal: true, topPosition: 0 }, options);
    $super(container, options);

    $(div).select('.close').invoke('observe', 'click', this.hide.bind(this));

    div.show();
    this.show();
  },

  _hide: function() {
    if (this.div.down()) {
      this.div.slideUp();
    }
  },

  _show: function() {
    var firstInput = this.div.down('input[type=text], textarea, input[type=submit], input[type=button]')
    this.div.slideDown({
      afterFinish: function() {
        firstInput.activate();
      }
    });
  }
});

Swivel.ModalDialog = Class.create(Swivel.Dialog, {
  initialize: function($super, div, callback, options, buttons) {
    div = $(div);
    buttons = buttons || div.select("button, input[type='button']");

    this.teardown = function(b) {
      this.hide();
      Event.stopObserving(document, Swivel.keyDown());
      if (callback) callback(b);
    }.bind(this);

    $super(div, Object.extend({chrome: false, modal: true}, options || {}));

    buttons.each(function(b) {
      b.observe('click', this.teardown.curry(b));
    }, this);
    this.show({
      afterFinish: function() { buttons.first().focus(); }
    });
    Event.observe(document, Swivel.keyDown(), function(e){
      if (e.keyCode == 27) { this.teardown(); } // escape
    }.bind(this));
  }
});

Swivel.ControlDialog = Class.create(Swivel.Dialog, {
  initialize: function($super, div, callback, options, buttons) {
    div = $(div);
    buttons = buttons || div.select("button, input[type='button']");

    var teardown = function(b) {
      this.hide();
      if (callback) callback(b);
    }.bind(this);

    $super(div, Object.extend({chrome: false, modal: true}, options || {}));

    buttons.each(function(b) {
      b.observe('click', teardown.curry(b));
    });

    this.show({
      afterFinish: function() { if(buttons.length > 0) buttons.first().focus(); }
    });
  }
});

Swivel.OKCancelDialog = Class.create(Swivel.SheetDialog, {
  initialize: function($super, title, msg, callback) {
    var div = new Element('div');

    div.insert(new Element('h1').update(title));

    var ok = new Element('input', { type: 'button', value: 'OK', 'class': 'close'});
    var cancel = new Element('a', { href: '#', 'class': 'close' }).update('Cancel');
    cancel.onclick = function() { return false; };

    div.insert(new Element('div', {'class': 'major form'}).
      insert(new Element('p').insert(msg)).
      insert(ok).
      insert(' ').
      insert(cancel));

    if (callback) {
      ok.observe('click', callback.curry(true));
      cancel.observe('click', callback.curry(false));
    }

    $super(div);
  }
});


Swivel.Listing = Class.create({
  initialize: function(options) {
    this._table = $(options.table);
    this._filters = $(options.filters);
    this._selectFilter = options.selectFilter;
    this._personId = options.personId;
    this._headers = options.header;
    this._controls = options.controls;

    this._setupRows();
    this._setupObservers();
    this._setupControls();
  },

  showAll: function() {
    if (this._headers)
      this._headers.invoke('show')
    this._rows.invoke('show');
    this._reStripe();
  },

  showOnly: function(cls) {
    if (cls == 'all') {
      this.showAll();
      return;
    }
    var lastVisible = null;
    if (this._headers) {
      this._headers.invoke('show')
    }
    this._rows.each(function(tr) {
      if (!tr.hasClassName(cls)) {
        tr.hide();
      } else if (!tr.visible()) {
        tr.show();
      }
    });
    this. _hideEmptyHeaders();
    this._reStripe();
  },

  _setupRows: function() {
    if (!this._table) {
      this._rows = [];
      return;
    }

    this._style = this._table.classNames().find(function(c) { return c !== 'list'; }) || 'tiles';

    if (this._selectFilter) {
      this._rows = this._table.select(this._selectFilter);
    } else {
      this._rows = this._table.select('tr').reject(function(tr) {
        return tr.down('th');
      });
    }
  },

  remove: function(cls) {
    var separated = this._rows.partition(function(tr) {
      return tr.hasClassName(cls);
    });

    separated[0].invoke('blindUp');
    this._rows = separated[1];
    this._reStripe();
  },

  _setupObservers: function() {
    this.updateFilters();
    setInterval(this.updateFilters.bind(this), 200);
    Event.observe(window, 'resize', this._resize.bind(this));
    this._resize.bind(this).defer();
  },

  updateFilters: function() {
    var tab = window.location.href.split(/#/)[1];
    if (tab) {
      $$('.filters li').each(function(li) {
        li.removeClassName('current');
        if (li.className.match(tab)) {
          li.addClassName('current');
        }
      });
      var cls = 'all';
      if (tab == 'charts') {
        cls = 'Chart';
      } else if (tab == 'workbooks') {
        cls = 'Workbook';
      } // TODO: translating between these names is needlessly cumbersome
      this.showOnly(cls);
    }
  },

  _resize: function() {
    if (!this._filters) { return; }

    var listing = $(this._filters.parentNode);
    var footer = $('footer').getHeight() + 1;
    var viewport = document.viewport.getHeight() - footer;
    var height = viewport - listing.cumulativeOffset().top;

    listing.setStyle({ height: height + 'px' });
    listing.childElements().each(function(e) {
      var h = height -
        parseInt(e.getStyle('paddingTop')) -
        parseInt(e.getStyle('paddingBottom'));
      e.setStyle({ height: h + 'px' });
    });
  },

  _setupControls: function() {
    if (!this._controls) { return; }

    var tb = new Swivel.Toolbar({
      div: this._controls,
      items: [
        { id: 'listing_style_tiles',
          title: 'Tile view', toggle: true, group: 'list_style',
          'class': 'listing_style_tiles first grouped',
          callback: function() { this._setStyle('tiles'); }.bind(this)
        },
        { id: 'listing_style_thumbnail',
          title: 'Thumbnail view', toggle: true, group: 'list_style',
          'class': 'listing_style_thumbnail grouped',
          callback: function() { this._setStyle('thumbnail'); }.bind(this)
        },
        { id: 'listing_style_compact',
          title: 'List view', toggle: true, group: 'list_style',
          'class': 'listing_style_compact grouped',
          callback: function() { this._setStyle('compact'); }.bind(this)
        }
      ]
    });
    tb.getItem('listing_style_' + this._style).select(true);
  },

  _setStyle: function(pref) {
    if (pref == this._style) { return; }
    var tiles = this._table.previous('#tiles');

    this._table.removeClassName(this._style);
    tiles.removeClassName(this._style);

    this._style = pref;

    this._table.addClassName(this._style);
    tiles.addClassName(this._style);

    this._updatePersonPreference();
  },

  _updatePersonPreference: function() {
    if (!this._personId) return;
    var url =  '/people/' + this._personId + '.json';
    var params = { "person[listing_style]": this._style };
    Object.extend(params, Swivel.AuthenticityToken);
    new Ajax.Request(url, {
      method: 'put',
      parameters: params
    });
  },

  _hideEmptyHeaders: function() {
    var allRows = this._table.select('tr').reject(function(t) { return t.hasClassName('space')});
    var shouldHide = true;
    var size = allRows.size();
    for (var i = size -1; i > 0 ; i--) {
      if (!allRows[i].hasClassName('day') && allRows[i].visible()) {
          shouldHide = false;
      }
      if(allRows[i-1].hasClassName('day')) {
        i--;
        if (shouldHide && allRows[i].visible()) {
          allRows[i].hide();
        }
        shouldHide = true;
      }
    }

  },

  _reStripe: function() {
    var visible = this._rows.select(function(tr) { return tr.visible(); });
    visible.each(function(tr, i) {
      if ((i & 1) == 0) { // even
        tr.removeClassName('odd');
        tr.addClassName('even');
      } else { // odd
        tr.removeClassName('even');
        tr.addClassName('odd');
      }
    });
  }
});

Swivel.Toolbar = Class.create({
  initialize: function(options) {
    this._name = options.name;
    this._items = [];
    this._itemsById = {};

    this._createElements();
    this._setupObservers();

    if (this._name)
      this.addItems([this._name, ' ', ' ']);

    if (options.items)
      this.addItems(options.items);

    if (options.div)
      this.render(options.div);
  },

  addItems: function(items) {
    items.each(function(e) {
      if (typeof(e) == 'string') {
        if (e == '-') {
          this.addSpacer();
          this.addSpacer();
          this.addSeparator();
          this.addSpacer();
          this.addSpacer();
        } else if (e == ' ') {
          this.addSpacer();
        } else {
          this.addItem(e);
        }
      } else if (e.render) {
        this.addItem(e);
      } else { // assume button config hash
        this.addItem(new Swivel.Toolbar.Button(e));
      }
    }, this);
  },

  addItem: function(item) {
    this._items.push(item);
    if(item._id != null) this._itemsById[item._id] = item;

    var td = new Element('td');
    td.addClassName(item._id);

    if (item.setContainer)
      item.setContainer(this._row);

    if (item.render) {
      item.render(td);
    } else {
      td.update(item);
    }

    this._row.insert(td);
  },

  getItem: function(id) {
    return this._itemsById[id];
  },

  getItems: function() {
    return this._items;
  },

  getItemGroup: function(group) {
    return this._items.select(function(item) { return item._group == group; });
  },

  addSpacer: function() {
    this._row.insert('<td class="spacer"></td>');
  },

  addSeparator: function() {
    this._row.insert('<td class="separator"></td>');
  },

  render: function(div) {
    this._div = $(div);
    this._div.update(this._table);
  },

  _createElements: function() {
    this._row = new Element('tr');
    this._table = new Element('table', {'class': 'toolbar'}).
      insert(new Element('tbody').
        insert(this._row));
  },

  _setupObservers: function() {
    this._row.observe('button:select', function(e) {
      var button = e.memo.source;
      if(button._group) {
        var groupButtons = this.getItemGroup(button._group).reject(function(item) { return item == button; });
        groupButtons.invoke('select', false);
      }
    }.bindAsEventListener(this));
  }
});

Swivel.Toolbar.Item = Class.create({
  initialize: function(options) {
    this._id = options.id;
  },

  setContainer: function(c) {
    this._container = c;
  },

  getContainer: function(c) {
    return this._container;
  }
});

Swivel.Toolbar.Helper = Class.create({
  moreButtons: {},
  defaultOptions: function(options) {
    var target = options.target;
    return $H({
      'data_text':
        { id: 'data_text', 'class': 'data_text grouped first', group: 'data', allowDeselect: true,
        menu: {
          items: this.DATA_TEXT_ITEMS,
          callback: target.setNumericFormatSelection.bind(target)
        }
      },
      'data_decimal':
        { id: 'data_decimal', 'class': 'data_decimal grouped', group: 'data', allowDeselect: true,
        menu: {
          items: this.DATA_DECIMAL_ITEMS,
          callback: target.setNumericFormatSelection.bind(target)
        }
      },
      'data_currency':
        { id: 'data_currency', 'class': 'data_currency grouped', group: 'data', allowDeselect: true,
        menu: {
          items: this.DATA_CURRENCY_ITEMS,
          callback: target.setNumericFormatSelection.bind(target)
        }
      },
      'data_percentage':
        { id: 'data_percentage', 'class': 'data_percentage grouped', group: 'data', allowDeselect: true,
        menu: {
          items: this.DATA_PERCENTAGE_ITEMS,
          callback: target.setNumericFormatSelection.bind(target)
        }
      },
      'data_date':
        { id: 'data_date', 'class': 'data_date grouped last', group: 'data', allowDeselect: true,
        menu: {
          contents: this.dataDateFormElements(),
          callback: target.setDataDateFormat.bind(target)
        }
      }
    });
  },

  advancedOptions: function(options) {
    var target = options.target;
    return $H({
      'data_precision':
        { id: 'data_precision', 'class': 'data_precision grouped first',
          menu: {
            contents: this.dataPrecisionFormElements(),
            callback: target.setDataAdvancedFormat.bind(target)
          }
        },
      'data_negative':
        { id: 'data_negative', 'class': 'data_negative grouped',
          menu: {
            contents: this.dataNegativeFormElements(),
            callback: target.setDataAdvancedFormat.bind(target)
          }
        },
      'data_magnitude':
        { id: 'data_magnitude', 'class': 'data_magnitude grouped',
          menu: {
            contents: this.dataMagnitudeFormElements(),
            callback: target.setDataAdvancedFormat.bind(target)
          }
        },
      'data_separator':
        { id: 'data_separator', 'class': 'data_separator grouped last',
          menu: {
            contents: this.dataSeparatorElements(),
            callback: target.setDataSeparatorFormat.bind(target)
          }
        }
    });
  },

  updateFormatButtons: function(toolbar, format) {
    if (!format) format = {};
    var simpleButtons = ['data_text', 'data_decimal', 'data_currency', 'data_percentage'];
    simpleButtons.each(function(t) {
      var b = toolbar.getItem(t);
      if (b) b.setOptions(format);
    });

    var dateButton      = toolbar.getItem('data_date');
    var precisionButton = toolbar.getItem('data_precision' )|| this.moreButtons['data_precision'];
    var magnitudeButton = toolbar.getItem('data_magnitude' )|| this.moreButtons['data_magnitude'];
    var negativeButton  = toolbar.getItem('data_negative'  )|| this.moreButtons['data_negative'];
    var separatorButton = toolbar.getItem('data_separator' )|| this.moreButtons['data_separator'];
    var dateString = "", timeString = "";
    if (dateButton) {
      if (format.dt) {
        var tokens = format.dt.split(/(%H|%I|%-1I)/);
        dateString = tokens[0].strip();
        if (tokens.size() > 1)
          timeString = (tokens[1] + tokens[2]).strip();
        dateButton.setOptions({
          data_date_date: dateString,
          data_date_time: timeString});
      }
      dateButton.select(format.dt);
    }

    format = $H(format);
    if (precisionButton) precisionButton.setOptions({data_precision: format.slice('p').toJSON()});
    if (magnitudeButton) magnitudeButton.setOptions({data_magnitude: format.slice('mag').toJSON()});
    if (negativeButton ) negativeButton.setOptions( {data_negative: format.slice('ns', 'np', 'nc').toJSON()});
    if (separatorButton) separatorButton.setOptions({
      data_separator_prefix: format.slice('pfx').toJSON(),
      data_separator_separator: format.slice('c').toJSON(),
      data_separator_suffix: format.slice('sfx').toJSON()
    });
  },

  dataDateFormElements: function() {
    return new Element('table').
      insert(new Element('tbody').
        insert(new Element('tr').
          insert('<td><label for="data_date_date">Date</label></td>').
          insert(new Element('td').
            insert(Swivel.createSelect('data_date_date', this.DATA_DATE_ITEMS)))).
        insert(new Element('tr').
          insert('<td><label for="data_date_time">Time</label></td>').
          insert(new Element('td').
            insert(Swivel.createSelect('data_date_time', this.DATA_TIME_ITEMS)))));
  },

  dataPrecisionFormElements: function(selectAction) {
    var precisionOptions =
      [ ["",  {"p":-1}],
        ["0", {"p": 0}],
        ["1", {"p": 1}],
        ["2", {"p": 2}],
        ["3", {"p": 3}],
        ["4", {"p": 4}],
        ["5", {"p": 5}],
        ["6", {"p": 6}],
        ["7", {"p": 7}] ];
    var titleLabel = selectAction ? '' : '<label>Number of Decimals</label><br/>'
    var select = Swivel.createSelect('data_precision', precisionOptions, selectAction);
    var div = new Element('div').
      insert(titleLabel).
      insert(select);
    div.setOptions = this._setOptions.bind(div);
    return div;
  },

  dataMagnitudeFormElements: function(selectAction) {
    var magnitudeOptions =
      [ ["Ones (default)",  {"mag": 0} ],
        ["Tens",            {"mag": 1} ],
        ["Hundreds",        {"mag": 2} ],
        ["Thousands",       {"mag": 3} ],
        ["Millions",        {"mag": 6} ],
        ["Billions",        {"mag": 9} ],
        ["Trillions",       {"mag": 12} ] ];
    var titleLabel = selectAction ? '' : '<label>Order of Magnitude</label><br/>'
    var select = Swivel.createSelect('data_magnitude', magnitudeOptions, selectAction);
    var div = new Element('div').
      insert(titleLabel).
      insert(select);
    div.setOptions = this._setOptions.bind(div);
    return div;
  },

  dataNegativeFormElements: function(selectAction) {
    var negativeOptions =
      [ ["-1234",   {"ns": true, "np": false, "nc": false}, {"style": 'color:#000;'}],
        ["(1234)",  {"ns": false, "np": true, "nc": false}, {"style": 'color:#000;'}],
        ["-1234 (red)",   {"ns": true, "np": false, "nc": "Red"}, {"style": 'color:Red;'}],
        ["(1234) (red)",  {"ns": false, "np": true, "nc": "Red"}, {"style": 'color:Red;'}] ];
    var titleLabel = selectAction ? '' : '<label>Negative Number Format</label><br/>'
    var select = Swivel.createSelect('data_negative', negativeOptions, selectAction);
    var div = new Element('div').
      insert(titleLabel).
      insert(select);
    div.setOptions = this._setOptions.bind(div);
    return div;
  },

  dataSeparatorElements: function(selectAction) {
    var prefixOptions =
      [ ["None",    {"pfx": ""}],
        ["$",       {"pfx": "$"}],
        ["&euro;",  {"pfx": "&euro;"}] ],
        separatorOptions =
        [ ["None",    {"c": false}],
          [",",       {"c": true}] ],
        suffixOptions =
        [ ["None",    {"sfx": ""}],
          ["%",       {"sfx": "%"}],
          ["&euro;",  {"sfx": "&euro;"}],
          ["K",       {"sfx": "K"}],
          ["M",       {"sfx": "M"}],
          ["B",       {"sfx": "B"}] ];
    var titleLabel = selectAction ? '' : '<label>Prefix, Separator & Suffix</label><br/>';
    var div = new Element('div').
      insert(titleLabel).
      insert(new Element('table').
        insert(new Element('tbody').
          insert(new Element('tr').
            insert('<td><label class="label">Prefix</label class="label"></td><td><label class="label">Separator</label class="label"></td><td><label class="label">Suffix</label class="label"></td>')).
          insert(new Element('tr').
            insert(new Element('td').
              update(Swivel.createSelect('data_separator_prefix', prefixOptions, selectAction))).
            insert(new Element('td').
              update(Swivel.createSelect('data_separator_separator', separatorOptions, selectAction))).
            insert(new Element('td').
              update(Swivel.createSelect('data_separator_suffix', suffixOptions, selectAction))))));
    div.setOptions = this._setOptions.bind(div);
    return div;
  },

  _setOptions: function(options) {
    $H(options).each(function(pair) {
      var input = this.down("*[name="+ pair.key +"]");
      input.selectedIndex = 0;
      input.value = pair.value;
    }, this);
    return false;
  },

  DATA_TEXT_ITEMS:
    [ ["Plain Text", {t: "t"} ] ],
  DATA_DECIMAL_ITEMS:
    [ ["1234",      {t: "n", p: 0, c: false, ns: true} ],
      ["1234.19",   {t: "n", p: 2, c: false, ns: true} ],
      "-",
      ["1,234",     {t: "n", p: 0, c: true,  ns: true} ],
      ["1,234.19",  {t: "n", p: 2, c: true,  ns: true} ],
      "-",
      ["1.234E+03", {t: "e", p: 3, ns: true} ] ],
  DATA_CURRENCY_ITEMS:
    [ ["$1234",     {t: "c", p: 0, c: false, np: true,  ns: false, nc: 'Red' } ],
      ["$1234.19",  {t: "c", p: 2, c: false, np: true,  ns: false, nc: 'Red' } ],
      "-",
      ["$1,234",    {t: "c", p: 0, c: true,  np: true,  ns: false, nc: 'Red' } ],
      ["$1,234.19", {t: "c", p: 2, c: true,  np: true,  ns: false, nc: 'Red' } ] ],
  DATA_PERCENTAGE_ITEMS:
    [ ["12%",       {t: "p", p: 0, c: true } ],
      ["12.34%",    {t: "p", p: 2, c: true } ] ],
  DATA_DATE_ITEMS:
    [ ["None",                  ""],
      "-",
      ["Monday",                "%A"],
      ["Mon",                   "%a"],
      "-",
      ["March",                 "%B"],
      ["Mar",                   "%b"],
      "-",
      ["2008",                  "%Y"],
      ["08",                    "%y"],
      "-",
      ["Monday, March 5, 2008", "%A, %B %-1d, %Y"],
      ["Mon, Mar 5, 2008",      "%a, %b %-1d, %Y"],
      ["Mon, Mar 05, 2008",     "%a, %b %d, %Y"],
      ["March 5, 2008",         "%B %-1d, %Y"],
      "-",
      ["3/5/2008",              "%-1m/%-1d/%Y"],
      ["3/5/08",                "%-1m/%-1d/%y"],
      ["3/5",                   "%-1m/%-1d"],
      "-",
      ["03/05/2008",            "%m/%d/%Y"],
      ["03/05/08",              "%m/%d/%y"],
      ["03/2008",               "%m/%Y"],
      ["03/05",                 "%m/%d"],
      "-",
      ["5-Mar-2008",            "%-1d-%b-%Y"],
      ["5-Mar-08",              "%-1d-%b-%y"],
      ["5-Mar",                 "%-1d-%b"],
      "-",
      ["March-2008",            "%B-%Y"],
      ["March-08",              "%B-%y"],
      ["Mar-08",                "%b-%y"],
      "-",
      ["Q1",                    "%q"],
      ["Q1 08",                 "%q %y"],
      ["Quarter 1",             "%Q"],
      ["Quarter 1 2008",        "%Q %Y"] ],
  DATA_TIME_ITEMS:
      [ ["None",                  ""],
        "-",
        ["1:30 PM",               "%-1I:%M %p"],
        ["1:30PM",                "%-1I:%M%p"],
        ["1:30 pm",               "%-1I:%M %p%p"],
        ["1:30pm",                "%-1I:%M%p%p"],
        "-",
        ["1:30:59 PM",            "%-1I:%M:%S %p"],
        ["1:30:59PM",             "%-1I:%M:%S%p"],
        ["1:30:59 pm",            "%-1I:%M:%S %p%p"],
        ["1:30:59pm",             "%-1I:%M:%S%p%p"],
        "-",
        ["01:30 PM",              "%I:%M %p"],
        ["01:30PM",               "%I:%M%p"],
        ["01:30 pm",              "%I:%M %p%p"],
        ["01:30pm",               "%I:%M%p%p"],
        "-",
        ["01:30:59 PM",           "%I:%M:%S %p"],
        ["01:30:59PM",            "%I:%M:%S%p"],
        ["01:30:59 pm",           "%I:%M:%S %p%p"],
        ["01:30:59pm",            "%I:%M:%S%p%p"],
        "-",
        ["13:30",                 "%H:%M"],
        ["13:30:59",              "%H:%M:%S"] ]
});

Swivel.Toolbar.Checkbox = Class.create(Swivel.Toolbar.Item, {
  initialize: function($super, options) {
    $super(options);
    var checkbox = new Element('input', {
      id: options.id,
      type: 'checkbox'
    });
    checkbox.defaultChecked = !!options.value;
    var label = new Element('label', {'for': options.id}).update(options.label).setStyle({whiteSpace:"nowrap"});
    this._div = new Element('div').insert(checkbox).insert(label).setStyle({whiteSpace:"nowrap"});

    if (options.callback) {
      checkbox.observe('click', options.callback);
    }
  },

  render: function(element) {
    $(element).insert(this._div);
  }
});

Swivel.Toolbar.TimeRangePicker = Class.create(Swivel.Toolbar.Item, {
  initialize: function($super, options) {
    $super(options);
    this._fromDate    = new Element('input', {type: 'text', size: 12});
    this._toDate      = new Element('input', {type: 'text', size: 12});
    this._leftButton  = new Element('button', {'class': 'left'}).update("&nbsp;");
    this._rightButton = new Element('button', {'class': 'right'}).update("&nbsp;");
    this._extrema = options.extrema;
    this.setRange(options.timerange);
    this._div = new Element('div').
      insert(this._leftButton).
      insert(this._fromDate).
      insert(" to ").
      insert(this._toDate).
      insert(this._rightButton).
      setStyle({whiteSpace: 'nowrap'});
    if (options.callback) {
      this._callback = options.callback;
      this._fromDate.onchange = function() { this._callback(this.getRange()); }.bind(this);
      this._toDate.onchange   = function() { this._callback(this.getRange()); }.bind(this);
    }
    this._leftButton.onclick = this.moveLeft.bind(this);
    this._rightButton.onclick = this.moveRight.bind(this);
  },

  moveLeft: function()  {
    this.move(true);
  },

  moveRight: function() {
    this.move(false);
  },

  move: function(movingLeft) {
    var timerange = this.getRange();
    var diff = timerange.to - timerange.from;
    if (diff < 1) return;

    if (movingLeft) {
      timerange.to = timerange.from
      timerange.from = timerange.from - diff;
    } else {
      timerange.from = timerange.to;
      timerange.to = timerange.to + diff;
    }

    this.setRange(timerange);
    this._callback(this.getRange());
  },

  getRange: function() {
    var fromValue = Swivel.sanitizeAsDate(this._fromDate.value);
    var toValue   = Swivel.sanitizeAsDate(this._toDate.value);
    return {from: fromValue, to: toValue};
  },

  setRange: function(timerange) {
    // translate to our format here
    this._fromDate.value  = new Date(timerange.from).strftime("%m/%d/%Y");
    this._toDate.value    = new Date(timerange.to  ).strftime("%m/%d/%Y");
    try {
      this._fromDate.blur(); // otherwise kinda ugly when it's focused already
      this._toDate.blur();
    } catch(e) {
      // TODO: unhack for IE
    }
    if (timerange.from <= this._extrema.min) {
      this._leftButton.disabled = true;
    } else {
      this._leftButton.disabled = false;
    }
    if (timerange.to >= this._extrema.max) {
      this._rightButton.disabled = true;
    } else {
      this._rightButton.disabled = false;
    }
  },

  render: function(element) {
    $(element).insert(this._div);
    if (this._menu)
      this._menu.render(element);
  }
});

Swivel.Toolbar.Button = Class.create(Swivel.Toolbar.Item, {
  initialize: function($super, options) {
    $super(options);

    this._label = options.label;
    this._class = options['class'];
    this._title = options.title;
    this._toggle = options.toggle;
    this._value = options.value;
    this._group = options.group;
    this._allowDeselect = options.allowDeselect || !options.group;
    this._callback = options.callback;
    this._elementId = options.elementId;

    this._createElements();
    this._setupObservers();

    if (options.menu) {
      // automatically try to make menu objects out of the menu options
      if (options.menu.items)
        this._menu = new Swivel.Toolbar.SelectMenu(this, options.menu);
      else if (options.menu.contents)
        this._menu = new Swivel.Toolbar.DialogMenu(this, options.menu);
      else if (options.menu.listItems)
        this._menu = new Swivel.Toolbar.ListMenu(this, options.menu);
      else if (options.menu.show)  // already a menu
        this._menu = options.menu;
      else
        this._menu = new Swivel.Toolbar.Menu(this, options.menu);
    }

    if (options.disabled)
      this.disable();
  },

  _createElements: function() {
    this._button = new Element('button', { 'class': this._class });
    if (this._elementId) this._button.id = this._elementId;
    if (this._title) { this._button.title = this._title; }
    this._content = new Element('div').update(this._label);
    this._button.update(this._content);
  },

  _setupObservers: function() {
    this._button.observe('mousedown', function(e) { e.stop(); }); // prevents focus
    this._button.observe('click', this._onClick.bindAsEventListener(this));
  },

  disable: function() {
    return this.setEnabled(false);
  },

  enable: function() {
    return this.setEnabled(true);
  },

  setEnabled: function(enable) {
    this._button.disabled = !enable;
    return this;
  },

  render: function(element) {
    $(element).insert(this._button);
    if (this._menu)
      this._menu.render(element);
  },

  select: function(on) {
    this._value = on;
    if (on) {
      this._button.addClassName('selected');
      this._container.fire('button:select', { source: this });
    } else {
      this._button.removeClassName('selected');
      if (this._menu) {
        this._menu.deselect();
      }
    }
  },

  toggle: function() {
    if (this._toggle) {
      this._value = !this._value;
      this.select(this._value);
    }

    if (this._menu) {
      if (this._menu.visible())
        this.hide();
      else
        this.show();
    }
  },

  show: function() {
    if (this._menu) {
      this._menu.show();
    }
  },

  hide: function() {
    if (this._menu)
      this._menu.hide();
  },

  setOptions: function(format) {
    this.select(this._menu.setOptions(format));
  },

  setLabel: function(label) {
    this._label = label;
    this._content.update(this._label);
  },

  _onClick: function(e) {
    if (!this._allowDeselect && this._value)
      return;

    this.toggle();

    if (this._callback) {
      this._callback(e);
    }
  }
});

Swivel.Toolbar.Select = Class.create(Swivel.Toolbar.Item, {
  initialize: function($super, options) {
    $super(options);

    this._value = options.value;
    this._items = options.items;

    this._select = new Element('select');
    $A(options.items).each(function(o) {
      var option = new Element('option', { value: o.value }).update(o.name);
      if (o.value == this._value)
        option.selected = 'selected';
      if (o.style)
        option.setStyle(o.style);
      this._select.insert(option);
    }, this);

    if (options.callback)
      this.observe('change', options.callback);

    if (options.disabled)
      this.disable();
  },

  setSelected: function(value){
    this._select.value = value;
  },

  observe: function(type, callback) {
    this._select.observe(type, callback);
  },

  render: function(element) {
    $(element).insert(this._select);
  },

  disable: function() {
    this._select.disable();
  },

  enable: function() {
    this._select.enable();
  }
});


Swivel.Toolbar.Input = Class.create(Swivel.Toolbar.Item, {
  initialize: function($super, options) {
    $super(options);

    var styles = {
      border: 'none',
      padding: 0,
      margin: 0,
      outlineWidth: 0,
      fontSize: '10px'
    };
    if (Prototype.Browser.IE) {styles.paddingBottom = '1px';}
    if (options.align && ['left', 'right', 'center'].include(options.align)) {
      styles.textAlign = options.align;
    }

    this._input = new Element('input', {type:'text', size: 2, value: options.value});
    this._input.setStyle(styles);
    if (Prototype.Browser.WebKit) { // put blue glow outline around whole div
      this._input.onfocus = function() { this._div.setStyle({outline: 'auto 3px rgb(75,137,208)'}); }.bind(this);
      this._input.onblur  = function() { this._div.setStyle({outlineWidth: '0px'}); }.bind(this);
    }
    var onclick = function() { this._input.focus(); };

    // fake text input box
    this._div = new Element('div', {'class': ''}).setStyle({
      backgroundColor: '#ffffff',
      border: '1px solid #CCCCCC',
      margin: 0,
      padding: '2px',
      fontSize: '10px'
    });

    this._div.onclick = onclick.bind(this);
    if (options.labels && options.labels.before)
      this._div.insert(options.labels.before);

    this._div.insert(this._input)

    if (options.labels && options.labels.after) {
      var label = new Element('label').update(options.labels.after);
      label.onclick = onclick.bind(this);
      this._div.insert(label);
    }

    if (options.callback)
      this.observe('change', options.callback);

    if (options.disabled)
      this.disable();

  },

  observe: function(type, callback) {
    this._input.observe(type, callback);
  },

  render: function(element) {
    $(element).insert(this._div);
  },

  disable: function() {
    this._input.disable();
    this._div.setStyle({backgroundColor: '#eee'});
  },

  enable: function() {
    this._input.enable();
    this._div.setStyle({backgroundColor: '#fff'});
  }
});

Swivel.Toolbar.FontFamilySelect = Class.create(Swivel.Toolbar.Select, {
  initialize: function($super, options) {
    $super(Object.extend(options || {}, {
      value: options.value || 'helvetica',
      items: this.FONTS
    }));
  },

  FONTS:
    ['Arial', 'Courier', 'Futura', 'Helvetica', 'Times', 'Verdana'].map(function(font) {
      return { value: font.toLowerCase(), name: font};
    })
});

Swivel.Toolbar.FontSizeSelect = Class.create(Swivel.Toolbar.Select, {
  initialize: function($super, options) {
    $super(Object.extend(options || {}, {
      items: options.sizes || this.SIZES
    }));
  },

  SIZES:
    $w('6 7 8 9 10 11 12 13 14 15 16 18 20 24 32 48').map(function(s) {
      return { value: s, name: s };
    })
});

// TODO inherit as much from Button as possible, as there is duplication here
Swivel.Toolbar.ColorPicker = Class.create(Swivel.Toolbar.Item, {
  initialize: function($super, options) {
    options = options || {};
    $super(options);
    this._value = options.value;

    var content = new Element('div');
    if (this._value) {
      if (this._value.color)
        this._value = this._value.color;
      this._value = Swivel.safeColor(this._value);
      content.setStyle({ 'backgroundColor': this._value });
    }
    this._button = new Element('button', { 'class': 'swatch' }).update(content);
    this._button.observe('click', function(e) {
      if (this._getPalette().visible())
        this.hide();
      else
        this.show();
    }.bindAsEventListener(this));
    this._div = new Element('div', {'class': 'color_picker'});
    this._div.insert(this._button);
    this._div.observe('mousedown', function(e) { e.stop(); });

    this._observers = [];
    this._boundOnDocumentClick = this._onDocumentClick.bindAsEventListener(this);

    if (options.callback) { this.observe(options.callback); }
    if (options.disabled) { this.disable(); }

    Swivel.Toolbar.ColorPicker.RECENT_COLORS.register(this);
  },

  render: function(element) {
    $(element).insert(this._div);
  },

  setColor: function(color) {
    color = Swivel.safeColor(color);
    this._button.down().setStyle({ backgroundColor: color });
  },

  show: function() {
    this._getPalette().appear();
    this._div.setStyle({zIndex: 2});
    document.observe('click', this._boundOnDocumentClick);
  },

  hide: function() {
    //don't change this to fade(), it will break IE
    this._getPalette().hide();
    this._div.setStyle({zIndex: 1});
    document.stopObserving('click', this._boundOnDocumentClick);
  },

  observe: function(f) {
    this._observers.push(f);
    return this;
  },

  disable: function() {
    return this.setEnabled(false);
  },

  enable: function() {
    return this.setEnabled(true);
  },

  setEnabled: function(enable) {
    this._button.disabled = !enable;
    return this;
  },

  addRecentColor: function(c) {
    if (this._recentRow && this._recentRow.down('td')) {
      this._recentRow.down('td:last-child').remove();
      this._recentRow.insert({ top: this._createSwatch(c) });
    }
  },

  _onClick: function(e) {
    var td = e.findElement('td');
    if (td && td.hasClassName('swatch')) {
      var c = td.getStyle('backgroundColor');
      this._button.down().setStyle({ backgroundColor: c });
      this._setCurrentSwatch(td);

      this._observers.each(function(f) { f(c); });
      Swivel.Toolbar.ColorPicker.RECENT_COLORS.push(c);

      this.hide();
    }
  },

  _onDocumentClick: function(e) {
    if (e.findElement('button') != this._button) {
      this.hide();
    }
  },

  _setCurrentSwatch: function(s) {
    if (this._currentSwatch) { this._currentSwatch.removeClassName('current'); }
    this._currentSwatch = s;
    if (this._currentSwatch) { this._currentSwatch.addClassName('current'); }
  },

  _getPalette: function() {
    if (!this._palette) {
      var tbody = new Element('tbody');
      this._COLORS.inGroupsOf(this._COLORS_PER_ROW, -1).each(function(row) {
        var tr = '<tr>';
        row.each(function(c) {
          if (c != -1)
            tr += this._createSwatch(c);
        }, this);
        tbody.insert(tr);
      }, this);

      var table = new Element('table').update(tbody);

      this._recentRow = new Element('tr');
      Swivel.Toolbar.ColorPicker.RECENT_COLORS.getColors().each(function(c) {
        this._recentRow.insert(this._createSwatch(c));
      }, this);
      var recent = new Element('div', { 'class': 'recent' }).
        insert(new Element('table').
          update(new Element('tbody').update(this._recentRow))).
        insert('Recent');

      this._palette = new Element('div', { 'class': 'palette' });
      this._palette.setStyle({ display: 'none' });
      this._palette.insert(table).insert(recent);
      this._palette.observe('click', this._onClick.bindAsEventListener(this));

      if (this._value) {
        this._setCurrentSwatch(this._palette.down('td.' + this._value.substring(1)));
      }
      this._div.insert(this._palette);
    }

    return this._palette;
  },

  _createSwatch: function(c) {
    if (c) {
      var cls = c.substring(1);
      var rgb = [
        parseInt(c.substring(1,3), 16),
        parseInt(c.substring(3,5), 16),
        parseInt(c.substring(5,7), 16)
      ].join(', ');
      return '<td class="swatch ' + cls + '" style="background-color: ' + c + ';" title=" RGB (' + rgb + ') "></td>';
    } else {
      return '<td class="swatch nocolor" title="no color"></td>';
    }
  },

  _COLORS_PER_ROW: 16,
  _COLORS: [ "#f30e10", "#fbff15", "#33ff0c", "#41fefe", "#2400fd", "#f700fe", "#ffffff", "#e6e6e6", "#dadada", "#cecece", "#c1c1c1", "#b5b5b5", "#a9a9a9", "#9c9c9c", "#8f8f8f", "#838383",
"#de1a20", "#fff500", "#00973f", "#0099ea", "#281c7f", "#de007a", "#767676", "#696969", "#5c5c5c", "#4f4f4f", "#434343", "#363636", "#292929", "#1c1c1c", "#0e0e0e", "#000000",
"#eebeb0", "#f3ceb8", "#f5ddc2", "#fffdd7", "#dfe6d6", "#d5d9d5", "#baccbf", "#b4cccb", "#b1dcf3", "#b0bbcf", "#acaebd", "#b1aebf", "#bab4bf", "#bfbabf", "#ebccdb", "#ebcfd0",
"#ec8768", "#f19f70", "#f6bc78", "#fff989", "#b8da8a", "#95cc8b", "#76c08b", "#71c1bb", "#6ac2f3", "#7194cf", "#747ebe", "#776baf", "#8f70b0", "#ac77b2", "#eb87b5", "#ec878c",
"#e55b40", "#eb7e46", "#f2a24d", "#fff758", "#9dcc60", "#6ebb63", "#3bab65", "#31ada4", "#1aadee", "#4075be", "#4a5ca9", "#504597", "#724897", "#944d98", "#e4589a", "#e55a6b",
"#de1a20", "#e4561f", "#ec861d", "#fff500", "#7dbe32", "#38a93a", "#00973f", "#00998b", "#0099ea", "#005aad", "#133d95", "#281c7f", "#53197e", "#7c147c", "#de007a", "#de104a",
"#850d10", "#883410", "#8d510f", "#989208", "#49751e", "#1e6925", "#006129", "#006057", "#006091", "#00376c", "#09235e", "#180851", "#34004f", "#4e004d", "#87004c", "#86002c",
"#610000", "#632400", "#663a00", "#6d6a00", "#335514", "#104d19", "#00471c", "#004740", "#00476b", "#002650", "#001545", "#0f003b", "#25003a", "#380038", "#630036", "#61001e",
"#b8a488", "#857462", "#5e5046", "#413732", "#292422", "#b58c5c", "#916b41", "#76512c", "#5f3d1c", "#4b2c11", null ]
});
Swivel.Toolbar.ColorPicker._RecentColors = Class.create({
  initialize: function(max) {
    this._colors = [];
    for (var i = 0; i < max; i++) {
      this._colors[i] = '#ffffff';
    }
    this._pickers = [];
  },

  getColors: function() {
    return this._colors;
  },

  push: function(color) {
    if (!this._colors.include(color)) {
      this._colors.unshift(color);
      this._pickers.invoke('addRecentColor', color);

      this._colors.pop();
    }
  },

  register: function(picker) {
    this._pickers.push(picker);
  }
});
Swivel.Toolbar.ColorPicker.RECENT_COLORS = new Swivel.Toolbar.ColorPicker._RecentColors(11);

Swivel.Toolbar.Menu = Class.create({
  initialize: function(button, options) {
    this._button = button;
    this._callback = options.callback;
    this._createElements();
    this._setupObservers();
    this._boundOnDocumentClick = this._onDocumentClick.bindAsEventListener(this);
  },

  _createElements: function() {
    this._div = new Element('div', { 'class': 'menu' });
    this._div.setStyle({ display: 'none' });
  },

  _setupObservers: function() {
  },

  render: function(element) {
    $(element).insert(this._div);
  },

  visible: function() {
    return this._div.visible();
  },

  deselect: function() {
  },

  show: function() {
    this._div.appear();
    (function(){
      var left = [(document.viewport.getDimensions().width - this._div.getWidth() - 10), this._div.offsetLeft].min();
      this._div.style.left = left  +'px';
    }).bind(this).delay(.1);
    document.observe('click', this._boundOnDocumentClick);
  },

  hide: function() {
    this._div.fade();
    document.stopObserving('click', this._boundOnDocumentClick);
  },

  setOptions: function(format) {
  },

  _onDocumentClick: function(e) {
    var container = $(this._button._button.parentNode);
    var element = e.element();
    var ancestors = element.ancestors ? element.ancestors() : [];
    if (!ancestors.include(container)) {
      this.hide();
    }
  }
});

Swivel.Toolbar.SelectMenu = Class.create(Swivel.Toolbar.Menu, {
  initialize: function($super, button, options) {
    $super(button, options);
    if (options.items)
      this.addItems(options.items);
  },

  _createElements: function($super) {
    $super();
    this._div.addClassName('select');

    this._ul = new Element('ul');
    this._div.insert(this._ul);
  },

  deselect: function() {
    this._ul.select('li').invoke('removeClassName', 'selected');
  },

  _setupObservers: function($super) {
    $super();
    this._ul.observe('click', this._onClick.bindAsEventListener(this));
  },

  addItems: function(items) {
    items.each(function(item) {
      var li;
      if (item === '-') {
        this._ul.insert('<hr/>');
      } else if (Object.isArray(item)) {
        li = new Element('li').update(item[0]);
        li._value = item[1];
        this._ul.insert(li);
      } else {
        li = new Element('li').update(item);
        li._value = item;
        this._ul.insert(li);
      }
    }, this);
  },

  setOptions: function(format) {
    this._ul.descendants().each(function(li, i) {
      if (!li._value || typeof(li._value) == 'string') return;
      for (k in li._value) {
        if (li._value[k] != format[k]) {
          li.removeClassName('selected');
          return;
        }
      }
      li.addClassName('selected');
    },this);
    return this._ul.firstDescendant()._value.t == format.t;
  },

  _onClick: function(e) {
    var li = e.element();
    if (!li._value)
      return;
    this._ul.descendants().each(function(l) {
      l.removeClassName('selected');
    });
    li.addClassName('selected');
    this._button.select(true);
    if (this._callback)
      this._callback(li._value);
    this.hide();
  }
});

Swivel.Toolbar.ListMenu = Class.create(Swivel.Toolbar.Menu, {
  initialize: function($super, button, options) {
    $super(button, options);

    if (options.listItems)
      this.addItems(options.listItems);
  },

  _createElements: function($super) {
    $super();
    this._div.addClassName('checkbox');

    this._ul = new Element('ul', {'class': 'dialog'});
    this._div.insert(this._ul);
  },

  addItems: function(items) {
    items.each(function(item, i) {
      if (item === '-') {
        this._ul.insert('<hr/>');
      } else {
        this._ul.insert(new Element('li').update(item));
      }
    }, this);
  }
});

Swivel.Toolbar.DialogMenu = Class.create(Swivel.Toolbar.Menu, {
  initialize: function($super, button, options) {
    this._contents = options.contents;
    $super(button, options);
  },

  _createElements: function($super) {
    $super();
    this._div.addClassName('dialog');
    this._form = new Element('form');
    this._form.onsubmit = function() { return false;};
    this._form.insert(this._contents);

    var buttons = new Element('div', { 'class': 'buttons' });

    var ok = new Element('input', { type: 'submit', value: 'OK' });
    buttons.insert(ok).insert(' ');

    var cancel = new Element('a', { href: '#', onclick: 'return false;' }).update('Cancel');
    cancel.observe('click', this.hide.bindAsEventListener(this));
    buttons.insert(cancel);

    this._form.insert(buttons);

    this._div.insert(this._form);
  },

  _setupObservers: function($super) {
    $super();
    this._form.observe('submit', this._onSubmit.bindAsEventListener(this));
  },

  setOptions: function(options) {
    $H(options).each(function(pair) {
      var input = this._form.down("*[name="+ pair.key +"]");
      input.selectedIndex = 0;
      input.value = pair.value;
    }, this);
    return false;
  },

  _onSubmit: function(e) {
    this._button.select(true);
    if (this._callback)
      this._callback(this._form.serialize(true));
    this.hide();
  }
});


Swivel.Toolbar.SelectionDialog = Class.create({
  initialize: function(f, callback, children, buttons) {

    // location gathered in a hack-ish way
    var isDate = (f == 'date');
    var isFirst = (f == 'precision');
    var isLast = (f == 'separator') || isDate;
    var border = isFirst ? "": "with_3_borders";
    this.children = children;

    this.span = new Element('span', {'class' : 'selection_dialog_span ' + border, 'id' : 'sheet_number_format_'+f });
    this.span.set = isDate ? this.selectDateTime.bind(this) : this.select.bind(this);
    this.span.unset = this.selectNone.bind(this);
    this.span.update(new Element('img', {'src' : '/images/tool_bar/data_'+f+'.png'}));
    if (isLast) this.span.appendChild(new Element('img', {'src': "/images/tool_bar/arrow.png", 'class': 'down_arrow'}));

    var html = new Element('div', {'class': 'dialog', 'id': 'selection_dialog_selects_' + f});
    this.children.each(function(c) {this.createSelectWithLabel(html, c, true);}.bind(this));

    var buttons = new Element('div', {'id': 'selection_dialog_buttons_' + f, 'style' : 'text-align: right;'}).update('<hr style="width:90%;"/>');
    var button_ok = new Element('input', {'type': "submit", 'value': "Ok"}).observe('click', function(){this.submit();}.bind(this));
    var button_no = new Element('input', {'type': "reset", 'value': "Cancel"}).observe('click', function(){this.span.deactivate();}.bind(this));
    buttons.appendChild(button_no);
    buttons.appendChild(button_ok);

    this.div = new Element('div', {'class' : 'selection_dialog', 'id': 'selection_dialog_div_' + f, 'style' : 'display:none;width:250px;'});
    this.div.appendChild(html);
    this.div.appendChild(buttons);
    this.div.observe('mousedown', function(e) { if (e.target.nodeName.toLowerCase() != "select") Event.stop(e); });

    this.observers = [];
    if (callback) this.observe(callback);
    $(document.body).insert(this.div);

    this.span.observe('click', this.show.bind(this));
    this.span.activate = this.show.bind(this);
    this.span.deactivate = this.hide.bind(this);
  },

  createSelectWithLabel: function(html, name, float_left) {
    var select = new Swivel.Toolbar.AdvancedSelect(name);
    var label_class = 'label';
    if (float_left) label_class += ' float';
    html.appendChild(new Element('div', {'class': label_class}).update(this.formatLabelChoices(name)));
    html.appendChild(select.html());
    if (float_left) html.appendChild(new Element('div', {'style': 'clear:left;'}));
  },

  formatLabelChoices: function(f) {
    var formatLabelChoices = {
      "date": "Date",
      "time": "Time",
      "precision": "Number of Decimals",
      "negative": "Negative Number Format",
      // "magnitude": "Order of Magnitude",
      "prefix": "Prefix",
      "separator": "Separator",
      "suffix": "Suffix"
    };
    return formatLabelChoices[f];
  },

  hide: function() {
    this.div.hide();
  },

  html: function() {
    return this.span;
  },

  observe: function(f) {
    this.observers.push(f);
    return this;
  },

  select: function(format) {
    this.children.each(function(c) {
      var select = $('selection_dialog_select_' + c);
      select.set(format);
    });
  },

  // for date/time we would need to compare startsWith and endsWith
  selectDateTime: function(format) {
    // no need to look if t!=d or missing dt
    if (format["t"] != "d" || !format["dt"] || format["dt"] == '') return;

    var dateSelect = $('selection_dialog_select_date');
    var timeSelect = $('selection_dialog_select_time');
    dateSelect.selectedIndex = 0;
    timeSelect.selectedIndex = 0;

    for (i=0; i<dateSelect.options.length; i++) {
      if (dateSelect.options[i].disabled) continue;
      var dt = dateSelect.options[i].value.evalJSON()["dt"];
      if (dt == "") continue;
      if (format["dt"].startsWith(dt)) {
        dateSelect.selectedIndex = i;
        break;
      }
    }

    for (i=0; i<timeSelect.options.length; i++) {
      if (timeSelect.options[i].disabled) continue;
      var dt = timeSelect.options[i].value;
      if (dt == "") continue;
      if (format["dt"].endsWith(dt)) {
        timeSelect.selectedIndex = i;
        break;
      }
    }
  },

  selectNone: function() {
    this.children.each(function(c) {
      $('selection_dialog_select_' + c).selectedIndex = 0; // default
    });
  },

  show: function() {
    if (this.span.disabled) return;
    var left, top;
    if(Prototype.Browser.IE) {
      var rect = this.span.getBoundingClientRect();
      left = rect.left + 10;
      top = rect.bottom + 1;
    } else {
      left = this.span.offsetLeft + 9;
      top = this.span.offsetTop + this.span.offsetHeight + 1;
    }
    this.div.style.left = left + 'px';
    this.div.style.top = top + 'px';
    this.div.show();
    // too far right
    var viewport_width = document.viewport.getDimensions().width;
    if (left + this.div.clientWidth > viewport_width) {
      this.div.style.left = (viewport_width - this.div.clientWidth) + 'px';
    }
  },

  submit: function() {
    this.observers.each(function(f) { f(); });
    this.span.deactivate();
  }
});

Swivel.InPlaceEditor = Class.create({
  initialize: function(element, handler) {
    this._element = $(element);
    this._handler = handler;

    this._element.addClassName('inplaceeditable');
    this._element.observe('click', this._onClick.bindAsEventListener(this));
  },

  _onClick: function(e) {
    var boundSubmit = this._onSubmit.bindAsEventListener(this),
        boundCancel = this._onCancel.bindAsEventListener(this);

    var input = new Element('input', { type: 'text', value: this._element.innerHTML });
    input.observe('keydown', boundCancel);
    input.observe('blur', function() { boundSubmit.defer(); });
    this._form = new Element('form', { 'class': 'inplace' });
    this._form.onsubmit = function() {return false; };
    this._form.observe('submit', boundSubmit);
    this._form.insert(input);

    this._element.replace(this._form);
    input.activate();
  },

  _onSubmit: function() {
    if (this._form) {
      var value = $F(this._form.down('input'));

      this._form.replace(this._element.update(value));
      this._form = null;

      this._handler(value);
    }
  },

  _onCancel: function(e) {
    if (e.keyCode == Event.KEY_ESC && this._form) {
      this._form.replace(this._element);
      this._form = null;
    }
  }
});
// new Swivel.RestInPlaceEditor($('chart_title'), '/charts/1', 'charts[title]');
Swivel.RestInPlaceEditor = Class.create(Swivel.InPlaceEditor, {
  initialize: function($super, element, url, field) {
    this._url = url;
    this._field = field;

    $super(element, this._onUpdate.bind(this));
  },

  _onUpdate: function(value) {
    var params = Object.extend({}, Swivel.AuthenticityToken);
    params[this._field] = value;

    new Ajax.Request(this._url, {
      method: 'put',
      parameters: params
    });
  }
});

Swivel.Cookie = {
  write: function(name, value, expireDays) {
    var exdate = new Date();
    exdate.setTime(exdate.getTime() + expireDays * 24 * 60 * 60 * 1000);
    document.cookie = escape(name) + "=" + escape(value) +
      (expireDays == null ? "" : ";expires=" + exdate.toGMTString());
  },

  read: function (name) {
    if (document.cookie.length <= 0) return null;

    name = escape(name);

    var start = document.cookie.indexOf(name + "=");
    if (start == -1) return null;
    start = start + name.length + 1;

    var end = document.cookie.indexOf(";", start);
    if (end == -1) end = document.cookie.length;

    return unescape(document.cookie.substring(start, end));
  },

  clear: function(name) {
    Swivel.Cookie.write(name, '', -1);
  }
};

Swivel.Keyboard = Class.create({
  initialize: function(options) {
    opts = {
      _debug: false,
      // if set to false, you can have multiple callbacks for a single event (if you had ctrl+k and meta+k for instance)
      _onlyOneCallback: true,
      _keydown: Swivel.keyDown(),
      _allShortcuts: []
    };
    Object.extend(opts, options || {});
    Object.extend(this, opts);
  },

  observe: function(shortcuts) {
    shortcuts.each( this._addShortcut.bind(this) );
  },

  /**
   * Nomenclature
   *  "ctrl+a"          : ctrl, meta, alt, and shift are allowed
   *  "esc"             : for special chars, look at #keys
   *  "ctrl+[a-zA-Z]"   : square brackets indicate regex. use double backslashes
   *
   * Options
   *  "condition"       : only run if condition function is met
   *  "metaOrCtrl"      : by default, meta and ctrl keys are treated the same
   *  "ignoreShift"     : ctrl+a and ctrl+shift+a should not be treated the same
   *  "propagate"       : allows the event to be propagated if set to true
   */
  _addShortcut: function(shortcut) {
    if (shortcut.name) {
      var s = {
        condition: function() {return true;},
        ignoreShift: false,
        metaOrCtrl: true,
        print: false,
        propagate: false
      };
      Object.extend(s, this._parseShortcut(shortcut));
      this._allShortcuts.push(s);
    }
  },

  _log: function(x) {
    if (this._debug) {
      if (Prototype.Browser.IE) {
        // alert(x);
      } else {
        console.log(x);
      }
    }
  },

  dispatch: function(ev) {
    if (![16, 17, 18, 20].include(ev.keyCode)) this._log('-> dispatched(k,c) = '+ev.type+'(' + ev.keyCode + ", " + ev.charCode + ')');
    var eventItem = this._parseEvent(ev);
    if (eventItem) {
      this._allShortcuts.any(function(shortcut) {
        if (this._equals(shortcut, eventItem)) {
          this._log('\tshortcut = ' + shortcut.name + ", " + shortcut.condition() + ", " + !!shortcut.callback);
          if (shortcut.condition() && shortcut.callback) {
            this._log('here, ' + shortcut.print + ":"+this._convertToCharacter(eventItem, true));
            if (shortcut.print) {
              if (!Prototype.Browser.Gecko && (this._lastKeyCode == eventItem.keyCode)) {
                this._lastKeyCode = null;
                return false;
              }
              this._lastKeyCode = null; // clear here too
              // IE/WK should ignore keydown for printable chars
              if (Prototype.Browser.Gecko || eventItem.type == 'keypress') {
                shortcut.callback(this._convertToCharacter(eventItem, true));
              }
              else return false;
            } else {
              // IE should ignore keypress for nonprintable chars
              if (Prototype.Browser.Gecko || eventItem.type == 'keydown') {
                this._log("keydown");
                shortcut.callback();
                if (!Prototype.Browser.Gecko) {
                  this._lastKeyCode = eventItem.keyCode; // suppress next keydown for printing chars
                }
              }
              else return false;
            }
          }
          if (!shortcut.propagate) {
            ev.stop();
          }
          return this._onlyOneCallback;
        }
        return false;
      }, this);
    }
  },

  _equals: function(shortcut, eventItem) {
    var meta = shortcut.modifiers.meta  == eventItem.modifiers.meta;
    var ctrl = shortcut.modifiers.ctrl  == eventItem.modifiers.ctrl;
    if (shortcut.metaOrCtrl) {
      meta = (shortcut.modifiers.meta || shortcut.modifiers.ctrl) ==
            (eventItem.modifiers.meta || eventItem.modifiers.ctrl);
      ctrl = meta;
    }
    var alt  = shortcut.modifiers.alt   == eventItem.modifiers.alt;
    var shift = shortcut.ignoreShift || (shortcut.modifiers.shift == eventItem.modifiers.shift);

    if (! (meta && ctrl && alt && shift)) return false;

    if (shortcut.key.match(/^\[.+\]$/)) {
      if (eventItem.key.match(eval("/" + shortcut.key + "/"))) {
        return eventItem.printable;
      } else {
        return false;
      }
    }

    return shortcut.key == eventItem.key.toLowerCase();
  },

  geckoKeepKeyDown: function(e) {
    var type = ((e.keyCode == 32 && e.ctrlKey) || (e.altKey)) ? 'keydown' : 'keypress';
    return e.type == type;
  },

  _parseEvent: function(ev) {
    if (Prototype.Browser.Gecko) {
      if (!this.geckoKeepKeyDown(ev)) {
        return false;
      }
    }
    var swEvent = {};
    swEvent.type = ev.type;
    swEvent.keyCode = ev.keyCode;
    swEvent.charCode = ev.charCode;
    if (Prototype.Browser.Gecko && swEvent.type == 'keydown') {
      swEvent.charCode = swEvent.keyCode; // ctrl + space issue
    }
    swEvent.modifiers = {
      ctrl:   !!ev.ctrlKey,
      alt:    !!ev.altKey,
      meta:   !!ev.metaKey,
      shift:  !!ev.shiftKey
    };
    swEvent.printable = this._convertToCharacter(swEvent);
    swEvent.key = swEvent.printable || this._specialKeys(swEvent.keyCode);
    if (swEvent.key == "ignore") return false;
    if (this._debug) {
      var fullName = (swEvent.modifiers.meta ? "meta+"  : "") +
        (swEvent.modifiers.ctrl ? "ctrl+" : "") +
        (swEvent.modifiers.alt  ? "alt+"  : "") +
        (swEvent.modifiers.shift? "shift+": "") +
        swEvent.key;
      this._log("\tevent = [ " + fullName + " ]" + (swEvent.printable ? " => " + swEvent.printable : ""));
    }
    if (swEvent.key === undefined || swEvent.key === null) swEvent.key = '';
    return swEvent;
  },

  _convertToCharacter: function(ev, unShifted) {
    if (!this._printable(ev)) return null;
    var c = String.fromCharCode(Prototype.Browser.Gecko ? ev.charCode : ev.keyCode);

    if (Prototype.Browser.Gecko && ev.charCode == 31) return '-'; // special case in ctrl+-
    if (ev.shiftKey && !unShifted) {
      return this._downShift(c); // shift + chars
    }
    return c;
  },

  _downShift: function(c) {
    var from = $A("~!@#$%^&*()_+{}|:\"<>?");
    var to   = $A("`1234567890-=[]\\;',./");
    var index = from.indexOf(c);
    if (index == -1) return c;
    return to[index];
  },

  _toLowerCase: function(c) {
    if (!c.match(/[A-Z]/)) return c;
    return c.toLowerCase();
  },

  _specialKeys: function(keyCode) {
    var ignore = {16: 'shift', 17: 'meta', 18: 'alt'};
    if (ignore[keyCode]) return "ignore";

    var keys = {
        8: 'delete', 12: 'delete', 46: 'delete',
        9: 'tab',
       13: 'enter',  27: 'escape',
       33: 'pgup',   34: 'pgdn',
       35: 'end',    36: 'home',
       37: 'left',   38: 'up',     39: 'right',  40: 'down',
      112: 'f1',    113: 'f2',    114: 'f3',    115: 'f4',    116: 'f5',
      117: 'f6',    118: 'f7',    119: 'f8',    120: 'f9',    121: 'f10',
      122: 'f11',   123: 'f12',   124: 'f13',   125: 'f14',   126: 'f15',
      127: 'f16',   128: 'f17',   129: 'f18',   130: 'f19',
      186: ';',     187: '=',     188: ',',     189: '-',     190: '.',     191: '/',     192: '`',
      219: '[',     220: "\\",    221: ']',     222: "'"
    };
    for (var i=0; i<10; i++) keys[48+i] = String(i);
    return keys[keyCode];
  },

  _printable: function(ev) {
    var code = Prototype.Browser.Gecko ? ev.charCode : ev.keyCode;
    // ignore these printable chars for keydown in IE and WK
    if (!Prototype.Browser.Gecko && ev.type == 'keydown') {
      if ( 33 <= code && code <= 40) return false; // arrows
      if ( 46 <= code && code <= 57) return false; // shift+0-9
      if (112 <= code && code <=126) return false; // f1-f19
    }
    if ( 31 <= code && code <= 126) return true; // 31 is '-' in FF when ctrl is pressed
    return false; // none of these
  },

  _parseShortcut: function(shortcut) {
    var name = shortcut.name;
    var modifiers = {
      meta:   !! name.match(/meta/),
      ctrl:   !! name.match(/ctrl/),
      'alt':  !! name.match(/alt/),
      shift:  !! name.match(/shift/)
    };
    var values = {
      key: name.split('+').last(),
      modifiers: modifiers
    };
    Object.extend(values, shortcut);
    return values;
  }
});
