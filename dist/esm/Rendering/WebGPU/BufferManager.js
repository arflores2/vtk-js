import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { newInstance as newInstance$1, obj, setGet, newTypedArray, vtkDebugMacro as vtkDebugMacro$1 } from '../../macros.js';
import { j as cross, f as normalize } from '../../Common/Core/Math/index.js';
import vtkWebGPUBuffer from './Buffer.js';
import vtkWebGPUTypes from './Types.js';
import vtkProperty from '../Core/Property.js';
import Constants from './BufferManager/Constants.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var BufferUsage = Constants.BufferUsage,
    PrimitiveTypes = Constants.PrimitiveTypes;
var Representation = vtkProperty.Representation;
var vtkDebugMacro = vtkDebugMacro$1; // the webgpu constants all show up as undefined

/* eslint-disable no-undef */
// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

var STATIC = {};

function requestMatches(req1, req2) {
  if (req1.time !== req2.time) return false;
  if (req1.format !== req2.format) return false;
  if (req1.usage !== req2.usage) return false;
  if (req1.hash !== req2.hash) return false;
  return true;
}

var cellCounters = {
  // easy, every input point becomes an output point
  anythingToPoints: function anythingToPoints(numPoints, cellPts) {
    return numPoints;
  },
  linesToWireframe: function linesToWireframe(numPoints, cellPts) {
    if (numPoints > 1) {
      return (numPoints - 1) * 2;
    }

    return 0;
  },
  polysToWireframe: function polysToWireframe(numPoints, cellPts) {
    if (numPoints > 2) {
      return numPoints * 2;
    }

    return 0;
  },
  stripsToWireframe: function stripsToWireframe(numPoints, cellPts) {
    if (numPoints > 2) {
      return numPoints * 4 - 6;
    }

    return 0;
  },
  polysToSurface: function polysToSurface(npts, cellPts) {
    if (npts > 2) {
      return (npts - 2) * 3;
    }

    return 0;
  },
  stripsToSurface: function stripsToSurface(npts, cellPts, offset) {
    if (numPoints > 2) {
      return (npts - 2) * 3;
    }

    return 0;
  }
};

function getPrimitiveName(primType) {
  switch (primType) {
    case PrimitiveTypes.Points:
      return 'points';

    case PrimitiveTypes.Lines:
      return 'lines';

    case PrimitiveTypes.Triangles:
    case PrimitiveTypes.TriangleEdges:
      return 'polys';

    case PrimitiveTypes.TriangleStripEdges:
    case PrimitiveTypes.TriangleStrips:
      return 'strips';

    default:
      return '';
  }
}

function getOutputSize(cellArray, representation, inRepName) {
  var countFunc = null;

  if (representation === Representation.POINTS || inRepName === 'points') {
    countFunc = cellCounters.anythingToPoints;
  } else if (representation === Representation.WIREFRAME || inRepName === 'lines') {
    countFunc = cellCounters["".concat(inRepName, "ToWireframe")];
  } else {
    countFunc = cellCounters["".concat(inRepName, "ToSurface")];
  }

  var array = cellArray.getData();
  var size = array.length;
  var caboCount = 0;

  for (var index = 0; index < size;) {
    caboCount += countFunc(array[index], array);
    index += array[index] + 1;
  }

  return caboCount;
}

function packArray(cellArray, primType, representation, inArray, outputType, options) {
  var result = {
    elementCount: 0,
    blockSize: 0,
    stride: 0
  };

  if (!cellArray.getData() || !cellArray.getData().length) {
    return result;
  } // setup shift and scale


  var shift = [0.0, 0.0, 0.0, 0.0];

  if (options.shift) {
    if (options.shift.length) {
      shift = options.shift;
    } else {
      shift.fill(options.shift);
    }
  }

  var scale = [1.0, 1.0, 1.0, 1.0];

  if (options.scale) {
    if (options.scale.length) {
      scale = options.scale;
    } else {
      scale.fill(options.scale);
    }
  }

  var packExtra = Object.prototype.hasOwnProperty.call(options, 'packExtra') ? options.packExtra : false;
  var pointData = inArray.getData();
  var addAPoint;
  var cellBuilders = {
    // easy, every input point becomes an output point
    anythingToPoints: function anythingToPoints(numPoints, cellPts, offset, cellId) {
      for (var i = 0; i < numPoints; ++i) {
        addAPoint(cellPts[offset + i], cellId);
      }
    },
    linesToWireframe: function linesToWireframe(numPoints, cellPts, offset, cellId) {
      // for lines we add a bunch of segments
      for (var i = 0; i < numPoints - 1; ++i) {
        addAPoint(cellPts[offset + i], cellId);
        addAPoint(cellPts[offset + i + 1], cellId);
      }
    },
    polysToWireframe: function polysToWireframe(numPoints, cellPts, offset, cellId) {
      // for polys we add a bunch of segments and close it
      if (numPoints > 2) {
        for (var i = 0; i < numPoints; ++i) {
          addAPoint(cellPts[offset + i], cellId);
          addAPoint(cellPts[offset + (i + 1) % numPoints], cellId);
        }
      }
    },
    stripsToWireframe: function stripsToWireframe(numPoints, cellPts, offset, cellId) {
      if (numPoints > 2) {
        // for strips we add a bunch of segments and close it
        for (var i = 0; i < numPoints - 1; ++i) {
          addAPoint(cellPts[offset + i], cellId);
          addAPoint(cellPts[offset + i + 1], cellId);
        }

        for (var _i = 0; _i < numPoints - 2; _i++) {
          addAPoint(cellPts[offset + _i], cellId);
          addAPoint(cellPts[offset + _i + 2], cellId);
        }
      }
    },
    polysToSurface: function polysToSurface(npts, cellPts, offset, cellId) {
      for (var i = 0; i < npts - 2; i++) {
        addAPoint(cellPts[offset + 0], cellId);
        addAPoint(cellPts[offset + i + 1], cellId);
        addAPoint(cellPts[offset + i + 2], cellId);
      }
    },
    stripsToSurface: function stripsToSurface(npts, cellPts, offset, cellId) {
      for (var i = 0; i < npts - 2; i++) {
        addAPoint(cellPts[offset + i], cellId);
        addAPoint(cellPts[offset + i + 1 + i % 2], cellId);
        addAPoint(cellPts[offset + i + 1 + (i + 1) % 2], cellId);
      }
    }
  };
  var inRepName = getPrimitiveName(primType);
  var func = null;

  if (representation === Representation.POINTS || primType === PrimitiveTypes.Points) {
    func = cellBuilders.anythingToPoints;
  } else if (representation === Representation.WIREFRAME || primType === PrimitiveTypes.Lines) {
    func = cellBuilders["".concat(inRepName, "ToWireframe")];
  } else {
    func = cellBuilders["".concat(inRepName, "ToSurface")];
  }

  var array = cellArray.getData();
  var size = array.length;
  var caboCount = getOutputSize(cellArray, representation, inRepName);
  var vboidx = 0;
  var numComp = inArray.getNumberOfComponents();
  var packedVBO = newTypedArray(outputType, caboCount * (numComp + (packExtra ? 1 : 0))); // pick the right function based on point versus cell data

  var getData = function getData(ptId, cellId) {
    return pointData[ptId];
  };

  if (options.cellData) {
    getData = function getData(ptId, cellId) {
      return pointData[cellId];
    };
  } // add data based on number of components


  if (numComp === 1) {
    addAPoint = function addAPointFunc(i, cellid) {
      packedVBO[vboidx++] = scale[0] * getData(i, cellid) + shift[0];
    };
  } else if (numComp === 2) {
    addAPoint = function addAPointFunc(i, cellid) {
      packedVBO[vboidx++] = scale[0] * getData(i * 2, cellid * 2) + shift[0];
      packedVBO[vboidx++] = scale[1] * getData(i * 2 + 1, cellid * 2 + 1) + shift[1];
    };
  } else if (numComp === 3 && !packExtra) {
    addAPoint = function addAPointFunc(i, cellid) {
      packedVBO[vboidx++] = scale[0] * getData(i * 3, cellid * 3) + shift[0];
      packedVBO[vboidx++] = scale[1] * getData(i * 3 + 1, cellid * 3 + 1) + shift[1];
      packedVBO[vboidx++] = scale[2] * getData(i * 3 + 2, cellid * 3 + 2) + shift[2];
    };
  } else if (numComp === 3 && packExtra) {
    addAPoint = function addAPointFunc(i, cellid) {
      packedVBO[vboidx++] = scale[0] * getData(i * 3, cellid * 3) + shift[0];
      packedVBO[vboidx++] = scale[1] * getData(i * 3 + 1, cellid * 3 + 1) + shift[1];
      packedVBO[vboidx++] = scale[2] * getData(i * 3 + 2, cellid * 3 + 2) + shift[2];
      packedVBO[vboidx++] = scale[3] * 1.0 + shift[3];
    };
  } else if (numComp === 4) {
    addAPoint = function addAPointFunc(i, cellid) {
      packedVBO[vboidx++] = scale[0] * getData(i * 4, cellid * 4) + shift[0];
      packedVBO[vboidx++] = scale[1] * getData(i * 4 + 1, cellid * 4 + 1) + shift[1];
      packedVBO[vboidx++] = scale[2] * getData(i * 4 + 2, cellid * 4 + 2) + shift[2];
      packedVBO[vboidx++] = scale[3] * getData(i * 4 + 3, cellid * 4 + 3) + shift[3];
    };
  }

  var cellId = options.cellOffset;

  for (var index = 0; index < size;) {
    func(array[index], array, index + 1, cellId);
    index += array[index] + 1;
    cellId++;
  }

  result.nativeArray = packedVBO;
  result.elementCount = caboCount;
  return result;
}

function getNormal(pointData, i0, i1, i2) {
  var v1 = [pointData[i2 * 3] - pointData[i1 * 3], pointData[i2 * 3 + 1] - pointData[i1 * 3 + 1], pointData[i2 * 3 + 2] - pointData[i1 * 3 + 2]];
  var v2 = [pointData[i0 * 3] - pointData[i1 * 3], pointData[i0 * 3 + 1] - pointData[i1 * 3 + 1], pointData[i0 * 3 + 2] - pointData[i1 * 3 + 2]];
  var result = [];
  cross(v1, v2, result);
  normalize(result);
  return result;
}

function generateNormals(cellArray, primType, representation, inArray) {
  if (!cellArray.getData() || !cellArray.getData().length) {
    return null;
  }

  var pointData = inArray.getData();
  var addAPoint;
  var cellBuilders = {
    polysToPoints: function polysToPoints(numPoints, cellPts, offset) {
      var normal = getNormal(pointData, cellPts[offset], cellPts[offset + 1], cellPts[offset + 2]);

      for (var i = 0; i < numPoints; ++i) {
        addAPoint(normal);
      }
    },
    polysToWireframe: function polysToWireframe(numPoints, cellPts, offset) {
      // for polys we add a bunch of segments and close it
      // compute the normal
      var normal = getNormal(pointData, cellPts[offset], cellPts[offset + 1], cellPts[offset + 2]);

      for (var i = 0; i < numPoints; ++i) {
        addAPoint(normal);
        addAPoint(normal);
      }
    },
    polysToSurface: function polysToSurface(npts, cellPts, offset) {
      if (npts < 3) {
        // ignore degenerate triangles
        vtkDebugMacro('skipping degenerate triangle');
      } else {
        // compute the normal
        var normal = getNormal(pointData, cellPts[offset], cellPts[offset + 1], cellPts[offset + 2]);

        for (var i = 0; i < npts - 2; i++) {
          addAPoint(normal);
          addAPoint(normal);
          addAPoint(normal);
        }
      }
    }
  };
  var primName = getPrimitiveName(primType);
  var func = null;

  if (representation === Representation.POINTS) {
    func = cellBuilders["".concat(primName, "ToPoints")];
  } else if (representation === Representation.WIREFRAME) {
    func = cellBuilders["".concat(primName, "ToWireframe")];
  } else {
    func = cellBuilders["".concat(primName, "ToSurface")];
  }

  var caboCount = getOutputSize(cellArray, representation, primName);
  var vboidx = 0;
  var packedVBO = new Int8Array(caboCount * 4);

  addAPoint = function addAPointFunc(normal) {
    packedVBO[vboidx++] = 127 * normal[0];
    packedVBO[vboidx++] = 127 * normal[1];
    packedVBO[vboidx++] = 127 * normal[2];
    packedVBO[vboidx++] = 127;
  };

  var array = cellArray.getData();
  var size = array.length;

  for (var index = 0; index < size;) {
    func(array[index], array, index + 1);
    index += array[index] + 1;
  }

  return packedVBO;
} // ----------------------------------------------------------------------------
// vtkWebGPUBufferManager methods
// ----------------------------------------------------------------------------


function vtkWebGPUBufferManager(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkWebGPUBufferManager'); // is the buffer already present?

  publicAPI.hasBuffer = function (req) {
    if (req.source) {
      // if a matching buffer already exists then return true
      if (model.buffers.has(req.source)) {
        var dabuffers = model.buffers.get(req.source);

        for (var i = 0; i < dabuffers.length; i++) {
          if (requestMatches(dabuffers[i].request, req)) {
            return true;
          }
        }
      }
    }

    return false;
  }; // we cache based on the passed in source, when the source is
  // garbage collected then the cache entry is removed. If a source
  // is not provided then the buffer is NOT cached and you are on your own
  // if you want to share it etc


  publicAPI.getBuffer = function (req) {
    if (req.source) {
      // if a matching buffer already exists then return it
      if (model.buffers.has(req.source)) {
        var dabuffers = model.buffers.get(req.source);

        for (var i = 0; i < dabuffers.length; i++) {
          if (requestMatches(dabuffers[i].request, req)) {
            return dabuffers[i].buffer;
          }
        }
      }
    } // if a dataArray is provided set the nativeArray


    if (req.dataArray && !req.nativeArray) {
      req.nativeArray = req.dataArray.getData();
    } // create one


    var buffer = vtkWebGPUBuffer.newInstance();
    buffer.setDevice(model.device);
    var gpuUsage = null; // handle uniform buffers

    if (req.usage === BufferUsage.UniformArray) {
      /* eslint-disable no-bitwise */
      gpuUsage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
      /* eslint-enable no-bitwise */

      buffer.createAndWrite(req.nativeArray, gpuUsage);
    } // handle storage buffers


    if (req.usage === BufferUsage.Storage) {
      /* eslint-disable no-bitwise */
      gpuUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      /* eslint-enable no-bitwise */

      buffer.createAndWrite(req.nativeArray, gpuUsage);
    } // handle textures


    if (req.usage === BufferUsage.Texture) {
      /* eslint-disable no-bitwise */
      gpuUsage = GPUBufferUsage.COPY_SRC;
      /* eslint-enable no-bitwise */

      buffer.createAndWrite(req.nativeArray, gpuUsage);
    } // all of the below types that have gpuUsage = VERTEX require format
    // to be provided.
    // handle point data


    if (req.usage === BufferUsage.PointArray) {
      gpuUsage = GPUBufferUsage.VERTEX;
      var arrayType = vtkWebGPUTypes.getNativeTypeFromBufferFormat(req.format);
      var result = packArray(req.cells, req.primitiveType, req.representation, req.dataArray, arrayType, {
        packExtra: req.packExtra,
        shift: req.shift,
        scale: req.scale,
        cellData: req.cellData,
        cellOffset: req.cellOffset
      }); // console.log(result);

      buffer.createAndWrite(result.nativeArray, gpuUsage);
      buffer.setStrideInBytes(vtkWebGPUTypes.getByteStrideFromBufferFormat(req.format));
      buffer.setArrayInformation([{
        offset: 0,
        format: req.format
      }]);
    } // handle normals from points, snorm8x4


    if (req.usage === BufferUsage.NormalsFromPoints) {
      gpuUsage = GPUBufferUsage.VERTEX;
      var normals = generateNormals(req.cells, req.primitiveType, req.representation, req.dataArray);
      buffer.createAndWrite(normals, gpuUsage);
      buffer.setStrideInBytes(vtkWebGPUTypes.getByteStrideFromBufferFormat(req.format));
      buffer.setArrayInformation([{
        offset: 0,
        format: req.format
      }]);
    }

    if (req.usage === BufferUsage.RawVertex) {
      gpuUsage = GPUBufferUsage.VERTEX;
      buffer.createAndWrite(req.nativeArray, gpuUsage);
      buffer.setStrideInBytes(vtkWebGPUTypes.getByteStrideFromBufferFormat(req.format));
      buffer.setArrayInformation([{
        offset: 0,
        format: req.format
      }]);
    }

    buffer.setSourceTime(req.time); // cache the buffer if we have a dataArray.
    // We create a new req that only has the 4 fields required for
    // a comparison to avoid GC cycles

    if (req.source) {
      if (!model.buffers.has(req.source)) {
        model.buffers.set(req.source, []);
      }

      var _dabuffers = model.buffers.get(req.source);

      _dabuffers.push({
        request: {
          time: req.time,
          format: req.format,
          usage: req.usage,
          hash: req.hash
        },
        buffer: buffer
      });
    }

    return buffer;
  };

  publicAPI.getFullScreenQuadBuffer = function () {
    if (model.fullScreenQuadBuffer) {
      return model.fullScreenQuadBuffer;
    }

    model.fullScreenQuadBuffer = vtkWebGPUBuffer.newInstance();
    model.fullScreenQuadBuffer.setDevice(model.device); // prettier-ignore

    var array = new Float32Array([-1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0]);
    model.fullScreenQuadBuffer.createAndWrite(array, GPUBufferUsage.VERTEX);
    model.fullScreenQuadBuffer.setStrideInBytes(12);
    model.fullScreenQuadBuffer.setArrayInformation([{
      offset: 0,
      format: 'float32x3'
    }]);
    return model.fullScreenQuadBuffer;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  device: null,
  fullScreenQuadBuffer: null
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Object methods

  obj(publicAPI, model); // this is a cache, and a cache with GC pretty much means WeakMap

  model.buffers = new WeakMap();
  setGet(publicAPI, model, ['device']);
  vtkWebGPUBufferManager(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = newInstance$1(extend); // ----------------------------------------------------------------------------

var vtkWebGPUBufferManager$1 = _objectSpread(_objectSpread({
  newInstance: newInstance,
  extend: extend
}, STATIC), Constants);

export { STATIC, vtkWebGPUBufferManager$1 as default, extend, newInstance };
