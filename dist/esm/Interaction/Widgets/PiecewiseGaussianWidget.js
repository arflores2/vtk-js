import _slicedToArray from '@babel/runtime/helpers/slicedToArray';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import { B as arrayRange } from '../../Common/Core/Math/index.js';
import WebworkerPromise from 'webworker-promise';
import { W as WorkerFactory } from '../../_virtual/rollup-plugin-worker-loader__module_Sources/Interaction/Widgets/PiecewiseGaussianWidget/ComputeHistogram.worker.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
/* eslint-disable no-continue */
// ----------------------------------------------------------------------------
// Global structures
// ----------------------------------------------------------------------------

var MIN_GAUSSIAN_WIDTH = 0.001;
var ACTION_TO_CURSOR = {
  adjustPosition: '-webkit-grab',
  adjustHeight: 'row-resize',
  adjustBias: 'crosshair',
  adjustWidth: 'col-resize',
  adjustZoom: 'col-resize'
};
var TOUCH_CLICK = []; // ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

var ACTIONS = {
  adjustPosition: function adjustPosition(x, y, _ref) {
    var originalXY = _ref.originalXY,
        gaussian = _ref.gaussian,
        originalGaussian = _ref.originalGaussian;
    var xOffset = originalGaussian.position - originalXY[0];
    gaussian.position = x + xOffset;
    return true;
  },
  adjustHeight: function adjustHeight(x, y, _ref2) {
    var model = _ref2.model,
        gaussian = _ref2.gaussian;
    gaussian.height = 1 - y;
    gaussian.height = Math.min(1, Math.max(model.gaussianMinimumHeight, gaussian.height));
    return true;
  },
  adjustBias: function adjustBias(x, y, _ref3) {
    var originalXY = _ref3.originalXY,
        gaussian = _ref3.gaussian,
        originalGaussian = _ref3.originalGaussian;
    gaussian.xBias = originalGaussian.xBias - (originalXY[0] - x) / gaussian.height;
    gaussian.yBias = originalGaussian.yBias + 4 * (originalXY[1] - y) / gaussian.height; // Clamps

    gaussian.xBias = Math.max(-1, Math.min(1, gaussian.xBias));
    gaussian.yBias = Math.max(0, Math.min(2, gaussian.yBias));
    return true;
  },
  adjustWidth: function adjustWidth(x, y, _ref4) {
    var originalXY = _ref4.originalXY,
        gaussian = _ref4.gaussian,
        originalGaussian = _ref4.originalGaussian,
        gaussianSide = _ref4.gaussianSide;
    gaussian.width = gaussianSide < 0 ? originalGaussian.width - (originalXY[0] - x) : originalGaussian.width + (originalXY[0] - x);

    if (gaussian.width < MIN_GAUSSIAN_WIDTH) {
      gaussian.width = MIN_GAUSSIAN_WIDTH;
    }

    return true;
  },
  adjustZoom: function adjustZoom(x, y, _ref5) {
    var rangeZoom = _ref5.rangeZoom,
        publicAPI = _ref5.publicAPI;
    var delta = rangeZoom[1] - rangeZoom[0];
    var absNormX = (x - rangeZoom[0]) / delta;
    var minDelta = Math.abs(absNormX - rangeZoom[0]);
    var maxDelta = Math.abs(absNormX - rangeZoom[1]);
    var meanDelta = Math.abs(absNormX - 0.5 * (rangeZoom[0] + rangeZoom[1]));

    if (meanDelta < Math.min(minDelta, maxDelta)) {
      var halfDelta = delta * 0.5;
      rangeZoom[0] = Math.min(Math.max(absNormX - halfDelta, 0), rangeZoom[1] - 0.1);
      rangeZoom[1] = Math.max(Math.min(absNormX + halfDelta, 1), rangeZoom[0] + 0.1);
    } else if (minDelta < maxDelta) {
      rangeZoom[0] = Math.min(Math.max(absNormX, 0), rangeZoom[1] - 0.1);
    } else {
      rangeZoom[1] = Math.max(Math.min(absNormX, 1), rangeZoom[0] + 0.1);
    }

    publicAPI.invokeZoomChange(rangeZoom); // The opacity did not changed

    return false;
  }
}; // ----------------------------------------------------------------------------

function computeOpacities(gaussians) {
  var sampling = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 256;
  var opacities = [];

  while (opacities.length < sampling) {
    opacities.push(0);
  }

  var count = gaussians.length;

  while (count--) {
    var _gaussians$count = gaussians[count],
        position = _gaussians$count.position,
        height = _gaussians$count.height,
        width = _gaussians$count.width,
        xBias = _gaussians$count.xBias,
        yBias = _gaussians$count.yBias;

    for (var i = 0; i < sampling; i++) {
      var x = i / (sampling - 1); // clamp non-zero values to pos +/- width

      if (x > position + width || x < position - width) {
        if (opacities[i] < 0.0) {
          opacities[i] = 0.0;
        }

        continue;
      } // non-zero width


      var correctedWidth = width < MIN_GAUSSIAN_WIDTH ? MIN_GAUSSIAN_WIDTH : width; // translate the original x to a new x based on the xbias

      var x0 = 0;

      if (xBias === 0 || x === position + xBias) {
        x0 = x;
      } else if (x > position + xBias) {
        if (correctedWidth === xBias) {
          x0 = position;
        } else {
          x0 = position + (x - position - xBias) * (correctedWidth / (correctedWidth - xBias));
        }
      } else if (-correctedWidth === xBias) {
        // (x < pos+xBias)
        x0 = position;
      } else {
        x0 = position - (x - position - xBias) * (correctedWidth / (correctedWidth + xBias));
      } // center around 0 and normalize to -1,1


      var x1 = (x0 - position) / correctedWidth; // do a linear interpolation between:
      //    a gaussian and a parabola        if 0 < yBias <1
      //    a parabola and a step function   if 1 < yBias <2

      var h0a = Math.exp(-(4 * x1 * x1));
      var h0b = 1.0 - x1 * x1;
      var h0c = 1.0;
      var h1 = void 0;

      if (yBias < 1) {
        h1 = yBias * h0b + (1 - yBias) * h0a;
      } else {
        h1 = (2 - yBias) * h0b + (yBias - 1) * h0c;
      }

      var h2 = height * h1; // perform the MAX over different gaussians, not the sum

      if (h2 > opacities[i]) {
        opacities[i] = h2;
      }
    }
  }

  return opacities;
} // ----------------------------------------------------------------------------


function applyGaussianToPiecewiseFunction(gaussians, sampling, rangeToUse, piecewiseFunction) {
  var opacities = computeOpacities(gaussians, sampling);
  var nodes = [];
  var delta = (rangeToUse[1] - rangeToUse[0]) / (opacities.length - 1);
  var midpoint = 0.5;
  var sharpness = 0;

  for (var index = 0; index < opacities.length; index++) {
    var x = rangeToUse[0] + delta * index;
    var y = opacities[index];
    nodes.push({
      x: x,
      y: y,
      midpoint: midpoint,
      sharpness: sharpness
    });
  }

  piecewiseFunction.setNodes(nodes);
} // ----------------------------------------------------------------------------


function drawChart(ctx, area, values) {
  var style = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
    lineWidth: 1,
    strokeStyle: '#000'
  };
  var verticalScale = area[3];
  var horizontalScale = area[2] / (values.length - 1);
  var fill = !!style.fillStyle;
  var offset = verticalScale + area[1];
  ctx.lineWidth = style.lineWidth;
  ctx.strokeStyle = style.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(area[0], area[1] + area[3]);

  for (var index = 0; index < values.length; index++) {
    ctx.lineTo(area[0] + index * horizontalScale, Math.max(area[1], offset - values[index] * verticalScale));
  }

  if (fill) {
    ctx.fillStyle = style.fillStyle;
    ctx.lineTo(area[0] + area[2], area[1] + area[3]);

    if (style.clip) {
      ctx.clip();
      return;
    }

    ctx.fill();
  }

  ctx.stroke();
} // ----------------------------------------------------------------------------


function updateColorCanvas(colorTransferFunction, width, rangeToUse, canvas) {
  var workCanvas = canvas || document.createElement('canvas');
  workCanvas.setAttribute('width', width);
  workCanvas.setAttribute('height', 256);
  var ctx = workCanvas.getContext('2d');
  var rgba = colorTransferFunction.getUint8Table(rangeToUse[0], rangeToUse[1], width, 4);
  var pixelsArea = ctx.getImageData(0, 0, width, 256);

  for (var lineIdx = 0; lineIdx < 256; lineIdx++) {
    pixelsArea.data.set(rgba, lineIdx * 4 * width);
  }

  var nbValues = 256 * width * 4;
  var lineSize = width * 4;

  for (var i = 3; i < nbValues; i += 4) {
    pixelsArea.data[i] = 255 - Math.floor(i / lineSize);
  }

  ctx.putImageData(pixelsArea, 0, 0);
  return workCanvas;
} // ----------------------------------------------------------------------------


function updateColorCanvasFromImage(img, width, canvas) {
  var workCanvas = canvas || document.createElement('canvas');
  workCanvas.setAttribute('width', width);
  workCanvas.setAttribute('height', 256);
  var ctx = workCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, 256);
  return workCanvas;
} // ----------------------------------------------------------------------------


function normalizeCoordinates(x, y, subRectangeArea) {
  var zoomRange = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [0, 1];
  return [zoomRange[0] + (x - subRectangeArea[0]) / subRectangeArea[2] * (zoomRange[1] - zoomRange[0]), (y - subRectangeArea[1]) / subRectangeArea[3]];
} // ----------------------------------------------------------------------------


function findGaussian(x, gaussians) {
  var distances = gaussians.map(function (g) {
    return Math.abs(g.position - x);
  });
  var min = Math.min.apply(Math, _toConsumableArray(distances));
  return distances.indexOf(min);
} // ----------------------------------------------------------------------------


function createListener(callback) {
  var preventDefault = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return function (e) {
    var offsetX = e.offsetX,
        offsetY = e.offsetY;

    if (preventDefault) {
      e.preventDefault();
    }

    callback(offsetX, offsetY);
  };
} // ----------------------------------------------------------------------------


function createTouchClickListener() {
  var id = TOUCH_CLICK.length;

  for (var _len = arguments.length, callbacks = new Array(_len), _key = 0; _key < _len; _key++) {
    callbacks[_key] = arguments[_key];
  }

  TOUCH_CLICK.push({
    callbacks: callbacks,
    timeout: 0,
    deltaT: 200,
    count: 0,
    ready: false
  });
  return id;
} // ----------------------------------------------------------------------------


function processTouchClicks() {
  TOUCH_CLICK.filter(function (t) {
    return t.ready;
  }).forEach(function (touchHandle) {
    touchHandle.callbacks.forEach(function (callback) {
      if (callback.touches === touchHandle.touches && callback.clicks === touchHandle.count) {
        callback.action.apply(callback, _toConsumableArray(touchHandle.singleTouche));
      }
    }); // Clear state

    touchHandle.ts = 0;
    touchHandle.count = 0;
    touchHandle.touches = 0;
    touchHandle.ready = false;
  });
} // ----------------------------------------------------------------------------


function createTouchListener(id, callback) {
  var nbTouches = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
  var preventDefault = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
  return function (e) {
    var targetBounds = e.target.getBoundingClientRect();
    var relativeTouches = Array.prototype.map.call(e.touches, function (t) {
      return [t.pageX - targetBounds.left, t.pageY - targetBounds.top];
    });
    var singleTouche = relativeTouches.reduce(function (a, b) {
      return [a[0] + b[0], a[1] + b[1]];
    }, [0, 0]).map(function (v) {
      return v / e.touches.length;
    });

    if (e.type === 'touchstart') {
      clearTimeout(TOUCH_CLICK[id].timeout);
      TOUCH_CLICK[id].ts = e.timeStamp;
      TOUCH_CLICK[id].singleTouche = singleTouche;
      TOUCH_CLICK[id].touches = e.touches.length;
    } else if (e.type === 'touchmove') {
      TOUCH_CLICK[id].ts = 0;
      TOUCH_CLICK[id].count = 0;
      TOUCH_CLICK[id].ready = false;
    } else if (e.type === 'touchend') {
      if (e.timeStamp - TOUCH_CLICK[id].ts < TOUCH_CLICK[id].deltaT) {
        TOUCH_CLICK[id].count += 1;
        TOUCH_CLICK[id].ready = true;

        if (preventDefault) {
          e.preventDefault();
        }

        TOUCH_CLICK[id].timeout = setTimeout(processTouchClicks, TOUCH_CLICK[id].deltaT);
      } else {
        TOUCH_CLICK[id].ready = false;
      }
    }

    if (e.touches.length === nbTouches) {
      callback.apply(void 0, _toConsumableArray(singleTouche));

      if (preventDefault) {
        e.preventDefault();
      }
    }
  };
} // ----------------------------------------------------------------------------


function listenerSelector(condition, ok, ko) {
  return function (e) {
    return condition() ? ok(e) : ko(e);
  };
} // ----------------------------------------------------------------------------


function rescaleArray(array, focusArea) {
  if (!focusArea) {
    return array;
  }

  var maxIdx = array.length - 1;
  var idxRange = focusArea.map(function (v) {
    return Math.round(v * maxIdx);
  });
  return array.slice(idxRange[0], idxRange[1] + 1);
} // ----------------------------------------------------------------------------


function rescaleValue(value, focusArea) {
  if (!focusArea) {
    return value;
  }

  return (value - focusArea[0]) / (focusArea[1] - focusArea[0]);
} // ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------


var STATIC = {
  applyGaussianToPiecewiseFunction: applyGaussianToPiecewiseFunction,
  computeOpacities: computeOpacities,
  createListener: createListener,
  drawChart: drawChart,
  findGaussian: findGaussian,
  listenerSelector: listenerSelector,
  normalizeCoordinates: normalizeCoordinates
}; // ----------------------------------------------------------------------------
// vtkPiecewiseGaussianWidget methods
// ----------------------------------------------------------------------------

function vtkPiecewiseGaussianWidget(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPiecewiseGaussianWidget');

  if (!model.canvas) {
    model.canvas = document.createElement('canvas');
  }

  publicAPI.setContainer = function (el) {
    if (model.container && model.container !== el) {
      model.container.removeChild(model.canvas);
    }

    if (model.container !== el) {
      model.container = el;

      if (model.container) {
        model.container.appendChild(model.canvas);
      }

      publicAPI.modified();
    }
  };

  publicAPI.setGaussians = function (gaussians) {
    if (model.gaussians === gaussians) {
      return;
    }

    model.gaussians = gaussians;
    model.opacities = computeOpacities(model.gaussians, model.piecewiseSize);
    publicAPI.invokeOpacityChange(publicAPI);
    publicAPI.modified();
  };

  publicAPI.addGaussian = function (position, height, width, xBias, yBias) {
    var nextIndex = model.gaussians.length;
    model.gaussians.push({
      position: position,
      height: height,
      width: width,
      xBias: xBias,
      yBias: yBias
    });
    model.opacities = computeOpacities(model.gaussians, model.piecewiseSize);
    publicAPI.invokeOpacityChange(publicAPI);
    publicAPI.modified();
    return nextIndex;
  };

  publicAPI.removeGaussian = function (index) {
    model.gaussians.splice(index, 1);
    model.opacities = computeOpacities(model.gaussians, model.piecewiseSize);
    publicAPI.invokeOpacityChange(publicAPI);
    publicAPI.modified();
  };

  publicAPI.setSize = function (width, height) {
    model.canvas.setAttribute('width', width);
    model.canvas.setAttribute('height', height);

    if (model.size[0] !== width || model.size[1] !== height) {
      model.size = [width, height];
      model.colorCanvasMTime = 0;
      publicAPI.modified();
    }
  };

  publicAPI.updateStyle = function (style) {
    model.style = _objectSpread(_objectSpread({}, model.style), style);
    publicAPI.modified();
  }; // Method used to compute and show data distribution in the background.
  // When an array with many components is used, you can provide additional
  // information to choose which component you want to extract the histogram
  // from.


  publicAPI.setDataArray = function (array) {
    var _ref6 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref6$numberOfBinToCo = _ref6.numberOfBinToConsiders,
        numberOfBinToConsiders = _ref6$numberOfBinToCo === void 0 ? 1 : _ref6$numberOfBinToCo,
        _ref6$numberOfBinsToS = _ref6.numberOfBinsToSkip,
        numberOfBinsToSkip = _ref6$numberOfBinsToS === void 0 ? 1 : _ref6$numberOfBinsToS,
        _ref6$numberOfCompone = _ref6.numberOfComponents,
        numberOfComponents = _ref6$numberOfCompone === void 0 ? 1 : _ref6$numberOfCompone,
        _ref6$component = _ref6.component,
        component = _ref6$component === void 0 ? 0 : _ref6$component;

    model.histogram = null;
    model.histogramArray = array;
    model.dataRange = arrayRange(array, component, numberOfComponents);

    var _model$dataRange = _slicedToArray(model.dataRange, 2),
        min = _model$dataRange[0],
        max = _model$dataRange[1];

    var maxNumberOfWorkers = 4;
    var arrayStride = Math.floor(array.length / maxNumberOfWorkers) || 1;
    arrayStride += arrayStride % numberOfComponents;
    var arrayIndex = 0;
    var workerChunks = [];
    var workers = [];

    while (arrayIndex < array.length) {
      var worker = new WorkerFactory();
      workers.push(worker);
      var workerPromise = new WebworkerPromise(worker);
      var arrayStart = arrayIndex;
      var arrayEnd = Math.min(arrayIndex + arrayStride, array.length - 1);
      var subArray = new array.constructor(array.slice(arrayStart, arrayEnd + 1));
      workerChunks.push(workerPromise.postMessage({
        array: subArray,
        component: component,
        numberOfComponents: numberOfComponents,
        min: min,
        max: max,
        numberOfBins: model.numberOfBins
      }, [subArray.buffer]));
      arrayIndex += arrayStride;
    }

    Promise.all(workerChunks).then(function (subHistograms) {
      workers.forEach(function (worker) {
        return worker.terminate();
      });
      model.histogram = new Float32Array(model.numberOfBins);
      model.histogram.fill(0);
      subHistograms.forEach(function (subHistogram) {
        for (var i = 0, len = subHistogram.length; i < len; ++i) {
          model.histogram[i] += subHistogram[i];
        }
      }); // Smart Rescale Histogram

      var sampleSize = Math.min(numberOfBinToConsiders, model.histogram.length - numberOfBinsToSkip);
      var sortedArray = Array.from(model.histogram);
      sortedArray.sort(function (a, b) {
        return Number(a) - Number(b);
      });

      for (var i = 0; i < numberOfBinsToSkip; i++) {
        sortedArray.pop();
      }

      while (sortedArray.length > sampleSize) {
        sortedArray.shift();
      }

      var mean = sortedArray.reduce(function (a, b) {
        return a + b;
      }, 0) / sampleSize;

      for (var _i = 0, len = model.histogram.length; _i < len; ++_i) {
        model.histogram[_i] /= mean;
      }

      publicAPI.modified();
      setTimeout(publicAPI.render, 0);
    });
    publicAPI.modified();
  };

  publicAPI.onClick = function (x, y) {
    var _normalizeCoordinates = normalizeCoordinates(x, y, model.graphArea, model.enableRangeZoom ? model.rangeZoom : null),
        _normalizeCoordinates2 = _slicedToArray(_normalizeCoordinates, 2),
        xNormalized = _normalizeCoordinates2[0],
        yNormalized = _normalizeCoordinates2[1];

    if (xNormalized < 0 && model.style.iconSize > 1) {
      // Control buttons
      var delta = model.style.iconSize + model.style.padding;
      var offset = delta;
      var buttonIdx = 0;

      while (y > offset) {
        buttonIdx += 1;
        offset += delta;
      }

      switch (buttonIdx) {
        case 0:
          {
            var gaussianIdx = publicAPI.addGaussian(0, 1, 0.1, 0, 0);
            var gaussian = model.gaussians[gaussianIdx];

            var originalGaussian = _objectSpread({}, gaussian);

            var action = ACTIONS.adjustPosition;
            model.activeGaussian = gaussianIdx;
            model.selectedGaussian = gaussianIdx; // Fake active action

            macro.setImmediate(function () {
              publicAPI.onDown(x, y);
              model.dragAction = {
                originalXY: [0, 0],
                action: action,
                gaussian: gaussian,
                originalGaussian: originalGaussian
              };
            });
            break;
          }

        case 1:
          {
            if (model.selectedGaussian !== -1) {
              publicAPI.removeGaussian(model.selectedGaussian);
            }

            break;
          }

        default:
          {
            model.selectedGaussian = -1;
            model.dragAction = null;
          }
      }
    } else if (xNormalized < 0 || xNormalized > 1 || yNormalized < 0 || yNormalized > 1) {
      model.selectedGaussian = -1;
      model.dragAction = null;
    } else {
      var newSelected = findGaussian(xNormalized, model.gaussians);

      if (newSelected !== model.selectedGaussian) {
        model.selectedGaussian = newSelected;
        publicAPI.modified();
      }
    }

    return true;
  };

  publicAPI.onHover = function (x, y) {
    // Determines the interaction region size for adjusting the Gaussian's
    // height.
    var tolerance = 20 / model.canvas.height;

    var _normalizeCoordinates3 = normalizeCoordinates(x, y, model.graphArea, model.enableRangeZoom ? model.rangeZoom : null),
        _normalizeCoordinates4 = _slicedToArray(_normalizeCoordinates3, 2),
        xNormalized = _normalizeCoordinates4[0],
        yNormalized = _normalizeCoordinates4[1];

    var _normalizeCoordinates5 = normalizeCoordinates(x, y, model.graphArea),
        _normalizeCoordinates6 = _slicedToArray(_normalizeCoordinates5, 1),
        xNormalizedAbs = _normalizeCoordinates6[0];

    var newActive = xNormalized < 0 ? model.selectedGaussian : findGaussian(xNormalized, model.gaussians);
    model.canvas.style.cursor = 'default';
    var gaussian = model.gaussians[newActive];

    if (model.enableRangeZoom && xNormalizedAbs >= 0 && y < model.graphArea[1] - 6 // circle radius
    ) {
      var thirdDelta = (model.rangeZoom[1] - model.rangeZoom[0]) / 3;

      if (xNormalizedAbs < model.rangeZoom[0] + thirdDelta || xNormalizedAbs > model.rangeZoom[1] - thirdDelta) {
        model.canvas.style.cursor = ACTION_TO_CURSOR.adjustZoom;
      } else {
        model.canvas.style.cursor = ACTION_TO_CURSOR.adjustPosition;
      }

      model.dragAction = {
        rangeZoom: model.rangeZoom,
        action: ACTIONS.adjustZoom
      };
    } else if (gaussian && xNormalizedAbs >= 0) {
      var invY = 1 - yNormalized;
      var actionName = null;

      if (invY > gaussian.height + tolerance) {
        actionName = 'adjustPosition';
      } else if (invY > gaussian.height - tolerance) {
        if (Math.abs(xNormalized - gaussian.position) < tolerance) {
          actionName = 'adjustHeight';
        } else {
          actionName = 'adjustPosition';
        }
      } else if (invY > gaussian.height * 0.5 + tolerance) {
        actionName = 'adjustPosition';
      } else if (invY > gaussian.height * 0.5 - tolerance) {
        if (Math.abs(xNormalized - gaussian.position) < tolerance) {
          actionName = 'adjustBias';
        } else {
          actionName = 'adjustPosition';
        }
      } else if (invY > tolerance) {
        actionName = 'adjustPosition';
      } else {
        actionName = 'adjustWidth';
      }

      model.canvas.style.cursor = ACTION_TO_CURSOR[actionName];
      var action = ACTIONS[actionName];

      var originalGaussian = _objectSpread({}, gaussian);

      model.dragAction = {
        originalXY: [xNormalized, yNormalized],
        action: action,
        gaussian: gaussian,
        originalGaussian: originalGaussian
      };
    }

    if (newActive !== model.activeGaussian) {
      model.activeGaussian = newActive;
      publicAPI.modified();
    }

    return true;
  };

  publicAPI.onDown = function (x, y) {
    if (!model.mouseIsDown) {
      publicAPI.invokeAnimation(true);
    }

    model.mouseIsDown = true;
    var xNormalized = normalizeCoordinates(x, y, model.graphArea, model.enableRangeZoom ? model.rangeZoom : null)[0];
    var newSelected = findGaussian(xNormalized, model.gaussians);
    model.gaussianSide = 0;
    var gaussian = model.gaussians[newSelected];

    if (gaussian) {
      model.gaussianSide = gaussian.position - xNormalized;
    }

    if (newSelected !== model.selectedGaussian && xNormalized > 0) {
      model.selectedGaussian = newSelected;
      publicAPI.modified();
    }

    return true;
  };

  publicAPI.onDrag = function (x, y) {
    if (model.dragAction) {
      var _normalizeCoordinates7 = normalizeCoordinates(x, y, model.graphArea, model.enableRangeZoom ? model.rangeZoom : null),
          _normalizeCoordinates8 = _slicedToArray(_normalizeCoordinates7, 2),
          xNormalized = _normalizeCoordinates8[0],
          yNormalized = _normalizeCoordinates8[1];

      var action = model.dragAction.action;

      if (action(xNormalized, yNormalized, _objectSpread({
        gaussianSide: model.gaussianSide,
        model: model,
        publicAPI: publicAPI
      }, model.dragAction))) {
        model.opacities = computeOpacities(model.gaussians, model.piecewiseSize);
        publicAPI.invokeOpacityChange(publicAPI, true);
      }

      publicAPI.modified();
    }

    return true;
  };

  publicAPI.onUp = function (x, y) {
    if (model.mouseIsDown) {
      publicAPI.invokeAnimation(false);
    }

    model.mouseIsDown = false;
    return true;
  };

  publicAPI.onLeave = function (x, y) {
    publicAPI.onUp(x, y);
    model.canvas.style.cursor = 'default';
    model.activeGaussian = -1;
    publicAPI.modified();
    return true;
  };

  publicAPI.onAddGaussian = function (x, y) {
    var _normalizeCoordinates9 = normalizeCoordinates(x, y, model.graphArea, model.enableRangeZoom ? model.rangeZoom : null),
        _normalizeCoordinates10 = _slicedToArray(_normalizeCoordinates9, 2),
        xNormalized = _normalizeCoordinates10[0],
        yNormalized = _normalizeCoordinates10[1];

    if (xNormalized >= 0) {
      publicAPI.addGaussian(xNormalized, 1 - yNormalized, 0.1, 0, 0);
    }

    return true;
  };

  publicAPI.onRemoveGaussian = function (x, y) {
    var xNormalized = normalizeCoordinates(x, y, model.graphArea, model.enableRangeZoom ? model.rangeZoom : null)[0];
    var newSelected = findGaussian(xNormalized, model.gaussians);

    if (xNormalized >= 0 && newSelected !== -1) {
      publicAPI.removeGaussian(newSelected);
    }

    return true;
  };

  publicAPI.bindMouseListeners = function () {
    if (!model.listeners) {
      var isDown = function isDown() {
        return !!model.mouseIsDown;
      };

      var touchId = createTouchClickListener({
        clicks: 1,
        touches: 1,
        action: publicAPI.onClick
      }, {
        clicks: 2,
        touches: 1,
        action: publicAPI.onAddGaussian
      }, {
        clicks: 2,
        touches: 2,
        action: publicAPI.onRemoveGaussian
      });
      model.listeners = {
        mousemove: listenerSelector(isDown, createListener(publicAPI.onDrag), createListener(publicAPI.onHover)),
        dblclick: createListener(publicAPI.onAddGaussian),
        contextmenu: createListener(publicAPI.onRemoveGaussian),
        click: createListener(publicAPI.onClick),
        mouseup: createListener(publicAPI.onUp),
        mousedown: createListener(publicAPI.onDown),
        mouseout: createListener(publicAPI.onLeave),
        touchstart: createTouchListener(touchId, macro.chain(publicAPI.onHover, publicAPI.onDown)),
        touchmove: listenerSelector(isDown, createTouchListener(touchId, publicAPI.onDrag), createTouchListener(touchId, publicAPI.onHover)),
        touchend: createTouchListener(touchId, publicAPI.onUp, 0) // touchend have 0 touch event...

      };
      Object.keys(model.listeners).forEach(function (eventType) {
        model.canvas.addEventListener(eventType, model.listeners[eventType], false);
      });
    }
  };

  publicAPI.unbindMouseListeners = function () {
    if (model.listeners) {
      Object.keys(model.listeners).forEach(function (eventType) {
        model.canvas.removeEventListener(eventType, model.listeners[eventType]);
      });
      delete model.listeners;
    }
  };

  publicAPI.render = function () {
    var ctx = model.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    var _model$size = _slicedToArray(model.size, 2),
        width = _model$size[0],
        height = _model$size[1];

    var offset = model.style.padding;
    var graphArea = [Math.floor(model.style.iconSize + offset), Math.floor(offset), Math.ceil(width - 2 * offset - model.style.iconSize), Math.ceil(height - 2 * offset)];
    var zoomControlHeight = model.style.zoomControlHeight;

    if (model.enableRangeZoom) {
      graphArea[1] += Math.floor(zoomControlHeight);
      graphArea[3] -= Math.floor(zoomControlHeight);
    }

    model.graphArea = graphArea; // Clear canvas

    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = 'round';
    ctx.fillStyle = model.style.backgroundColor;
    ctx.fillRect.apply(ctx, graphArea);

    if (model.style.iconSize > 1) {
      // Draw icons
      // +
      var halfSize = Math.round(model.style.iconSize / 2 - model.style.strokeWidth);
      var center = Math.round(halfSize + offset + model.style.strokeWidth);
      ctx.beginPath();
      ctx.lineWidth = model.style.buttonStrokeWidth;
      ctx.strokeStyle = model.style.buttonStrokeColor;
      ctx.arc(center - offset / 2, center, halfSize, 0, 2 * Math.PI, false);
      ctx.fillStyle = model.style.buttonFillColor;
      ctx.fill();
      ctx.stroke();
      ctx.moveTo(center - halfSize + model.style.strokeWidth + 2 - offset / 2, center);
      ctx.lineTo(center + halfSize - model.style.strokeWidth - 2 - offset / 2, center);
      ctx.stroke();
      ctx.moveTo(center - offset / 2, center - halfSize + model.style.strokeWidth + 2);
      ctx.lineTo(center - offset / 2, center + halfSize - model.style.strokeWidth - 2);
      ctx.stroke(); // -

      if (model.selectedGaussian === -1) {
        ctx.fillStyle = model.style.buttonDisableFillColor;
        ctx.lineWidth = model.style.buttonDisableStrokeWidth;
        ctx.strokeStyle = model.style.buttonDisableStrokeColor;
      } else {
        ctx.fillStyle = model.style.buttonFillColor;
        ctx.lineWidth = model.style.buttonStrokeWidth;
        ctx.strokeStyle = model.style.buttonStrokeColor;
      }

      ctx.beginPath();
      ctx.arc(center - offset / 2, center + offset / 2 + model.style.iconSize, halfSize, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();
      ctx.moveTo(center - halfSize + model.style.strokeWidth + 2 - offset / 2, center + offset / 2 + model.style.iconSize);
      ctx.lineTo(center + halfSize - model.style.strokeWidth - 2 - offset / 2, center + offset / 2 + model.style.iconSize);
      ctx.stroke();
    } // Draw histogram


    if (model.histogram) {
      drawChart(ctx, graphArea, rescaleArray(model.histogram, model.rangeZoom), {
        lineWidth: 1,
        strokeStyle: model.style.histogramColor,
        fillStyle: model.style.histogramColor
      });
    } // Draw gaussians


    drawChart(ctx, graphArea, rescaleArray(model.opacities, model.enableRangeZoom && model.rangeZoom), {
      lineWidth: model.style.strokeWidth,
      strokeStyle: model.style.strokeColor
    }); // Draw color function if any

    if (model.colorTransferFunction && model.colorTransferFunction.getSize()) {
      var rangeToUse = model.dataRange || model.colorTransferFunction.getMappingRange();

      if (!model.colorCanvas || model.colorCanvasMTime !== model.colorTransferFunction.getMTime()) {
        model.colorCanvasMTime = model.colorTransferFunction.getMTime();
        model.colorCanvas = updateColorCanvas(model.colorTransferFunction, graphArea[2], rangeToUse, model.colorCanvas);
      }

      ctx.save();
      drawChart(ctx, graphArea, rescaleArray(model.opacities, model.enableRangeZoom && model.rangeZoom), {
        lineWidth: 1,
        strokeStyle: 'rgba(0,0,0,0)',
        fillStyle: 'rgba(0,0,0,1)',
        clip: true
      }); // Draw the correct portion of the color BG image

      if (model.enableRangeZoom) {
        ctx.drawImage(model.colorCanvas, model.rangeZoom[0] * graphArea[2], 0, graphArea[2], graphArea[3], graphArea[0], graphArea[1], graphArea[2] / (model.rangeZoom[1] - model.rangeZoom[0]), graphArea[3]);
      } else {
        ctx.drawImage(model.colorCanvas, graphArea[0], graphArea[1]);
      }

      ctx.restore();
    } else if (model.backgroundImage) {
      model.colorCanvas = updateColorCanvasFromImage(model.backgroundImage, graphArea[2], model.colorCanvas);
      ctx.save();
      drawChart(ctx, graphArea, rescaleArray(model.opacities, model.enableRangeZoom && model.rangeZoom), {
        lineWidth: 1,
        strokeStyle: 'rgba(0,0,0,0)',
        fillStyle: 'rgba(0,0,0,1)',
        clip: true
      });
      ctx.drawImage(model.colorCanvas, graphArea[0], graphArea[1]);
      ctx.restore();
    } // Draw zoomed area


    if (model.enableRangeZoom) {
      ctx.fillStyle = model.style.zoomControlColor;
      ctx.beginPath();
      ctx.rect(graphArea[0] + model.rangeZoom[0] * graphArea[2], 0, (model.rangeZoom[1] - model.rangeZoom[0]) * graphArea[2], zoomControlHeight);
      ctx.fill();
    } // Draw active gaussian


    var activeGaussian = model.gaussians[model.activeGaussian] || model.gaussians[model.selectedGaussian];

    if (activeGaussian) {
      var activeOpacities = computeOpacities([activeGaussian], graphArea[2]);
      drawChart(ctx, graphArea, rescaleArray(activeOpacities, model.enableRangeZoom && model.rangeZoom), {
        lineWidth: model.style.activeStrokeWidth,
        strokeStyle: model.style.activeColor
      }); // Draw controls

      var xCenter = graphArea[0] + rescaleValue(activeGaussian.position, model.enableRangeZoom && model.rangeZoom) * graphArea[2];
      var yTop = graphArea[1] + (1 - activeGaussian.height) * graphArea[3];
      var yMiddle = graphArea[1] + (1 - 0.5 * activeGaussian.height) * graphArea[3];
      var yBottom = graphArea[1] + graphArea[3];
      var widthInPixel = activeGaussian.width * graphArea[2];

      if (model.enableRangeZoom) {
        widthInPixel /= model.rangeZoom[1] - model.rangeZoom[0];
      }

      ctx.lineWidth = model.style.handleWidth;
      ctx.strokeStyle = model.style.handleColor;
      ctx.fillStyle = model.style.backgroundColor;
      ctx.beginPath();
      ctx.moveTo(xCenter, graphArea[1] + (1 - activeGaussian.height) * graphArea[3]);
      ctx.lineTo(xCenter, graphArea[1] + graphArea[3]);
      ctx.stroke(); // Height

      ctx.beginPath();
      ctx.arc(xCenter, yTop, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke(); // Bias

      var radius = Math.min(widthInPixel * 0.1, activeGaussian.height * graphArea[3] * 0.2);
      ctx.beginPath();
      ctx.rect(xCenter - radius, yMiddle - radius, radius * 2, radius * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath(); // Width

      var sliderWidth = widthInPixel * 0.8;
      ctx.rect(xCenter - sliderWidth, yBottom - 5, 2 * sliderWidth, 10);
      ctx.fill();
      ctx.stroke();
    }
  };

  publicAPI.getOpacityNodes = function (dataRange) {
    var rangeToUse = dataRange || model.dataRange;
    var delta = (rangeToUse[1] - rangeToUse[0]) / (model.opacities.length - 1);
    var nodes = [];
    var midpoint = 0.5;
    var sharpness = 0;

    for (var index = 0; index < model.opacities.length; index++) {
      var x = rangeToUse[0] + delta * index;
      var y = model.opacities[index];
      nodes.push({
        x: x,
        y: y,
        midpoint: midpoint,
        sharpness: sharpness
      });
    }

    return nodes;
  };

  publicAPI.applyOpacity = function (piecewiseFunction, dataRange) {
    var nodes = publicAPI.getOpacityNodes(dataRange);
    piecewiseFunction.setNodes(nodes);
  };

  publicAPI.getOpacityRange = function (dataRange) {
    var rangeToUse = dataRange || model.dataRange;
    var delta = (rangeToUse[1] - rangeToUse[0]) / (model.opacities.length - 1);
    var minIndex = model.opacities.length - 1;
    var maxIndex = 0;

    for (var index = 0; index < model.opacities.length; index++) {
      if (model.opacities[index] > 0) {
        minIndex = Math.min(minIndex, index);
      }

      if (model.opacities[index] > 0) {
        maxIndex = Math.max(maxIndex, index);
      }
    }

    return [rangeToUse[0] + minIndex * delta, rangeToUse[0] + maxIndex * delta];
  };

  var enableZoom = publicAPI.setEnableRangeZoom;

  publicAPI.setEnableRangeZoom = function (v) {
    var change = enableZoom(v);

    if (change) {
      model.colorCanvasMTime = 0;
      model.rangeZoom = [0, 1];
    }

    return change;
  };

  var rangeZoom = publicAPI.setRangeZoom;

  publicAPI.setRangeZoom = function () {
    var change = rangeZoom.apply(void 0, arguments);

    if (change) {
      model.colorCanvasMTime = 0;
    }

    return change;
  }; // Trigger rendering for any modified event


  publicAPI.onModified(function () {
    return publicAPI.render();
  });
  publicAPI.setSize.apply(publicAPI, _toConsumableArray(model.size));
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  histogram: [],
  numberOfBins: 256,
  histogramArray: null,
  dataRange: [0, 1],
  gaussians: [],
  opacities: [],
  size: [600, 300],
  piecewiseSize: 256,
  colorCanvasMTime: 0,
  gaussianMinimumHeight: 0.05,
  style: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    histogramColor: 'rgba(200, 200, 200, 0.5)',
    strokeColor: 'rgb(0, 0, 0)',
    activeColor: 'rgb(0, 0, 150)',
    buttonDisableFillColor: 'rgba(255, 255, 255, 0.5)',
    buttonDisableStrokeColor: 'rgba(0, 0, 0, 0.5)',
    buttonStrokeColor: 'rgba(0, 0, 0, 1)',
    buttonFillColor: 'rgba(255, 255, 255, 1)',
    handleColor: 'rgb(0, 150, 0)',
    strokeWidth: 2,
    activeStrokeWidth: 3,
    buttonStrokeWidth: 1.5,
    handleWidth: 3,
    iconSize: 20,
    padding: 10,
    zoomControlHeight: 10,
    zoomControlColor: '#999'
  },
  activeGaussian: -1,
  selectedGaussian: -1,
  enableRangeZoom: true,
  rangeZoom: [0, 1] // normalized value

}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Object methods

  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, ['piecewiseSize', 'numberOfBins', 'colorTransferFunction', 'backgroundImage', 'enableRangeZoom', 'gaussianMinimumHeight']);
  macro.setGetArray(publicAPI, model, ['rangeZoom'], 2);
  macro.get(publicAPI, model, ['size', 'canvas', 'gaussians']);
  macro.event(publicAPI, model, 'opacityChange');
  macro.event(publicAPI, model, 'animation');
  macro.event(publicAPI, model, 'zoomChange'); // Object specific methods

  vtkPiecewiseGaussianWidget(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkPiecewiseGaussianWidget'); // ----------------------------------------------------------------------------

var vtkPiecewiseGaussianWidget$1 = _objectSpread({
  newInstance: newInstance,
  extend: extend
}, STATIC);

export { STATIC, vtkPiecewiseGaussianWidget$1 as default, extend, newInstance };
