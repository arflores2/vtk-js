import _defineProperty from '@babel/runtime/helpers/defineProperty';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import vtkMatrixBuilder from '../../Common/Core/MatrixBuilder.js';
import { w as multiplyScalar } from '../../Common/Core/Math/index.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
// vtkCircleSource methods
// ----------------------------------------------------------------------------

function vtkCircleSource(publicAPI, model) {
  // Set our classname
  model.classHierarchy.push('vtkCircleSource');

  function requestData(inData, outData) {
    var _vtkMatrixBuilder$bui, _vtkMatrixBuilder$bui2;

    if (model.deleted) {
      return;
    }

    var dataset = outData[0]; // Points

    var points = macro.newTypedArray(model.pointType, model.resolution * 3); // Lines/cells
    // [# of points in line, vert_index_0, vert_index_1, ..., vert_index_0]

    var edges = new Uint32Array(model.resolution + 2);
    edges[0] = model.resolution + 1; // generate polydata

    var angle = 2.0 * Math.PI / model.resolution;

    for (var i = 0; i < model.resolution; i++) {
      var x = model.center[0];
      var y = model.radius * Math.cos(i * angle) + model.center[1];
      var z = model.radius * Math.sin(i * angle) + model.center[2];
      points.set([x, y, z], i * 3);
      edges[i + 1] = i;
    } // connect endpoints


    edges[edges.length - 1] = edges[1];
    dataset = vtkPolyData.newInstance();
    dataset.getPoints().setData(points, 3);

    if (model.lines) {
      dataset.getLines().setData(edges, 1);
    }

    if (model.face) {
      dataset.getPolys().setData(edges, 1);
    } // translate an eventual center different to [0, 0, 0] to ensure rotation is correct


    (_vtkMatrixBuilder$bui = (_vtkMatrixBuilder$bui2 = vtkMatrixBuilder.buildFromRadian()).translate.apply(_vtkMatrixBuilder$bui2, _toConsumableArray(model.center)).rotateFromDirections([1, 0, 0], model.direction)).translate.apply(_vtkMatrixBuilder$bui, _toConsumableArray(multiplyScalar(_toConsumableArray(model.center), -1))).apply(points); // Update output


    outData[0] = dataset;
  } // Expose methods


  publicAPI.requestData = requestData;
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


function defaultValues(initialValues) {
  return _objectSpread({
    face: true,
    center: [0, 0, 0],
    lines: false,
    direction: [1, 0, 0],
    pointType: 'Float32Array',
    radius: 1.0,
    resolution: 6
  }, initialValues);
} // ----------------------------------------------------------------------------


function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, defaultValues(initialValues)); // Build VTK API

  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, ['radius', 'resolution', 'lines', 'face']);
  macro.setGetArray(publicAPI, model, ['center', 'direction'], 3);
  macro.algo(publicAPI, model, 0, 1);
  vtkCircleSource(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkCircleSource'); // ----------------------------------------------------------------------------

var vtkCircleSource$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkCircleSource$1 as default, extend, newInstance };
