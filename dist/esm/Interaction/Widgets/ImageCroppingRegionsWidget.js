import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../macros.js';
import { f as normalize, d as dot, g as subtract, A as projectVector, k as add } from '../../Common/Core/Math/index.js';
import vtkPlane from '../../Common/DataModel/Plane.js';
import vtkAbstractWidget from './AbstractWidget.js';
import vtkImageCroppingRegionsRepresentation from './ImageCroppingRegionsRepresentation.js';
import Constants from './ImageCroppingRegionsWidget/Constants.js';
import { mat4, vec3 } from 'gl-matrix';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var vtkErrorMacro = macro.vtkErrorMacro,
    VOID = macro.VOID,
    EVENT_ABORT = macro.EVENT_ABORT;
var TOTAL_NUM_HANDLES = Constants.TOTAL_NUM_HANDLES,
    WidgetState = Constants.WidgetState,
    CropWidgetEvents = Constants.CropWidgetEvents; // Determines the ordering of edge handles for some fixed axis

var EDGE_ORDER = [[0, 0], [0, 1], [1, 0], [1, 1]]; // ----------------------------------------------------------------------------
// vtkImageCroppingRegionsWidget methods
// ----------------------------------------------------------------------------

function arrayEquals(a, b) {
  if (a.length === b.length) {
    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function vtkImageCroppingRegionsWidget(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkImageCroppingRegionsWidget'); // camera subscription

  var cameraSub = null;
  model.indexToWorld = mat4.identity(new Float64Array(16));
  model.worldToIndex = mat4.identity(new Float64Array(16));
  var handlesCache = null;
  model.widgetState = {
    activeHandleIndex: -1,
    // index space: xmin, xmax, ymin, ymax, zmin, zmax
    planes: Array(6).fill(0),
    controlState: WidgetState.IDLE
  };

  function worldToIndex(ain) {
    var vout = [];
    vec3.transformMat4(vout, ain, model.worldToIndex);
    return vout;
  }

  function indexToWorld(ain) {
    var vout = [];
    vec3.transformMat4(vout, ain, model.indexToWorld);
    return vout;
  } // Overridden method


  publicAPI.createDefaultRepresentation = function () {
    if (!model.widgetRep) {
      model.widgetRep = vtkImageCroppingRegionsRepresentation.newInstance();
      publicAPI.updateRepresentation();
    }
  };

  publicAPI.getWidgetState = function () {
    return _objectSpread({}, model.widgetState);
  };

  publicAPI.updateWidgetState = function (state) {
    var needsUpdate = Object.keys(state).reduce(function (flag, key) {
      return flag || model.widgetState[key] !== state[key];
    }, false);

    if (needsUpdate) {
      var oldState = model.widgetState;
      model.widgetState = _objectSpread(_objectSpread({}, oldState), state);

      if (!arrayEquals(oldState.planes, model.widgetState.planes)) {
        // invalidate handles cache
        handlesCache = null;
        publicAPI.invokeCroppingPlanesChanged(model.widgetState.planes);
      }

      publicAPI.updateRepresentation();
      publicAPI.modified();
    }
  };

  publicAPI.setVolumeMapper = function (volumeMapper) {
    if (volumeMapper !== model.volumeMapper) {
      model.volumeMapper = volumeMapper;
      publicAPI.resetWidgetState();

      if (model.enabled) {
        publicAPI.updateRepresentation();
      }
    }
  };

  publicAPI.planesToHandles = function (planes) {
    if (!model.volumeMapper || !model.volumeMapper.getInputData()) {
      return null;
    }

    if (handlesCache) {
      return handlesCache;
    } // coords are in world space.
    // a null handle means it is disabled


    var handles = Array(TOTAL_NUM_HANDLES).fill(null);

    if (model.faceHandlesEnabled) {
      var _loop = function _loop(i) {
        var center = [0, 0, 0].map(function (c, j) {
          if (j === Math.floor(i / 2)) {
            return planes[i];
          }

          return (planes[j * 2] + planes[j * 2 + 1]) / 2;
        });
        handles[i] = [center[0], center[1], center[2]];
      };

      // construct face handles
      for (var i = 0; i < 6; ++i) {
        _loop(i);
      }
    }

    if (model.edgeHandlesEnabled) {
      // construct edge handles
      for (var _i = 0; _i < 12; ++_i) {
        // the axis around which edge handles will be placed
        var fixedAxis = Math.floor(_i / 4);

        var edgeSpec = EDGE_ORDER[_i % 4].slice();

        var center = [];

        for (var j = 0; j < 3; ++j) {
          if (j !== fixedAxis) {
            // edgeSpec[j] determines whether to pick a min or max cropping
            // plane for edge selection.
            center.push(planes[j * 2 + edgeSpec.shift()]);
          }
        } // set fixed axis coordinate


        center.splice(fixedAxis, 0, (planes[fixedAxis * 2] + planes[fixedAxis * 2 + 1]) / 2);
        handles[_i + 6] = [center[0], center[1], center[2]];
      }
    }

    if (model.cornerHandlesEnabled) {
      // construct corner handles
      for (var _i2 = 0; _i2 < 8; ++_i2) {
        /* eslint-disable no-bitwise */
        handles[_i2 + 18] = [planes[0 + (_i2 >> 2 & 0x1)], planes[2 + (_i2 >> 1 & 0x1)], planes[4 + (_i2 >> 0 & 0x1)]];
        /* eslint-enable no-bitwise */
      }
    } // transform handles from index to world space


    for (var _i3 = 0; _i3 < handles.length; ++_i3) {
      if (handles[_i3]) {
        handles[_i3] = indexToWorld(handles[_i3]);
      }
    }

    handlesCache = handles;
    return handles;
  };

  publicAPI.planesToBBoxCorners = function (planes) {
    if (!model.volumeMapper || !model.volumeMapper.getInputData()) {
      return null;
    }

    return [[planes[0], planes[2], planes[4]], [planes[0], planes[2], planes[5]], [planes[0], planes[3], planes[4]], [planes[0], planes[3], planes[5]], [planes[1], planes[2], planes[4]], [planes[1], planes[2], planes[5]], [planes[1], planes[3], planes[4]], [planes[1], planes[3], planes[5]]].map(function (coord) {
      return indexToWorld(coord);
    });
  };

  publicAPI.resetWidgetState = function () {
    if (!model.volumeMapper) {
      vtkErrorMacro('Volume mapper must be set to update representation');
      return;
    }

    if (!model.volumeMapper.getInputData()) {
      vtkErrorMacro('Volume mapper has no input data');
      return;
    }

    var data = model.volumeMapper.getInputData(); // cache transforms

    model.indexToWorld = data.getIndexToWorld();
    model.worldToIndex = data.getWorldToIndex();
    var planes = data.getExtent();
    publicAPI.setCroppingPlanes.apply(publicAPI, _toConsumableArray(planes));
  };

  publicAPI.setEnabled = macro.chain(publicAPI.setEnabled, function (enable) {
    if (cameraSub) {
      cameraSub.unsubscribe();
    }

    if (enable) {
      var camera = publicAPI.getInteractor().getCurrentRenderer().getActiveCamera();
      cameraSub = camera.onModified(publicAPI.updateRepresentation);
      publicAPI.updateRepresentation();
    }
  });

  publicAPI.setFaceHandlesEnabled = function (enabled) {
    if (model.faceHandlesEnabled !== enabled) {
      model.faceHandlesEnabled = enabled;
      publicAPI.updateRepresentation();
      publicAPI.modified();
    }
  };

  publicAPI.setEdgeHandlesEnabled = function (enabled) {
    if (model.edgeHandlesEnabled !== enabled) {
      model.edgeHandlesEnabled = enabled;
      publicAPI.updateRepresentation();
      publicAPI.modified();
    }
  };

  publicAPI.setCornerHandlesEnabled = function (enabled) {
    if (model.cornerHandlesEnabled !== enabled) {
      model.cornerHandlesEnabled = enabled;
      publicAPI.updateRepresentation();
      publicAPI.modified();
    }
  };

  publicAPI.setHandleSize = function (size) {
    if (model.handleSize !== size) {
      model.handleSize = size;
      publicAPI.updateRepresentation();
      publicAPI.modified();
    }
  };

  publicAPI.getCroppingPlanes = function () {
    return model.widgetState.planes.slice();
  };

  publicAPI.setCroppingPlanes = function () {
    for (var _len = arguments.length, planes = new Array(_len), _key = 0; _key < _len; _key++) {
      planes[_key] = arguments[_key];
    }

    publicAPI.updateWidgetState({
      planes: planes
    });
  };

  publicAPI.updateRepresentation = function () {
    if (model.widgetRep) {
      var _model$widgetRep;

      var bounds = model.volumeMapper.getBounds();

      (_model$widgetRep = model.widgetRep).placeWidget.apply(_model$widgetRep, _toConsumableArray(bounds));

      var _model$widgetState = model.widgetState,
          activeHandleIndex = _model$widgetState.activeHandleIndex,
          planes = _model$widgetState.planes;
      var bboxCorners = publicAPI.planesToBBoxCorners(planes);
      var handlePositions = publicAPI.planesToHandles(planes);
      var handleSizes = handlePositions.map(function (handle) {
        if (!handle) {
          return model.handleSize;
        }

        return publicAPI.adjustHandleSize(handle, model.handleSize);
      });
      model.widgetRep.set({
        activeHandleIndex: activeHandleIndex,
        handlePositions: handlePositions,
        bboxCorners: bboxCorners,
        handleSizes: handleSizes
      });
      publicAPI.render();
    }
  };

  publicAPI.adjustHandleSize = function (pos, size) {
    var interactor = publicAPI.getInteractor();

    if (!interactor && !interactor.getCurrentRenderer()) {
      return null;
    }

    var renderer = interactor.getCurrentRenderer();

    if (!renderer.getActiveCamera()) {
      return null;
    }

    var worldCoords = publicAPI.computeWorldToDisplay(renderer, pos[0], pos[1], pos[2]);
    var lowerLeft = publicAPI.computeDisplayToWorld(renderer, worldCoords[0] - size / 2.0, worldCoords[1] - size / 2.0, worldCoords[2]);
    var upperRight = publicAPI.computeDisplayToWorld(renderer, worldCoords[0] + size / 2.0, worldCoords[1] + size / 2.0, worldCoords[2]);
    var radius = 0.0;

    for (var i = 0; i < 3; i++) {
      radius += (upperRight[i] - lowerLeft[i]) * (upperRight[i] - lowerLeft[i]);
    }

    return Math.sqrt(radius) / 2.0;
  }; // Given display coordinates and a plane, returns the
  // point on the plane that corresponds to display coordinates.


  publicAPI.displayToPlane = function (displayCoords, planePoint, planeNormal) {
    var view = publicAPI.getInteractor().getView();
    var renderer = publicAPI.getInteractor().getCurrentRenderer();
    var camera = renderer.getActiveCamera();
    var cameraFocalPoint = camera.getFocalPoint();
    var cameraPos = camera.getPosition(); // Adapted from vtkPicker

    var focalPointDispCoords = view.worldToDisplay.apply(view, _toConsumableArray(cameraFocalPoint).concat([renderer]));
    var worldCoords = view.displayToWorld(displayCoords[0], displayCoords[1], focalPointDispCoords[2], // Use focal point for z coord
    renderer); // compute ray from camera to selection

    var ray = [0, 0, 0];

    for (var i = 0; i < 3; ++i) {
      ray[i] = worldCoords[i] - cameraPos[i];
    }

    var dop = camera.getDirectionOfProjection();
    normalize(dop);
    var rayLength = dot(dop, ray);
    var clipRange = camera.getClippingRange();
    var p1World = [0, 0, 0];
    var p2World = [0, 0, 0]; // get line segment coords from ray based on clip range

    if (camera.getParallelProjection()) {
      var tF = clipRange[0] - rayLength;
      var tB = clipRange[1] - rayLength;

      for (var _i4 = 0; _i4 < 3; _i4++) {
        p1World[_i4] = worldCoords[_i4] + tF * dop[_i4];
        p2World[_i4] = worldCoords[_i4] + tB * dop[_i4];
      }
    } else {
      var _tF = clipRange[0] / rayLength;

      var _tB = clipRange[1] / rayLength;

      for (var _i5 = 0; _i5 < 3; _i5++) {
        p1World[_i5] = cameraPos[_i5] + _tF * ray[_i5];
        p2World[_i5] = cameraPos[_i5] + _tB * ray[_i5];
      }
    }

    var r = vtkPlane.intersectWithLine(p1World, p2World, planePoint, planeNormal);
    return r.intersection ? r.x : null;
  };

  publicAPI.handleLeftButtonPress = function (callData) {
    return publicAPI.pressAction(callData);
  };

  publicAPI.handleLeftButtonRelease = function (callData) {
    return publicAPI.endMoveAction(callData);
  };

  publicAPI.handleMiddleButtonPress = function (callData) {
    return publicAPI.pressAction(callData);
  };

  publicAPI.handleMiddleButtonRelease = function (callData) {
    return publicAPI.endMoveAction(callData);
  };

  publicAPI.handleRightButtonPress = function (callData) {
    return publicAPI.pressAction(callData);
  };

  publicAPI.handleRightButtonRelease = function (callData) {
    return publicAPI.endMoveAction(callData);
  };

  publicAPI.handleMouseMove = function (callData) {
    return publicAPI.moveAction(callData);
  };

  publicAPI.pressAction = function (callData) {
    if (model.widgetState.controlState === WidgetState.IDLE) {
      var handleIndex = model.widgetRep.getEventIntersection(callData);

      if (handleIndex > -1) {
        model.activeHandleIndex = handleIndex;
        publicAPI.updateWidgetState({
          activeHandleIndex: handleIndex,
          controlState: WidgetState.CROPPING
        });
        return EVENT_ABORT;
      }
    }

    return VOID;
  };

  publicAPI.moveAction = function (callData) {
    var _model$widgetState2 = model.widgetState,
        controlState = _model$widgetState2.controlState,
        planes = _model$widgetState2.planes,
        activeHandleIndex = _model$widgetState2.activeHandleIndex;

    if (controlState === WidgetState.IDLE || activeHandleIndex === -1) {
      return VOID;
    }

    var handles = publicAPI.planesToHandles(planes);
    var mouse = [callData.position.x, callData.position.y];
    var handlePos = handles[activeHandleIndex];
    var renderer = publicAPI.getInteractor().getCurrentRenderer();
    var camera = renderer.getActiveCamera();
    var dop = camera.getDirectionOfProjection();
    var point = publicAPI.displayToPlane(mouse, handlePos, dop);

    if (!point) {
      return EVENT_ABORT;
    }

    var newPlanes = planes.slice(); // activeHandleIndex should be > -1 here

    if (activeHandleIndex < 6) {
      // face handle, so constrain to axis
      var moveAxis = Math.floor(activeHandleIndex / 2); // Constrain point to axis

      var orientation = model.volumeMapper.getInputData().getDirection();
      var offset = moveAxis * 3;
      var constraintAxis = orientation.slice(offset, offset + 3);
      var newPos = [0, 0, 0];
      var relMoveVect = [0, 0, 0];
      var projection = [0, 0, 0];
      subtract(point, handlePos, relMoveVect);
      projectVector(relMoveVect, constraintAxis, projection);
      add(handlePos, projection, newPos);
      var indexHandle = worldToIndex(newPos); // set correct plane value

      newPlanes[activeHandleIndex] = indexHandle[moveAxis];
    } else if (activeHandleIndex < 18) {
      // edge handle, so constrain to plane
      var edgeHandleIndex = activeHandleIndex - 6;
      var fixedAxis = Math.floor(edgeHandleIndex / 4);
      /**
       * edgeHandleIndex: plane, plane
       * 4: xmin, zmin
       * 5: xmin, zmax
       * 6: xmax, zmin
       * 7: xmax, zmax
       * 8: xmin, ymin
       * 9: xmin, ymax
       * 10: xmax, ymin
       * 11: xmax, ymax
       */

      var _orientation = model.volumeMapper.getInputData().getDirection();

      var _offset = fixedAxis * 3;

      var constraintPlaneNormal = _orientation.slice(_offset, _offset + 3);

      var _newPos = [0, 0, 0];
      var _relMoveVect = [0, 0, 0];
      var _projection = [0, 0, 0];
      subtract(point, handlePos, _relMoveVect);
      vtkPlane.projectVector(_relMoveVect, constraintPlaneNormal, _projection);
      add(handlePos, _projection, _newPos);

      var _indexHandle = worldToIndex(_newPos); // get the two planes that are being adjusted


      var edgeSpec = EDGE_ORDER[edgeHandleIndex % 4].slice();
      var modifiedPlanes = [];

      for (var i = 0; i < 3; ++i) {
        if (i !== fixedAxis) {
          modifiedPlanes.push(i * 2 + edgeSpec.shift());
        }
      } // set correct plane value


      modifiedPlanes.forEach(function (planeIndex) {
        // Math.floor(planeIndex / 2) is the corresponding changed
        // coordinate (that dictates the plane position)
        newPlanes[planeIndex] = _indexHandle[Math.floor(planeIndex / 2)];
      });
    } else {
      // corner handles, so no constraints
      var cornerHandleIndex = activeHandleIndex - 18;

      var _indexHandle2 = worldToIndex(point); // get the three planes that are being adjusted

      /* eslint-disable no-bitwise */


      var _modifiedPlanes = [0 + (cornerHandleIndex >> 2 & 0x1), 2 + (cornerHandleIndex >> 1 & 0x1), 4 + (cornerHandleIndex >> 0 & 0x1)];
      /* eslint-enable no-bitwise */
      // set correct plane value

      _modifiedPlanes.forEach(function (planeIndex) {
        // Math.floor(planeIndex / 2) is the corresponding changed
        // coordinate (that dictates the plane position)
        newPlanes[planeIndex] = _indexHandle2[Math.floor(planeIndex / 2)];
      });
    }

    publicAPI.setCroppingPlanes.apply(publicAPI, _toConsumableArray(newPlanes));
    return EVENT_ABORT;
  };

  publicAPI.endMoveAction = function () {
    if (model.widgetState.activeHandleIndex > -1) {
      publicAPI.updateWidgetState({
        activeHandleIndex: -1,
        controlState: WidgetState.IDLE
      });
    }
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  // volumeMapper: null,
  handleSize: 5,
  faceHandlesEnabled: false,
  edgeHandlesEnabled: false,
  cornerHandlesEnabled: true
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance
  // Have our default values override whatever is from parent class

  vtkAbstractWidget.extend(publicAPI, model, DEFAULT_VALUES, initialValues);
  CropWidgetEvents.forEach(function (eventName) {
    return macro.event(publicAPI, model, eventName);
  });
  macro.get(publicAPI, model, ['volumeMapper', 'handleSize', 'faceHandlesEnabled', 'edgeHandlesEnabled', 'cornerHandlesEnabled']); // Object methods

  vtkImageCroppingRegionsWidget(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkImageCroppingRegionsWidget'); // ----------------------------------------------------------------------------

var vtkImageCroppingRegionsWidget$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkImageCroppingRegionsWidget$1 as default, extend, newInstance };
