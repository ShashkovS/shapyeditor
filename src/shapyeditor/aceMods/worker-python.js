// ВАЖНО: Этот файл должен называться именно worker-python!
const pythonValidationUrl = location.origin + '/shapyeditor/aceMods/python-validation.min.js';
http://localhost:63343/shapyeditor/aceMods/python-validation.min.js
http://localhost:63343/shapyeditor/src/shapyeditor/ace/ace.min.js


console.warn('Worker validator start');
/**
 * Этот worker создан на основе worker-json.js (https://github.com/ajaxorg/ace-builds/blob/master/src-noconflict/worker-json.js)
 * Везде json был заменён на python
 * После чего в каждую функцию был добавлен console.log, чтобы выявить неиспользуемые
 * Потом всё неиспользуемое было закомментировано (регулярные выражения жгут!)
 */
const eventDataSaver = {
  data: null,
};

!(function (window) {
  if (typeof window.window !== 'undefined' && window.document) return;
  if (window.require && window.define) return;

  if (!window.console) {
    window.console = function () { // console.log('run console');
      const msgs = Array.prototype.slice.call(arguments, 0);
      postMessage({type: 'log', data: msgs});
    };
    window.console.error = window.console.warn = window.console.log = window.console.trace = window.console;
  }
  window.window = window;
  window.ace = window;

  window.onerror = function (message, file, line, col, err) { // console.log('run onerror');
    postMessage({
      type: 'error',
      data: {
        message,
        data: err.data,
        file,
        line,
        col,
        stack: err.stack,
      },
    });
  };

  window.normalizeModule = function (parentId, moduleName) { // console.log('run normalizeModule');
    // normalize plugin requires
    if (moduleName.indexOf('!') !== -1) {
      const chunks = moduleName.split('!');
      return `${window.normalizeModule(parentId, chunks[0])}!${window.normalizeModule(parentId, chunks[1])}`;
    }
    // normalize relative requires
    if (moduleName.charAt(0) === '.') {
      const base = parentId.split('/').slice(0, -1).join('/');
      moduleName = (base ? `${base}/` : '') + moduleName;

      let previous;
      while (moduleName.indexOf('.') !== -1 && previous !== moduleName) {
        previous = moduleName;
        moduleName = moduleName.replace(/^\.\//, '').replace(/\/\.\//, '/').replace(/[^\/]+\/\.\.\//, '');
      }
    }

    return moduleName;
  };

  window.require = function require(parentId, id) { // console.log('run require'); // console.log('run require');
    if (!id) {
      id = parentId;
      parentId = null;
    }
    if (!id.charAt) throw new Error('worker.js require() accepts only (parentId, id) as arguments');

    id = window.normalizeModule(parentId, id);

    const module = window.require.modules[id];
    if (module) {
      if (!module.initialized) {
        module.initialized = true;
        module.exports = module.factory().exports;
      }
      return module.exports;
    }

    if (!window.require.tlns) return console.log(`unable to load ${id}`);

    let path = resolveModuleId(id, window.require.tlns);
    if (path.slice(-3) !== '.js') path += '.js';

    window.require.id = id;
    window.require.modules[id] = {}; // prevent infinite loop on broken modules
    importScripts(path);
    return window.require(parentId, id);
  };

  function resolveModuleId(id, paths) { // console.log('run resolveModuleId');
    let testPath = id, tail = '';
    while (testPath) {
      const alias = paths[testPath];
      if (typeof alias === 'string') {
        return alias + tail;
      }
      if (alias) {
        return alias.location.replace(/\/*$/, '/') + (tail || alias.main || alias.name);
      }
      if (alias === false) {
        return '';
      }
      const i = testPath.lastIndexOf('/');
      if (i === -1) break;
      tail = testPath.substr(i) + tail;
      testPath = testPath.slice(0, i);
    }
    return id;
  }

  window.require.modules = {};
  window.require.tlns = {};

  window.define = function (id, deps, factory) { // console.log('run define');
    if (arguments.length === 2) {
      factory = deps;
      if (typeof id !== 'string') {
        deps = id;
        id = window.require.id;
      }
    } else if (arguments.length === 1) {
      factory = id;
      deps = [];
      id = window.require.id;
    }

    if (typeof factory !== 'function') {
      window.require.modules[id] = {
        exports: factory,
        initialized: true,
      };
      return;
    }

    if (!deps.length)
      // If there is no dependencies, we inject "require", "exports" and
      // "module" as dependencies, to provide CommonJS compatibility.
    {
      deps = ['require', 'exports', 'module'];
    }

    const req = function (childId) {
      return window.require(id, childId);
    };

    window.require.modules[id] = {
      exports: {},
      factory() { // console.log('run factory');
        const module = this;
        const returnExports = factory.apply(this, deps.slice(0, factory.length).map((dep) => {
          switch (dep) {
            // Because "require", "exports" and "module" aren't actual
            // dependencies, we must handle them seperately.
            case 'require':
              return req;
            case 'exports':
              return module.exports;
            case 'module':
              return module;
            // But for all other dependencies, we can just go ahead and
            // require them.
            default:
              return req(dep);
          }
        }));
        if (returnExports) module.exports = returnExports;
        return module;
      },
    };
  };
  window.define.amd = {};
  require.tlns = {};
  window.initBaseUrls = function initBaseUrls(topLevelNamespaces) { // console.log('run initBaseUrls'); // console.log('run initBaseUrls');
    for (const i in topLevelNamespaces) require.tlns[i] = topLevelNamespaces[i];
  };

  window.initSender = function initSender() { // console.log('run initSender'); // console.log('run initSender');
    const {EventEmitter} = window.require('ace/lib/event_emitter');
    const oop = window.require('ace/lib/oop');

    const Sender = function () {
    };

    (function () {
      oop.implement(this, EventEmitter);

      // this.callback = function(data, callbackId) { // console.log('run callback');
      //   postMessage({
      //     type: "call",
      //     id: callbackId,
      //     data: data
      //   });
      // };

      this.emit = function (name, data) { // console.log('run emit');
        postMessage({
          type: 'event',
          name,
          data,
        });
      };
    }).call(Sender.prototype);

    return new Sender();
  };

  let main = window.main = null;
  let sender = window.sender = null;

  window.onmessage = function (e) { // console.log('run onmessage');
    eventDataSaver.data = e.data;
    const msg = e.data;
    if (msg.event && sender) {
      sender._signal(msg.event, msg.data);
    } else if (msg.command) {
      if (main[msg.command]) {
        main[msg.command].apply(main, msg.args);
      } else if (window[msg.command]) {
        window[msg.command].apply(window, msg.args);
      } else {
        throw new Error(`Unknown command:${msg.command}`);
      }
    } else if (msg.init) {
      window.initBaseUrls(msg.tlns);
      sender = window.sender = window.initSender();
      const clazz = require(msg.module)[msg.classname];
      main = window.main = new clazz(sender);
    }
  };
}(this));

ace.define('ace/lib/oop', [], (require, exports, module) => { // console.log('run "ace/lib/oop"');

  "use strict";

  exports.inherits = function (ctor, superCtor) { // console.log('run inherits');
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true,
      },
    });
  };

  exports.mixin = function (obj, mixin) { // console.log('run mixin');
    for (const key in mixin) {
      obj[key] = mixin[key];
    }
    return obj;
  };

  exports.implement = function (proto, mixin) { // console.log('run implement');
    exports.mixin(proto, mixin);
  };
});

ace.define('ace/range', [], (require, exports, module) => { // console.log('run "ace/range",[');

  "use strict";

  const comparePoints = function (p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
  };
  const Range = function (startRow, startColumn, endRow, endColumn) {
    this.start = {
      row: startRow,
      column: startColumn,
    };

    this.end = {
      row: endRow,
      column: endColumn,
    };
  };

  (function () {
    // this.isEqual = function(range) { // console.log('run isEqual');
    //   return this.start.row === range.start.row &&
    //     this.end.row === range.end.row &&
    //     this.start.column === range.start.column &&
    //     this.end.column === range.end.column;
    // };
    // this.toString = function() { // console.log('run toString');
    //   return ("Range: [" + this.start.row + "/" + this.start.column +
    //     "] -> [" + this.end.row + "/" + this.end.column + "]");
    // };

    // this.contains = function(row, column) { // console.log('run contains');
    //   return this.compare(row, column) == 0;
    // };
    // this.compareRange = function(range) { // console.log('run compareRange');
    //   const cmp,
    //     end = range.end,
    //     start = range.start;
    //
    //   cmp = this.compare(end.row, end.column);
    //   if (cmp == 1) {
    //     cmp = this.compare(start.row, start.column);
    //     if (cmp == 1) {
    //       return 2;
    //     } else if (cmp == 0) {
    //       return 1;
    //     } else {
    //       return 0;
    //     }
    //   } else if (cmp == -1) {
    //     return -2;
    //   } else {
    //     cmp = this.compare(start.row, start.column);
    //     if (cmp == -1) {
    //       return -1;
    //     } else if (cmp == 1) {
    //       return 42;
    //     } else {
    //       return 0;
    //     }
    //   }
    // };
    // this.comparePoint = function(p) { // console.log('run comparePoint');
    //   return this.compare(p.row, p.column);
    // };
    // this.containsRange = function(range) { // console.log('run containsRange');
    //   return this.comparePoint(range.start) == 0 && this.comparePoint(range.end) == 0;
    // };
    // this.intersects = function(range) { // console.log('run intersects');
    //   const cmp = this.compareRange(range);
    //   return (cmp == -1 || cmp == 0 || cmp == 1);
    // };
    // this.isEnd = function(row, column) { // console.log('run isEnd');
    //   return this.end.row == row && this.end.column == column;
    // };
    // this.isStart = function(row, column) { // console.log('run isStart');
    //   return this.start.row == row && this.start.column == column;
    // };
    // this.setStart = function(row, column) { // console.log('run setStart');
    //   if (typeof row == "object") {
    //     this.start.column = row.column;
    //     this.start.row = row.row;
    //   } else {
    //     this.start.row = row;
    //     this.start.column = column;
    //   }
    // };
    // this.setEnd = function(row, column) { // console.log('run setEnd');
    //   if (typeof row == "object") {
    //     this.end.column = row.column;
    //     this.end.row = row.row;
    //   } else {
    //     this.end.row = row;
    //     this.end.column = column;
    //   }
    // };
    // this.inside = function(row, column) { // console.log('run inside');
    //   if (this.compare(row, column) == 0) {
    //     if (this.isEnd(row, column) || this.isStart(row, column)) {
    //       return false;
    //     } else {
    //       return true;
    //     }
    //   }
    //   return false;
    // };
    // this.insideStart = function(row, column) { // console.log('run insideStart');
    //   if (this.compare(row, column) == 0) {
    //     if (this.isEnd(row, column)) {
    //       return false;
    //     } else {
    //       return true;
    //     }
    //   }
    //   return false;
    // };
    // this.insideEnd = function(row, column) { // console.log('run insideEnd');
    //   if (this.compare(row, column) == 0) {
    //     if (this.isStart(row, column)) {
    //       return false;
    //     } else {
    //       return true;
    //     }
    //   }
    //   return false;
    // };
    // this.compare = function(row, column) { // console.log('run compare');
    //   if (!this.isMultiLine()) {
    //     if (row === this.start.row) {
    //       return column < this.start.column ? -1 : (column > this.end.column ? 1 : 0);
    //     }
    //   }
    //
    //   if (row < this.start.row)
    //     return -1;
    //
    //   if (row > this.end.row)
    //     return 1;
    //
    //   if (this.start.row === row)
    //     return column >= this.start.column ? 0 : -1;
    //
    //   if (this.end.row === row)
    //     return column <= this.end.column ? 0 : 1;
    //
    //   return 0;
    // };
    // this.compareStart = function(row, column) { // console.log('run compareStart');
    //   if (this.start.row == row && this.start.column == column) {
    //     return -1;
    //   } else {
    //     return this.compare(row, column);
    //   }
    // };
    // this.compareEnd = function(row, column) { // console.log('run compareEnd');
    //   if (this.end.row == row && this.end.column == column) {
    //     return 1;
    //   } else {
    //     return this.compare(row, column);
    //   }
    // };
    // this.compareInside = function(row, column) { // console.log('run compareInside');
    //   if (this.end.row == row && this.end.column == column) {
    //     return 1;
    //   } else if (this.start.row == row && this.start.column == column) {
    //     return -1;
    //   } else {
    //     return this.compare(row, column);
    //   }
    // };
    // this.clipRows = function(firstRow, lastRow) { // console.log('run clipRows');
    //   if (this.end.row > lastRow)
    //     const end = {row: lastRow + 1, column: 0};
    //   else if (this.end.row < firstRow)
    //     const end = {row: firstRow, column: 0};
    //
    //   if (this.start.row > lastRow)
    //     const start = {row: lastRow + 1, column: 0};
    //   else if (this.start.row < firstRow)
    //     const start = {row: firstRow, column: 0};
    //
    //   return Range.fromPoints(start || this.start, end || this.end);
    // };
    // this.extend = function(row, column) { // console.log('run extend');
    //   const cmp = this.compare(row, column);
    //
    //   if (cmp == 0)
    //     return this;
    //   else if (cmp == -1)
    //     const start = {row: row, column: column};
    //   else
    //     const end = {row: row, column: column};
    //
    //   return Range.fromPoints(start || this.start, end || this.end);
    // };

    // this.isEmpty = function() { // console.log('run isEmpty');
    //   return (this.start.row === this.end.row && this.start.column === this.end.column);
    // };
    // this.isMultiLine = function() { // console.log('run isMultiLine');
    //   return (this.start.row !== this.end.row);
    // };
    // this.clone = function() { // console.log('run clone');
    //   return Range.fromPoints(this.start, this.end);
    // };
    // this.collapseRows = function() { // console.log('run collapseRows');
    //   if (this.end.column == 0)
    //     return new Range(this.start.row, 0, Math.max(this.start.row, this.end.row-1), 0);
    //   else
    //     return new Range(this.start.row, 0, this.end.row, 0);
    // };
    // this.toScreenRange = function(session) { // console.log('run toScreenRange');
    //   const screenPosStart = session.documentToScreenPosition(this.start);
    //   const screenPosEnd = session.documentToScreenPosition(this.end);
    //
    //   return new Range(
    //     screenPosStart.row, screenPosStart.column,
    //     screenPosEnd.row, screenPosEnd.column
    //   );
    // };
    // this.moveBy = function(row, column) { // console.log('run moveBy');
    //   this.start.row += row;
    //   this.start.column += column;
    //   this.end.row += row;
    //   this.end.column += column;
    // };

  }).call(Range.prototype);
  // Range.fromPoints = function(start, end) { // console.log('run fromPoints');
  //   return new Range(start.row, start.column, end.row, end.column);
  // };
  Range.comparePoints = comparePoints;

  // Range.comparePoints = function(p1, p2) { // console.log('run comparePoints');
  //   return p1.row - p2.row || p1.column - p2.column;
  // };

  exports.Range = Range;
});

ace.define('ace/apply_delta', [], (require, exports, module) => { // console.log('run "ace/apply_delta",[');

  "use strict";

  // function throwDeltaError(delta, errorText){ // console.log('run throwDeltaError');
  //   console.log("Invalid Delta:", delta);
  //   throw "Invalid Delta: " + errorText;
  // }

  // function positionInDocument(docLines, position) { // console.log('run positionInDocument');
  //   return position.row    >= 0 && position.row    <  docLines.length &&
  //     position.column >= 0 && position.column <= docLines[position.row].length;
  // }

  // function validateDelta(docLines, delta) { // console.log('run validateDelta');
  //   if (delta.action != "insert" && delta.action != "remove")
  //     throwDeltaError(delta, "delta.action must be 'insert' or 'remove'");
  //   if (!(delta.lines instanceof Array))
  //     throwDeltaError(delta, "delta.lines must be an Array");
  //   if (!delta.start || !delta.end)
  //     throwDeltaError(delta, "delta.start/end must be an present");
  //   const start = delta.start;
  //   if (!positionInDocument(docLines, delta.start))
  //     throwDeltaError(delta, "delta.start must be contained in document");
  //   const end = delta.end;
  //   if (delta.action == "remove" && !positionInDocument(docLines, end))
  //     throwDeltaError(delta, "delta.end must contained in document for 'remove' actions");
  //   const numRangeRows = end.row - start.row;
  //   const numRangeLastLineChars = (end.column - (numRangeRows == 0 ? start.column : 0));
  //   if (numRangeRows != delta.lines.length - 1 || delta.lines[numRangeRows].length != numRangeLastLineChars)
  //     throwDeltaError(delta, "delta.range must match delta lines");
  // }

  exports.applyDelta = function (docLines, delta, doNotValidate) { // console.log('run applyDelta');
    const {row} = delta.start;
    const startColumn = delta.start.column;
    const line = docLines[row] || '';
    switch (delta.action) {
      case 'insert':
        const {lines} = delta;
        if (lines.length === 1) {
          docLines[row] = line.substring(0, startColumn) + delta.lines[0] + line.substring(startColumn);
        } else {
          const args = [row, 1].concat(delta.lines);
          docLines.splice.apply(docLines, args);
          docLines[row] = line.substring(0, startColumn) + docLines[row];
          docLines[row + delta.lines.length - 1] += line.substring(startColumn);
        }
        break;
      case 'remove':
        const endColumn = delta.end.column;
        const endRow = delta.end.row;
        if (row === endRow) {
          docLines[row] = line.substring(0, startColumn) + line.substring(endColumn);
        } else {
          docLines.splice(
            row, endRow - row + 1,
            line.substring(0, startColumn) + docLines[endRow].substring(endColumn),
          );
        }
        break;
    }
  };
});

ace.define('ace/lib/event_emitter', [], (require, exports, module) => { // console.log('run "ace/lib/event_emitter"');

  "use strict";

  const EventEmitter = {};
  // const stopPropagation = function() { this.propagationStopped = true; };
  // const preventDefault = function() { this.defaultPrevented = true; };

  EventEmitter._emit =
    // EventEmitter._dispatchEvent = function(eventName, e) { // console.log('run _dispatchEvent');
    //   this._eventRegistry || (this._eventRegistry = {});
    //   this._defaultHandlers || (this._defaultHandlers = {});
    //
    //   const listeners = this._eventRegistry[eventName] || [];
    //   const defaultHandler = this._defaultHandlers[eventName];
    //   if (!listeners.length && !defaultHandler)
    //     return;
    //
    //   if (typeof e != "object" || !e)
    //     e = {};
    //
    //   if (!e.type)
    //     e.type = eventName;
    //   if (!e.stopPropagation)
    //     e.stopPropagation = stopPropagation;
    //   if (!e.preventDefault)
    //     e.preventDefault = preventDefault;
    //
    //   listeners = listeners.slice();
    //   for (const i=0; i<listeners.length; i++) {
    //     listeners[i](e, this);
    //     if (e.propagationStopped)
    //       break;
    //   }
    //
    //   if (defaultHandler && !e.defaultPrevented)
    //     return defaultHandler(e, this);
    // };

    EventEmitter._signal = function (eventName, e) { // console.log('run _signal');
      let listeners = (this._eventRegistry || {})[eventName];
      if (!listeners) return;
      listeners = listeners.slice();
      for (let i = 0; i < listeners.length; i++) listeners[i](e, this);
    };

  // EventEmitter.once = function(eventName, callback) { // console.log('run once');
  //   const _self = this;
  //   this.on(eventName, function newCallback() { // console.log('run newCallback');
  //     _self.off(eventName, newCallback);
  //     callback.apply(null, arguments);
  //   });
  //   if (!callback) {
  //     return new Promise(function(resolve) {
  //       callback = resolve;
  //     });
  //   }
  // };

  // EventEmitter.setDefaultHandler = function(eventName, callback) { // console.log('run setDefaultHandler');
  //   const handlers = this._defaultHandlers;
  //   if (!handlers)
  //     handlers = this._defaultHandlers = {_disabled_: {}};
  //
  //   if (handlers[eventName]) {
  //     const old = handlers[eventName];
  //     const disabled = handlers._disabled_[eventName];
  //     if (!disabled)
  //       handlers._disabled_[eventName] = disabled = [];
  //     disabled.push(old);
  //     const i = disabled.indexOf(callback);
  //     if (i != -1)
  //       disabled.splice(i, 1);
  //   }
  //   handlers[eventName] = callback;
  // };
  // EventEmitter.removeDefaultHandler = function(eventName, callback) { // console.log('run removeDefaultHandler');
  //   const handlers = this._defaultHandlers;
  //   if (!handlers)
  //     return;
  //   const disabled = handlers._disabled_[eventName];
  //
  //   if (handlers[eventName] == callback) {
  //     if (disabled)
  //       this.setDefaultHandler(eventName, disabled.pop());
  //   } else if (disabled) {
  //     const i = disabled.indexOf(callback);
  //     if (i != -1)
  //       disabled.splice(i, 1);
  //   }
  // };

  EventEmitter.on = EventEmitter.addEventListener = function (eventName, callback, capturing) { // console.log('run addEventListener');
    this._eventRegistry = this._eventRegistry || {};

    let listeners = this._eventRegistry[eventName];
    if (!listeners) listeners = this._eventRegistry[eventName] = [];

    if (listeners.indexOf(callback) == -1) listeners[capturing ? 'unshift' : 'push'](callback);
    return callback;
  };

  EventEmitter.off = EventEmitter.removeListener =
    // EventEmitter.removeEventListener = function(eventName, callback) { // console.log('run removeEventListener');
    //   this._eventRegistry = this._eventRegistry || {};
    //
    //   const listeners = this._eventRegistry[eventName];
    //   if (!listeners)
    //     return;
    //
    //   const index = listeners.indexOf(callback);
    //   if (index !== -1)
    //     listeners.splice(index, 1);
    // };

    // EventEmitter.removeAllListeners = function(eventName) { // console.log('run removeAllListeners');
    //   if (!eventName) this._eventRegistry = this._defaultHandlers = undefined;
    //   if (this._eventRegistry) this._eventRegistry[eventName] = undefined;
    //   if (this._defaultHandlers) this._defaultHandlers[eventName] = undefined;
    // };

    exports.EventEmitter = EventEmitter;
});

ace.define('ace/anchor', [], (require, exports, module) => { // console.log('run "ace/anchor",[');

  "use strict";

  const oop = require('./lib/oop');
  const {EventEmitter} = require('./lib/event_emitter');

  const Anchor = exports.Anchor = function (doc, row, column) { // console.log('run Anchor');
    this.$onChange = this.onChange.bind(this);
    this.attach(doc);

    if (typeof column === 'undefined') {
      this.setPosition(row.row, row.column);
    } else {
      this.setPosition(row, column);
    }
  };

  (function () {
    oop.implement(this, EventEmitter);
    // this.getPosition = function() { // console.log('run getPosition');
    //   return this.$clipPositionToDocument(this.row, this.column);
    // };
    // this.getDocument = function() { // console.log('run getDocument');
    //   return this.document;
    // };
    // this.$insertRight = false;
    // this.onChange = function(delta) { // console.log('run onChange');
    //   if (delta.start.row == delta.end.row && delta.start.row != this.row)
    //     return;
    //
    //   if (delta.start.row > this.row)
    //     return;
    //
    //   const point = $getTransformedPoint(delta, {row: this.row, column: this.column}, this.$insertRight);
    //   this.setPosition(point.row, point.column, true);
    // };

    function $pointsInOrder(point1, point2, equalPointsInOrder) {
      const bColIsAfter = equalPointsInOrder ? point1.column <= point2.column : point1.column < point2.column;
      return (point1.row < point2.row) || (point1.row === point2.row && bColIsAfter);
    }

    function $getTransformedPoint(delta, point, moveIfEqual) {
      const deltaIsInsert = delta.action === 'insert';
      const deltaRowShift = (deltaIsInsert ? 1 : -1) * (delta.end.row - delta.start.row);
      const deltaColShift = (deltaIsInsert ? 1 : -1) * (delta.end.column - delta.start.column);
      const deltaStart = delta.start;
      const deltaEnd = deltaIsInsert ? deltaStart : delta.end; // Collapse insert range.
      if ($pointsInOrder(point, deltaStart, moveIfEqual)) {
        return {
          row: point.row,
          column: point.column,
        };
      }
      if ($pointsInOrder(deltaEnd, point, !moveIfEqual)) {
        return {
          row: point.row + deltaRowShift,
          column: point.column + (point.row === deltaEnd.row ? deltaColShift : 0),
        };
      }

      return {
        row: deltaStart.row,
        column: deltaStart.column,
      };
    }

    // this.setPosition = function(row, column, noClip) { // console.log('run setPosition');
    //   const pos;
    //   if (noClip) {
    //     pos = {
    //       row: row,
    //       column: column
    //     };
    //   } else {
    //     pos = this.$clipPositionToDocument(row, column);
    //   }
    //
    //   if (this.row == pos.row && this.column == pos.column)
    //     return;
    //
    //   const old = {
    //     row: this.row,
    //     column: this.column
    //   };
    //
    //   this.row = pos.row;
    //   this.column = pos.column;
    //   this._signal("change", {
    //     old: old,
    //     value: pos
    //   });
    // };
    // this.detach = function() { // console.log('run detach');
    //   this.document.off("change", this.$onChange);
    // };
    // this.attach = function(doc) { // console.log('run attach');
    //   this.document = doc || this.document;
    //   this.document.on("change", this.$onChange);
    // };
    // this.$clipPositionToDocument = function(row, column) {
    //   const pos = {};
    //
    //   if (row >= this.document.getLength()) {
    //     pos.row = Math.max(0, this.document.getLength() - 1);
    //     pos.column = this.document.getLine(pos.row).length;
    //   }
    //   else if (row < 0) {
    //     pos.row = 0;
    //     pos.column = 0;
    //   }
    //   else {
    //     pos.row = row;
    //     pos.column = Math.min(this.document.getLine(pos.row).length, Math.max(0, column));
    //   }
    //
    //   if (column < 0)
    //     pos.column = 0;
    //
    //   return pos;
    // };
  }).call(Anchor.prototype);
});

ace.define('ace/document', [], (require, exports, module) => { // console.log('run "ace/document",[');

  "use strict";

  const oop = require('./lib/oop');
  const {applyDelta} = require('./apply_delta');
  const {EventEmitter} = require('./lib/event_emitter');
  const {Range} = require('./range');
  // const Anchor = require("./anchor").Anchor;

  const Document = function (textOrLines) {
    this.$lines = [''];
    if (textOrLines.length === 0) {
      this.$lines = [''];
    } else if (Array.isArray(textOrLines)) {
      this.insertMergedLines({row: 0, column: 0}, textOrLines);
    } else {
      this.insert({row: 0, column: 0}, textOrLines);
    }
  };

  (function () {
    oop.implement(this, EventEmitter);
    this.setValue = function (text) { // console.log('run setValue');
      const len = this.getLength() - 1;
      this.remove(new Range(0, 0, len, this.getLine(len).length));
      this.insert({row: 0, column: 0}, text);
    };
    this.getValue = function () { // console.log('run getValue');
      return this.getAllLines().join(this.getNewLineCharacter());
    };
    // this.createAnchor = function(row, column) { // console.log('run createAnchor');
    //   return new Anchor(this, row, column);
    // };
    if ('aaa'.split(/a/).length === 0) {
      this.$split = function (text) {
        return text.replace(/\r\n|\r/g, '\n').split('\n');
      };
    } else {
      this.$split = function (text) {
        return text.split(/\r\n|\r|\n/);
      };
    }

    this.$detectNewLine = function (text) {
      const match = text.match(/^.*?(\r\n|\r|\n)/m);
      this.$autoNewLine = match ? match[1] : '\n';
      this._signal('changeNewLineMode');
    };
    this.getNewLineCharacter = function () { // console.log('run getNewLineCharacter');
      switch (this.$newLineMode) {
        case 'windows':
          return '\r\n';
        case 'unix':
          return '\n';
        default:
          return this.$autoNewLine || '\n';
      }
    };

    this.$autoNewLine = '';
    this.$newLineMode = 'auto';
    // this.setNewLineMode = function(newLineMode) { // console.log('run setNewLineMode');
    //   if (this.$newLineMode === newLineMode)
    //     return;
    //
    //   this.$newLineMode = newLineMode;
    //   this._signal("changeNewLineMode");
    // };
    // this.getNewLineMode = function() { // console.log('run getNewLineMode');
    //   return this.$newLineMode;
    // };
    // this.isNewLine = function(text) { // console.log('run isNewLine');
    //   return (text == "\r\n" || text == "\r" || text == "\n");
    // };
    this.getLine = function (row) { // console.log('run getLine');
      return this.$lines[row] || '';
    };
    this.getLines = function (firstRow, lastRow) { // console.log('run getLines');
      return this.$lines.slice(firstRow, lastRow + 1);
    };
    this.getAllLines = function () { // console.log('run getAllLines');
      return this.getLines(0, this.getLength());
    };
    this.getLength = function () { // console.log('run getLength');
      return this.$lines.length;
    };
    // this.getTextRange = function(range) { // console.log('run getTextRange');
    //   return this.getLinesForRange(range).join(this.getNewLineCharacter());
    // };
    this.getLinesForRange = function (range) { // console.log('run getLinesForRange');
      let lines;
      if (range.start.row === range.end.row) {
        lines = [this.getLine(range.start.row).substring(range.start.column, range.end.column)];
      } else {
        lines = this.getLines(range.start.row, range.end.row);
        lines[0] = (lines[0] || '').substring(range.start.column);
        const l = lines.length - 1;
        if (range.end.row - range.start.row === l) lines[l] = lines[l].substring(0, range.end.column);
      }
      return lines;
    };
    // this.insertLines = function(row, lines) { // console.log('run insertLines');
    //   console.warn("Use of document.insertLines is deprecated. Use the insertFullLines method instead.");
    //   return this.insertFullLines(row, lines);
    // };
    // this.removeLines = function(firstRow, lastRow) { // console.log('run removeLines');
    //   console.warn("Use of document.removeLines is deprecated. Use the removeFullLines method instead.");
    //   return this.removeFullLines(firstRow, lastRow);
    // };
    // this.insertNewLine = function(position) { // console.log('run insertNewLine');
    //   console.warn("Use of document.insertNewLine is deprecated. Use insertMergedLines(position, ['', '']) instead.");
    //   return this.insertMergedLines(position, ["", ""]);
    // };
    this.insert = function (position, text) { // console.log('run insert');
      if (this.getLength() <= 1) this.$detectNewLine(text);

      return this.insertMergedLines(position, this.$split(text));
    };
    // this.insertInLine = function(position, text) { // console.log('run insertInLine');
    //   const start = this.clippedPos(position.row, position.column);
    //   const end = this.pos(position.row, position.column + text.length);
    //
    //   this.applyDelta({
    //     start: start,
    //     end: end,
    //     action: "insert",
    //     lines: [text]
    //   }, true);
    //
    //   return this.clonePos(end);
    // };

    this.clippedPos = function (row, column) { // console.log('run clippedPos');
      const length = this.getLength();
      if (row === undefined) {
        row = length;
      } else if (row < 0) {
        row = 0;
      } else if (row >= length) {
        row = length - 1;
        column = undefined;
      }
      const line = this.getLine(row);
      if (column === undefined) column = line.length;
      column = Math.min(Math.max(column, 0), line.length);
      return {row, column};
    };

    this.clonePos = function (pos) { // console.log('run clonePos');
      return {row: pos.row, column: pos.column};
    };

    this.pos = function (row, column) { // console.log('run pos');
      return {row, column};
    };

    // this.$clipPosition = function(position) {
    //   const length = this.getLength();
    //   if (position.row >= length) {
    //     position.row = Math.max(0, length - 1);
    //     position.column = this.getLine(length - 1).length;
    //   } else {
    //     position.row = Math.max(0, position.row);
    //     position.column = Math.min(Math.max(position.column, 0), this.getLine(position.row).length);
    //   }
    //   return position;
    // };
    // this.insertFullLines = function(row, lines) { // console.log('run insertFullLines');
    //   row = Math.min(Math.max(row, 0), this.getLength());
    //   const column = 0;
    //   if (row < this.getLength()) {
    //     lines = lines.concat([""]);
    //     column = 0;
    //   } else {
    //     lines = [""].concat(lines);
    //     row--;
    //     column = this.$lines[row].length;
    //   }
    //   this.insertMergedLines({row: row, column: column}, lines);
    // };
    this.insertMergedLines = function (position, lines) { // console.log('run insertMergedLines');
      const start = this.clippedPos(position.row, position.column);
      const end = {
        row: start.row + lines.length - 1,
        column: (lines.length === 1 ? start.column : 0) + lines[lines.length - 1].length,
      };

      this.applyDelta({
        start,
        end,
        action: 'insert',
        lines,
      });

      return this.clonePos(end);
    };
    this.remove = function (range) { // console.log('run remove');
      const start = this.clippedPos(range.start.row, range.start.column);
      const end = this.clippedPos(range.end.row, range.end.column);
      this.applyDelta({
        start,
        end,
        action: 'remove',
        lines: this.getLinesForRange({start, end}),
      });
      return this.clonePos(start);
    };
    // this.removeInLine = function(row, startColumn, endColumn) { // console.log('run removeInLine');
    //   const start = this.clippedPos(row, startColumn);
    //   const end = this.clippedPos(row, endColumn);
    //
    //   this.applyDelta({
    //     start: start,
    //     end: end,
    //     action: "remove",
    //     lines: this.getLinesForRange({start: start, end: end})
    //   }, true);
    //
    //   return this.clonePos(start);
    // };
    // this.removeFullLines = function(firstRow, lastRow) { // console.log('run removeFullLines');
    //   firstRow = Math.min(Math.max(0, firstRow), this.getLength() - 1);
    //   lastRow  = Math.min(Math.max(0, lastRow ), this.getLength() - 1);
    //   const deleteFirstNewLine = lastRow == this.getLength() - 1 && firstRow > 0;
    //   const deleteLastNewLine  = lastRow  < this.getLength() - 1;
    //   const startRow = ( deleteFirstNewLine ? firstRow - 1                  : firstRow                    );
    //   const startCol = ( deleteFirstNewLine ? this.getLine(startRow).length : 0                           );
    //   const endRow   = ( deleteLastNewLine  ? lastRow + 1                   : lastRow                     );
    //   const endCol   = ( deleteLastNewLine  ? 0                             : this.getLine(endRow).length );
    //   const range = new Range(startRow, startCol, endRow, endCol);
    //   const deletedLines = this.$lines.slice(firstRow, lastRow + 1);
    //
    //   this.applyDelta({
    //     start: range.start,
    //     end: range.end,
    //     action: "remove",
    //     lines: this.getLinesForRange(range)
    //   });
    //   return deletedLines;
    // };
    // this.removeNewLine = function(row) { // console.log('run removeNewLine');
    //   if (row < this.getLength() - 1 && row >= 0) {
    //     this.applyDelta({
    //       start: this.pos(row, this.getLine(row).length),
    //       end: this.pos(row + 1, 0),
    //       action: "remove",
    //       lines: ["", ""]
    //     });
    //   }
    // };
    // this.replace = function(range, text) { // console.log('run replace');
    //   if (!(range instanceof Range))
    //     range = Range.fromPoints(range.start, range.end);
    //   if (text.length === 0 && range.isEmpty())
    //     return range.start;
    //   if (text == this.getTextRange(range))
    //     return range.end;
    //
    //   this.remove(range);
    //   const end;
    //   if (text) {
    //     end = this.insert(range.start, text);
    //   }
    //   else {
    //     end = range.start;
    //   }
    //
    //   return end;
    // };
    this.applyDeltas = function (deltas) { // console.log('run applyDeltas');
      for (let i = 0; i < deltas.length; i++) {
        this.applyDelta(deltas[i]);
      }
    };
    // this.revertDeltas = function(deltas) { // console.log('run revertDeltas');
    //   for (const i=deltas.length-1; i>=0; i--) {
    //     this.revertDelta(deltas[i]);
    //   }
    // };
    this.applyDelta = function (delta, doNotValidate) { // console.log('run applyDelta');
      const isInsert = delta.action === 'insert';
      if (isInsert ? delta.lines.length <= 1 && !delta.lines[0]
        : !Range.comparePoints(delta.start, delta.end)) {
        return;
      }

      if (isInsert && delta.lines.length > 20000) {
        this.$splitAndapplyLargeDelta(delta, 20000);
      } else {
        applyDelta(this.$lines, delta, doNotValidate);
        this._signal('change', delta);
      }
    };

    // this.$safeApplyDelta = function(delta) {
    //   const docLength = this.$lines.length;
    //   if (
    //     delta.action == "remove" && delta.start.row < docLength && delta.end.row < docLength
    //     || delta.action == "insert" && delta.start.row <= docLength
    //   ) {
    //     this.applyDelta(delta);
    //   }
    // };

    this.$splitAndapplyLargeDelta = function (delta, MAX) {
      const {lines} = delta;
      const l = lines.length - MAX + 1;
      const {row} = delta.start;
      let {column} = delta.start;
      for (let from = 0, to = 0; from < l; from = to) {
        to += MAX - 1;
        const chunk = lines.slice(from, to);
        chunk.push('');
        this.applyDelta({
          start: this.pos(row + from, column),
          end: this.pos(row + to, column = 0),
          action: delta.action,
          lines: chunk,
        }, true);
      }
      delta.lines = lines.slice(from);
      delta.start.row = row + from;
      delta.start.column = column;
      this.applyDelta(delta, true);
    };
    // this.revertDelta = function(delta) { // console.log('run revertDelta');
    //   this.$safeApplyDelta({
    //     start: this.clonePos(delta.start),
    //     end: this.clonePos(delta.end),
    //     action: (delta.action == "insert" ? "remove" : "insert"),
    //     lines: delta.lines.slice()
    //   });
    // };
    // this.indexToPosition = function(index, startRow) { // console.log('run indexToPosition');
    //   const lines = this.$lines || this.getAllLines();
    //   const newlineLength = this.getNewLineCharacter().length;
    //   for (const i = startRow || 0, l = lines.length; i < l; i++) {
    //     index -= lines[i].length + newlineLength;
    //     if (index < 0)
    //       return {row: i, column: index + lines[i].length + newlineLength};
    //   }
    //   return {row: l-1, column: index + lines[l-1].length + newlineLength};
    // };
    // this.positionToIndex = function(pos, startRow) { // console.log('run positionToIndex');
    //   const lines = this.$lines || this.getAllLines();
    //   const newlineLength = this.getNewLineCharacter().length;
    //   const index = 0;
    //   const row = Math.min(pos.row, lines.length);
    //   for (const i = startRow || 0; i < row; ++i)
    //     index += lines[i].length + newlineLength;
    //
    //   return index + pos.column;
    // };
  }).call(Document.prototype);

  exports.Document = Document;
});

ace.define('ace/lib/lang', [], (require, exports, module) => { // console.log('run "ace/lib/lang"');

  "use strict";

  // exports.last = function(a) { // console.log('run last');
  //   return a[a.length - 1];
  // };

  // exports.stringReverse = function(string) { // console.log('run stringReverse');
  //   return string.split("").reverse().join("");
  // };

  // exports.stringRepeat = function (string, count) { // console.log('run stringRepeat');
  //   const result = '';
  //   while (count > 0) {
  //     if (count & 1)
  //       result += string;
  //
  //     if (count >>= 1)
  //       string += string;
  //   }
  //   return result;
  // };

  // const trimBeginRegexp = /^\s\s*/;
  // const trimEndRegexp = /\s\s*$/;

  // exports.stringTrimLeft = function (string) { // console.log('run stringTrimLeft');
  //   return string.replace(trimBeginRegexp, '');
  // };

  // exports.stringTrimRight = function (string) { // console.log('run stringTrimRight');
  //   return string.replace(trimEndRegexp, '');
  // };

  // exports.copyObject = function(obj) { // console.log('run copyObject');
  //   const copy = {};
  //   for (const key in obj) {
  //     copy[key] = obj[key];
  //   }
  //   return copy;
  // };

  // exports.copyArray = function(array){ // console.log('run copyArray');
  //   const copy = [];
  //   for (const i=0, l=array.length; i<l; i++) {
  //     if (array[i] && typeof array[i] == "object")
  //       copy[i] = this.copyObject(array[i]);
  //     else
  //       copy[i] = array[i];
  //   }
  //   return copy;
  // };

  // exports.deepCopy = function deepCopy(obj) { // console.log('run deepCopy'); // console.log('run deepCopy');
  //   if (typeof obj !== "object" || !obj)
  //     return obj;
  //   const copy;
  //   if (Array.isArray(obj)) {
  //     copy = [];
  //     for (const key = 0; key < obj.length; key++) {
  //       copy[key] = deepCopy(obj[key]);
  //     }
  //     return copy;
  //   }
  //   if (Object.prototype.toString.call(obj) !== "[object Object]")
  //     return obj;
  //
  //   copy = {};
  //   for (const key in obj)
  //     copy[key] = deepCopy(obj[key]);
  //   return copy;
  // };

  // exports.arrayToMap = function(arr) { // console.log('run arrayToMap');
  //   const map = {};
  //   for (const i=0; i<arr.length; i++) {
  //     map[arr[i]] = 1;
  //   }
  //   return map;
  //
  // };

  // exports.createMap = function(props) { // console.log('run createMap');
  //   const map = Object.create(null);
  //   for (const i in props) {
  //     map[i] = props[i];
  //   }
  //   return map;
  // };
  // exports.arrayRemove = function(array, value) { // console.log('run arrayRemove');
  //   for (const i = 0; i <= array.length; i++) {
  //     if (value === array[i]) {
  //       array.splice(i, 1);
  //     }
  //   }
  // };

  // exports.escapeRegExp = function(str) { // console.log('run escapeRegExp');
  //   return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
  // };

  // exports.escapeHTML = function(str) { // console.log('run escapeHTML');
  //   return ("" + str).replace(/&/g, "&#38;").replace(/"/g, "&#34;").replace(/'/g, "&#39;").replace(/</g, "&#60;");
  // };

  // exports.getMatchOffsets = function(string, regExp) { // console.log('run getMatchOffsets');
  //   const matches = [];
  //
  //   string.replace(regExp, function(str) {
  //     matches.push({
  //       offset: arguments[arguments.length-2],
  //       length: str.length
  //     });
  //   });
  //
  //   return matches;
  // };
  // exports.deferredCall = function(fcn) { // console.log('run deferredCall');
  //   const timer = null;
  //   const callback = function() {
  //     timer = null;
  //     fcn();
  //   };
  //
  //   const deferred = function(timeout) {
  //     deferred.cancel();
  //     timer = setTimeout(callback, timeout || 0);
  //     return deferred;
  //   };
  //
  //   deferred.schedule = deferred;
  //
  //   deferred.call = function() { // console.log('run call');
  //     this.cancel();
  //     fcn();
  //     return deferred;
  //   };
  //
  //   deferred.cancel = function() { // console.log('run cancel');
  //     clearTimeout(timer);
  //     timer = null;
  //     return deferred;
  //   };
  //
  //   deferred.isPending = function() { // console.log('run isPending');
  //     return timer;
  //   };
  //
  //   return deferred;
  // };

  exports.delayedCall = function (fcn, defaultTimeout) { // console.log('run delayedCall');
    let timer = null;
    const callback = function () {
      timer = null;
      fcn();
    };

    const _self = function (timeout) {
      if (timer == null) timer = setTimeout(callback, timeout || defaultTimeout);
    };

    _self.delay = function (timeout) { // console.log('run delay');
      timer && clearTimeout(timer);
      timer = setTimeout(callback, timeout || defaultTimeout);
    };
    _self.schedule = _self;

    _self.call = function () { // console.log('run call');
      this.cancel();
      fcn();
    };

    _self.cancel = function () { // console.log('run cancel');
      timer && clearTimeout(timer);
      timer = null;
    };

    _self.isPending = function () { // console.log('run isPending');
      return timer;
    };

    return _self;
  };
});

ace.define('ace/worker/mirror', [], (require, exports, module) => { // console.log('run "ace/worker/mirror"');

  "use strict";

  const {Range} = require('../range');
  const {Document} = require('../document');
  const lang = require('../lib/lang');

  const Mirror = exports.Mirror = function (sender) { // console.log('run Mirror');
    this.sender = sender;
    const doc = this.doc = new Document('');

    const deferredUpdate = this.deferredUpdate = lang.delayedCall(this.onUpdate.bind(this));

    const _self = this;
    sender.on('change', (e) => {
      const {data} = e;
      if (data[0].start) {
        doc.applyDeltas(data);
      } else {
        for (let i = 0; i < data.length; i += 2) {
          let d;
          if (Array.isArray(data[i + 1])) {
            d = {action: 'insert', start: data[i], lines: data[i + 1]};
          } else {
            d = {action: 'remove', start: data[i], end: data[i + 1]};
          }
          doc.applyDelta(d, true);
        }
      }
      if (_self.$timeout) return deferredUpdate.schedule(_self.$timeout);
      _self.onUpdate();
    });
  };

  (function () {
    this.$timeout = 500;

    this.setTimeout = function (timeout) { // console.log('run setTimeout');
      this.$timeout = timeout;
    };

    this.setValue = function (value) { // console.log('run setValue');
      this.doc.setValue(value);
      this.deferredUpdate.schedule(this.$timeout);
    };

    this.getValue = function (callbackId) { // console.log('run getValue');
      this.sender.callback(this.doc.getValue(), callbackId);
    };

    this.onUpdate = function () { // console.log('run onUpdate');
    };

    // this.isPending = function() { // console.log('run isPending');
    //   return this.deferredUpdate.isPending();
    // };
  }).call(Mirror.prototype);
});

importScripts(pythonValidationUrl);
ace.define('ace/mode/python_worker', [], (require, exports, module) => { // console.log('run "ace/mode/python_worker"');

  "use strict";

  const oop = require('../lib/oop');
  const {Mirror} = require('../worker/mirror');
  const PythonWorker = exports.PythonWorker = function (sender) { // console.log('run PythonWorker');
    Mirror.call(this, sender);
    this.setTimeout(500);
  };
  oop.inherits(PythonWorker, Mirror);
  (function () {
    this.onUpdate = function () { // console.log('run onUpdate');
      if (!eventDataSaver.data || !eventDataSaver.data.data) {
        this.sender.emit('ok');
        return;
      }
      const changedRow = eventDataSaver.data.data.data[0].row; // Три раза data — это смешно :)
      const errors = pythonValidation(this.doc.getValue(), changedRow);
      if (errors.length) {
        this.sender.emit('error', errors);
      } else {
        this.sender.emit('ok');
      }
    };
  }).call(PythonWorker.prototype);
});
