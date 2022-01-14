import _slicedToArray from '@babel/runtime/helpers/slicedToArray';
import _typeof from '@babel/runtime/helpers/typeof';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _construct from '@babel/runtime/helpers/construct';
import vtk, { vtkGlobal } from './vtk.js';
import ClassHierarchy from './Common/Core/ClassHierarchy.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var globalMTime = 0;
var VOID = Symbol('void');

function getCurrentGlobalMTime() {
  return globalMTime;
} // ----------------------------------------------------------------------------
// Logging function calls
// ----------------------------------------------------------------------------

/* eslint-disable no-prototype-builtins                                      */


var fakeConsole = {};

function noOp() {}

var consoleMethods = ['log', 'debug', 'info', 'warn', 'error', 'time', 'timeEnd', 'group', 'groupEnd'];
consoleMethods.forEach(function (methodName) {
  fakeConsole[methodName] = noOp;
});
vtkGlobal.console = console.hasOwnProperty('log') ? console : fakeConsole;
var loggerFunctions = {
  debug: noOp,
  // Don't print debug by default
  error: vtkGlobal.console.error || noOp,
  info: vtkGlobal.console.info || noOp,
  log: vtkGlobal.console.log || noOp,
  warn: vtkGlobal.console.warn || noOp
};
function setLoggerFunction(name, fn) {
  if (loggerFunctions[name]) {
    loggerFunctions[name] = fn || noOp;
  }
}
function vtkLogMacro() {
  loggerFunctions.log.apply(loggerFunctions, arguments);
}
function vtkInfoMacro() {
  loggerFunctions.info.apply(loggerFunctions, arguments);
}
function vtkDebugMacro() {
  loggerFunctions.debug.apply(loggerFunctions, arguments);
}
function vtkErrorMacro() {
  loggerFunctions.error.apply(loggerFunctions, arguments);
}
function vtkWarningMacro() {
  loggerFunctions.warn.apply(loggerFunctions, arguments);
}
var ERROR_ONCE_MAP = {};
function vtkOnceErrorMacro(str) {
  if (!ERROR_ONCE_MAP[str]) {
    loggerFunctions.error(str);
    ERROR_ONCE_MAP[str] = true;
  }
} // ----------------------------------------------------------------------------
// TypedArray
// ----------------------------------------------------------------------------

var TYPED_ARRAYS = Object.create(null);
TYPED_ARRAYS.Float32Array = Float32Array;
TYPED_ARRAYS.Float64Array = Float64Array;
TYPED_ARRAYS.Uint8Array = Uint8Array;
TYPED_ARRAYS.Int8Array = Int8Array;
TYPED_ARRAYS.Uint16Array = Uint16Array;
TYPED_ARRAYS.Int16Array = Int16Array;
TYPED_ARRAYS.Uint32Array = Uint32Array;
TYPED_ARRAYS.Int32Array = Int32Array;
TYPED_ARRAYS.Uint8ClampedArray = Uint8ClampedArray; // TYPED_ARRAYS.BigInt64Array = BigInt64Array;
// TYPED_ARRAYS.BigUint64Array = BigUint64Array;

function newTypedArray(type) {
  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  return _construct(TYPED_ARRAYS[type] || Float64Array, args);
}
function newTypedArrayFrom(type) {
  var _ref;

  for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    args[_key2 - 1] = arguments[_key2];
  }

  return (_ref = TYPED_ARRAYS[type] || Float64Array).from.apply(_ref, args);
} // ----------------------------------------------------------------------------
// capitilze provided string
// ----------------------------------------------------------------------------

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function uncapitalize(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
} // ----------------------------------------------------------------------------
// Convert byte size into a well formatted string
// ----------------------------------------------------------------------------

function formatBytesToProperUnit(size) {
  var precision = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
  var chunkSize = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;
  var units = ['TB', 'GB', 'MB', 'KB'];
  var value = Number(size);
  var currentUnit = 'B';

  while (value > chunkSize) {
    value /= chunkSize;
    currentUnit = units.pop();
  }

  return "".concat(value.toFixed(precision), " ").concat(currentUnit);
} // ----------------------------------------------------------------------------
// Convert thousand number with proper separator
// ----------------------------------------------------------------------------

function formatNumbersWithThousandSeparator(n) {
  var separator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ' ';
  var sections = [];
  var size = n;

  while (size > 1000) {
    sections.push("000".concat(size % 1000).slice(-3));
    size = Math.floor(size / 1000);
  }

  if (size > 0) {
    sections.push(size);
  }

  sections.reverse();
  return sections.join(separator);
} // ----------------------------------------------------------------------------
// Array helper
// ----------------------------------------------------------------------------

function safeArrays(model) {
  Object.keys(model).forEach(function (key) {
    if (Array.isArray(model[key])) {
      model[key] = [].concat(model[key]);
    }
  });
} // ----------------------------------------------------------------------------
// shallow equals
// ----------------------------------------------------------------------------


function shallowEquals(a, b) {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  return false;
} // ----------------------------------------------------------------------------


function enumToString(e, value) {
  return Object.keys(e).find(function (key) {
    return e[key] === value;
  });
}

function getStateArrayMapFunc(item) {
  if (item.isA) {
    return item.getState();
  }

  return item;
} // ----------------------------------------------------------------------------
// setImmediate
// ----------------------------------------------------------------------------


function setImmediateVTK(fn) {
  setTimeout(fn, 0);
} // ----------------------------------------------------------------------------
// vtkObject: modified(), onModified(callback), delete()
// ----------------------------------------------------------------------------

function obj() {
  var publicAPI = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var model = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  // Ensure each instance as a unique ref of array
  safeArrays(model);
  var callbacks = [];

  if (!Number.isInteger(model.mtime)) {
    model.mtime = ++globalMTime;
  }

  if (!('classHierarchy' in model)) {
    model.classHierarchy = new ClassHierarchy('vtkObject');
  } else if (!(model.classHierarchy instanceof ClassHierarchy)) {
    model.classHierarchy = ClassHierarchy.from(model.classHierarchy);
  }

  function off(index) {
    callbacks[index] = null;
  }

  function on(index) {
    function unsubscribe() {
      off(index);
    }

    return Object.freeze({
      unsubscribe: unsubscribe
    });
  }

  publicAPI.isDeleted = function () {
    return !!model.deleted;
  };

  publicAPI.modified = function (otherMTime) {
    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return;
    }

    if (otherMTime && otherMTime < publicAPI.getMTime()) {
      return;
    }

    model.mtime = ++globalMTime;
    callbacks.forEach(function (callback) {
      return callback && callback(publicAPI);
    });
  };

  publicAPI.onModified = function (callback) {
    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return null;
    }

    var index = callbacks.length;
    callbacks.push(callback);
    return on(index);
  };

  publicAPI.getMTime = function () {
    return model.mtime;
  };

  publicAPI.isA = function (className) {
    var count = model.classHierarchy.length; // we go backwards as that is more likely for
    // early termination

    while (count--) {
      if (model.classHierarchy[count] === className) {
        return true;
      }
    }

    return false;
  };

  publicAPI.getClassName = function () {
    var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    return model.classHierarchy[model.classHierarchy.length - 1 - depth];
  };

  publicAPI.set = function () {
    var map = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var noWarning = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var noFunction = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var ret = false;
    Object.keys(map).forEach(function (name) {
      var fn = noFunction ? null : publicAPI["set".concat(capitalize(name))];

      if (fn && Array.isArray(map[name]) && fn.length > 1) {
        ret = fn.apply(void 0, _toConsumableArray(map[name])) || ret;
      } else if (fn) {
        ret = fn(map[name]) || ret;
      } else {
        // Set data on model directly
        if (['mtime'].indexOf(name) === -1 && !noWarning) {
          vtkWarningMacro("Warning: Set value to model directly ".concat(name, ", ").concat(map[name]));
        }

        model[name] = map[name];
        ret = true;
      }
    });
    return ret;
  };

  publicAPI.get = function () {
    for (var _len3 = arguments.length, list = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      list[_key3] = arguments[_key3];
    }

    if (!list.length) {
      return model;
    }

    var subset = {};
    list.forEach(function (name) {
      subset[name] = model[name];
    });
    return subset;
  };

  publicAPI.getReferenceByName = function (val) {
    return model[val];
  };

  publicAPI.delete = function () {
    Object.keys(model).forEach(function (field) {
      return delete model[field];
    });
    callbacks.forEach(function (el, index) {
      return off(index);
    }); // Flag the instance being deleted

    model.deleted = true;
  }; // Add serialization support


  publicAPI.getState = function () {
    var jsonArchive = _objectSpread(_objectSpread({}, model), {}, {
      vtkClass: publicAPI.getClassName()
    }); // Convert every vtkObject to its serializable form


    Object.keys(jsonArchive).forEach(function (keyName) {
      if (jsonArchive[keyName] === null || jsonArchive[keyName] === undefined || keyName[0] === '_' // protected members start with _
      ) {
        delete jsonArchive[keyName];
      } else if (jsonArchive[keyName].isA) {
        jsonArchive[keyName] = jsonArchive[keyName].getState();
      } else if (Array.isArray(jsonArchive[keyName])) {
        jsonArchive[keyName] = jsonArchive[keyName].map(getStateArrayMapFunc);
      }
    }); // Sort resulting object by key name

    var sortedObj = {};
    Object.keys(jsonArchive).sort().forEach(function (name) {
      sortedObj[name] = jsonArchive[name];
    }); // Remove mtime

    if (sortedObj.mtime) {
      delete sortedObj.mtime;
    }

    return sortedObj;
  }; // Add shallowCopy(otherInstance) support


  publicAPI.shallowCopy = function (other) {
    var debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (other.getClassName() !== publicAPI.getClassName()) {
      throw new Error("Cannot ShallowCopy ".concat(other.getClassName(), " into ").concat(publicAPI.getClassName()));
    }

    var otherModel = other.get();
    var keyList = Object.keys(model).sort();
    var otherKeyList = Object.keys(otherModel).sort();
    otherKeyList.forEach(function (key) {
      var keyIdx = keyList.indexOf(key);

      if (keyIdx === -1) {
        if (debug) {
          vtkDebugMacro("add ".concat(key, " in shallowCopy"));
        }
      } else {
        keyList.splice(keyIdx, 1);
      }

      model[key] = otherModel[key];
    });

    if (keyList.length && debug) {
      vtkDebugMacro("Untouched keys: ".concat(keyList.join(', ')));
    }

    publicAPI.modified();
  }; // Allow usage as decorator


  return publicAPI;
} // ----------------------------------------------------------------------------
// getXXX: add getters
// ----------------------------------------------------------------------------

function get(publicAPI, model, fieldNames) {
  fieldNames.forEach(function (field) {
    if (_typeof(field) === 'object') {
      publicAPI["get".concat(capitalize(field.name))] = function () {
        return model[field.name];
      };
    } else {
      publicAPI["get".concat(capitalize(field))] = function () {
        return model[field];
      };
    }
  });
} // ----------------------------------------------------------------------------
// setXXX: add setters
// ----------------------------------------------------------------------------

var objectSetterMap = {
  enum: function _enum(publicAPI, model, field) {
    return function (value) {
      if (typeof value === 'string') {
        if (field.enum[value] !== undefined) {
          if (model[field.name] !== field.enum[value]) {
            model[field.name] = field.enum[value];
            publicAPI.modified();
            return true;
          }

          return false;
        }

        vtkErrorMacro("Set Enum with invalid argument ".concat(field, ", ").concat(value));
        throw new RangeError('Set Enum with invalid string argument');
      }

      if (typeof value === 'number') {
        if (model[field.name] !== value) {
          if (Object.keys(field.enum).map(function (key) {
            return field.enum[key];
          }).indexOf(value) !== -1) {
            model[field.name] = value;
            publicAPI.modified();
            return true;
          }

          vtkErrorMacro("Set Enum outside numeric range ".concat(field, ", ").concat(value));
          throw new RangeError('Set Enum outside numeric range');
        }

        return false;
      }

      vtkErrorMacro("Set Enum with invalid argument (String/Number) ".concat(field, ", ").concat(value));
      throw new TypeError('Set Enum with invalid argument (String/Number)');
    };
  }
};

function findSetter(field) {
  if (_typeof(field) === 'object') {
    var fn = objectSetterMap[field.type];

    if (fn) {
      return function (publicAPI, model) {
        return fn(publicAPI, model, field);
      };
    }

    vtkErrorMacro("No setter for field ".concat(field));
    throw new TypeError('No setter for field');
  }

  return function getSetter(publicAPI, model) {
    return function setter(value) {
      if (model.deleted) {
        vtkErrorMacro('instance deleted - cannot call any method');
        return false;
      }

      if (model[field] !== value) {
        model[field] = value;
        publicAPI.modified();
        return true;
      }

      return false;
    };
  };
}

function set(publicAPI, model, fields) {
  fields.forEach(function (field) {
    if (_typeof(field) === 'object') {
      publicAPI["set".concat(capitalize(field.name))] = findSetter(field)(publicAPI, model);
    } else {
      publicAPI["set".concat(capitalize(field))] = findSetter(field)(publicAPI, model);
    }
  });
} // ----------------------------------------------------------------------------
// set/get XXX: add both setters and getters
// ----------------------------------------------------------------------------

function setGet(publicAPI, model, fieldNames) {
  get(publicAPI, model, fieldNames);
  set(publicAPI, model, fieldNames);
} // ----------------------------------------------------------------------------
// getXXX: add getters for object of type array with copy to be safe
// getXXXByReference: add getters for object of type array without copy
// ----------------------------------------------------------------------------

function getArray(publicAPI, model, fieldNames) {
  fieldNames.forEach(function (field) {
    publicAPI["get".concat(capitalize(field))] = function () {
      return model[field] ? [].concat(model[field]) : model[field];
    };

    publicAPI["get".concat(capitalize(field), "ByReference")] = function () {
      return model[field];
    };
  });
} // ----------------------------------------------------------------------------
// setXXX: add setter for object of type array
// if 'defaultVal' is supplied, shorter arrays will be padded to 'size' with 'defaultVal'
// set...From: fast path to copy the content of an array to the current one without call to modified.
// ----------------------------------------------------------------------------

function setArray(publicAPI, model, fieldNames, size) {
  var defaultVal = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : undefined;
  fieldNames.forEach(function (field) {
    if (model[field] && size && model[field].length !== size) {
      throw new RangeError("Invalid initial number of values for array (".concat(field, ")"));
    }

    publicAPI["set".concat(capitalize(field))] = function () {
      if (model.deleted) {
        vtkErrorMacro('instance deleted - cannot call any method');
        return false;
      }

      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }

      var array = args;
      var changeDetected;
      var needCopy = false; // allow null or an array to be passed as a single arg.

      if (array.length === 1 && (array[0] == null || array[0].length >= 0)) {
        /* eslint-disable prefer-destructuring */
        array = array[0];
        /* eslint-enable prefer-destructuring */

        needCopy = true;
      }

      if (array == null) {
        changeDetected = model[field] !== array;
      } else {
        if (size && array.length !== size) {
          if (array.length < size && defaultVal !== undefined) {
            array = Array.from(array);
            needCopy = false;

            while (array.length < size) {
              array.push(defaultVal);
            }
          } else {
            throw new RangeError("Invalid number of values for array setter (".concat(field, ")"));
          }
        }

        changeDetected = model[field] == null || model[field].some(function (item, index) {
          return item !== array[index];
        }) || model[field].length !== array.length;

        if (changeDetected && needCopy) {
          array = Array.from(array);
        }
      }

      if (changeDetected) {
        model[field] = array;
        publicAPI.modified();
      }

      return changeDetected;
    };

    publicAPI["set".concat(capitalize(field), "From")] = function (otherArray) {
      var target = model[field];
      otherArray.forEach(function (v, i) {
        target[i] = v;
      });
    };
  });
} // ----------------------------------------------------------------------------
// set/get XXX: add setter and getter for object of type array
// ----------------------------------------------------------------------------

function setGetArray(publicAPI, model, fieldNames, size) {
  var defaultVal = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : undefined;
  getArray(publicAPI, model, fieldNames);
  setArray(publicAPI, model, fieldNames, size, defaultVal);
} // ----------------------------------------------------------------------------
// vtkAlgorithm: setInputData(), setInputConnection(), getOutputData(), getOutputPort()
// ----------------------------------------------------------------------------

function algo(publicAPI, model, numberOfInputs, numberOfOutputs) {
  if (model.inputData) {
    model.inputData = model.inputData.map(vtk);
  } else {
    model.inputData = [];
  }

  if (model.inputConnection) {
    model.inputConnection = model.inputConnection.map(vtk);
  } else {
    model.inputConnection = [];
  }

  if (model.output) {
    model.output = model.output.map(vtk);
  } else {
    model.output = [];
  }

  if (model.inputArrayToProcess) {
    model.inputArrayToProcess = model.inputArrayToProcess.map(vtk);
  } else {
    model.inputArrayToProcess = [];
  } // Cache the argument for later manipulation


  model.numberOfInputs = numberOfInputs; // Methods

  function setInputData(dataset) {
    var port = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return;
    }

    if (port >= model.numberOfInputs) {
      vtkErrorMacro("algorithm ".concat(publicAPI.getClassName(), " only has ").concat(model.numberOfInputs, " input ports. To add more input ports, use addInputData()"));
      return;
    }

    if (model.inputData[port] !== dataset || model.inputConnection[port]) {
      model.inputData[port] = dataset;
      model.inputConnection[port] = null;

      if (publicAPI.modified) {
        publicAPI.modified();
      }
    }
  }

  function getInputData() {
    var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

    if (model.inputConnection[port]) {
      model.inputData[port] = model.inputConnection[port]();
    }

    return model.inputData[port];
  }

  function setInputConnection(outputPort) {
    var port = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return;
    }

    if (port >= model.numberOfInputs) {
      var msg = "algorithm ".concat(publicAPI.getClassName(), " only has ");
      msg += "".concat(model.numberOfInputs);
      msg += ' input ports. To add more input ports, use addInputConnection()';
      vtkErrorMacro(msg);
      return;
    }

    model.inputData[port] = null;
    model.inputConnection[port] = outputPort;
  }

  function getInputConnection() {
    var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    return model.inputConnection[port];
  }

  function addInputConnection(outputPort) {
    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return;
    }

    var portToFill = model.numberOfInputs;

    while (portToFill && !model.inputData[portToFill - 1] && !model.inputConnection[portToFill - 1]) {
      portToFill--;
    }

    if (portToFill === model.numberOfInputs) {
      model.numberOfInputs++;
    }

    setInputConnection(outputPort, portToFill);
  }

  function addInputData(dataset) {
    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return;
    }

    var portToFill = model.numberOfInputs;

    while (portToFill && !model.inputData[portToFill - 1] && !model.inputConnection[portToFill - 1]) {
      portToFill--;
    }

    if (portToFill === model.numberOfInputs) {
      model.numberOfInputs++;
    }

    setInputData(dataset, portToFill);
  }

  function getOutputData() {
    var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return null;
    }

    if (publicAPI.shouldUpdate()) {
      publicAPI.update();
    }

    return model.output[port];
  }

  publicAPI.shouldUpdate = function () {
    var localMTime = publicAPI.getMTime();
    var count = numberOfOutputs;
    var minOutputMTime = Infinity;

    while (count--) {
      if (!model.output[count]) {
        return true;
      }

      if (model.output[count].isDeleted()) {
        return true;
      }

      var mt = model.output[count].getMTime();

      if (mt < localMTime) {
        return true;
      }

      if (mt < minOutputMTime) {
        minOutputMTime = mt;
      }
    }

    count = model.numberOfInputs;

    while (count--) {
      if (model.inputConnection[count] && model.inputConnection[count].filter.shouldUpdate()) {
        return true;
      }
    }

    count = model.numberOfInputs;

    while (count--) {
      if (publicAPI.getInputData(count) && publicAPI.getInputData(count).getMTime() > minOutputMTime) {
        return true;
      }
    }

    return false;
  };

  function getOutputPort() {
    var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

    var outputPortAccess = function outputPortAccess() {
      return getOutputData(port);
    }; // Add reference to filter


    outputPortAccess.filter = publicAPI;
    return outputPortAccess;
  } // Handle input if needed


  if (model.numberOfInputs) {
    // Reserve inputs
    var count = model.numberOfInputs;

    while (count--) {
      model.inputData.push(null);
      model.inputConnection.push(null);
    } // Expose public methods


    publicAPI.setInputData = setInputData;
    publicAPI.setInputConnection = setInputConnection;
    publicAPI.addInputData = addInputData;
    publicAPI.addInputConnection = addInputConnection;
    publicAPI.getInputData = getInputData;
    publicAPI.getInputConnection = getInputConnection;
  }

  if (numberOfOutputs) {
    publicAPI.getOutputData = getOutputData;
    publicAPI.getOutputPort = getOutputPort;
  }

  publicAPI.update = function () {
    var ins = [];

    if (model.numberOfInputs) {
      var _count = 0;

      while (_count < model.numberOfInputs) {
        ins[_count] = publicAPI.getInputData(_count);
        _count++;
      }
    }

    if (publicAPI.shouldUpdate() && publicAPI.requestData) {
      publicAPI.requestData(ins, model.output);
    }
  };

  publicAPI.getNumberOfInputPorts = function () {
    return model.numberOfInputs;
  };

  publicAPI.getNumberOfOutputPorts = function () {
    return numberOfOutputs || model.output.length;
  };

  publicAPI.getInputArrayToProcess = function (inputPort) {
    var arrayDesc = model.inputArrayToProcess[inputPort];
    var ds = model.inputData[inputPort];

    if (arrayDesc && ds) {
      return ds["get".concat(arrayDesc.fieldAssociation)]().getArray(arrayDesc.arrayName);
    }

    return null;
  };

  publicAPI.setInputArrayToProcess = function (inputPort, arrayName, fieldAssociation) {
    var attributeType = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'Scalars';

    while (model.inputArrayToProcess.length < inputPort) {
      model.inputArrayToProcess.push(null);
    }

    model.inputArrayToProcess[inputPort] = {
      arrayName: arrayName,
      fieldAssociation: fieldAssociation,
      attributeType: attributeType
    };
  };
} // ----------------------------------------------------------------------------
// Event handling: onXXX(callback), invokeXXX(args...)
// ----------------------------------------------------------------------------

var EVENT_ABORT = Symbol('Event abort');
function event(publicAPI, model, eventName) {
  var callbacks = [];
  var previousDelete = publicAPI.delete;
  var curCallbackID = 1;

  function off(callbackID) {
    for (var i = 0; i < callbacks.length; ++i) {
      var _callbacks$i = _slicedToArray(callbacks[i], 1),
          cbID = _callbacks$i[0];

      if (cbID === callbackID) {
        callbacks.splice(i, 1);
        return;
      }
    }
  }

  function on(callbackID) {
    function unsubscribe() {
      off(callbackID);
    }

    return Object.freeze({
      unsubscribe: unsubscribe
    });
  }

  function invoke() {
    var _arguments = arguments;

    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return;
    }
    /* eslint-disable prefer-rest-params */
    // Go through a copy of the callbacks array in case new callbacks
    // get prepended within previous callbacks


    var currentCallbacks = callbacks.slice();

    var _loop = function _loop(index) {
      var _currentCallbacks$ind = _slicedToArray(currentCallbacks[index], 3),
          cb = _currentCallbacks$ind[1],
          priority = _currentCallbacks$ind[2];

      if (!cb) {
        return "continue"; // eslint-disable-line
      }

      if (priority < 0) {
        setTimeout(function () {
          return cb.apply(publicAPI, _arguments);
        }, 1 - priority);
      } else {
        // Abort only if the callback explicitly returns false
        var continueNext = cb.apply(publicAPI, _arguments);

        if (continueNext === EVENT_ABORT) {
          return "break";
        }
      }
    };

    for (var index = 0; index < currentCallbacks.length; ++index) {
      var _ret = _loop(index);

      if (_ret === "continue") continue;
      if (_ret === "break") break;
    }
    /* eslint-enable prefer-rest-params */

  }

  publicAPI["invoke".concat(capitalize(eventName))] = invoke;

  publicAPI["on".concat(capitalize(eventName))] = function (callback) {
    var priority = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.0;

    if (!callback.apply) {
      console.error("Invalid callback for event ".concat(eventName));
      return null;
    }

    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return null;
    }

    var callbackID = curCallbackID++;
    callbacks.push([callbackID, callback, priority]);
    callbacks.sort(function (cb1, cb2) {
      return cb2[2] - cb1[2];
    });
    return on(callbackID);
  };

  publicAPI.delete = function () {
    previousDelete();
    callbacks.forEach(function (_ref2) {
      var _ref3 = _slicedToArray(_ref2, 1),
          cbID = _ref3[0];

      return off(cbID);
    });
  };
} // ----------------------------------------------------------------------------
// newInstance
// ----------------------------------------------------------------------------

function newInstance(extend, className) {
  var constructor = function constructor() {
    var initialValues = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var model = {};
    var publicAPI = {};
    extend(publicAPI, model, initialValues);
    return Object.freeze(publicAPI);
  }; // Register constructor to factory


  if (className) {
    vtk.register(className, constructor);
  }

  return constructor;
} // ----------------------------------------------------------------------------
// Chain function calls
// ----------------------------------------------------------------------------

function chain() {
  for (var _len5 = arguments.length, fn = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
    fn[_key5] = arguments[_key5];
  }

  return function () {
    for (var _len6 = arguments.length, args = new Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
      args[_key6] = arguments[_key6];
    }

    return fn.filter(function (i) {
      return !!i;
    }).map(function (i) {
      return i.apply(void 0, args);
    });
  };
} // ----------------------------------------------------------------------------
// Some utility methods for vtk objects
// ----------------------------------------------------------------------------

function isVtkObject(instance) {
  return instance && instance.isA && instance.isA('vtkObject');
}
function traverseInstanceTree(instance, extractFunction) {
  var accumulator = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var visitedInstances = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

  if (isVtkObject(instance)) {
    if (visitedInstances.indexOf(instance) >= 0) {
      // avoid cycles
      return accumulator;
    }

    visitedInstances.push(instance);
    var result = extractFunction(instance);

    if (result !== undefined) {
      accumulator.push(result);
    } // Now go through this instance's model


    var model = instance.get();
    Object.keys(model).forEach(function (key) {
      var modelObj = model[key];

      if (Array.isArray(modelObj)) {
        modelObj.forEach(function (subObj) {
          traverseInstanceTree(subObj, extractFunction, accumulator, visitedInstances);
        });
      } else {
        traverseInstanceTree(modelObj, extractFunction, accumulator, visitedInstances);
      }
    });
  }

  return accumulator;
} // ----------------------------------------------------------------------------
// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.

function debounce(func, wait, immediate) {
  var _this = this;

  var timeout;

  var debounced = function debounced() {
    for (var _len7 = arguments.length, args = new Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
      args[_key7] = arguments[_key7];
    }

    var context = _this;

    var later = function later() {
      timeout = null;

      if (!immediate) {
        func.apply(context, args);
      }
    };

    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };

  debounced.cancel = function () {
    return clearTimeout(timeout);
  };

  return debounced;
} // ----------------------------------------------------------------------------
// Creates a throttled function that only invokes `func` at most once per
// every `wait` milliseconds.

function throttle(callback, delay) {
  var isThrottled = false;
  var argsToUse = null;

  function next() {
    isThrottled = false;

    if (argsToUse !== null) {
      wrapper.apply(void 0, _toConsumableArray(argsToUse)); // eslint-disable-line

      argsToUse = null;
    }
  }

  function wrapper() {
    for (var _len8 = arguments.length, args = new Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
      args[_key8] = arguments[_key8];
    }

    if (isThrottled) {
      argsToUse = args;
      return;
    }

    isThrottled = true;
    callback.apply(void 0, args);
    setTimeout(next, delay);
  }

  return wrapper;
} // ----------------------------------------------------------------------------
// keystore(publicAPI, model, initialKeystore)
//
//    - initialKeystore: Initial keystore. This can be either a Map or an
//      object.
//
// Generated API
//  setKey(key, value) : mixed (returns value)
//  getKey(key) : mixed
//  getAllKeys() : [mixed]
//  deleteKey(key) : Boolean
// ----------------------------------------------------------------------------

function keystore(publicAPI, model) {
  var initialKeystore = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  model.keystore = Object.assign(model.keystore || {}, initialKeystore);

  publicAPI.setKey = function (key, value) {
    model.keystore[key] = value;
  };

  publicAPI.getKey = function (key) {
    return model.keystore[key];
  };

  publicAPI.getAllKeys = function () {
    return Object.keys(model.keystore);
  };

  publicAPI.deleteKey = function (key) {
    return delete model.keystore[key];
  };

  publicAPI.clearKeystore = function () {
    return publicAPI.getAllKeys().forEach(function (key) {
      return delete model.keystore[key];
    });
  };
} // ----------------------------------------------------------------------------
// proxy(publicAPI, model, sectionName, propertyUI)
//
//    - sectionName: Name of the section for UI
//    - propertyUI: List of props with their UI description
//
// Generated API
//  getProxyId() : String
//  listProxyProperties() : [string]
//  updateProxyProperty(name, prop)
//  getProxySection() => List of properties for UI generation
// ----------------------------------------------------------------------------

var nextProxyId = 1;
var ROOT_GROUP_NAME = '__root__';
function proxy(publicAPI, model) {
  // Proxies are keystores
  keystore(publicAPI, model);
  var parentDelete = publicAPI.delete; // getProxyId

  model.proxyId = "".concat(nextProxyId++); // ui handling

  model.ui = JSON.parse(JSON.stringify(model.ui || [])); // deep copy

  get(publicAPI, model, ['proxyId', 'proxyGroup', 'proxyName']);
  setGet(publicAPI, model, ['proxyManager']); // group properties

  var propertyMap = {};
  var groupChildrenNames = {};

  function registerProperties(descriptionList, currentGroupName) {
    if (!groupChildrenNames[currentGroupName]) {
      groupChildrenNames[currentGroupName] = [];
    }

    var childrenNames = groupChildrenNames[currentGroupName];

    for (var i = 0; i < descriptionList.length; i++) {
      childrenNames.push(descriptionList[i].name);
      propertyMap[descriptionList[i].name] = descriptionList[i];

      if (descriptionList[i].children && descriptionList[i].children.length) {
        registerProperties(descriptionList[i].children, descriptionList[i].name);
      }
    }
  }

  registerProperties(model.ui, ROOT_GROUP_NAME);

  publicAPI.updateUI = function (ui) {
    model.ui = JSON.parse(JSON.stringify(ui || [])); // deep copy

    Object.keys(propertyMap).forEach(function (k) {
      return delete propertyMap[k];
    });
    Object.keys(groupChildrenNames).forEach(function (k) {
      return delete groupChildrenNames[k];
    });
    registerProperties(model.ui, ROOT_GROUP_NAME);
    publicAPI.modified();
  };

  function listProxyProperties() {
    var gName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ROOT_GROUP_NAME;
    return groupChildrenNames[gName];
  }

  publicAPI.updateProxyProperty = function (propertyName, propUI) {
    var prop = propertyMap[propertyName];

    if (prop) {
      Object.assign(prop, propUI);
    } else {
      propertyMap[propertyName] = _objectSpread({}, propUI);
    }
  };

  publicAPI.activate = function () {
    if (model.proxyManager) {
      var setActiveMethod = "setActive".concat(capitalize(publicAPI.getProxyGroup().slice(0, -1)));

      if (model.proxyManager[setActiveMethod]) {
        model.proxyManager[setActiveMethod](publicAPI);
      }
    }
  }; // property link


  model.propertyLinkSubscribers = {};

  publicAPI.registerPropertyLinkForGC = function (otherLink, type) {
    if (!(type in model.propertyLinkSubscribers)) {
      model.propertyLinkSubscribers[type] = [];
    }

    model.propertyLinkSubscribers[type].push(otherLink);
  };

  publicAPI.gcPropertyLinks = function (type) {
    var subscribers = model.propertyLinkSubscribers[type] || [];

    while (subscribers.length) {
      subscribers.pop().unbind(publicAPI);
    }
  };

  model.propertyLinkMap = {};

  publicAPI.getPropertyLink = function (id) {
    var persistent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (model.propertyLinkMap[id]) {
      return model.propertyLinkMap[id];
    }

    var value = null;
    var links = [];
    var count = 0;
    var updateInProgress = false;

    function update(source) {
      var force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      if (updateInProgress) {
        return null;
      }

      var needUpdate = [];
      var sourceLink = null;
      count = links.length;

      while (count--) {
        var link = links[count];

        if (link.instance === source) {
          sourceLink = link;
        } else {
          needUpdate.push(link);
        }
      }

      if (!sourceLink) {
        return null;
      }

      var newValue = sourceLink.instance["get".concat(capitalize(sourceLink.propertyName))]();

      if (!shallowEquals(newValue, value) || force) {
        value = newValue;
        updateInProgress = true;

        while (needUpdate.length) {
          var linkToUpdate = needUpdate.pop();
          linkToUpdate.instance.set(_defineProperty({}, linkToUpdate.propertyName, value));
        }

        updateInProgress = false;
      }

      if (model.propertyLinkMap[id].persistent) {
        model.propertyLinkMap[id].value = newValue;
      }

      return newValue;
    }

    function unbind(instance, propertyName) {
      var indexToDelete = [];
      count = links.length;

      while (count--) {
        var link = links[count];

        if (link.instance === instance && (link.propertyName === propertyName || propertyName === undefined)) {
          link.subscription.unsubscribe();
          indexToDelete.push(count);
        }
      }

      while (indexToDelete.length) {
        links.splice(indexToDelete.pop(), 1);
      }
    }

    function bind(instance, propertyName) {
      var updateMe = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var subscription = instance.onModified(update);
      var other = links[0];
      links.push({
        instance: instance,
        propertyName: propertyName,
        subscription: subscription
      });

      if (updateMe) {
        if (model.propertyLinkMap[id].persistent && model.propertyLinkMap[id].value !== undefined) {
          instance.set(_defineProperty({}, propertyName, model.propertyLinkMap[id].value));
        } else if (other) {
          update(other.instance, true);
        }
      }

      return {
        unsubscribe: function unsubscribe() {
          return unbind(instance, propertyName);
        }
      };
    }

    function unsubscribe() {
      while (links.length) {
        links.pop().subscription.unsubscribe();
      }
    }

    var linkHandler = {
      bind: bind,
      unbind: unbind,
      unsubscribe: unsubscribe,
      persistent: persistent
    };
    model.propertyLinkMap[id] = linkHandler;
    return linkHandler;
  }; // extract values


  function getProperties() {
    var groupName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ROOT_GROUP_NAME;
    var values = [];
    var id = model.proxyId;
    var propertyNames = listProxyProperties(groupName) || [];

    for (var i = 0; i < propertyNames.length; i++) {
      var name = propertyNames[i];
      var method = publicAPI["get".concat(capitalize(name))];
      var value = method ? method() : undefined;
      var prop = {
        id: id,
        name: name,
        value: value
      };
      var children = getProperties(name);

      if (children.length) {
        prop.children = children;
      }

      values.push(prop);
    }

    return values;
  }

  publicAPI.listPropertyNames = function () {
    return getProperties().map(function (p) {
      return p.name;
    });
  };

  publicAPI.getPropertyByName = function (name) {
    return getProperties().find(function (p) {
      return p.name === name;
    });
  };

  publicAPI.getPropertyDomainByName = function (name) {
    return (propertyMap[name] || {}).domain;
  }; // ui section


  publicAPI.getProxySection = function () {
    return {
      id: model.proxyId,
      name: model.proxyGroup,
      ui: model.ui,
      properties: getProperties()
    };
  }; // free resources


  publicAPI.delete = function () {
    var list = Object.keys(model.propertyLinkMap);
    var count = list.length;

    while (count--) {
      model.propertyLinkMap[list[count]].unsubscribe();
    }

    Object.keys(model.propertyLinkSubscribers).forEach(publicAPI.gcPropertyLinks);
    parentDelete();
  };

  function registerLinks() {
    // Allow dynamic registration of links at the application level
    if (model.links) {
      for (var i = 0; i < model.links.length; i++) {
        var _model$links$i = model.links[i],
            link = _model$links$i.link,
            property = _model$links$i.property,
            persistent = _model$links$i.persistent,
            updateOnBind = _model$links$i.updateOnBind,
            type = _model$links$i.type;

        if (type === 'application') {
          var sLink = model.proxyManager.getPropertyLink(link, persistent);
          publicAPI.registerPropertyLinkForGC(sLink, 'application');
          sLink.bind(publicAPI, property, updateOnBind);
        }
      }
    }
  }

  setImmediateVTK(registerLinks);
} // ----------------------------------------------------------------------------
// proxyPropertyMapping(publicAPI, model, map)
//
//   map = {
//      opacity: { modelKey: 'property', property: 'opacity' },
//   }
//
// Generated API:
//  Elevate set/get methods from internal object stored in the model to current one
// ----------------------------------------------------------------------------

function proxyPropertyMapping(publicAPI, model, map) {
  var parentDelete = publicAPI.delete;
  var subscriptions = [];
  var propertyNames = Object.keys(map);
  var count = propertyNames.length;

  while (count--) {
    var propertyName = propertyNames[count];
    var _map$propertyName = map[propertyName],
        modelKey = _map$propertyName.modelKey,
        property = _map$propertyName.property,
        _map$propertyName$mod = _map$propertyName.modified,
        modified = _map$propertyName$mod === void 0 ? true : _map$propertyName$mod;
    var methodSrc = capitalize(property);
    var methodDst = capitalize(propertyName);
    publicAPI["get".concat(methodDst)] = model[modelKey]["get".concat(methodSrc)];
    publicAPI["set".concat(methodDst)] = model[modelKey]["set".concat(methodSrc)];

    if (modified) {
      subscriptions.push(model[modelKey].onModified(publicAPI.modified));
    }
  }

  publicAPI.delete = function () {
    while (subscriptions.length) {
      subscriptions.pop().unsubscribe();
    }

    parentDelete();
  };
} // ----------------------------------------------------------------------------
// proxyPropertyState(publicAPI, model, state, defaults)
//
//   state = {
//     representation: {
//       'Surface with edges': { property: { edgeVisibility: true, representation: 2 } },
//       Surface: { property: { edgeVisibility: false, representation: 2 } },
//       Wireframe: { property: { edgeVisibility: false, representation: 1 } },
//       Points: { property: { edgeVisibility: false, representation: 0 } },
//     },
//   }
//
//   defaults = {
//      representation: 'Surface',
//   }
//
// Generated API
//   get / set Representation ( string ) => push state to various internal objects
// ----------------------------------------------------------------------------

function proxyPropertyState(publicAPI, model) {
  var state = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var defaults = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  model.this = publicAPI;

  function applyState(map) {
    var modelKeys = Object.keys(map);
    var count = modelKeys.length;

    while (count--) {
      var modelKey = modelKeys[count];
      model[modelKey].set(map[modelKey]);
    }
  }

  var modelKeys = Object.keys(defaults);
  var count = modelKeys.length;

  var _loop2 = function _loop2() {
    // Add default
    var key = modelKeys[count];
    model[key] = defaults[key]; // Add set method

    var mapping = state[key];

    publicAPI["set".concat(capitalize(key))] = function (value) {
      if (value !== model[key]) {
        model[key] = value;
        var propValues = mapping[value];
        applyState(propValues);
        publicAPI.modified();
      }
    };
  };

  while (count--) {
    _loop2();
  } // Add getter


  if (modelKeys.length) {
    get(publicAPI, model, modelKeys);
  }
} // ----------------------------------------------------------------------------
// From : https://github.com/facebookarchive/fixed-data-table/blob/master/src/vendor_upstream/dom/normalizeWheel.js
//
//
// Copyright (c) 2015, Facebook, Inc.
// All rights reserved.
//
// This source code is licensed under the BSD-style license found in the
// LICENSE file in the root directory of this source tree. An additional grant
// of patent rights can be found in the PATENTS file in the same directory.
//
//
// Mouse wheel (and 2-finger trackpad) support on the web sucks.  It is
// complicated, thus this doc is long and (hopefully) detailed enough to answer
// your questions.
//
// If you need to react to the mouse wheel in a predictable way, this code is
// like your bestest friend.// hugs//
//
// As of today, there are 4 DOM event types you can listen to:
//
//   'wheel'                -- Chrome(31+), FF(17+), IE(9+)
//   'mousewheel'           -- Chrome, IE(6+), Opera, Safari
//   'MozMousePixelScroll'  -- FF(3.5 only!) (2010-2013) -- don't bother!
//   'DOMMouseScroll'       -- FF(0.9.7+) since 2003
//
// So what to do?  The is the best:
//
//   normalizeWheel.getEventType();
//
// In your event callback, use this code to get sane interpretation of the
// deltas.  This code will return an object with properties:
//
//   spinX   -- normalized spin speed (use for zoom) - x plane
//   spinY   -- " - y plane
//   pixelX  -- normalized distance (to pixels) - x plane
//   pixelY  -- " - y plane
//
// Wheel values are provided by the browser assuming you are using the wheel to
// scroll a web page by a number of lines or pixels (or pages).  Values can vary
// significantly on different platforms and browsers, forgetting that you can
// scroll at different speeds.  Some devices (like trackpads) emit more events
// at smaller increments with fine granularity, and some emit massive jumps with
// linear speed or acceleration.
//
// This code does its best to normalize the deltas for you:
//
//   - spin is trying to normalize how far the wheel was spun (or trackpad
//     dragged).  This is super useful for zoom support where you want to
//     throw away the chunky scroll steps on the PC and make those equal to
//     the slow and smooth tiny steps on the Mac. Key data: This code tries to
//     resolve a single slow step on a wheel to 1.
//
//   - pixel is normalizing the desired scroll delta in pixel units.  You'll
//     get the crazy differences between browsers, but at least it'll be in
//     pixels!
//
//   - positive value indicates scrolling DOWN/RIGHT, negative UP/LEFT.  This
//     should translate to positive value zooming IN, negative zooming OUT.
//     This matches the newer 'wheel' event.
//
// Why are there spinX, spinY (or pixels)?
//
//   - spinX is a 2-finger side drag on the trackpad, and a shift + wheel turn
//     with a mouse.  It results in side-scrolling in the browser by default.
//
//   - spinY is what you expect -- it's the classic axis of a mouse wheel.
//
//   - I dropped spinZ/pixelZ.  It is supported by the DOM 3 'wheel' event and
//     probably is by browsers in conjunction with fancy 3D controllers .. but
//     you know.
//
// Implementation info:
//
// Examples of 'wheel' event if you scroll slowly (down) by one step with an
// average mouse:
//
//   OS X + Chrome  (mouse)     -    4   pixel delta  (wheelDelta -120)
//   OS X + Safari  (mouse)     -  N/A   pixel delta  (wheelDelta  -12)
//   OS X + Firefox (mouse)     -    0.1 line  delta  (wheelDelta  N/A)
//   Win8 + Chrome  (mouse)     -  100   pixel delta  (wheelDelta -120)
//   Win8 + Firefox (mouse)     -    3   line  delta  (wheelDelta -120)
//
// On the trackpad:
//
//   OS X + Chrome  (trackpad)  -    2   pixel delta  (wheelDelta   -6)
//   OS X + Firefox (trackpad)  -    1   pixel delta  (wheelDelta  N/A)
//
// On other/older browsers.. it's more complicated as there can be multiple and
// also missing delta values.
//
// The 'wheel' event is more standard:
//
// http://www.w3.org/TR/DOM-Level-3-Events/#events-wheelevents
//
// The basics is that it includes a unit, deltaMode (pixels, lines, pages), and
// deltaX, deltaY and deltaZ.  Some browsers provide other values to maintain
// backward compatibility with older events.  Those other values help us
// better normalize spin speed.  Example of what the browsers provide:
//
//                          | event.wheelDelta | event.detail
//        ------------------+------------------+--------------
//          Safari v5/OS X  |       -120       |       0
//          Safari v5/Win7  |       -120       |       0
//         Chrome v17/OS X  |       -120       |       0
//         Chrome v17/Win7  |       -120       |       0
//                IE9/Win7  |       -120       |   undefined
//         Firefox v4/OS X  |     undefined    |       1
//         Firefox v4/Win7  |     undefined    |       3
//
// ----------------------------------------------------------------------------
// Reasonable defaults

var PIXEL_STEP = 10;
var LINE_HEIGHT = 40;
var PAGE_HEIGHT = 800;
function normalizeWheel(wheelEvent) {
  var sX = 0; // spinX

  var sY = 0; // spinY

  var pX = 0; // pixelX

  var pY = 0; // pixelY
  // Legacy

  if ('detail' in wheelEvent) {
    sY = wheelEvent.detail;
  }

  if ('wheelDelta' in wheelEvent) {
    sY = -wheelEvent.wheelDelta / 120;
  }

  if ('wheelDeltaY' in wheelEvent) {
    sY = -wheelEvent.wheelDeltaY / 120;
  }

  if ('wheelDeltaX' in wheelEvent) {
    sX = -wheelEvent.wheelDeltaX / 120;
  } // side scrolling on FF with DOMMouseScroll


  if ('axis' in wheelEvent && wheelEvent.axis === wheelEvent.HORIZONTAL_AXIS) {
    sX = sY;
    sY = 0;
  }

  pX = sX * PIXEL_STEP;
  pY = sY * PIXEL_STEP;

  if ('deltaY' in wheelEvent) {
    pY = wheelEvent.deltaY;
  }

  if ('deltaX' in wheelEvent) {
    pX = wheelEvent.deltaX;
  }

  if ((pX || pY) && wheelEvent.deltaMode) {
    if (wheelEvent.deltaMode === 1) {
      // delta in LINE units
      pX *= LINE_HEIGHT;
      pY *= LINE_HEIGHT;
    } else {
      // delta in PAGE units
      pX *= PAGE_HEIGHT;
      pY *= PAGE_HEIGHT;
    }
  } // Fall-back if spin cannot be determined


  if (pX && !sX) {
    sX = pX < 1 ? -1 : 1;
  }

  if (pY && !sY) {
    sY = pY < 1 ? -1 : 1;
  }

  return {
    spinX: sX,
    spinY: sY,
    pixelX: pX,
    pixelY: pY
  };
} // ----------------------------------------------------------------------------
// Default export
// ----------------------------------------------------------------------------

var macro = {
  algo: algo,
  capitalize: capitalize,
  chain: chain,
  debounce: debounce,
  enumToString: enumToString,
  event: event,
  EVENT_ABORT: EVENT_ABORT,
  formatBytesToProperUnit: formatBytesToProperUnit,
  formatNumbersWithThousandSeparator: formatNumbersWithThousandSeparator,
  get: get,
  getArray: getArray,
  getCurrentGlobalMTime: getCurrentGlobalMTime,
  getStateArrayMapFunc: getStateArrayMapFunc,
  isVtkObject: isVtkObject,
  keystore: keystore,
  newInstance: newInstance,
  newTypedArray: newTypedArray,
  newTypedArrayFrom: newTypedArrayFrom,
  normalizeWheel: normalizeWheel,
  obj: obj,
  proxy: proxy,
  proxyPropertyMapping: proxyPropertyMapping,
  proxyPropertyState: proxyPropertyState,
  safeArrays: safeArrays,
  set: set,
  setArray: setArray,
  setGet: setGet,
  setGetArray: setGetArray,
  setImmediate: setImmediateVTK,
  setLoggerFunction: setLoggerFunction,
  throttle: throttle,
  traverseInstanceTree: traverseInstanceTree,
  TYPED_ARRAYS: TYPED_ARRAYS,
  // deprecated todo remove on breaking API revision
  uncapitalize: uncapitalize,
  VOID: VOID,
  vtkDebugMacro: vtkDebugMacro,
  vtkErrorMacro: vtkErrorMacro,
  vtkInfoMacro: vtkInfoMacro,
  vtkLogMacro: vtkLogMacro,
  vtkOnceErrorMacro: vtkOnceErrorMacro,
  vtkWarningMacro: vtkWarningMacro
};

export { EVENT_ABORT, TYPED_ARRAYS, VOID, algo, capitalize, chain, debounce, macro as default, event, formatBytesToProperUnit, formatNumbersWithThousandSeparator, get, getArray, isVtkObject, keystore, newInstance, newTypedArray, newTypedArrayFrom, normalizeWheel, obj, proxy, proxyPropertyMapping, proxyPropertyState, set, setArray, setGet, setGetArray, setImmediateVTK, setLoggerFunction, throttle, traverseInstanceTree, uncapitalize, vtkDebugMacro, vtkErrorMacro, vtkInfoMacro, vtkLogMacro, vtkOnceErrorMacro, vtkWarningMacro };
