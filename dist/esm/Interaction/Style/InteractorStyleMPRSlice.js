import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import { f as normalize, e as distance2BetweenPoints } from '../../Common/Core/Math/index.js';
import vtkMatrixBuilder from '../../Common/Core/MatrixBuilder.js';
import vtkInteractorStyleManipulator from './InteractorStyleManipulator.js';
import vtkMouseCameraTrackballRotateManipulator from '../Manipulators/MouseCameraTrackballRotateManipulator.js';
import vtkMouseCameraTrackballPanManipulator from '../Manipulators/MouseCameraTrackballPanManipulator.js';
import vtkMouseCameraTrackballZoomManipulator from '../Manipulators/MouseCameraTrackballZoomManipulator.js';
import vtkMouseRangeManipulator from '../Manipulators/MouseRangeManipulator.js';

// Global methods
// ----------------------------------------------------------------------------

function boundsToCorners(bounds) {
  return [[bounds[0], bounds[2], bounds[4]], [bounds[0], bounds[2], bounds[5]], [bounds[0], bounds[3], bounds[4]], [bounds[0], bounds[3], bounds[5]], [bounds[1], bounds[2], bounds[4]], [bounds[1], bounds[2], bounds[5]], [bounds[1], bounds[3], bounds[4]], [bounds[1], bounds[3], bounds[5]]];
} // ----------------------------------------------------------------------------


function clamp(value, min, max) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
} // ----------------------------------------------------------------------------
// vtkInteractorStyleMPRSlice methods
// ----------------------------------------------------------------------------


function vtkInteractorStyleMPRSlice(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleMPRSlice');
  model.trackballManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance({
    button: 1
  });
  model.panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance({
    button: 1,
    shift: true
  });
  model.zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance({
    button: 3
  });
  model.scrollManipulator = vtkMouseRangeManipulator.newInstance({
    scrollEnabled: true,
    dragEnabled: false
  }); // cache for sliceRange

  var cache = {
    sliceNormal: [0, 0, 0],
    sliceRange: [0, 0]
  };
  var cameraSub = null;

  function updateScrollManipulator() {
    var range = publicAPI.getSliceRange();
    model.scrollManipulator.removeScrollListener();
    model.scrollManipulator.setScrollListener(range[0], range[1], 1, publicAPI.getSlice, publicAPI.setSlice);
  }

  function setManipulators() {
    publicAPI.removeAllMouseManipulators();
    publicAPI.addMouseManipulator(model.trackballManipulator);
    publicAPI.addMouseManipulator(model.panManipulator);
    publicAPI.addMouseManipulator(model.zoomManipulator);
    publicAPI.addMouseManipulator(model.scrollManipulator);
    updateScrollManipulator();
  }

  var superSetInteractor = publicAPI.setInteractor;

  publicAPI.setInteractor = function (interactor) {
    superSetInteractor(interactor);

    if (cameraSub) {
      cameraSub.unsubscribe();
      cameraSub = null;
    }

    if (interactor) {
      var renderer = interactor.getCurrentRenderer();
      var camera = renderer.getActiveCamera();
      cameraSub = camera.onModified(function () {
        updateScrollManipulator();
        publicAPI.modified();
      });
    }
  };

  publicAPI.handleMouseMove = macro.chain(publicAPI.handleMouseMove, function () {
    var renderer = model.interactor.getCurrentRenderer();
    var camera = renderer.getActiveCamera();
    var dist = camera.getDistance();
    camera.setClippingRange(dist, dist + 0.1);
  });
  var superSetVolumeMapper = publicAPI.setVolumeMapper;

  publicAPI.setVolumeMapper = function (mapper) {
    if (superSetVolumeMapper(mapper)) {
      var renderer = model.interactor.getCurrentRenderer();
      var camera = renderer.getActiveCamera();

      if (mapper) {
        // prevent zoom manipulator from messing with our focal point
        camera.setFreezeFocalPoint(true);
        publicAPI.setSliceNormal.apply(publicAPI, _toConsumableArray(publicAPI.getSliceNormal()));
      } else {
        camera.setFreezeFocalPoint(false);
      }
    }
  };

  publicAPI.getSlice = function () {
    var renderer = model.interactor.getCurrentRenderer();
    var camera = renderer.getActiveCamera();
    var sliceNormal = publicAPI.getSliceNormal(); // Get rotation matrix from normal to +X (since bounds is aligned to XYZ)

    var transform = vtkMatrixBuilder.buildFromDegree().identity().rotateFromDirections(sliceNormal, [1, 0, 0]);
    var fp = camera.getFocalPoint();
    transform.apply(fp);
    return fp[0];
  };

  publicAPI.setSlice = function (slice) {
    var renderer = model.interactor.getCurrentRenderer();
    var camera = renderer.getActiveCamera();

    if (model.volumeMapper) {
      var range = publicAPI.getSliceRange();
      var bounds = model.volumeMapper.getBounds();
      var clampedSlice = clamp.apply(void 0, [slice].concat(_toConsumableArray(range)));
      var center = [(bounds[0] + bounds[1]) / 2.0, (bounds[2] + bounds[3]) / 2.0, (bounds[4] + bounds[5]) / 2.0];
      var distance = camera.getDistance();
      var dop = camera.getDirectionOfProjection();
      normalize(dop);
      var midPoint = (range[1] + range[0]) / 2.0;
      var zeroPoint = [center[0] - dop[0] * midPoint, center[1] - dop[1] * midPoint, center[2] - dop[2] * midPoint];
      var slicePoint = [zeroPoint[0] + dop[0] * clampedSlice, zeroPoint[1] + dop[1] * clampedSlice, zeroPoint[2] + dop[2] * clampedSlice];
      var newPos = [slicePoint[0] - dop[0] * distance, slicePoint[1] - dop[1] * distance, slicePoint[2] - dop[2] * distance];
      camera.setPosition.apply(camera, newPos);
      camera.setFocalPoint.apply(camera, slicePoint);
    }
  };

  publicAPI.getSliceRange = function () {
    if (model.volumeMapper) {
      var sliceNormal = publicAPI.getSliceNormal();

      if (sliceNormal[0] === cache.sliceNormal[0] && sliceNormal[1] === cache.sliceNormal[1] && sliceNormal[2] === cache.sliceNormal[2]) {
        return cache.sliceRange;
      }

      var bounds = model.volumeMapper.getBounds();
      var points = boundsToCorners(bounds); // Get rotation matrix from normal to +X (since bounds is aligned to XYZ)

      var transform = vtkMatrixBuilder.buildFromDegree().identity().rotateFromDirections(sliceNormal, [1, 0, 0]);
      points.forEach(function (pt) {
        return transform.apply(pt);
      }); // range is now maximum X distance

      var minX = Infinity;
      var maxX = -Infinity;

      for (var i = 0; i < 8; i++) {
        var x = points[i][0];

        if (x > maxX) {
          maxX = x;
        }

        if (x < minX) {
          minX = x;
        }
      }

      cache.sliceNormal = sliceNormal;
      cache.sliceRange = [minX, maxX];
      return cache.sliceRange;
    }

    return [0, 0];
  }; // Slice normal is just camera DOP


  publicAPI.getSliceNormal = function () {
    if (model.volumeMapper) {
      var renderer = model.interactor.getCurrentRenderer();
      var camera = renderer.getActiveCamera();
      return camera.getDirectionOfProjection();
    }

    return [0, 0, 0];
  }; // in world space


  publicAPI.setSliceNormal = function () {
    var renderer = model.interactor.getCurrentRenderer();
    var camera = renderer.getActiveCamera();

    for (var _len = arguments.length, normal = new Array(_len), _key = 0; _key < _len; _key++) {
      normal[_key] = arguments[_key];
    }

    normalize(normal);

    if (model.volumeMapper) {
      var bounds = model.volumeMapper.getBounds(); // diagonal will be used as "width" of camera scene

      var diagonal = Math.sqrt(distance2BetweenPoints([bounds[0], bounds[2], bounds[4]], [bounds[1], bounds[3], bounds[5]])); // center will be used as initial focal point

      var center = [(bounds[0] + bounds[1]) / 2.0, (bounds[2] + bounds[3]) / 2.0, (bounds[4] + bounds[5]) / 2.0];
      var angle = 90; // distance from camera to focal point

      var dist = diagonal / (2 * Math.tan(angle / 360 * Math.PI));
      var cameraPos = [center[0] - normal[0] * dist, center[1] - normal[1] * dist, center[2] - normal[2] * dist]; // set viewUp based on DOP rotation

      var oldDop = camera.getDirectionOfProjection();
      var transform = vtkMatrixBuilder.buildFromDegree().identity().rotateFromDirections(oldDop, normal);
      var viewUp = [0, 1, 0];
      transform.apply(viewUp);
      camera.setPosition.apply(camera, cameraPos);
      camera.setDistance(dist); // should be set after pos and distance

      camera.setDirectionOfProjection.apply(camera, normal);
      camera.setViewUp.apply(camera, viewUp);
      camera.setViewAngle(angle);
      camera.setClippingRange(dist, dist + 0.1);
      publicAPI.setCenterOfRotation(center);
    }
  };

  setManipulators();
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkInteractorStyleManipulator.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['volumeMapper']); // Object specific methods

  vtkInteractorStyleMPRSlice(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkInteractorStyleMPRSlice'); // ----------------------------------------------------------------------------

var vtkInteractorStyleMPRSlice$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkInteractorStyleMPRSlice$1 as default, extend, newInstance };
