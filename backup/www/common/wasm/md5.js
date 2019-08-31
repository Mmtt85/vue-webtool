// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error(
      "Module['ENVIRONMENT'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL."
    );
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE =
    typeof process === 'object' &&
    typeof require === 'function' &&
    !ENVIRONMENT_IS_WEB &&
    !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL =
    !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}

if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    Module['printErr']('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['inspect'] = function() {
    return '[Emscripten Module object]';
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    };
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
        // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  Module['setWindowTitle'] = function(title) {
    document.title = title;
  };
} else {
  // Unreachable because SHELL is dependent on the others
  throw new Error('unknown runtime environment');
}

// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
Module['print'] =
  typeof console !== 'undefined'
    ? console.log.bind(console)
    : typeof print !== 'undefined'
    ? print
    : null;
Module['printErr'] =
  typeof printErr !== 'undefined'
    ? printErr
    : (typeof console !== 'undefined' && console.warn.bind(console)) ||
      Module['print'];

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort(
    'cannot use the stack before compiled code is ready to run, and has provided stack access'
  );
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR >> 2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR >> 2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR >> 2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = (size = Math.ceil(size / factor) * factor);
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1':
    case 'i8':
      return 1;
    case 'i16':
      return 2;
    case 'i32':
      return 4;
    case 'i64':
      return 8;
    case 'float':
      return 4;
    case 'double':
      return 8;
    default: {
      if (type[type.length - 1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    Module.printErr(text);
  }
}

var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    Module.printErr(
      'Warning: addFunction: Provide a wasm function signature ' +
        'string as a second argument'
    );
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index - jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}

function makeBigInt(low, high, unsigned) {
  return unsigned
    ? +(low >>> 0) + +(high >>> 0) * 4294967296.0
    : +(low >>> 0) + +(high | 0) * 4294967296.0;
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length - 1);
    assert(
      'dynCall_' + sig in Module,
      "bad function pointer type - no table for sig '" + sig + "'"
    );
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(
      'dynCall_' + sig in Module,
      "bad function pointer type - no table for sig '" + sig + "'"
    );
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() {
    abort(
      'getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."'
    );
  },
  staticAlloc: function() {
    abort(
      'staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."'
    );
  },
  stackAlloc: function() {
    abort(
      'stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."'
    );
  }
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(
    func,
    'Cannot call unknown function ' + ident + ', make sure it is exported'
  );
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  stackSave: function() {
    stackSave();
  },
  stackRestore: function() {
    stackRestore();
  },
  // type conversion from js to c
  arrayToC: function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  stringToC: function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) {
      // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};
// For fast lookup of conversion functions
var toC = { string: JSfuncs['stringToC'], array: JSfuncs['arrayToC'] };

// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === 'string') ret = Pointer_stringify(ret);
  if (stack !== 0) {
    stackRestore(stack);
  }
  return ret;
}

function cwrap(ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type) {
    return type === 'number';
  });
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments);
  };
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length - 1) === '*') type = 'i32'; // pointers are 32-bit
  switch (type) {
    case 'i1':
      HEAP8[(ptr >> 0)] = value;
      break;
    case 'i8':
      HEAP8[(ptr >> 0)] = value;
      break;
    case 'i16':
      HEAP16[(ptr >> 1)] = value;
      break;
    case 'i32':
      HEAP32[(ptr >> 2)] = value;
      break;
    case 'i64':
      ((tempI64 = [
        value >>> 0,
        ((tempDouble = value),
        +Math_abs(tempDouble) >= 1.0
          ? tempDouble > 0.0
            ? (Math_min(+Math_floor(tempDouble / 4294967296.0), 4294967295.0) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296.0
              ) >>> 0
          : 0)
      ]),
        (HEAP32[ptr >> 2] = tempI64[0]),
        (HEAP32[(ptr + 4) >> 2] = tempI64[1]));
      break;
    case 'float':
      HEAPF32[(ptr >> 2)] = value;
      break;
    case 'double':
      HEAPF64[(ptr >> 3)] = value;
      break;
    default:
      abort('invalid type for setValue: ' + type);
  }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length - 1) === '*') type = 'i32'; // pointers are 32-bit
  switch (type) {
    case 'i1':
      return HEAP8[(ptr >> 0)];
    case 'i8':
      return HEAP8[(ptr >> 0)];
    case 'i16':
      return HEAP16[(ptr >> 1)];
    case 'i32':
      return HEAP32[(ptr >> 2)];
    case 'i64':
      return HEAP32[(ptr >> 2)];
    case 'float':
      return HEAPF32[(ptr >> 2)];
    case 'double':
      return HEAPF64[(ptr >> 3)];
    default:
      abort('invalid type for getValue: ' + type);
  }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [
      typeof _malloc === 'function' ? _malloc : staticAlloc,
      stackAlloc,
      staticAlloc,
      dynamicAlloc
    ][allocator === undefined ? ALLOC_STATIC : allocator](
      Math.max(size, singleType ? 1 : types.length)
    );
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[(ptr >> 2)] = 0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[(ptr++ >> 0)] = 0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0,
    type,
    typeSize,
    previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret + i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[((ptr + i) >> 0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(
        String,
        HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK))
      );
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[ptr++ >> 0];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) {
        str += String.fromCharCode(u0);
        continue;
      }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xe0) == 0xc0) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1);
        continue;
      }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xf0) == 0xe0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xf8) == 0xf0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xfc) == 0xf8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 =
              ((u0 & 1) << 30) |
              (u1 << 24) |
              (u2 << 18) |
              (u3 << 12) |
              (u4 << 6) |
              u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xd800 | (ch >> 10), 0xdc00 | (ch & 0x3ff));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8, ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0))
    // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xd800 && u <= 0xdfff)
      u = (0x10000 + ((u & 0x3ff) << 10)) | (str.charCodeAt(++i) & 0x3ff);
    if (u <= 0x7f) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7ff) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xc0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xffff) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xe0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1fffff) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xf0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3ffffff) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xf8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xfc | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xd800 && u <= 0xdfff)
      u = (0x10000 + ((u & 0x3ff) << 10)) | (str.charCodeAt(++i) & 0x3ff);
    if (u <= 0x7f) {
      ++len;
    } else if (u <= 0x7ff) {
      len += 2;
    } else if (u <= 0xffff) {
      len += 3;
    } else if (u <= 0x1fffff) {
      len += 4;
    } else if (u <= 0x3ffffff) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(
    ptr % 2 == 0,
    'Pointer passed to UTF16ToString must be aligned to two bytes!'
  );
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(ptr + i * 2) >> 1];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(
    outPtr % 2 == 0,
    'Pointer passed to stringToUTF16 must be aligned to two bytes!'
  );
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7fffffff;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite =
    maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[outPtr >> 1] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[outPtr >> 1] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length * 2;
}

function UTF32ToString(ptr) {
  assert(
    ptr % 4 == 0,
    'Pointer passed to UTF32ToString must be aligned to four bytes!'
  );
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(ptr + i * 4) >> 2];
    if (utf32 == 0) return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xd800 | (ch >> 10), 0xdc00 | (ch & 0x3ff));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(
    outPtr % 4 == 0,
    'Pointer passed to stringToUTF32 must be aligned to four bytes!'
  );
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7fffffff;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xd800 && codeUnit <= 0xdfff) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit =
        (0x10000 + ((codeUnit & 0x3ff) << 10)) | (trailSurrogate & 0x3ff);
    }
    HEAP32[outPtr >> 2] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[outPtr >> 2] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdfff) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce(
    'warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling'
  );
  return func;
}

function demangleAll(text) {
  var regex = /__Z[\w\d_]+/g;
  return text.replace(regex, function(x) {
    var y = demangle(x);
    return x === y ? x : x + ' [' + y + ']';
  });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch (e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
  /** @type {ArrayBuffer} */
  buffer,
  /** @type {Int8Array} */
  HEAP8,
  /** @type {Uint8Array} */
  HEAPU8,
  /** @type {Int16Array} */
  HEAP16,
  /** @type {Uint16Array} */
  HEAPU16,
  /** @type {Int32Array} */
  HEAP32,
  /** @type {Uint32Array} */
  HEAPU32,
  /** @type {Float32Array} */
  HEAPF32,
  /** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
staticSealed = false;

// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2) - 1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2) - 2] = 0x89bacdfe;
}

function checkStackCookie() {
  if (
    HEAPU32[(STACK_MAX >> 2) - 1] != 0x02135467 ||
    HEAPU32[(STACK_MAX >> 2) - 2] != 0x89bacdfe
  ) {
    abort(
      'Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' +
        HEAPU32[(STACK_MAX >> 2) - 2].toString(16) +
        ' ' +
        HEAPU32[(STACK_MAX >> 2) - 1].toString(16)
    );
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */)
    throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort(
    'Stack overflow! Attempted to allocate ' +
      allocSize +
      ' bytes on the stack, but stack has only ' +
      (STACK_MAX - stackSave() + allocSize) +
      ' bytes available!'
  );
}

function abortOnCannotGrowMemory() {
  abort(
    'Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' +
      TOTAL_MEMORY +
      ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 '
  );
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}

var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK)
  Module.printErr(
    'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' +
      TOTAL_MEMORY +
      '! (TOTAL_STACK=' +
      TOTAL_STACK +
      ')'
  );

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(
  typeof Int32Array !== 'undefined' &&
    typeof Float64Array !== 'undefined' &&
    Int32Array.prototype.subarray !== undefined &&
    Int32Array.prototype.set !== undefined,
  'JS engine does not provide full typed array support'
);

// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(
    buffer.byteLength === TOTAL_MEMORY,
    'provided buffer should be ' +
      TOTAL_MEMORY +
      ' bytes, but it is ' +
      buffer.byteLength
  );
} else {
  // Use a WebAssembly memory where available
  if (
    typeof WebAssembly === 'object' &&
    typeof WebAssembly.Memory === 'function'
  ) {
    assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    Module['wasmMemory'] = new WebAssembly.Memory({
      initial: TOTAL_MEMORY / WASM_PAGE_SIZE,
      maximum: TOTAL_MEMORY / WASM_PAGE_SIZE
    });
    buffer = Module['wasmMemory'].buffer;
  } else {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();

function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63)
  throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__ = []; // functions called before the runtime is initialized
var __ATINIT__ = []; // functions called during startup
var __ATMAIN__ = []; // functions called when main() is to be run
var __ATEXIT__ = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function')
      Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function')
      Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce(
    'writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!'
  );

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(
    array.length >= 0,
    'writeArrayToMemory array must have a length (should be an array or typed array)'
  );
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert((str.charCodeAt(i) === str.charCodeAt(i)) & 0xff);
    HEAP8[buffer++ >> 0] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32
    ? 2 * Math.abs(1 << (bits - 1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
    : Math.pow(2, bits) + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half =
    bits <= 32
      ? Math.abs(1 << (bits - 1)) // abs is needed if bits == 32
      : Math.pow(2, bits - 1);
  if (value >= half && (bits <= 32 || value > half)) {
    // for huge values, we can hit the precision limit and always get true here. so don't do that
    // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
    // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2 * half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(
  Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'],
  'this is a legacy browser, build with LEGACY_VM_SUPPORT'
);

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module['preloadedImages'] = {}; // maps url to image data
Module['preloadedAudios'] = {}; // maps url to audio data

var memoryInitializer = null;

var /* show errors on likely calls to FS when it was not included */ FS = {
    error: function() {
      abort(
        'Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1'
      );
    },
    init: function() {
      FS.error();
    },
    createDataFile: function() {
      FS.error();
    },
    createPreloadedFile: function() {
      FS.error();
    },
    createLazyFile: function() {
      FS.error();
    },
    open: function() {
      FS.error();
    },
    mkdev: function() {
      FS.error();
    },
    registerDevice: function() {
      FS.error();
    },
    analyzePath: function() {
      FS.error();
    },
    loadFilesFromDB: function() {
      FS.error();
    },

    ErrnoError: function ErrnoError() {
      FS.error();
    }
  };
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0;
}

function integrateWasmJS() {
  // wasm.js has several methods for creating the compiled code module here:
  //  * 'native-wasm' : use native WebAssembly support in the browser
  //  * 'interpret-s-expr': load s-expression code from a .wast and interpret
  //  * 'interpret-binary': load binary wasm and interpret
  //  * 'interpret-asm2wasm': load asm.js code, translate to wasm, and interpret
  //  * 'asmjs': no wasm, just load the asm.js code and use that (good for testing)
  // The method is set at compile time (BINARYEN_METHOD)
  // The method can be a comma-separated list, in which case, we will try the
  // options one by one. Some of them can fail gracefully, and then we can try
  // the next.

  // inputs

  var method = 'native-wasm';

  var wasmTextFile = 'md5.wast';
  var wasmBinaryFile = '/dutils/wasm/md5.wasm';
  var asmjsCodeFile = 'md5.temp.asm.js';

  if (typeof Module['locateFile'] === 'function') {
    if (!isDataURI(wasmTextFile)) {
      wasmTextFile = Module['locateFile'](wasmTextFile);
    }
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = Module['locateFile'](wasmBinaryFile);
    }
    if (!isDataURI(asmjsCodeFile)) {
      asmjsCodeFile = Module['locateFile'](asmjsCodeFile);
    }
  }

  // utilities

  var wasmPageSize = 64 * 1024;

  var info = {
    global: null,
    env: null,
    asm2wasm: {
      // special asm2wasm imports
      'f64-rem': function(x, y) {
        return x % y;
      },
      debugger: function() {
        debugger;
      }
    },
    parent: Module // Module inside wasm-js.cpp refers to wasm-js.cpp; this allows access to the outside program.
  };

  var exports = null;

  function mergeMemory(newBuffer) {
    // The wasm instance creates its memory. But static init code might have written to
    // buffer already, including the mem init file, and we must copy it over in a proper merge.
    // TODO: avoid this copy, by avoiding such static init writes
    // TODO: in shorter term, just copy up to the last static init write
    var oldBuffer = Module['buffer'];
    if (newBuffer.byteLength < oldBuffer.byteLength) {
      Module['printErr'](
        'the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here'
      );
    }
    var oldView = new Int8Array(oldBuffer);
    var newView = new Int8Array(newBuffer);

    newView.set(oldView);
    updateGlobalBuffer(newBuffer);
    updateGlobalBufferViews();
  }

  function fixImports(imports) {
    return imports;
  }

  function getBinary() {
    try {
      if (Module['wasmBinary']) {
        return new Uint8Array(Module['wasmBinary']);
      }
      if (Module['readBinary']) {
        return Module['readBinary'](wasmBinaryFile);
      } else {
        throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)";
      }
    } catch (err) {
      abort(err);
    }
  }

  function getBinaryPromise() {
    // if we don't have the binary yet, and have the Fetch api, use that
    // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
    if (
      !Module['wasmBinary'] &&
      (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
      typeof fetch === 'function'
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' })
        .then(function(response) {
          if (!response['ok']) {
            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
          }
          return response['arrayBuffer']();
        })
        .catch(function() {
          return getBinary();
        });
    }
    // Otherwise, getBinary should be able to get it synchronously
    return new Promise(function(resolve, reject) {
      resolve(getBinary());
    });
  }

  // do-method functions

  function doNativeWasm(global, env, providedBuffer) {
    if (typeof WebAssembly !== 'object') {
      Module['printErr']('no native wasm support detected');
      return false;
    }
    // prepare memory import
    if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
      Module['printErr']('no native wasm Memory in use');
      return false;
    }
    env['memory'] = Module['wasmMemory'];
    // Load the wasm module and create an instance of using native support in the JS engine.
    info['global'] = {
      NaN: NaN,
      Infinity: Infinity
    };
    info['global.Math'] = Math;
    info['env'] = env;
    // handle a generated wasm instance, receiving its exports and
    // performing other necessary setup
    function receiveInstance(instance, module) {
      exports = instance.exports;
      if (exports.memory) mergeMemory(exports.memory);
      Module['asm'] = exports;
      Module['usingWasm'] = true;
      removeRunDependency('wasm-instantiate');
    }
    addRunDependency('wasm-instantiate');

    // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
    // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
    // to any other async startup actions they are performing.
    if (Module['instantiateWasm']) {
      try {
        return Module['instantiateWasm'](info, receiveInstance);
      } catch (e) {
        Module['printErr'](
          'Module.instantiateWasm callback failed with error: ' + e
        );
        return false;
      }
    }

    // Async compilation can be confusing when an error on the page overwrites Module
    // (for example, if the order of elements is wrong, and the one defining Module is
    // later), so we save Module and check it later.
    var trueModule = Module;
    function receiveInstantiatedSource(output) {
      // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
      // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      assert(
        Module === trueModule,
        'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?'
      );
      trueModule = null;
      receiveInstance(output['instance'], output['module']);
    }
    function instantiateArrayBuffer(receiver) {
      getBinaryPromise()
        .then(function(binary) {
          return WebAssembly.instantiate(binary, info);
        })
        .then(receiver)
        .catch(function(reason) {
          Module['printErr'](
            'failed to asynchronously prepare wasm: ' + reason
          );
          abort(reason);
        });
    }
    // Prefer streaming instantiation if available.
    if (
      !Module['wasmBinary'] &&
      typeof WebAssembly.instantiateStreaming === 'function' &&
      !isDataURI(wasmBinaryFile) &&
      typeof fetch === 'function'
    ) {
      WebAssembly.instantiateStreaming(
        fetch(wasmBinaryFile, { credentials: 'same-origin' }),
        info
      )
        .then(receiveInstantiatedSource)
        .catch(function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          Module['printErr']('wasm streaming compile failed: ' + reason);
          Module['printErr']('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
    } else {
      instantiateArrayBuffer(receiveInstantiatedSource);
    }
    return {}; // no exports yet; we'll fill them in later
  }

  // We may have a preloaded value in Module.asm, save it
  Module['asmPreload'] = Module['asm'];

  // Memory growth integration code

  var asmjsReallocBuffer = Module['reallocBuffer'];

  var wasmReallocBuffer = function(size) {
    var PAGE_MULTIPLE = Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
    size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
    var old = Module['buffer'];
    var oldSize = old.byteLength;
    if (Module['usingWasm']) {
      // native wasm support
      try {
        var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return (Module['buffer'] = Module['wasmMemory'].buffer);
        } else {
          return null;
        }
      } catch (e) {
        console.error(
          'Module.reallocBuffer: Attempted to grow from ' +
            oldSize +
            ' bytes to ' +
            size +
            ' bytes, but got error: ' +
            e
        );
        return null;
      }
    }
  };

  Module['reallocBuffer'] = function(size) {
    if (finalMethod === 'asmjs') {
      return asmjsReallocBuffer(size);
    } else {
      return wasmReallocBuffer(size);
    }
  };

  // we may try more than one; this is the final one, that worked and we are using
  var finalMethod = '';

  // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
  // the wasm module at that time, and it receives imports and provides exports and so forth, the app
  // doesn't need to care that it is wasm or olyfilled wasm or asm.js.

  Module['asm'] = function(global, env, providedBuffer) {
    env = fixImports(env);

    // import table
    if (!env['table']) {
      var TABLE_SIZE = Module['wasmTableSize'];
      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024; // works in binaryen interpreter at least
      var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
      if (
        typeof WebAssembly === 'object' &&
        typeof WebAssembly.Table === 'function'
      ) {
        if (MAX_TABLE_SIZE !== undefined) {
          env['table'] = new WebAssembly.Table({
            initial: TABLE_SIZE,
            maximum: MAX_TABLE_SIZE,
            element: 'anyfunc'
          });
        } else {
          env['table'] = new WebAssembly.Table({
            initial: TABLE_SIZE,
            element: 'anyfunc'
          });
        }
      } else {
        env['table'] = new Array(TABLE_SIZE); // works in binaryen interpreter at least
      }
      Module['wasmTable'] = env['table'];
    }

    if (!env['memoryBase']) {
      env['memoryBase'] = Module['STATIC_BASE']; // tell the memory segments where to place themselves
    }
    if (!env['tableBase']) {
      env['tableBase'] = 0; // table starts at 0 by default, in dynamic linking this will change
    }

    // try the methods. each should return the exports if it succeeded

    var exports;
    exports = doNativeWasm(global, env, providedBuffer);

    if (!exports)
      abort(
        'no binaryen method succeeded. consider enabling more options, like interpreting, if you want that: https://github.com/kripken/emscripten/wiki/WebAssembly#binaryen-methods'
      );

    return exports;
  };

  var methodHandler = Module['asm']; // note our method handler, as we may modify Module['asm'] later
}

integrateWasmJS();

// === Body ===

var ASM_CONSTS = [
  function($0, $1) {
    Module.printErr(
      'bad name in getProcAddress: ' +
        [Pointer_stringify($0), Pointer_stringify($1)]
    );
  }
];

function _emscripten_asm_const_iii(code, a0, a1) {
  return ASM_CONSTS[code](a0, a1);
}

STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 9024;
/* global initializers */ __ATINIT__.push();

var STATIC_BUMP = 9024;
Module['STATIC_BASE'] = STATIC_BASE;
Module['STATIC_BUMP'] = STATIC_BUMP;

/* no memory initializer */
var tempDoublePtr = STATICTOP;
STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) {
  // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];

  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];

  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
}

function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];

  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];

  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];

  HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];

  HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];

  HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];

  HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7];
}

// {{PRE_LIBRARY}}

function ___lock() {}

var SYSCALLS = {
  varargs: 0,
  get: function(varargs) {
    SYSCALLS.varargs += 4;
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
    return ret;
  },
  getStr: function() {
    var ret = Pointer_stringify(SYSCALLS.get());
    return ret;
  },
  get64: function() {
    var low = SYSCALLS.get(),
      high = SYSCALLS.get();
    if (low >= 0) assert(high === 0);
    else assert(high === -1);
    return low;
  },
  getZero: function() {
    assert(SYSCALLS.get() === 0);
  }
};
function ___syscall140(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    // llseek
    var stream = SYSCALLS.getStreamFromFD(),
      offset_high = SYSCALLS.get(),
      offset_low = SYSCALLS.get(),
      result = SYSCALLS.get(),
      whence = SYSCALLS.get();
    // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
    var offset = offset_low;
    FS.llseek(stream, offset, whence);
    HEAP32[result >> 2] = stream.position;
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}

function flush_NO_FILESYSTEM() {
  // flush anything remaining in the buffers during shutdown
  var fflush = Module['_fflush'];
  if (fflush) fflush(0);
  var printChar = ___syscall146.printChar;
  if (!printChar) return;
  var buffers = ___syscall146.buffers;
  if (buffers[1].length) printChar(1, 10);
  if (buffers[2].length) printChar(2, 10);
}
function ___syscall146(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    // writev
    // hack to support printf in NO_FILESYSTEM
    var stream = SYSCALLS.get(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get();
    var ret = 0;
    if (!___syscall146.buffers) {
      ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
      ___syscall146.printChar = function(stream, curr) {
        var buffer = ___syscall146.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? Module['print'] : Module['printErr'])(
            UTF8ArrayToString(buffer, 0)
          );
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      };
    }
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2];
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
      for (var j = 0; j < len; j++) {
        ___syscall146.printChar(stream, HEAPU8[ptr + j]);
      }
      ret += len;
    }
    return ret;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}

function ___syscall54(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    // ioctl
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}

function ___syscall6(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    // close
    var stream = SYSCALLS.getStreamFromFD();
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}

function ___unlock() {}

var _emscripten_asm_const_int = true;

var GL = {
  counter: 1,
  lastError: 0,
  buffers: [],
  mappedBuffers: {},
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  uniforms: [],
  shaders: [],
  vaos: [],
  contexts: [],
  currentContext: null,
  offscreenCanvases: {},
  timerQueriesEXT: [],
  byteSizeByTypeRoot: 5120,
  byteSizeByType: [1, 1, 2, 2, 4, 4, 4, 2, 3, 4, 8],
  programInfos: {},
  stringCache: {},
  tempFixedLengthArray: [],
  packAlignment: 4,
  unpackAlignment: 4,
  init: function() {
    GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
    for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
      GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1);
    }

    // For functions such as glDrawBuffers, glInvalidateFramebuffer and glInvalidateSubFramebuffer that need to pass a short array to the WebGL API,
    // create a set of short fixed-length arrays to avoid having to generate any garbage when calling those functions.
    for (var i = 0; i < 32; i++) {
      GL.tempFixedLengthArray.push(new Array(i));
    }
  },
  recordError: function recordError(errorCode) {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: function(table) {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  MINI_TEMP_BUFFER_SIZE: 256,
  miniTempBuffer: null,
  miniTempBufferViews: [0],
  getSource: function(shader, count, string, length) {
    var source = '';
    for (var i = 0; i < count; ++i) {
      var frag;
      if (length) {
        var len = HEAP32[(length + i * 4) >> 2];
        if (len < 0) {
          frag = Pointer_stringify(HEAP32[(string + i * 4) >> 2]);
        } else {
          frag = Pointer_stringify(HEAP32[(string + i * 4) >> 2], len);
        }
      } else {
        frag = Pointer_stringify(HEAP32[(string + i * 4) >> 2]);
      }
      source += frag;
    }
    return source;
  },
  createContext: function(canvas, webGLContextAttributes) {
    if (
      typeof webGLContextAttributes['majorVersion'] === 'undefined' &&
      typeof webGLContextAttributes['minorVersion'] === 'undefined'
    ) {
      webGLContextAttributes['majorVersion'] = 1;
      webGLContextAttributes['minorVersion'] = 0;
    }

    var ctx;
    var errorInfo = '?';
    function onContextCreationError(event) {
      errorInfo = event.statusMessage || errorInfo;
    }
    try {
      canvas.addEventListener(
        'webglcontextcreationerror',
        onContextCreationError,
        false
      );
      try {
        if (
          webGLContextAttributes['majorVersion'] == 1 &&
          webGLContextAttributes['minorVersion'] == 0
        ) {
          ctx =
            canvas.getContext('webgl', webGLContextAttributes) ||
            canvas.getContext('experimental-webgl', webGLContextAttributes);
        } else if (
          webGLContextAttributes['majorVersion'] == 2 &&
          webGLContextAttributes['minorVersion'] == 0
        ) {
          ctx = canvas.getContext('webgl2', webGLContextAttributes);
        } else {
          throw 'Unsupported WebGL context version ' +
            majorVersion +
            '.' +
            minorVersion +
            '!';
        }
      } finally {
        canvas.removeEventListener(
          'webglcontextcreationerror',
          onContextCreationError,
          false
        );
      }
      if (!ctx) throw ':(';
    } catch (e) {
      Module.print(
        'Could not create canvas: ' +
          [errorInfo, e, JSON.stringify(webGLContextAttributes)]
      );
      return 0;
    }

    if (!ctx) return 0;
    var context = GL.registerContext(ctx, webGLContextAttributes);
    return context;
  },
  registerContext: function(ctx, webGLContextAttributes) {
    var handle = GL.getNewId(GL.contexts);
    var context = {
      handle: handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes['majorVersion'],
      GLctx: ctx
    };

    // Store the created context object so that we can access the context given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (
      typeof webGLContextAttributes['enableExtensionsByDefault'] ===
        'undefined' ||
      webGLContextAttributes['enableExtensionsByDefault']
    ) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: function(contextHandle) {
    var context = GL.contexts[contextHandle];
    if (!context) return false;
    GLctx = Module.ctx = context.GLctx; // Active WebGL context object.
    GL.currentContext = context; // Active Emscripten GL layer context object.
    return true;
  },
  getContext: function(contextHandle) {
    return GL.contexts[contextHandle];
  },
  deleteContext: function(contextHandle) {
    if (GL.currentContext === GL.contexts[contextHandle])
      GL.currentContext = null;
    if (typeof JSEvents === 'object')
      JSEvents.removeAllHandlersOnTarget(
        GL.contexts[contextHandle].GLctx.canvas
      ); // Release all JS event handlers on the DOM element that the GL context is associated with since the context is now deleted.
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined; // Make sure the canvas object no longer refers to the context object so there are no GC surprises.
    GL.contexts[contextHandle] = null;
  },
  initExtensions: function(context) {
    // If this function is called without a specific context object, init the extensions of the currently active context.
    if (!context) context = GL.currentContext;

    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;

    var GLctx = context.GLctx;

    context.maxVertexAttribs = GLctx.getParameter(GLctx.MAX_VERTEX_ATTRIBS);

    // Detect the presence of a few extensions manually, this GL interop layer itself will need to know if they exist.

    if (context.version < 2) {
      // Extension available from Firefox 26 and Google Chrome 30
      var instancedArraysExt = GLctx.getExtension('ANGLE_instanced_arrays');
      if (instancedArraysExt) {
        GLctx['vertexAttribDivisor'] = function(index, divisor) {
          instancedArraysExt['vertexAttribDivisorANGLE'](index, divisor);
        };
        GLctx['drawArraysInstanced'] = function(mode, first, count, primcount) {
          instancedArraysExt['drawArraysInstancedANGLE'](
            mode,
            first,
            count,
            primcount
          );
        };
        GLctx['drawElementsInstanced'] = function(
          mode,
          count,
          type,
          indices,
          primcount
        ) {
          instancedArraysExt['drawElementsInstancedANGLE'](
            mode,
            count,
            type,
            indices,
            primcount
          );
        };
      }

      // Extension available from Firefox 25 and WebKit
      var vaoExt = GLctx.getExtension('OES_vertex_array_object');
      if (vaoExt) {
        GLctx['createVertexArray'] = function() {
          return vaoExt['createVertexArrayOES']();
        };
        GLctx['deleteVertexArray'] = function(vao) {
          vaoExt['deleteVertexArrayOES'](vao);
        };
        GLctx['bindVertexArray'] = function(vao) {
          vaoExt['bindVertexArrayOES'](vao);
        };
        GLctx['isVertexArray'] = function(vao) {
          return vaoExt['isVertexArrayOES'](vao);
        };
      }

      var drawBuffersExt = GLctx.getExtension('WEBGL_draw_buffers');
      if (drawBuffersExt) {
        GLctx['drawBuffers'] = function(n, bufs) {
          drawBuffersExt['drawBuffersWEBGL'](n, bufs);
        };
      }
    }

    GLctx.disjointTimerQueryExt = GLctx.getExtension(
      'EXT_disjoint_timer_query'
    );

    // These are the 'safe' feature-enabling extensions that don't add any performance impact related to e.g. debugging, and
    // should be enabled by default so that client GLES2/GL code will not need to go through extra hoops to get its stuff working.
    // As new extensions are ratified at http://www.khronos.org/registry/webgl/extensions/ , feel free to add your new extensions
    // here, as long as they don't produce a performance impact for users that might not be using those extensions.
    // E.g. debugging-related extensions should probably be off by default.
    var automaticallyEnabledExtensions = [
      'OES_texture_float',
      'OES_texture_half_float',
      'OES_standard_derivatives',
      'OES_vertex_array_object',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_depth_texture',
      'OES_element_index_uint',
      'EXT_texture_filter_anisotropic',
      'ANGLE_instanced_arrays',
      'OES_texture_float_linear',
      'OES_texture_half_float_linear',
      'WEBGL_compressed_texture_atc',
      'WEBKIT_WEBGL_compressed_texture_pvrtc',
      'WEBGL_compressed_texture_pvrtc',
      'EXT_color_buffer_half_float',
      'WEBGL_color_buffer_float',
      'EXT_frag_depth',
      'EXT_sRGB',
      'WEBGL_draw_buffers',
      'WEBGL_shared_resources',
      'EXT_shader_texture_lod',
      'EXT_color_buffer_float'
    ];

    function shouldEnableAutomatically(extension) {
      var ret = false;
      automaticallyEnabledExtensions.forEach(function(include) {
        if (extension.indexOf(include) != -1) {
          ret = true;
        }
      });
      return ret;
    }

    var exts = GLctx.getSupportedExtensions();
    if (exts && exts.length > 0) {
      GLctx.getSupportedExtensions().forEach(function(ext) {
        if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
          GLctx.getExtension(ext); // Calling .getExtension enables that extension permanently, no need to store the return value to be enabled.
        }
      });
    }
  },
  populateUniformTable: function(program) {
    var p = GL.programs[program];
    GL.programInfos[program] = {
      uniforms: {},
      maxUniformLength: 0, // This is eagerly computed below, since we already enumerate all uniforms anyway.
      maxAttributeLength: -1, // This is lazily computed and cached, computed when/if first asked, "-1" meaning not computed yet.
      maxUniformBlockNameLength: -1 // Lazily computed as well
    };

    var ptable = GL.programInfos[program];
    var utable = ptable.uniforms;
    // A program's uniform table maps the string name of an uniform to an integer location of that uniform.
    // The global GL.uniforms map maps integer locations to WebGLUniformLocations.
    var numUniforms = GLctx.getProgramParameter(p, GLctx.ACTIVE_UNIFORMS);
    for (var i = 0; i < numUniforms; ++i) {
      var u = GLctx.getActiveUniform(p, i);

      var name = u.name;
      ptable.maxUniformLength = Math.max(
        ptable.maxUniformLength,
        name.length + 1
      );

      // Strip off any trailing array specifier we might have got, e.g. "[0]".
      if (name.indexOf(']', name.length - 1) !== -1) {
        var ls = name.lastIndexOf('[');
        name = name.slice(0, ls);
      }

      // Optimize memory usage slightly: If we have an array of uniforms, e.g. 'vec3 colors[3];', then
      // only store the string 'colors' in utable, and 'colors[0]', 'colors[1]' and 'colors[2]' will be parsed as 'colors'+i.
      // Note that for the GL.uniforms table, we still need to fetch the all WebGLUniformLocations for all the indices.
      var loc = GLctx.getUniformLocation(p, name);
      if (loc != null) {
        var id = GL.getNewId(GL.uniforms);
        utable[name] = [u.size, id];
        GL.uniforms[id] = loc;

        for (var j = 1; j < u.size; ++j) {
          var n = name + '[' + j + ']';
          loc = GLctx.getUniformLocation(p, n);
          id = GL.getNewId(GL.uniforms);

          GL.uniforms[id] = loc;
        }
      }
    }
  }
};
function _emscripten_glActiveTexture(x0) {
  GLctx['activeTexture'](x0);
}

function _emscripten_glAttachShader(program, shader) {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}

function _emscripten_glBindAttribLocation(program, index, name) {
  name = Pointer_stringify(name);
  GLctx.bindAttribLocation(GL.programs[program], index, name);
}

function _emscripten_glBindBuffer(target, buffer) {
  var bufferObj = buffer ? GL.buffers[buffer] : null;

  GLctx.bindBuffer(target, bufferObj);
}

function _emscripten_glBindFramebuffer(target, framebuffer) {
  GLctx.bindFramebuffer(
    target,
    framebuffer ? GL.framebuffers[framebuffer] : null
  );
}

function _emscripten_glBindProgramARB() {
  Module['printErr']('missing function: emscripten_glBindProgramARB');
  abort(-1);
}

function _emscripten_glBindRenderbuffer(target, renderbuffer) {
  GLctx.bindRenderbuffer(
    target,
    renderbuffer ? GL.renderbuffers[renderbuffer] : null
  );
}

function _emscripten_glBindTexture(target, texture) {
  GLctx.bindTexture(target, texture ? GL.textures[texture] : null);
}

function _emscripten_glBindVertexArray(vao) {
  GLctx['bindVertexArray'](GL.vaos[vao]);
}

function _emscripten_glBlendColor(x0, x1, x2, x3) {
  GLctx['blendColor'](x0, x1, x2, x3);
}

function _emscripten_glBlendEquation(x0) {
  GLctx['blendEquation'](x0);
}

function _emscripten_glBlendEquationSeparate(x0, x1) {
  GLctx['blendEquationSeparate'](x0, x1);
}

function _emscripten_glBlendFunc(x0, x1) {
  GLctx['blendFunc'](x0, x1);
}

function _emscripten_glBlendFuncSeparate(x0, x1, x2, x3) {
  GLctx['blendFuncSeparate'](x0, x1, x2, x3);
}

function _emscripten_glBufferData(target, size, data, usage) {
  if (!data) {
    GLctx.bufferData(target, size, usage);
  } else {
    GLctx.bufferData(target, HEAPU8.subarray(data, data + size), usage);
  }
}

function _emscripten_glBufferSubData(target, offset, size, data) {
  GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
}

function _emscripten_glCheckFramebufferStatus(x0) {
  return GLctx['checkFramebufferStatus'](x0);
}

function _emscripten_glClear(x0) {
  GLctx['clear'](x0);
}

function _emscripten_glClearColor(x0, x1, x2, x3) {
  GLctx['clearColor'](x0, x1, x2, x3);
}

function _emscripten_glClearDepth(x0) {
  GLctx['clearDepth'](x0);
}

function _emscripten_glClearDepthf(x0) {
  GLctx['clearDepth'](x0);
}

function _emscripten_glClearStencil(x0) {
  GLctx['clearStencil'](x0);
}

function _emscripten_glClientActiveTexture() {
  Module['printErr']('missing function: emscripten_glClientActiveTexture');
  abort(-1);
}

function _emscripten_glColorMask(red, green, blue, alpha) {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
}

function _emscripten_glColorPointer() {
  Module['printErr']('missing function: emscripten_glColorPointer');
  abort(-1);
}

function _emscripten_glCompileShader(shader) {
  GLctx.compileShader(GL.shaders[shader]);
}

function _emscripten_glCompressedTexImage2D(
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  imageSize,
  data
) {
  GLctx['compressedTexImage2D'](
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    data ? HEAPU8.subarray(data, data + imageSize) : null
  );
}

function _emscripten_glCompressedTexSubImage2D(
  target,
  level,
  xoffset,
  yoffset,
  width,
  height,
  format,
  imageSize,
  data
) {
  GLctx['compressedTexSubImage2D'](
    target,
    level,
    xoffset,
    yoffset,
    width,
    height,
    format,
    data ? HEAPU8.subarray(data, data + imageSize) : null
  );
}

function _emscripten_glCopyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
  GLctx['copyTexImage2D'](x0, x1, x2, x3, x4, x5, x6, x7);
}

function _emscripten_glCopyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
  GLctx['copyTexSubImage2D'](x0, x1, x2, x3, x4, x5, x6, x7);
}

function _emscripten_glCreateProgram() {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  program.name = id;
  GL.programs[id] = program;
  return id;
}

function _emscripten_glCreateShader(shaderType) {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
}

function _emscripten_glCullFace(x0) {
  GLctx['cullFace'](x0);
}

function _emscripten_glDeleteBuffers(n, buffers) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(buffers + i * 4) >> 2];
    var buffer = GL.buffers[id];

    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue;

    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;

    if (id == GL.currArrayBuffer) GL.currArrayBuffer = 0;
    if (id == GL.currElementArrayBuffer) GL.currElementArrayBuffer = 0;
  }
}

function _emscripten_glDeleteFramebuffers(n, framebuffers) {
  for (var i = 0; i < n; ++i) {
    var id = HEAP32[(framebuffers + i * 4) >> 2];
    var framebuffer = GL.framebuffers[id];
    if (!framebuffer) continue; // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
    GLctx.deleteFramebuffer(framebuffer);
    framebuffer.name = 0;
    GL.framebuffers[id] = null;
  }
}

function _emscripten_glDeleteObjectARB() {
  Module['printErr']('missing function: emscripten_glDeleteObjectARB');
  abort(-1);
}

function _emscripten_glDeleteProgram(id) {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting object, unlike some other GL delete functions.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
  GL.programInfos[id] = null;
}

function _emscripten_glDeleteRenderbuffers(n, renderbuffers) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(renderbuffers + i * 4) >> 2];
    var renderbuffer = GL.renderbuffers[id];
    if (!renderbuffer) continue; // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
    GLctx.deleteRenderbuffer(renderbuffer);
    renderbuffer.name = 0;
    GL.renderbuffers[id] = null;
  }
}

function _emscripten_glDeleteShader(id) {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting object, unlike some other GL delete functions.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
}

function _emscripten_glDeleteTextures(n, textures) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(textures + i * 4) >> 2];
    var texture = GL.textures[id];
    if (!texture) continue; // GL spec: "glDeleteTextures silently ignores 0s and names that do not correspond to existing textures".
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
}

function _emscripten_glDeleteVertexArrays(n, vaos) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(vaos + i * 4) >> 2];
    GLctx['deleteVertexArray'](GL.vaos[id]);
    GL.vaos[id] = null;
  }
}

function _emscripten_glDepthFunc(x0) {
  GLctx['depthFunc'](x0);
}

function _emscripten_glDepthMask(flag) {
  GLctx.depthMask(!!flag);
}

function _emscripten_glDepthRange(x0, x1) {
  GLctx['depthRange'](x0, x1);
}

function _emscripten_glDepthRangef(x0, x1) {
  GLctx['depthRange'](x0, x1);
}

function _emscripten_glDetachShader(program, shader) {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
}

function _emscripten_glDisable(x0) {
  GLctx['disable'](x0);
}

function _emscripten_glDisableVertexAttribArray(index) {
  GLctx.disableVertexAttribArray(index);
}

function _emscripten_glDrawArrays(mode, first, count) {
  GLctx.drawArrays(mode, first, count);
}

function _emscripten_glDrawArraysInstanced(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}

function _emscripten_glDrawBuffers(n, bufs) {
  var bufArray = GL.tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = HEAP32[(bufs + i * 4) >> 2];
  }

  GLctx['drawBuffers'](bufArray);
}

function _emscripten_glDrawElements(mode, count, type, indices) {
  GLctx.drawElements(mode, count, type, indices);
}

function _emscripten_glDrawElementsInstanced(
  mode,
  count,
  type,
  indices,
  primcount
) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}

function _emscripten_glDrawRangeElements() {
  Module['printErr']('missing function: emscripten_glDrawRangeElements');
  abort(-1);
}

function _emscripten_glEnable(x0) {
  GLctx['enable'](x0);
}

function _emscripten_glEnableClientState() {
  Module['printErr']('missing function: emscripten_glEnableClientState');
  abort(-1);
}

function _emscripten_glEnableVertexAttribArray(index) {
  GLctx.enableVertexAttribArray(index);
}

function _emscripten_glFinish() {
  GLctx['finish']();
}

function _emscripten_glFlush() {
  GLctx['flush']();
}

function _emscripten_glFramebufferRenderbuffer(
  target,
  attachment,
  renderbuffertarget,
  renderbuffer
) {
  GLctx.framebufferRenderbuffer(
    target,
    attachment,
    renderbuffertarget,
    GL.renderbuffers[renderbuffer]
  );
}

function _emscripten_glFramebufferTexture2D(
  target,
  attachment,
  textarget,
  texture,
  level
) {
  GLctx.framebufferTexture2D(
    target,
    attachment,
    textarget,
    GL.textures[texture],
    level
  );
}

function _emscripten_glFrontFace(x0) {
  GLctx['frontFace'](x0);
}

function _emscripten_glFrustum() {
  Module['printErr']('missing function: emscripten_glFrustum');
  abort(-1);
}

function _emscripten_glGenBuffers(n, buffers) {
  for (var i = 0; i < n; i++) {
    var buffer = GLctx.createBuffer();
    if (!buffer) {
      GL.recordError(0x0502 /* GL_INVALID_OPERATION */);
      while (i < n) HEAP32[(buffers + i++ * 4) >> 2] = 0;
      return;
    }
    var id = GL.getNewId(GL.buffers);
    buffer.name = id;
    GL.buffers[id] = buffer;
    HEAP32[(buffers + i * 4) >> 2] = id;
  }
}

function _emscripten_glGenFramebuffers(n, ids) {
  for (var i = 0; i < n; ++i) {
    var framebuffer = GLctx.createFramebuffer();
    if (!framebuffer) {
      GL.recordError(0x0502 /* GL_INVALID_OPERATION */);
      while (i < n) HEAP32[(ids + i++ * 4) >> 2] = 0;
      return;
    }
    var id = GL.getNewId(GL.framebuffers);
    framebuffer.name = id;
    GL.framebuffers[id] = framebuffer;
    HEAP32[(ids + i * 4) >> 2] = id;
  }
}

function _emscripten_glGenRenderbuffers(n, renderbuffers) {
  for (var i = 0; i < n; i++) {
    var renderbuffer = GLctx.createRenderbuffer();
    if (!renderbuffer) {
      GL.recordError(0x0502 /* GL_INVALID_OPERATION */);
      while (i < n) HEAP32[(renderbuffers + i++ * 4) >> 2] = 0;
      return;
    }
    var id = GL.getNewId(GL.renderbuffers);
    renderbuffer.name = id;
    GL.renderbuffers[id] = renderbuffer;
    HEAP32[(renderbuffers + i * 4) >> 2] = id;
  }
}

function _emscripten_glGenTextures(n, textures) {
  for (var i = 0; i < n; i++) {
    var texture = GLctx.createTexture();
    if (!texture) {
      GL.recordError(0x0502 /* GL_INVALID_OPERATION */); // GLES + EGL specs don't specify what should happen here, so best to issue an error and create IDs with 0.
      while (i < n) HEAP32[(textures + i++ * 4) >> 2] = 0;
      return;
    }
    var id = GL.getNewId(GL.textures);
    texture.name = id;
    GL.textures[id] = texture;
    HEAP32[(textures + i * 4) >> 2] = id;
  }
}

function _emscripten_glGenVertexArrays(n, arrays) {
  for (var i = 0; i < n; i++) {
    var vao = GLctx['createVertexArray']();
    if (!vao) {
      GL.recordError(0x0502 /* GL_INVALID_OPERATION */);
      while (i < n) HEAP32[(arrays + i++ * 4) >> 2] = 0;
      return;
    }
    var id = GL.getNewId(GL.vaos);
    vao.name = id;
    GL.vaos[id] = vao;
    HEAP32[(arrays + i * 4) >> 2] = id;
  }
}

function _emscripten_glGenerateMipmap(x0) {
  GLctx['generateMipmap'](x0);
}

function _emscripten_glGetActiveAttrib(
  program,
  index,
  bufSize,
  length,
  size,
  type,
  name
) {
  program = GL.programs[program];
  var info = GLctx.getActiveAttrib(program, index);
  if (!info) return; // If an error occurs, nothing will be written to length, size and type and name.

  if (bufSize > 0 && name) {
    var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }

  if (size) HEAP32[size >> 2] = info.size;
  if (type) HEAP32[type >> 2] = info.type;
}

function _emscripten_glGetActiveUniform(
  program,
  index,
  bufSize,
  length,
  size,
  type,
  name
) {
  program = GL.programs[program];
  var info = GLctx.getActiveUniform(program, index);
  if (!info) return; // If an error occurs, nothing will be written to length, size, type and name.

  if (bufSize > 0 && name) {
    var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }

  if (size) HEAP32[size >> 2] = info.size;
  if (type) HEAP32[type >> 2] = info.type;
}

function _emscripten_glGetAttachedShaders(program, maxCount, count, shaders) {
  var result = GLctx.getAttachedShaders(GL.programs[program]);
  var len = result.length;
  if (len > maxCount) {
    len = maxCount;
  }
  HEAP32[count >> 2] = len;
  for (var i = 0; i < len; ++i) {
    var id = GL.shaders.indexOf(result[i]);
    assert(id !== -1, 'shader not bound to local id');
    HEAP32[(shaders + i * 4) >> 2] = id;
  }
}

function _emscripten_glGetAttribLocation(program, name) {
  program = GL.programs[program];
  name = Pointer_stringify(name);
  return GLctx.getAttribLocation(program, name);
}

function emscriptenWebGLGet(name_, p, type) {
  // Guard against user passing a null pointer.
  // Note that GLES2 spec does not say anything about how passing a null pointer should be treated.
  // Testing on desktop core GL 3, the application crashes on glGetIntegerv to a null pointer, but
  // better to report an error instead of doing anything random.
  if (!p) {
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  var ret = undefined;
  switch (
    name_ // Handle a few trivial GLES values
  ) {
    case 0x8dfa: // GL_SHADER_COMPILER
      ret = 1;
      break;
    case 0x8df8: // GL_SHADER_BINARY_FORMATS
      if (type !== 'Integer' && type !== 'Integer64') {
        GL.recordError(0x0500); // GL_INVALID_ENUM
      }
      return; // Do not write anything to the out pointer, since no binary formats are supported.
    case 0x8df9: // GL_NUM_SHADER_BINARY_FORMATS
      ret = 0;
      break;
    case 0x86a2: // GL_NUM_COMPRESSED_TEXTURE_FORMATS
      // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be queried for length),
      // so implement it ourselves to allow C++ GLES2 code get the length.
      var formats = GLctx.getParameter(
        0x86a3 /*GL_COMPRESSED_TEXTURE_FORMATS*/
      );
      ret = formats.length;
      break;
  }

  if (ret === undefined) {
    var result = GLctx.getParameter(name_);
    switch (typeof result) {
      case 'number':
        ret = result;
        break;
      case 'boolean':
        ret = result ? 1 : 0;
        break;
      case 'string':
        GL.recordError(0x0500); // GL_INVALID_ENUM
        return;
      case 'object':
        if (result === null) {
          // null is a valid result for some (e.g., which buffer is bound - perhaps nothing is bound), but otherwise
          // can mean an invalid name_, which we need to report as an error
          switch (name_) {
            case 0x8894: // ARRAY_BUFFER_BINDING
            case 0x8b8d: // CURRENT_PROGRAM
            case 0x8895: // ELEMENT_ARRAY_BUFFER_BINDING
            case 0x8ca6: // FRAMEBUFFER_BINDING
            case 0x8ca7: // RENDERBUFFER_BINDING
            case 0x8069: // TEXTURE_BINDING_2D
            case 0x8514: {
              // TEXTURE_BINDING_CUBE_MAP
              ret = 0;
              break;
            }
            default: {
              GL.recordError(0x0500); // GL_INVALID_ENUM
              return;
            }
          }
        } else if (
          result instanceof Float32Array ||
          result instanceof Uint32Array ||
          result instanceof Int32Array ||
          result instanceof Array
        ) {
          for (var i = 0; i < result.length; ++i) {
            switch (type) {
              case 'Integer':
                HEAP32[(p + i * 4) >> 2] = result[i];
                break;
              case 'Float':
                HEAPF32[(p + i * 4) >> 2] = result[i];
                break;
              case 'Boolean':
                HEAP8[(p + i) >> 0] = result[i] ? 1 : 0;
                break;
              default:
                throw 'internal glGet error, bad type: ' + type;
            }
          }
          return;
        } else if (
          result instanceof WebGLBuffer ||
          result instanceof WebGLProgram ||
          result instanceof WebGLFramebuffer ||
          result instanceof WebGLRenderbuffer ||
          result instanceof WebGLTexture
        ) {
          ret = result.name | 0;
        } else {
          GL.recordError(0x0500); // GL_INVALID_ENUM
          return;
        }
        break;
      default:
        GL.recordError(0x0500); // GL_INVALID_ENUM
        return;
    }
  }

  switch (type) {
    case 'Integer64':
      (tempI64 = [
        ret >>> 0,
        ((tempDouble = ret),
        +Math_abs(tempDouble) >= 1.0
          ? tempDouble > 0.0
            ? (Math_min(+Math_floor(tempDouble / 4294967296.0), 4294967295.0) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296.0
              ) >>> 0
          : 0)
      ]),
        (HEAP32[p >> 2] = tempI64[0]),
        (HEAP32[(p + 4) >> 2] = tempI64[1]);
      break;
    case 'Integer':
      HEAP32[p >> 2] = ret;
      break;
    case 'Float':
      HEAPF32[p >> 2] = ret;
      break;
    case 'Boolean':
      HEAP8[p >> 0] = ret ? 1 : 0;
      break;
    default:
      throw 'internal glGet error, bad type: ' + type;
  }
}
function _emscripten_glGetBooleanv(name_, p) {
  emscriptenWebGLGet(name_, p, 'Boolean');
}

function _emscripten_glGetBufferParameteriv(target, value, data) {
  if (!data) {
    // GLES2 specification does not specify how to behave if data is a null pointer. Since calling this function does not make sense
    // if data == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  HEAP32[data >> 2] = GLctx.getBufferParameter(target, value);
}

function _emscripten_glGetError() {
  // First return any GL error generated by the emscripten library_gl.js interop layer.
  if (GL.lastError) {
    var error = GL.lastError;
    GL.lastError = 0 /*GL_NO_ERROR*/;
    return error;
  } else {
    // If there were none, return the GL error from the browser GL context.
    return GLctx.getError();
  }
}

function _emscripten_glGetFloatv(name_, p) {
  emscriptenWebGLGet(name_, p, 'Float');
}

function _emscripten_glGetFramebufferAttachmentParameteriv(
  target,
  attachment,
  pname,
  params
) {
  var result = GLctx.getFramebufferAttachmentParameter(
    target,
    attachment,
    pname
  );
  HEAP32[params >> 2] = result;
}

function _emscripten_glGetInfoLogARB() {
  Module['printErr']('missing function: emscripten_glGetInfoLogARB');
  abort(-1);
}

function _emscripten_glGetIntegerv(name_, p) {
  emscriptenWebGLGet(name_, p, 'Integer');
}

function _emscripten_glGetObjectParameterivARB() {
  Module['printErr']('missing function: emscripten_glGetObjectParameterivARB');
  abort(-1);
}

function _emscripten_glGetPointerv() {
  Module['printErr']('missing function: emscripten_glGetPointerv');
  abort(-1);
}

function _emscripten_glGetProgramInfoLog(program, maxLength, length, infoLog) {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = '(unknown error)';

  if (maxLength > 0 && infoLog) {
    var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}

function _emscripten_glGetProgramiv(program, pname, p) {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }

  if (program >= GL.counter) {
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }

  var ptable = GL.programInfos[program];
  if (!ptable) {
    GL.recordError(0x0502 /* GL_INVALID_OPERATION */);
    return;
  }

  if (pname == 0x8b84) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getProgramInfoLog(GL.programs[program]);
    if (log === null) log = '(unknown error)';
    HEAP32[p >> 2] = log.length + 1;
  } else if (pname == 0x8b87 /* GL_ACTIVE_UNIFORM_MAX_LENGTH */) {
    HEAP32[p >> 2] = ptable.maxUniformLength;
  } else if (pname == 0x8b8a /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */) {
    if (ptable.maxAttributeLength == -1) {
      program = GL.programs[program];
      var numAttribs = GLctx.getProgramParameter(
        program,
        GLctx.ACTIVE_ATTRIBUTES
      );
      ptable.maxAttributeLength = 0; // Spec says if there are no active attribs, 0 must be returned.
      for (var i = 0; i < numAttribs; ++i) {
        var activeAttrib = GLctx.getActiveAttrib(program, i);
        ptable.maxAttributeLength = Math.max(
          ptable.maxAttributeLength,
          activeAttrib.name.length + 1
        );
      }
    }
    HEAP32[p >> 2] = ptable.maxAttributeLength;
  } else if (pname == 0x8a35 /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */) {
    if (ptable.maxUniformBlockNameLength == -1) {
      program = GL.programs[program];
      var numBlocks = GLctx.getProgramParameter(
        program,
        GLctx.ACTIVE_UNIFORM_BLOCKS
      );
      ptable.maxUniformBlockNameLength = 0;
      for (var i = 0; i < numBlocks; ++i) {
        var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
        ptable.maxUniformBlockNameLength = Math.max(
          ptable.maxUniformBlockNameLength,
          activeBlockName.length + 1
        );
      }
    }
    HEAP32[p >> 2] = ptable.maxUniformBlockNameLength;
  } else {
    HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname);
  }
}

function _emscripten_glGetRenderbufferParameteriv(target, pname, params) {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  HEAP32[params >> 2] = GLctx.getRenderbufferParameter(target, pname);
}

function _emscripten_glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = '(unknown error)';
  if (maxLength > 0 && infoLog) {
    var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}

function _emscripten_glGetShaderPrecisionFormat(
  shaderType,
  precisionType,
  range,
  precision
) {
  var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
  HEAP32[range >> 2] = result.rangeMin;
  HEAP32[(range + 4) >> 2] = result.rangeMax;
  HEAP32[precision >> 2] = result.precision;
}

function _emscripten_glGetShaderSource(shader, bufSize, length, source) {
  var result = GLctx.getShaderSource(GL.shaders[shader]);
  if (!result) return; // If an error occurs, nothing will be written to length or source.
  if (bufSize > 0 && source) {
    var numBytesWrittenExclNull = stringToUTF8(result, source, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}

function _emscripten_glGetShaderiv(shader, pname, p) {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  if (pname == 0x8b84) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = '(unknown error)';
    HEAP32[p >> 2] = log.length + 1;
  } else if (pname == 0x8b88) {
    // GL_SHADER_SOURCE_LENGTH
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    var sourceLength =
      source === null || source.length == 0 ? 0 : source.length + 1;
    HEAP32[p >> 2] = sourceLength;
  } else {
    HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}

function _emscripten_glGetString(name_) {
  if (GL.stringCache[name_]) return GL.stringCache[name_];
  var ret;
  switch (name_) {
    case 0x1f00 /* GL_VENDOR */:
    case 0x1f01 /* GL_RENDERER */:
    case 0x9245 /* UNMASKED_VENDOR_WEBGL */:
    case 0x9246 /* UNMASKED_RENDERER_WEBGL */:
      ret = allocate(
        intArrayFromString(GLctx.getParameter(name_)),
        'i8',
        ALLOC_NORMAL
      );
      break;
    case 0x1f02 /* GL_VERSION */:
      var glVersion = GLctx.getParameter(GLctx.VERSION);
      // return GLES version string corresponding to the version of the WebGL context
      {
        glVersion = 'OpenGL ES 2.0 (' + glVersion + ')';
      }
      ret = allocate(intArrayFromString(glVersion), 'i8', ALLOC_NORMAL);
      break;
    case 0x1f03 /* GL_EXTENSIONS */:
      var exts = GLctx.getSupportedExtensions();
      var gl_exts = [];
      for (var i = 0; i < exts.length; ++i) {
        gl_exts.push(exts[i]);
        gl_exts.push('GL_' + exts[i]);
      }
      ret = allocate(intArrayFromString(gl_exts.join(' ')), 'i8', ALLOC_NORMAL);
      break;
    case 0x8b8c /* GL_SHADING_LANGUAGE_VERSION */:
      var glslVersion = GLctx.getParameter(GLctx.SHADING_LANGUAGE_VERSION);
      // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
      var ver_num = glslVersion.match(ver_re);
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + '0'; // ensure minor version has 2 digits
        glslVersion =
          'OpenGL ES GLSL ES ' + ver_num[1] + ' (' + glslVersion + ')';
      }
      ret = allocate(intArrayFromString(glslVersion), 'i8', ALLOC_NORMAL);
      break;
    default:
      GL.recordError(0x0500 /*GL_INVALID_ENUM*/);
      return 0;
  }
  GL.stringCache[name_] = ret;
  return ret;
}

function _emscripten_glGetTexParameterfv(target, pname, params) {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  HEAPF32[params >> 2] = GLctx.getTexParameter(target, pname);
}

function _emscripten_glGetTexParameteriv(target, pname, params) {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  HEAP32[params >> 2] = GLctx.getTexParameter(target, pname);
}

function _emscripten_glGetUniformLocation(program, name) {
  name = Pointer_stringify(name);

  var arrayOffset = 0;
  // If user passed an array accessor "[index]", parse the array index off the accessor.
  if (name.indexOf(']', name.length - 1) !== -1) {
    var ls = name.lastIndexOf('[');
    var arrayIndex = name.slice(ls + 1, -1);
    if (arrayIndex.length > 0) {
      arrayOffset = parseInt(arrayIndex);
      if (arrayOffset < 0) {
        return -1;
      }
    }
    name = name.slice(0, ls);
  }

  var ptable = GL.programInfos[program];
  if (!ptable) {
    return -1;
  }
  var utable = ptable.uniforms;
  var uniformInfo = utable[name]; // returns pair [ dimension_of_uniform_array, uniform_location ]
  if (uniformInfo && arrayOffset < uniformInfo[0]) {
    // Check if user asked for an out-of-bounds element, i.e. for 'vec4 colors[3];' user could ask for 'colors[10]' which should return -1.
    return uniformInfo[1] + arrayOffset;
  } else {
    return -1;
  }
}

function emscriptenWebGLGetUniform(program, location, params, type) {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  var data = GLctx.getUniform(GL.programs[program], GL.uniforms[location]);
  if (typeof data == 'number' || typeof data == 'boolean') {
    switch (type) {
      case 'Integer':
        HEAP32[params >> 2] = data;
        break;
      case 'Float':
        HEAPF32[params >> 2] = data;
        break;
      default:
        throw 'internal emscriptenWebGLGetUniform() error, bad type: ' + type;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
        case 'Integer':
          HEAP32[(params + i * 4) >> 2] = data[i];
          break;
        case 'Float':
          HEAPF32[(params + i * 4) >> 2] = data[i];
          break;
        default:
          throw 'internal emscriptenWebGLGetUniform() error, bad type: ' + type;
      }
    }
  }
}
function _emscripten_glGetUniformfv(program, location, params) {
  emscriptenWebGLGetUniform(program, location, params, 'Float');
}

function _emscripten_glGetUniformiv(program, location, params) {
  emscriptenWebGLGetUniform(program, location, params, 'Integer');
}

function _emscripten_glGetVertexAttribPointerv(index, pname, pointer) {
  if (!pointer) {
    // GLES2 specification does not specify how to behave if pointer is a null pointer. Since calling this function does not make sense
    // if pointer == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  HEAP32[pointer >> 2] = GLctx.getVertexAttribOffset(index, pname);
}

function emscriptenWebGLGetVertexAttrib(index, pname, params, type) {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(0x0501 /* GL_INVALID_VALUE */);
    return;
  }
  var data = GLctx.getVertexAttrib(index, pname);
  if (pname == 0x889f /*VERTEX_ATTRIB_ARRAY_BUFFER_BINDING*/) {
    HEAP32[params >> 2] = data['name'];
  } else if (typeof data == 'number' || typeof data == 'boolean') {
    switch (type) {
      case 'Integer':
        HEAP32[params >> 2] = data;
        break;
      case 'Float':
        HEAPF32[params >> 2] = data;
        break;
      case 'FloatToInteger':
        HEAP32[params >> 2] = Math.fround(data);
        break;
      default:
        throw 'internal emscriptenWebGLGetVertexAttrib() error, bad type: ' +
          type;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
        case 'Integer':
          HEAP32[(params + i * 4) >> 2] = data[i];
          break;
        case 'Float':
          HEAPF32[(params + i * 4) >> 2] = data[i];
          break;
        case 'FloatToInteger':
          HEAP32[(params + i * 4) >> 2] = Math.fround(data[i]);
          break;
        default:
          throw 'internal emscriptenWebGLGetVertexAttrib() error, bad type: ' +
            type;
      }
    }
  }
}
function _emscripten_glGetVertexAttribfv(index, pname, params) {
  // N.B. This function may only be called if the vertex attribute was specified using the function glVertexAttrib*f(),
  // otherwise the results are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 'Float');
}

function _emscripten_glGetVertexAttribiv(index, pname, params) {
  // N.B. This function may only be called if the vertex attribute was specified using the function glVertexAttrib*f(),
  // otherwise the results are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 'FloatToInteger');
}

function _emscripten_glHint(x0, x1) {
  GLctx['hint'](x0, x1);
}

function _emscripten_glIsBuffer(buffer) {
  var b = GL.buffers[buffer];
  if (!b) return 0;
  return GLctx.isBuffer(b);
}

function _emscripten_glIsEnabled(x0) {
  return GLctx['isEnabled'](x0);
}

function _emscripten_glIsFramebuffer(framebuffer) {
  var fb = GL.framebuffers[framebuffer];
  if (!fb) return 0;
  return GLctx.isFramebuffer(fb);
}

function _emscripten_glIsProgram(program) {
  program = GL.programs[program];
  if (!program) return 0;
  return GLctx.isProgram(program);
}

function _emscripten_glIsRenderbuffer(renderbuffer) {
  var rb = GL.renderbuffers[renderbuffer];
  if (!rb) return 0;
  return GLctx.isRenderbuffer(rb);
}

function _emscripten_glIsShader(shader) {
  var s = GL.shaders[shader];
  if (!s) return 0;
  return GLctx.isShader(s);
}

function _emscripten_glIsTexture(texture) {
  var texture = GL.textures[texture];
  if (!texture) return 0;
  return GLctx.isTexture(texture);
}

function _emscripten_glIsVertexArray(array) {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx['isVertexArray'](vao);
}

function _emscripten_glLineWidth(x0) {
  GLctx['lineWidth'](x0);
}

function _emscripten_glLinkProgram(program) {
  GLctx.linkProgram(GL.programs[program]);
  GL.programInfos[program] = null; // uniforms no longer keep the same names after linking
  GL.populateUniformTable(program);
}

function _emscripten_glLoadIdentity() {
  throw 'Legacy GL function (glLoadIdentity) called. If you want legacy GL emulation, you need to compile with -s LEGACY_GL_EMULATION=1 to enable legacy GL emulation.';
}

function _emscripten_glLoadMatrixf() {
  Module['printErr']('missing function: emscripten_glLoadMatrixf');
  abort(-1);
}

function _emscripten_glMatrixMode() {
  throw 'Legacy GL function (glMatrixMode) called. If you want legacy GL emulation, you need to compile with -s LEGACY_GL_EMULATION=1 to enable legacy GL emulation.';
}

function _emscripten_glNormalPointer() {
  Module['printErr']('missing function: emscripten_glNormalPointer');
  abort(-1);
}

function _emscripten_glPixelStorei(pname, param) {
  if (pname == 0x0d05 /* GL_PACK_ALIGNMENT */) {
    GL.packAlignment = param;
  } else if (pname == 0x0cf5 /* GL_UNPACK_ALIGNMENT */) {
    GL.unpackAlignment = param;
  }
  GLctx.pixelStorei(pname, param);
}

function _emscripten_glPolygonOffset(x0, x1) {
  GLctx['polygonOffset'](x0, x1);
}

function emscriptenWebGLComputeImageSize(
  width,
  height,
  sizePerPixel,
  alignment
) {
  function roundedToNextMultipleOf(x, y) {
    return Math.floor((x + y - 1) / y) * y;
  }
  var plainRowSize = width * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
  return height <= 0 ? 0 : (height - 1) * alignedRowSize + plainRowSize;
}
function emscriptenWebGLGetTexPixelData(
  type,
  format,
  width,
  height,
  pixels,
  internalFormat
) {
  var sizePerPixel;
  var numChannels;
  switch (format) {
    case 0x1906 /* GL_ALPHA */:
    case 0x1909 /* GL_LUMINANCE */:
    case 0x1902 /* GL_DEPTH_COMPONENT */:
      numChannels = 1;
      break;
    case 0x190a /* GL_LUMINANCE_ALPHA */:
      numChannels = 2;
      break;
    case 0x1907 /* GL_RGB */:
    case 0x8c40 /* GL_SRGB_EXT */:
      numChannels = 3;
      break;
    case 0x1908 /* GL_RGBA */:
    case 0x8c42 /* GL_SRGB_ALPHA_EXT */:
      numChannels = 4;
      break;
    default:
      GL.recordError(0x0500); // GL_INVALID_ENUM
      return null;
  }
  switch (type) {
    case 0x1401 /* GL_UNSIGNED_BYTE */:
      sizePerPixel = numChannels * 1;
      break;
    case 0x1403 /* GL_UNSIGNED_SHORT */:
    case 0x8d61 /* GL_HALF_FLOAT_OES */:
      sizePerPixel = numChannels * 2;
      break;
    case 0x1405 /* GL_UNSIGNED_INT */:
    case 0x1406 /* GL_FLOAT */:
      sizePerPixel = numChannels * 4;
      break;
    case 0x84fa /* GL_UNSIGNED_INT_24_8_WEBGL/GL_UNSIGNED_INT_24_8 */:
      sizePerPixel = 4;
      break;
    case 0x8363 /* GL_UNSIGNED_SHORT_5_6_5 */:
    case 0x8033 /* GL_UNSIGNED_SHORT_4_4_4_4 */:
    case 0x8034 /* GL_UNSIGNED_SHORT_5_5_5_1 */:
      sizePerPixel = 2;
      break;
    default:
      GL.recordError(0x0500); // GL_INVALID_ENUM
      return null;
  }
  var bytes = emscriptenWebGLComputeImageSize(
    width,
    height,
    sizePerPixel,
    GL.unpackAlignment
  );
  switch (type) {
    case 0x1401 /* GL_UNSIGNED_BYTE */:
      return HEAPU8.subarray(pixels, pixels + bytes);
    case 0x1406 /* GL_FLOAT */:
      return HEAPF32.subarray(pixels >> 2, (pixels + bytes) >> 2);
    case 0x1405 /* GL_UNSIGNED_INT */:
    case 0x84fa /* GL_UNSIGNED_INT_24_8_WEBGL/GL_UNSIGNED_INT_24_8 */:
      return HEAPU32.subarray(pixels >> 2, (pixels + bytes) >> 2);
    case 0x1403 /* GL_UNSIGNED_SHORT */:
    case 0x8363 /* GL_UNSIGNED_SHORT_5_6_5 */:
    case 0x8033 /* GL_UNSIGNED_SHORT_4_4_4_4 */:
    case 0x8034 /* GL_UNSIGNED_SHORT_5_5_5_1 */:
    case 0x8d61 /* GL_HALF_FLOAT_OES */:
      return HEAPU16.subarray(pixels >> 1, (pixels + bytes) >> 1);
    default:
      GL.recordError(0x0500); // GL_INVALID_ENUM
      return null;
  }
}
function _emscripten_glReadPixels(x, y, width, height, format, type, pixels) {
  var pixelData = emscriptenWebGLGetTexPixelData(
    type,
    format,
    width,
    height,
    pixels,
    format
  );
  if (!pixelData) {
    GL.recordError(0x0500 /*GL_INVALID_ENUM*/);
    return;
  }
  GLctx.readPixels(x, y, width, height, format, type, pixelData);
}

function _emscripten_glReleaseShaderCompiler() {
  // NOP (as allowed by GLES 2.0 spec)
}

function _emscripten_glRenderbufferStorage(x0, x1, x2, x3) {
  GLctx['renderbufferStorage'](x0, x1, x2, x3);
}

function _emscripten_glRotatef() {
  Module['printErr']('missing function: emscripten_glRotatef');
  abort(-1);
}

function _emscripten_glSampleCoverage(value, invert) {
  GLctx.sampleCoverage(value, !!invert);
}

function _emscripten_glScissor(x0, x1, x2, x3) {
  GLctx['scissor'](x0, x1, x2, x3);
}

function _emscripten_glShaderBinary() {
  GL.recordError(0x0500 /*GL_INVALID_ENUM*/);
}

function _emscripten_glShaderSource(shader, count, string, length) {
  var source = GL.getSource(shader, count, string, length);

  GLctx.shaderSource(GL.shaders[shader], source);
}

function _emscripten_glStencilFunc(x0, x1, x2) {
  GLctx['stencilFunc'](x0, x1, x2);
}

function _emscripten_glStencilFuncSeparate(x0, x1, x2, x3) {
  GLctx['stencilFuncSeparate'](x0, x1, x2, x3);
}

function _emscripten_glStencilMask(x0) {
  GLctx['stencilMask'](x0);
}

function _emscripten_glStencilMaskSeparate(x0, x1) {
  GLctx['stencilMaskSeparate'](x0, x1);
}

function _emscripten_glStencilOp(x0, x1, x2) {
  GLctx['stencilOp'](x0, x1, x2);
}

function _emscripten_glStencilOpSeparate(x0, x1, x2, x3) {
  GLctx['stencilOpSeparate'](x0, x1, x2, x3);
}

function _emscripten_glTexCoordPointer() {
  Module['printErr']('missing function: emscripten_glTexCoordPointer');
  abort(-1);
}

function _emscripten_glTexImage2D(
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  format,
  type,
  pixels
) {
  var pixelData = null;
  if (pixels)
    pixelData = emscriptenWebGLGetTexPixelData(
      type,
      format,
      width,
      height,
      pixels,
      internalFormat
    );
  GLctx.texImage2D(
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    format,
    type,
    pixelData
  );
}

function _emscripten_glTexParameterf(x0, x1, x2) {
  GLctx['texParameterf'](x0, x1, x2);
}

function _emscripten_glTexParameterfv(target, pname, params) {
  var param = HEAPF32[params >> 2];
  GLctx.texParameterf(target, pname, param);
}

function _emscripten_glTexParameteri(x0, x1, x2) {
  GLctx['texParameteri'](x0, x1, x2);
}

function _emscripten_glTexParameteriv(target, pname, params) {
  var param = HEAP32[params >> 2];
  GLctx.texParameteri(target, pname, param);
}

function _emscripten_glTexSubImage2D(
  target,
  level,
  xoffset,
  yoffset,
  width,
  height,
  format,
  type,
  pixels
) {
  var pixelData = null;
  if (pixels)
    pixelData = emscriptenWebGLGetTexPixelData(
      type,
      format,
      width,
      height,
      pixels,
      0
    );
  GLctx.texSubImage2D(
    target,
    level,
    xoffset,
    yoffset,
    width,
    height,
    format,
    type,
    pixelData
  );
}

function _emscripten_glUniform1f(location, v0) {
  GLctx.uniform1f(GL.uniforms[location], v0);
}

function _emscripten_glUniform1fv(location, count, value) {
  var view;
  if (count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[count - 1];
    for (var i = 0; i < count; ++i) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 4) >> 2);
  }
  GLctx.uniform1fv(GL.uniforms[location], view);
}

function _emscripten_glUniform1i(location, v0) {
  GLctx.uniform1i(GL.uniforms[location], v0);
}

function _emscripten_glUniform1iv(location, count, value) {
  GLctx.uniform1iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 4) >> 2)
  );
}

function _emscripten_glUniform2f(location, v0, v1) {
  GLctx.uniform2f(GL.uniforms[location], v0, v1);
}

function _emscripten_glUniform2fv(location, count, value) {
  var view;
  if (2 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[2 * count - 1];
    for (var i = 0; i < 2 * count; i += 2) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 8) >> 2);
  }
  GLctx.uniform2fv(GL.uniforms[location], view);
}

function _emscripten_glUniform2i(location, v0, v1) {
  GLctx.uniform2i(GL.uniforms[location], v0, v1);
}

function _emscripten_glUniform2iv(location, count, value) {
  GLctx.uniform2iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 8) >> 2)
  );
}

function _emscripten_glUniform3f(location, v0, v1, v2) {
  GLctx.uniform3f(GL.uniforms[location], v0, v1, v2);
}

function _emscripten_glUniform3fv(location, count, value) {
  var view;
  if (3 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[3 * count - 1];
    for (var i = 0; i < 3 * count; i += 3) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 12) >> 2);
  }
  GLctx.uniform3fv(GL.uniforms[location], view);
}

function _emscripten_glUniform3i(location, v0, v1, v2) {
  GLctx.uniform3i(GL.uniforms[location], v0, v1, v2);
}

function _emscripten_glUniform3iv(location, count, value) {
  GLctx.uniform3iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 12) >> 2)
  );
}

function _emscripten_glUniform4f(location, v0, v1, v2, v3) {
  GLctx.uniform4f(GL.uniforms[location], v0, v1, v2, v3);
}

function _emscripten_glUniform4fv(location, count, value) {
  var view;
  if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[4 * count - 1];
    for (var i = 0; i < 4 * count; i += 4) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
  }
  GLctx.uniform4fv(GL.uniforms[location], view);
}

function _emscripten_glUniform4i(location, v0, v1, v2, v3) {
  GLctx.uniform4i(GL.uniforms[location], v0, v1, v2, v3);
}

function _emscripten_glUniform4iv(location, count, value) {
  GLctx.uniform4iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 16) >> 2)
  );
}

function _emscripten_glUniformMatrix2fv(location, count, transpose, value) {
  var view;
  if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[4 * count - 1];
    for (var i = 0; i < 4 * count; i += 4) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
  }
  GLctx.uniformMatrix2fv(GL.uniforms[location], !!transpose, view);
}

function _emscripten_glUniformMatrix3fv(location, count, transpose, value) {
  var view;
  if (9 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[9 * count - 1];
    for (var i = 0; i < 9 * count; i += 9) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
      view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2];
      view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2];
      view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2];
      view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2];
      view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 36) >> 2);
  }
  GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, view);
}

function _emscripten_glUniformMatrix4fv(location, count, transpose, value) {
  var view;
  if (16 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    // avoid allocation when uploading few enough uniforms
    view = GL.miniTempBufferViews[16 * count - 1];
    for (var i = 0; i < 16 * count; i += 16) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
      view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2];
      view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2];
      view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2];
      view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2];
      view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2];
      view[i + 9] = HEAPF32[(value + (4 * i + 36)) >> 2];
      view[i + 10] = HEAPF32[(value + (4 * i + 40)) >> 2];
      view[i + 11] = HEAPF32[(value + (4 * i + 44)) >> 2];
      view[i + 12] = HEAPF32[(value + (4 * i + 48)) >> 2];
      view[i + 13] = HEAPF32[(value + (4 * i + 52)) >> 2];
      view[i + 14] = HEAPF32[(value + (4 * i + 56)) >> 2];
      view[i + 15] = HEAPF32[(value + (4 * i + 60)) >> 2];
    }
  } else {
    view = HEAPF32.subarray(value >> 2, (value + count * 64) >> 2);
  }
  GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view);
}

function _emscripten_glUseProgram(program) {
  GLctx.useProgram(program ? GL.programs[program] : null);
}

function _emscripten_glValidateProgram(program) {
  GLctx.validateProgram(GL.programs[program]);
}

function _emscripten_glVertexAttrib1f(x0, x1) {
  GLctx['vertexAttrib1f'](x0, x1);
}

function _emscripten_glVertexAttrib1fv(index, v) {
  GLctx.vertexAttrib1f(index, HEAPF32[v >> 2]);
}

function _emscripten_glVertexAttrib2f(x0, x1, x2) {
  GLctx['vertexAttrib2f'](x0, x1, x2);
}

function _emscripten_glVertexAttrib2fv(index, v) {
  GLctx.vertexAttrib2f(index, HEAPF32[v >> 2], HEAPF32[(v + 4) >> 2]);
}

function _emscripten_glVertexAttrib3f(x0, x1, x2, x3) {
  GLctx['vertexAttrib3f'](x0, x1, x2, x3);
}

function _emscripten_glVertexAttrib3fv(index, v) {
  GLctx.vertexAttrib3f(
    index,
    HEAPF32[v >> 2],
    HEAPF32[(v + 4) >> 2],
    HEAPF32[(v + 8) >> 2]
  );
}

function _emscripten_glVertexAttrib4f(x0, x1, x2, x3, x4) {
  GLctx['vertexAttrib4f'](x0, x1, x2, x3, x4);
}

function _emscripten_glVertexAttrib4fv(index, v) {
  GLctx.vertexAttrib4f(
    index,
    HEAPF32[v >> 2],
    HEAPF32[(v + 4) >> 2],
    HEAPF32[(v + 8) >> 2],
    HEAPF32[(v + 12) >> 2]
  );
}

function _emscripten_glVertexAttribDivisor(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}

function _emscripten_glVertexAttribPointer(
  index,
  size,
  type,
  normalized,
  stride,
  ptr
) {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

function _emscripten_glVertexPointer() {
  throw 'Legacy GL function (glVertexPointer) called. If you want legacy GL emulation, you need to compile with -s LEGACY_GL_EMULATION=1 to enable legacy GL emulation.';
}

function _emscripten_glViewport(x0, x1, x2, x3) {
  GLctx['viewport'](x0, x1, x2, x3);
}

function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
  return dest;
}

function ___setErrNo(value) {
  if (Module['___errno_location'])
    HEAP32[Module['___errno_location']() >> 2] = value;
  else Module.printErr('failed to set errno from JS');
  return value;
}
var GLctx;
GL.init();
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, 'TOTAL_MEMORY not big enough for stack');

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xff) {
      if (ASSERTIONS) {
        assert(
          false,
          'Character code ' +
            chr +
            ' (' +
            String.fromCharCode(chr) +
            ')  at offset ' +
            i +
            ' not in 0x00-0xFF.'
        );
      }
      chr &= 0xff;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}

function nullFunc_i(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_ii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_iii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_iiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_v(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vd(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vdd(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vdd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vdddddd(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vdddddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vf(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vf'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vff(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vffff(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vfi(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vfi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vi(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vif(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viff(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vifff(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vifff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viffff(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_vii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viif(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viiiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viiiiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viiiiiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viiiiiiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

function nullFunc_viiiiiiiii(x) {
  Module['printErr'](
    "Invalid function pointer called with signature 'viiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  Module['printErr']('Build with ASSERTIONS=2 for more info.');
  abort(x);
}

Module['wasmTableSize'] = 5520;

Module['wasmMaxTableSize'] = 5520;

function invoke_i(index) {
  try {
    return Module['dynCall_i'](index);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_ii(index, a1) {
  try {
    return Module['dynCall_ii'](index, a1);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_iii(index, a1, a2) {
  try {
    return Module['dynCall_iii'](index, a1, a2);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_iiii(index, a1, a2, a3) {
  try {
    return Module['dynCall_iiii'](index, a1, a2, a3);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module['dynCall_v'](index);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vd(index, a1) {
  try {
    Module['dynCall_vd'](index, a1);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vdd(index, a1, a2) {
  try {
    Module['dynCall_vdd'](index, a1, a2);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vdddddd(index, a1, a2, a3, a4, a5, a6) {
  try {
    Module['dynCall_vdddddd'](index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vf(index, a1) {
  try {
    Module['dynCall_vf'](index, a1);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vff(index, a1, a2) {
  try {
    Module['dynCall_vff'](index, a1, a2);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vffff(index, a1, a2, a3, a4) {
  try {
    Module['dynCall_vffff'](index, a1, a2, a3, a4);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vfi(index, a1, a2) {
  try {
    Module['dynCall_vfi'](index, a1, a2);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vi(index, a1) {
  try {
    Module['dynCall_vi'](index, a1);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vif(index, a1, a2) {
  try {
    Module['dynCall_vif'](index, a1, a2);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viff(index, a1, a2, a3) {
  try {
    Module['dynCall_viff'](index, a1, a2, a3);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vifff(index, a1, a2, a3, a4) {
  try {
    Module['dynCall_vifff'](index, a1, a2, a3, a4);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viffff(index, a1, a2, a3, a4, a5) {
  try {
    Module['dynCall_viffff'](index, a1, a2, a3, a4, a5);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_vii(index, a1, a2) {
  try {
    Module['dynCall_vii'](index, a1, a2);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viif(index, a1, a2, a3) {
  try {
    Module['dynCall_viif'](index, a1, a2, a3);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viii(index, a1, a2, a3) {
  try {
    Module['dynCall_viii'](index, a1, a2, a3);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viiii(index, a1, a2, a3, a4) {
  try {
    Module['dynCall_viiii'](index, a1, a2, a3, a4);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viiiii(index, a1, a2, a3, a4, a5) {
  try {
    Module['dynCall_viiiii'](index, a1, a2, a3, a4, a5);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
  try {
    Module['dynCall_viiiiii'](index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  try {
    Module['dynCall_viiiiiii'](index, a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  try {
    Module['dynCall_viiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  try {
    Module['dynCall_viiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module['setThrew'](1, 0);
  }
}

Module.asmGlobalArg = {};

Module.asmLibraryArg = {
  abort: abort,
  assert: assert,
  enlargeMemory: enlargeMemory,
  getTotalMemory: getTotalMemory,
  abortOnCannotGrowMemory: abortOnCannotGrowMemory,
  abortStackOverflow: abortStackOverflow,
  nullFunc_i: nullFunc_i,
  nullFunc_ii: nullFunc_ii,
  nullFunc_iii: nullFunc_iii,
  nullFunc_iiii: nullFunc_iiii,
  nullFunc_v: nullFunc_v,
  nullFunc_vd: nullFunc_vd,
  nullFunc_vdd: nullFunc_vdd,
  nullFunc_vdddddd: nullFunc_vdddddd,
  nullFunc_vf: nullFunc_vf,
  nullFunc_vff: nullFunc_vff,
  nullFunc_vffff: nullFunc_vffff,
  nullFunc_vfi: nullFunc_vfi,
  nullFunc_vi: nullFunc_vi,
  nullFunc_vif: nullFunc_vif,
  nullFunc_viff: nullFunc_viff,
  nullFunc_vifff: nullFunc_vifff,
  nullFunc_viffff: nullFunc_viffff,
  nullFunc_vii: nullFunc_vii,
  nullFunc_viif: nullFunc_viif,
  nullFunc_viii: nullFunc_viii,
  nullFunc_viiii: nullFunc_viiii,
  nullFunc_viiiii: nullFunc_viiiii,
  nullFunc_viiiiii: nullFunc_viiiiii,
  nullFunc_viiiiiii: nullFunc_viiiiiii,
  nullFunc_viiiiiiii: nullFunc_viiiiiiii,
  nullFunc_viiiiiiiii: nullFunc_viiiiiiiii,
  invoke_i: invoke_i,
  invoke_ii: invoke_ii,
  invoke_iii: invoke_iii,
  invoke_iiii: invoke_iiii,
  invoke_v: invoke_v,
  invoke_vd: invoke_vd,
  invoke_vdd: invoke_vdd,
  invoke_vdddddd: invoke_vdddddd,
  invoke_vf: invoke_vf,
  invoke_vff: invoke_vff,
  invoke_vffff: invoke_vffff,
  invoke_vfi: invoke_vfi,
  invoke_vi: invoke_vi,
  invoke_vif: invoke_vif,
  invoke_viff: invoke_viff,
  invoke_vifff: invoke_vifff,
  invoke_viffff: invoke_viffff,
  invoke_vii: invoke_vii,
  invoke_viif: invoke_viif,
  invoke_viii: invoke_viii,
  invoke_viiii: invoke_viiii,
  invoke_viiiii: invoke_viiiii,
  invoke_viiiiii: invoke_viiiiii,
  invoke_viiiiiii: invoke_viiiiiii,
  invoke_viiiiiiii: invoke_viiiiiiii,
  invoke_viiiiiiiii: invoke_viiiiiiiii,
  ___lock: ___lock,
  ___setErrNo: ___setErrNo,
  ___syscall140: ___syscall140,
  ___syscall146: ___syscall146,
  ___syscall54: ___syscall54,
  ___syscall6: ___syscall6,
  ___unlock: ___unlock,
  _emscripten_asm_const_iii: _emscripten_asm_const_iii,
  _emscripten_glActiveTexture: _emscripten_glActiveTexture,
  _emscripten_glAttachShader: _emscripten_glAttachShader,
  _emscripten_glBindAttribLocation: _emscripten_glBindAttribLocation,
  _emscripten_glBindBuffer: _emscripten_glBindBuffer,
  _emscripten_glBindFramebuffer: _emscripten_glBindFramebuffer,
  _emscripten_glBindProgramARB: _emscripten_glBindProgramARB,
  _emscripten_glBindRenderbuffer: _emscripten_glBindRenderbuffer,
  _emscripten_glBindTexture: _emscripten_glBindTexture,
  _emscripten_glBindVertexArray: _emscripten_glBindVertexArray,
  _emscripten_glBlendColor: _emscripten_glBlendColor,
  _emscripten_glBlendEquation: _emscripten_glBlendEquation,
  _emscripten_glBlendEquationSeparate: _emscripten_glBlendEquationSeparate,
  _emscripten_glBlendFunc: _emscripten_glBlendFunc,
  _emscripten_glBlendFuncSeparate: _emscripten_glBlendFuncSeparate,
  _emscripten_glBufferData: _emscripten_glBufferData,
  _emscripten_glBufferSubData: _emscripten_glBufferSubData,
  _emscripten_glCheckFramebufferStatus: _emscripten_glCheckFramebufferStatus,
  _emscripten_glClear: _emscripten_glClear,
  _emscripten_glClearColor: _emscripten_glClearColor,
  _emscripten_glClearDepth: _emscripten_glClearDepth,
  _emscripten_glClearDepthf: _emscripten_glClearDepthf,
  _emscripten_glClearStencil: _emscripten_glClearStencil,
  _emscripten_glClientActiveTexture: _emscripten_glClientActiveTexture,
  _emscripten_glColorMask: _emscripten_glColorMask,
  _emscripten_glColorPointer: _emscripten_glColorPointer,
  _emscripten_glCompileShader: _emscripten_glCompileShader,
  _emscripten_glCompressedTexImage2D: _emscripten_glCompressedTexImage2D,
  _emscripten_glCompressedTexSubImage2D: _emscripten_glCompressedTexSubImage2D,
  _emscripten_glCopyTexImage2D: _emscripten_glCopyTexImage2D,
  _emscripten_glCopyTexSubImage2D: _emscripten_glCopyTexSubImage2D,
  _emscripten_glCreateProgram: _emscripten_glCreateProgram,
  _emscripten_glCreateShader: _emscripten_glCreateShader,
  _emscripten_glCullFace: _emscripten_glCullFace,
  _emscripten_glDeleteBuffers: _emscripten_glDeleteBuffers,
  _emscripten_glDeleteFramebuffers: _emscripten_glDeleteFramebuffers,
  _emscripten_glDeleteObjectARB: _emscripten_glDeleteObjectARB,
  _emscripten_glDeleteProgram: _emscripten_glDeleteProgram,
  _emscripten_glDeleteRenderbuffers: _emscripten_glDeleteRenderbuffers,
  _emscripten_glDeleteShader: _emscripten_glDeleteShader,
  _emscripten_glDeleteTextures: _emscripten_glDeleteTextures,
  _emscripten_glDeleteVertexArrays: _emscripten_glDeleteVertexArrays,
  _emscripten_glDepthFunc: _emscripten_glDepthFunc,
  _emscripten_glDepthMask: _emscripten_glDepthMask,
  _emscripten_glDepthRange: _emscripten_glDepthRange,
  _emscripten_glDepthRangef: _emscripten_glDepthRangef,
  _emscripten_glDetachShader: _emscripten_glDetachShader,
  _emscripten_glDisable: _emscripten_glDisable,
  _emscripten_glDisableVertexAttribArray: _emscripten_glDisableVertexAttribArray,
  _emscripten_glDrawArrays: _emscripten_glDrawArrays,
  _emscripten_glDrawArraysInstanced: _emscripten_glDrawArraysInstanced,
  _emscripten_glDrawBuffers: _emscripten_glDrawBuffers,
  _emscripten_glDrawElements: _emscripten_glDrawElements,
  _emscripten_glDrawElementsInstanced: _emscripten_glDrawElementsInstanced,
  _emscripten_glDrawRangeElements: _emscripten_glDrawRangeElements,
  _emscripten_glEnable: _emscripten_glEnable,
  _emscripten_glEnableClientState: _emscripten_glEnableClientState,
  _emscripten_glEnableVertexAttribArray: _emscripten_glEnableVertexAttribArray,
  _emscripten_glFinish: _emscripten_glFinish,
  _emscripten_glFlush: _emscripten_glFlush,
  _emscripten_glFramebufferRenderbuffer: _emscripten_glFramebufferRenderbuffer,
  _emscripten_glFramebufferTexture2D: _emscripten_glFramebufferTexture2D,
  _emscripten_glFrontFace: _emscripten_glFrontFace,
  _emscripten_glFrustum: _emscripten_glFrustum,
  _emscripten_glGenBuffers: _emscripten_glGenBuffers,
  _emscripten_glGenFramebuffers: _emscripten_glGenFramebuffers,
  _emscripten_glGenRenderbuffers: _emscripten_glGenRenderbuffers,
  _emscripten_glGenTextures: _emscripten_glGenTextures,
  _emscripten_glGenVertexArrays: _emscripten_glGenVertexArrays,
  _emscripten_glGenerateMipmap: _emscripten_glGenerateMipmap,
  _emscripten_glGetActiveAttrib: _emscripten_glGetActiveAttrib,
  _emscripten_glGetActiveUniform: _emscripten_glGetActiveUniform,
  _emscripten_glGetAttachedShaders: _emscripten_glGetAttachedShaders,
  _emscripten_glGetAttribLocation: _emscripten_glGetAttribLocation,
  _emscripten_glGetBooleanv: _emscripten_glGetBooleanv,
  _emscripten_glGetBufferParameteriv: _emscripten_glGetBufferParameteriv,
  _emscripten_glGetError: _emscripten_glGetError,
  _emscripten_glGetFloatv: _emscripten_glGetFloatv,
  _emscripten_glGetFramebufferAttachmentParameteriv: _emscripten_glGetFramebufferAttachmentParameteriv,
  _emscripten_glGetInfoLogARB: _emscripten_glGetInfoLogARB,
  _emscripten_glGetIntegerv: _emscripten_glGetIntegerv,
  _emscripten_glGetObjectParameterivARB: _emscripten_glGetObjectParameterivARB,
  _emscripten_glGetPointerv: _emscripten_glGetPointerv,
  _emscripten_glGetProgramInfoLog: _emscripten_glGetProgramInfoLog,
  _emscripten_glGetProgramiv: _emscripten_glGetProgramiv,
  _emscripten_glGetRenderbufferParameteriv: _emscripten_glGetRenderbufferParameteriv,
  _emscripten_glGetShaderInfoLog: _emscripten_glGetShaderInfoLog,
  _emscripten_glGetShaderPrecisionFormat: _emscripten_glGetShaderPrecisionFormat,
  _emscripten_glGetShaderSource: _emscripten_glGetShaderSource,
  _emscripten_glGetShaderiv: _emscripten_glGetShaderiv,
  _emscripten_glGetString: _emscripten_glGetString,
  _emscripten_glGetTexParameterfv: _emscripten_glGetTexParameterfv,
  _emscripten_glGetTexParameteriv: _emscripten_glGetTexParameteriv,
  _emscripten_glGetUniformLocation: _emscripten_glGetUniformLocation,
  _emscripten_glGetUniformfv: _emscripten_glGetUniformfv,
  _emscripten_glGetUniformiv: _emscripten_glGetUniformiv,
  _emscripten_glGetVertexAttribPointerv: _emscripten_glGetVertexAttribPointerv,
  _emscripten_glGetVertexAttribfv: _emscripten_glGetVertexAttribfv,
  _emscripten_glGetVertexAttribiv: _emscripten_glGetVertexAttribiv,
  _emscripten_glHint: _emscripten_glHint,
  _emscripten_glIsBuffer: _emscripten_glIsBuffer,
  _emscripten_glIsEnabled: _emscripten_glIsEnabled,
  _emscripten_glIsFramebuffer: _emscripten_glIsFramebuffer,
  _emscripten_glIsProgram: _emscripten_glIsProgram,
  _emscripten_glIsRenderbuffer: _emscripten_glIsRenderbuffer,
  _emscripten_glIsShader: _emscripten_glIsShader,
  _emscripten_glIsTexture: _emscripten_glIsTexture,
  _emscripten_glIsVertexArray: _emscripten_glIsVertexArray,
  _emscripten_glLineWidth: _emscripten_glLineWidth,
  _emscripten_glLinkProgram: _emscripten_glLinkProgram,
  _emscripten_glLoadIdentity: _emscripten_glLoadIdentity,
  _emscripten_glLoadMatrixf: _emscripten_glLoadMatrixf,
  _emscripten_glMatrixMode: _emscripten_glMatrixMode,
  _emscripten_glNormalPointer: _emscripten_glNormalPointer,
  _emscripten_glPixelStorei: _emscripten_glPixelStorei,
  _emscripten_glPolygonOffset: _emscripten_glPolygonOffset,
  _emscripten_glReadPixels: _emscripten_glReadPixels,
  _emscripten_glReleaseShaderCompiler: _emscripten_glReleaseShaderCompiler,
  _emscripten_glRenderbufferStorage: _emscripten_glRenderbufferStorage,
  _emscripten_glRotatef: _emscripten_glRotatef,
  _emscripten_glSampleCoverage: _emscripten_glSampleCoverage,
  _emscripten_glScissor: _emscripten_glScissor,
  _emscripten_glShaderBinary: _emscripten_glShaderBinary,
  _emscripten_glShaderSource: _emscripten_glShaderSource,
  _emscripten_glStencilFunc: _emscripten_glStencilFunc,
  _emscripten_glStencilFuncSeparate: _emscripten_glStencilFuncSeparate,
  _emscripten_glStencilMask: _emscripten_glStencilMask,
  _emscripten_glStencilMaskSeparate: _emscripten_glStencilMaskSeparate,
  _emscripten_glStencilOp: _emscripten_glStencilOp,
  _emscripten_glStencilOpSeparate: _emscripten_glStencilOpSeparate,
  _emscripten_glTexCoordPointer: _emscripten_glTexCoordPointer,
  _emscripten_glTexImage2D: _emscripten_glTexImage2D,
  _emscripten_glTexParameterf: _emscripten_glTexParameterf,
  _emscripten_glTexParameterfv: _emscripten_glTexParameterfv,
  _emscripten_glTexParameteri: _emscripten_glTexParameteri,
  _emscripten_glTexParameteriv: _emscripten_glTexParameteriv,
  _emscripten_glTexSubImage2D: _emscripten_glTexSubImage2D,
  _emscripten_glUniform1f: _emscripten_glUniform1f,
  _emscripten_glUniform1fv: _emscripten_glUniform1fv,
  _emscripten_glUniform1i: _emscripten_glUniform1i,
  _emscripten_glUniform1iv: _emscripten_glUniform1iv,
  _emscripten_glUniform2f: _emscripten_glUniform2f,
  _emscripten_glUniform2fv: _emscripten_glUniform2fv,
  _emscripten_glUniform2i: _emscripten_glUniform2i,
  _emscripten_glUniform2iv: _emscripten_glUniform2iv,
  _emscripten_glUniform3f: _emscripten_glUniform3f,
  _emscripten_glUniform3fv: _emscripten_glUniform3fv,
  _emscripten_glUniform3i: _emscripten_glUniform3i,
  _emscripten_glUniform3iv: _emscripten_glUniform3iv,
  _emscripten_glUniform4f: _emscripten_glUniform4f,
  _emscripten_glUniform4fv: _emscripten_glUniform4fv,
  _emscripten_glUniform4i: _emscripten_glUniform4i,
  _emscripten_glUniform4iv: _emscripten_glUniform4iv,
  _emscripten_glUniformMatrix2fv: _emscripten_glUniformMatrix2fv,
  _emscripten_glUniformMatrix3fv: _emscripten_glUniformMatrix3fv,
  _emscripten_glUniformMatrix4fv: _emscripten_glUniformMatrix4fv,
  _emscripten_glUseProgram: _emscripten_glUseProgram,
  _emscripten_glValidateProgram: _emscripten_glValidateProgram,
  _emscripten_glVertexAttrib1f: _emscripten_glVertexAttrib1f,
  _emscripten_glVertexAttrib1fv: _emscripten_glVertexAttrib1fv,
  _emscripten_glVertexAttrib2f: _emscripten_glVertexAttrib2f,
  _emscripten_glVertexAttrib2fv: _emscripten_glVertexAttrib2fv,
  _emscripten_glVertexAttrib3f: _emscripten_glVertexAttrib3f,
  _emscripten_glVertexAttrib3fv: _emscripten_glVertexAttrib3fv,
  _emscripten_glVertexAttrib4f: _emscripten_glVertexAttrib4f,
  _emscripten_glVertexAttrib4fv: _emscripten_glVertexAttrib4fv,
  _emscripten_glVertexAttribDivisor: _emscripten_glVertexAttribDivisor,
  _emscripten_glVertexAttribPointer: _emscripten_glVertexAttribPointer,
  _emscripten_glVertexPointer: _emscripten_glVertexPointer,
  _emscripten_glViewport: _emscripten_glViewport,
  _emscripten_memcpy_big: _emscripten_memcpy_big,
  emscriptenWebGLComputeImageSize: emscriptenWebGLComputeImageSize,
  emscriptenWebGLGet: emscriptenWebGLGet,
  emscriptenWebGLGetTexPixelData: emscriptenWebGLGetTexPixelData,
  emscriptenWebGLGetUniform: emscriptenWebGLGetUniform,
  emscriptenWebGLGetVertexAttrib: emscriptenWebGLGetVertexAttrib,
  flush_NO_FILESYSTEM: flush_NO_FILESYSTEM,
  DYNAMICTOP_PTR: DYNAMICTOP_PTR,
  tempDoublePtr: tempDoublePtr,
  ABORT: ABORT,
  STACKTOP: STACKTOP,
  STACK_MAX: STACK_MAX
};
// EMSCRIPTEN_START_ASM
var asm = Module['asm'](
  // EMSCRIPTEN_END_ASM
  Module.asmGlobalArg,
  Module.asmLibraryArg,
  buffer
);

var real____errno_location = asm['___errno_location'];
asm['___errno_location'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real____errno_location.apply(null, arguments);
};

var real__emscripten_GetProcAddress = asm['_emscripten_GetProcAddress'];
asm['_emscripten_GetProcAddress'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__emscripten_GetProcAddress.apply(null, arguments);
};

var real__fflush = asm['_fflush'];
asm['_fflush'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__fflush.apply(null, arguments);
};

var real__free = asm['_free'];
asm['_free'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__free.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm['_llvm_bswap_i32'];
asm['_llvm_bswap_i32'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__main = asm['_main'];
asm['_main'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__main.apply(null, arguments);
};

var real__malloc = asm['_malloc'];
asm['_malloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm['_sbrk'];
asm['_sbrk'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__sbrk.apply(null, arguments);
};

var real__strstr = asm['_strstr'];
asm['_strstr'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__strstr.apply(null, arguments);
};

var real_establishStackSpace = asm['establishStackSpace'];
asm['establishStackSpace'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm['getTempRet0'];
asm['getTempRet0'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm['setTempRet0'];
asm['setTempRet0'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm['setThrew'];
asm['setThrew'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm['stackAlloc'];
asm['stackAlloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm['stackRestore'];
asm['stackRestore'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm['stackSave'];
asm['stackSave'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_stackSave.apply(null, arguments);
};
Module['asm'] = asm;
var ___errno_location = (Module['___errno_location'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['___errno_location'].apply(null, arguments);
});
var _emscripten_GetProcAddress = (Module[
  '_emscripten_GetProcAddress'
] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_emscripten_GetProcAddress'].apply(null, arguments);
});
var _fflush = (Module['_fflush'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_fflush'].apply(null, arguments);
});
var _free = (Module['_free'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_free'].apply(null, arguments);
});
var _llvm_bswap_i32 = (Module['_llvm_bswap_i32'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_llvm_bswap_i32'].apply(null, arguments);
});
var _main = (Module['_main'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_main'].apply(null, arguments);
});
var _malloc = (Module['_malloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_malloc'].apply(null, arguments);
});
var _memcpy = (Module['_memcpy'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_memcpy'].apply(null, arguments);
});
var _memset = (Module['_memset'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_memset'].apply(null, arguments);
});
var _sbrk = (Module['_sbrk'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_sbrk'].apply(null, arguments);
});
var _strstr = (Module['_strstr'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_strstr'].apply(null, arguments);
});
var establishStackSpace = (Module['establishStackSpace'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['establishStackSpace'].apply(null, arguments);
});
var getTempRet0 = (Module['getTempRet0'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['getTempRet0'].apply(null, arguments);
});
var runPostSets = (Module['runPostSets'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['runPostSets'].apply(null, arguments);
});
var setTempRet0 = (Module['setTempRet0'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['setTempRet0'].apply(null, arguments);
});
var setThrew = (Module['setThrew'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['setThrew'].apply(null, arguments);
});
var stackAlloc = (Module['stackAlloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['stackAlloc'].apply(null, arguments);
});
var stackRestore = (Module['stackRestore'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['stackRestore'].apply(null, arguments);
});
var stackSave = (Module['stackSave'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['stackSave'].apply(null, arguments);
});
var dynCall_i = (Module['dynCall_i'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_i'].apply(null, arguments);
});
var dynCall_ii = (Module['dynCall_ii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_ii'].apply(null, arguments);
});
var dynCall_iii = (Module['dynCall_iii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iii'].apply(null, arguments);
});
var dynCall_iiii = (Module['dynCall_iiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiii'].apply(null, arguments);
});
var dynCall_v = (Module['dynCall_v'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_v'].apply(null, arguments);
});
var dynCall_vd = (Module['dynCall_vd'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vd'].apply(null, arguments);
});
var dynCall_vdd = (Module['dynCall_vdd'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vdd'].apply(null, arguments);
});
var dynCall_vdddddd = (Module['dynCall_vdddddd'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vdddddd'].apply(null, arguments);
});
var dynCall_vf = (Module['dynCall_vf'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vf'].apply(null, arguments);
});
var dynCall_vff = (Module['dynCall_vff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vff'].apply(null, arguments);
});
var dynCall_vffff = (Module['dynCall_vffff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vffff'].apply(null, arguments);
});
var dynCall_vfi = (Module['dynCall_vfi'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vfi'].apply(null, arguments);
});
var dynCall_vi = (Module['dynCall_vi'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vi'].apply(null, arguments);
});
var dynCall_vif = (Module['dynCall_vif'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vif'].apply(null, arguments);
});
var dynCall_viff = (Module['dynCall_viff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viff'].apply(null, arguments);
});
var dynCall_vifff = (Module['dynCall_vifff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vifff'].apply(null, arguments);
});
var dynCall_viffff = (Module['dynCall_viffff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viffff'].apply(null, arguments);
});
var dynCall_vii = (Module['dynCall_vii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vii'].apply(null, arguments);
});
var dynCall_viif = (Module['dynCall_viif'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viif'].apply(null, arguments);
});
var dynCall_viii = (Module['dynCall_viii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viii'].apply(null, arguments);
});
var dynCall_viiii = (Module['dynCall_viiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiii'].apply(null, arguments);
});
var dynCall_viiiii = (Module['dynCall_viiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiii'].apply(null, arguments);
});
var dynCall_viiiiii = (Module['dynCall_viiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiii'].apply(null, arguments);
});
var dynCall_viiiiiii = (Module['dynCall_viiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiii'].apply(null, arguments);
});
var dynCall_viiiiiiii = (Module['dynCall_viiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiiii'].apply(null, arguments);
});
var dynCall_viiiiiiiii = (Module['dynCall_viiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiiiii'].apply(null, arguments);
});
// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module['intArrayFromString'])
  Module['intArrayFromString'] = function() {
    abort(
      "'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['intArrayToString'])
  Module['intArrayToString'] = function() {
    abort(
      "'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['ccall'])
  Module['ccall'] = function() {
    abort(
      "'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['cwrap'])
  Module['cwrap'] = function() {
    abort(
      "'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['setValue'])
  Module['setValue'] = function() {
    abort(
      "'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getValue'])
  Module['getValue'] = function() {
    abort(
      "'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['allocate'])
  Module['allocate'] = function() {
    abort(
      "'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getMemory'])
  Module['getMemory'] = function() {
    abort(
      "'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
Module['Pointer_stringify'] = Pointer_stringify;
if (!Module['AsciiToString'])
  Module['AsciiToString'] = function() {
    abort(
      "'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToAscii'])
  Module['stringToAscii'] = function() {
    abort(
      "'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF8ArrayToString'])
  Module['UTF8ArrayToString'] = function() {
    abort(
      "'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF8ToString'])
  Module['UTF8ToString'] = function() {
    abort(
      "'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF8Array'])
  Module['stringToUTF8Array'] = function() {
    abort(
      "'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF8'])
  Module['stringToUTF8'] = function() {
    abort(
      "'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['lengthBytesUTF8'])
  Module['lengthBytesUTF8'] = function() {
    abort(
      "'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF16ToString'])
  Module['UTF16ToString'] = function() {
    abort(
      "'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF16'])
  Module['stringToUTF16'] = function() {
    abort(
      "'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['lengthBytesUTF16'])
  Module['lengthBytesUTF16'] = function() {
    abort(
      "'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF32ToString'])
  Module['UTF32ToString'] = function() {
    abort(
      "'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF32'])
  Module['stringToUTF32'] = function() {
    abort(
      "'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['lengthBytesUTF32'])
  Module['lengthBytesUTF32'] = function() {
    abort(
      "'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['allocateUTF8'])
  Module['allocateUTF8'] = function() {
    abort(
      "'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stackTrace'])
  Module['stackTrace'] = function() {
    abort(
      "'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnPreRun'])
  Module['addOnPreRun'] = function() {
    abort(
      "'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnInit'])
  Module['addOnInit'] = function() {
    abort(
      "'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnPreMain'])
  Module['addOnPreMain'] = function() {
    abort(
      "'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnExit'])
  Module['addOnExit'] = function() {
    abort(
      "'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnPostRun'])
  Module['addOnPostRun'] = function() {
    abort(
      "'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['writeStringToMemory'])
  Module['writeStringToMemory'] = function() {
    abort(
      "'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['writeArrayToMemory'])
  Module['writeArrayToMemory'] = function() {
    abort(
      "'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['writeAsciiToMemory'])
  Module['writeAsciiToMemory'] = function() {
    abort(
      "'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addRunDependency'])
  Module['addRunDependency'] = function() {
    abort(
      "'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['removeRunDependency'])
  Module['removeRunDependency'] = function() {
    abort(
      "'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS'])
  Module['FS'] = function() {
    abort(
      "'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['FS_createFolder'])
  Module['FS_createFolder'] = function() {
    abort(
      "'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createPath'])
  Module['FS_createPath'] = function() {
    abort(
      "'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createDataFile'])
  Module['FS_createDataFile'] = function() {
    abort(
      "'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createPreloadedFile'])
  Module['FS_createPreloadedFile'] = function() {
    abort(
      "'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createLazyFile'])
  Module['FS_createLazyFile'] = function() {
    abort(
      "'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createLink'])
  Module['FS_createLink'] = function() {
    abort(
      "'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createDevice'])
  Module['FS_createDevice'] = function() {
    abort(
      "'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_unlink'])
  Module['FS_unlink'] = function() {
    abort(
      "'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['GL'])
  Module['GL'] = function() {
    abort(
      "'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['staticAlloc'])
  Module['staticAlloc'] = function() {
    abort(
      "'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['dynamicAlloc'])
  Module['dynamicAlloc'] = function() {
    abort(
      "'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['warnOnce'])
  Module['warnOnce'] = function() {
    abort(
      "'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['loadDynamicLibrary'])
  Module['loadDynamicLibrary'] = function() {
    abort(
      "'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['loadWebAssemblyModule'])
  Module['loadWebAssemblyModule'] = function() {
    abort(
      "'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getLEB'])
  Module['getLEB'] = function() {
    abort(
      "'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getFunctionTables'])
  Module['getFunctionTables'] = function() {
    abort(
      "'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['alignFunctionTables'])
  Module['alignFunctionTables'] = function() {
    abort(
      "'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['registerFunctions'])
  Module['registerFunctions'] = function() {
    abort(
      "'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addFunction'])
  Module['addFunction'] = function() {
    abort(
      "'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['removeFunction'])
  Module['removeFunction'] = function() {
    abort(
      "'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getFuncWrapper'])
  Module['getFuncWrapper'] = function() {
    abort(
      "'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['prettyPrint'])
  Module['prettyPrint'] = function() {
    abort(
      "'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['makeBigInt'])
  Module['makeBigInt'] = function() {
    abort(
      "'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['dynCall'])
  Module['dynCall'] = function() {
    abort(
      "'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getCompilerSetting'])
  Module['getCompilerSetting'] = function() {
    abort(
      "'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['ALLOC_NORMAL'])
  Object.defineProperty(Module, 'ALLOC_NORMAL', {
    get: function() {
      abort(
        "'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_STACK'])
  Object.defineProperty(Module, 'ALLOC_STACK', {
    get: function() {
      abort(
        "'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_STATIC'])
  Object.defineProperty(Module, 'ALLOC_STATIC', {
    get: function() {
      abort(
        "'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_DYNAMIC'])
  Object.defineProperty(Module, 'ALLOC_DYNAMIC', {
    get: function() {
      abort(
        "'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_NONE'])
  Object.defineProperty(Module, 'ALLOC_NONE', {
    get: function() {
      abort(
        "'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });

/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = 'ExitStatus';
  this.message = 'Program terminated with exit(' + status + ')';
  this.status = status;
}
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

Module['callMain'] = function callMain(args) {
  assert(
    runDependencies == 0,
    'cannot call main when async dependencies remain! (listen on __ATMAIN__)'
  );
  assert(
    __ATPRERUN__.length == 0,
    'cannot call main when preRun functions remain to be called'
  );

  args = args || [];

  ensureInitRuntime();

  var argc = args.length + 1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(Module['thisProgram']);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;

  try {
    var ret = Module['_main'](argc, argv, 0);

    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  } catch (e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
};

/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = Module['print'];
  var printErr = Module['printErr'];
  var has = false;
  Module['print'] = Module['printErr'] = function(x) {
    has = true;
  };
  try {
    // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch (e) {}
  Module['print'] = print;
  Module['printErr'] = printErr;
  if (has) {
    warnOnce(
      'stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.'
    );
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      Module.printErr(
        'exit(' +
          status +
          ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)'
      );
    }
  } else {
    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what);
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function')
    Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module['noExitRuntime'] = true;

run();

// {{POST_RUN_ADDITIONS}}

// {{MODULE_ADDITIONS}}
