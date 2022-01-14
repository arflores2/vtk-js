import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../../macros.js';
import { j as cross, f as normalize, z as clampValue } from '../../../Common/Core/Math/index.js';
import vtkPolyData from '../../../Common/DataModel/PolyData.js';
import vtkPlane from '../../../Common/DataModel/Plane.js';
import vtkCellArray from '../../../Common/Core/CellArray.js';
import { CenterProjectionType } from './ResliceCursor/Constants.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var vtkErrorMacro = macro.vtkErrorMacro; // ----------------------------------------------------------------------------
// vtkResliceCursor methods
// ----------------------------------------------------------------------------

function vtkResliceCursor(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkResliceCursor');

  var superClass = _objectSpread({}, publicAPI);

  function projectCenterToFitBounds(center, bounds) {
    if (center[0] >= bounds[0] && center[0] <= bounds[1] && center[1] >= bounds[2] && center[1] <= bounds[3] && center[2] >= bounds[4] && center[2] <= bounds[5]) {
      return center;
    }

    center[0] = clampValue(center[0], bounds[0], bounds[1]);
    center[1] = clampValue(center[1], bounds[2], bounds[3]);
    center[2] = clampValue(center[2], bounds[4], bounds[5]);
    return center;
  } //----------------------------------------------------------------------------
  // Public API methods
  //----------------------------------------------------------------------------


  publicAPI.buildCursorTopology = function () {
    for (var i = 0; i < 3; ++i) {
      // Set number of points
      model.centerlinesAxis[i].getPoints().setNumberOfPoints(2); // Define polys

      var cellsData = new Float32Array(3);
      var cells = vtkCellArray.newInstance({
        values: cellsData
      });
      cellsData[0] = 2;
      cellsData[1] = 0;
      cellsData[2] = 1;
      model.centerlinesAxis[i].setLines(cells);
    }
  };

  publicAPI.buildCursorGeometry = function () {
    publicAPI.computeAxes();
    var bounds = model.image.getBounds(); // Length of the principal diagonal.

    var pdLength = 20 * 0.5 * Math.sqrt((bounds[1] - bounds[0]) * (bounds[1] - bounds[0]) + (bounds[3] - bounds[2]) * (bounds[3] - bounds[2]) + (bounds[5] - bounds[4]) * (bounds[5] - bounds[4])); // Precompute prior to use within the loop.

    var pts = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

    for (var i = 0; i < 3; i++) {
      pts[0][i] = model.center[i] - pdLength * model.xAxis[i];
      pts[1][i] = model.center[i] + pdLength * model.xAxis[i];
      pts[2][i] = model.center[i] - pdLength * model.yAxis[i];
      pts[3][i] = model.center[i] + pdLength * model.yAxis[i];
      pts[4][i] = model.center[i] - pdLength * model.zAxis[i];
      pts[5][i] = model.center[i] + pdLength * model.zAxis[i];
    }

    for (var j = 0; j < 3; j++) {
      var points = model.centerlinesAxis[j].getPoints();
      var pointsData = points.getData();
      pointsData[0] = pts[2 * j][0];
      pointsData[1] = pts[2 * j][1];
      pointsData[2] = pts[2 * j][2];
      pointsData[3] = pts[2 * j + 1][0];
      pointsData[4] = pts[2 * j + 1][1];
      pointsData[5] = pts[2 * j + 1][2];
      model.centerlinesAxis[j].modified();
    }

    model.polyDataBuildTime.modified();
  };

  publicAPI.computeAxes = function () {
    var normals = [];

    for (var i = 0; i < 3; ++i) {
      normals[i] = publicAPI.getPlane(i).getNormal();
    }

    cross(normals[0], normals[1], model.zAxis);
    cross(normals[1], normals[2], model.xAxis);
    cross(normals[2], normals[0], model.yAxis);
    normalize(model.xAxis);
    normalize(model.yAxis);
    normalize(model.zAxis);
  }; // Reset cursor to its initial position


  publicAPI.reset = function () {
    model.xAxis = [1, 0, 0];
    model.yAxis = [0, 1, 0];
    model.zAxis = [0, 0, 1];
    model.xViewUp = [0, 0, 1];
    model.yViewUp = [0, 0, 1];
    model.zViewUp = [0, -1, 0];

    if (publicAPI.getImage()) {
      model.center = publicAPI.getImage().getCenter();
    } else {
      model.center = [0, 0, 0];
    }

    for (var i = 0; i < 3; ++i) {
      publicAPI.getPlane(i).setOrigin(model.center);
    }

    model.reslicePlanes[0].setNormal([1, 0, 0]);
    model.reslicePlanes[1].setNormal([0, -1, 0]);
    model.reslicePlanes[2].setNormal([0, 0, 1]);
    publicAPI.buildCursorTopology();
    publicAPI.buildCursorGeometry();
  };

  publicAPI.getPlane = function (i) {
    return model.reslicePlanes[i];
  };

  publicAPI.update = function () {
    if (!publicAPI.getImage()) {
      vtkErrorMacro('Image not set! ');
      return;
    }

    if (publicAPI.getMTime() > model.polyDataBuildTime.getMTime()) {
      publicAPI.buildCursorTopology();
      publicAPI.buildCursorGeometry();
    }
  };

  publicAPI.getPolyData = function () {
    publicAPI.update();
    return model.polyData;
  };

  publicAPI.setCenter = function (center) {
    var centerProjectionType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : CenterProjectionType.INSIDE_BOUNDS;

    if (model.center[0] === center[0] && model.center[1] === center[1] && model.center[2] === center[2]) {
      return;
    }

    if (model.image) {
      var bounds = model.image.getBounds();

      var newCenter = _toConsumableArray(center);

      if (centerProjectionType === CenterProjectionType.INSIDE_BOUNDS && (newCenter[0] < bounds[0] || newCenter[0] > bounds[1] || newCenter[1] < bounds[2] || newCenter[1] > bounds[3] || newCenter[2] < bounds[4] || newCenter[2] > bounds[5])) {
        return;
      }

      if (centerProjectionType === CenterProjectionType.FIT_BOUNDS) {
        newCenter = projectCenterToFitBounds(newCenter, bounds);

        if (newCenter.length !== 3) {
          return;
        }
      }

      model.center = newCenter;
      publicAPI.getPlane(0).setOrigin(model.center);
      publicAPI.getPlane(1).setOrigin(model.center);
      publicAPI.getPlane(2).setOrigin(model.center);
      publicAPI.modified();
    }
  };

  publicAPI.getCenterlineAxisPolyData = function (axis) {
    publicAPI.update();
    return model.centerlinesAxis[axis];
  };

  publicAPI.getAxis = function (i) {
    if (i === 0) {
      return model.xAxis;
    }

    if (i === 1) {
      return model.yAxis;
    }

    return model.zAxis;
  };

  publicAPI.getViewUp = function (i) {
    if (i === 0) {
      return model.xViewUp;
    }

    if (i === 1) {
      return model.yViewUp;
    }

    return model.zViewUp;
  };

  publicAPI.getMTime = function () {
    var mTime = superClass.getMTime();

    for (var i = 0; i < 3; ++i) {
      var planeMTime = publicAPI.getPlane(i).getMTime();

      if (planeMTime > mTime) {
        mTime = planeMTime;
      }
    }

    return mTime;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  image: null,
  center: [0, 0, 0],
  xAxis: [1, 0, 0],
  yAxis: [0, 1, 0],
  zAxis: [0, 0, 1],
  xViewUp: [0, 0, 1],
  yViewUp: [0, 0, 1],
  zViewUp: [0, -1, 0]
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, ['image']);
  macro.setGetArray(publicAPI, model, ['xAxis', 'yAxis', 'zAxis', 'xViewUp', 'yViewUp', 'zViewUp'], 3);
  macro.getArray(publicAPI, model, ['center'], 3);
  model.reslicePlanes = [];
  model.centerlinesAxis = [];
  model.polyDataBuildTime = {};
  macro.obj(model.polyDataBuildTime); // Object methods

  vtkResliceCursor(publicAPI, model);

  for (var i = 0; i < 3; ++i) {
    model.reslicePlanes.push(vtkPlane.newInstance());
    model.centerlinesAxis.push(vtkPolyData.newInstance());
  }

  model.reslicePlanes[0].setNormal([1, 0, 0]);
  model.reslicePlanes[1].setNormal([0, -1, 0]);
  model.reslicePlanes[2].setNormal([0, 0, -1]);
  publicAPI.buildCursorTopology();
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkResliceCursor'); // ----------------------------------------------------------------------------

var vtkResliceCursor$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkResliceCursor$1 as default, extend, newInstance };
