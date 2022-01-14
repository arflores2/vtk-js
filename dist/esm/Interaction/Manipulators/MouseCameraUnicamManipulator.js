import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _slicedToArray from '@babel/runtime/helpers/slicedToArray';
import vtkCompositeCameraManipulator from './CompositeCameraManipulator.js';
import vtkCompositeMouseManipulator from './CompositeMouseManipulator.js';
import vtkInteractorStyleConstants from '../../Rendering/Core/InteractorStyle/Constants.js';
import vtkMouseCameraUnicamRotateManipulator from './MouseCameraUnicamRotateManipulator.js';
import macro from '../../macros.js';
import { g as subtract, w as multiplyScalar, f as normalize, d as dot, r as radiansFromDegrees, j as cross } from '../../Common/Core/Math/index.js';

var States = vtkInteractorStyleConstants.States; // ----------------------------------------------------------------------------
// vtkMouseCameraUnicamManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseCameraUnicamManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMouseCameraUnicamManipulator');
  model.state = States.IS_NONE;
  model.rotateManipulator = vtkMouseCameraUnicamRotateManipulator.newInstance({
    button: model.button,
    shift: model.shift,
    control: model.control,
    alt: model.alt,
    dragEnabled: model.dragEnabled,
    scrollEnabled: model.scrollEnabled,
    displayFocusSphereOnButtonDown: false
  }); //----------------------------------------------------------------------------

  var normalize$1 = function normalize(position, interactor) {
    var _interactor$getView$g = interactor.getView().getSize(),
        _interactor$getView$g2 = _slicedToArray(_interactor$getView$g, 2),
        width = _interactor$getView$g2[0],
        height = _interactor$getView$g2[1];

    var nx = -1.0 + 2.0 * position.x / width;
    var ny = -1.0 + 2.0 * position.y / height;
    return {
      x: nx,
      y: ny
    };
  }; // Given a 3D point & a vtkCamera, compute the vectors that extend
  // from the projection of the center of projection to the center of
  // the right-edge and the center of the top-edge onto the plane
  // containing the 3D point & with normal parallel to the camera's
  // projection plane.


  var getRightVAndUpV = function getRightVAndUpV(downPoint, interactor) {
    // Compute the horizontal & vertical scaling ('scalex' and 'scaley')
    // factors as function of the down point & camera params.
    var camera = interactor.findPokedRenderer().getActiveCamera();
    var cameraPosition = camera.getPosition();
    var cameraToPointVec = [0, 0, 0]; // Construct a vector from the viewing position to the picked point

    subtract(downPoint, cameraPosition, cameraToPointVec);

    if (camera.getParallelProjection()) {
      multiplyScalar(cameraToPointVec, camera.getParallelScale());
    } // Get shortest distance 'l' between the viewing position and
    // plane parallel to the projection plane that contains the 'downPoint'.


    var atV = camera.getViewPlaneNormal();
    normalize(atV);
    var l = dot(cameraToPointVec, atV);
    var viewAngle = radiansFromDegrees(camera.getViewAngle());

    var _interactor$getView$g3 = interactor.getView().getSize(),
        _interactor$getView$g4 = _slicedToArray(_interactor$getView$g3, 2),
        width = _interactor$getView$g4[0],
        height = _interactor$getView$g4[1];

    var scaleX = width / height * (2 * l * Math.tan(viewAngle / 2) / 2);
    var scaleY = 2 * l * Math.tan(viewAngle / 2) / 2; // Construct the camera offset vector as function of delta mouse X & Y.

    var upV = camera.getViewUp();
    var rightV = [];
    cross(upV, atV, rightV); // (Make sure 'upV' is orthogonal to 'atV' & 'rightV')

    cross(atV, rightV, upV);
    normalize(rightV);
    normalize(upV);
    multiplyScalar(rightV, scaleX);
    multiplyScalar(upV, scaleY);
    return {
      rightV: rightV,
      upV: upV
    };
  }; //----------------------------------------------------------------------------


  var choose = function choose(interactor, position) {
    var normalizedPosition = normalize$1(position, interactor);
    var normalizedPreviousPosition = normalize$1(model.previousPosition, interactor);
    var delta = {
      x: normalizedPosition.x - normalizedPreviousPosition.x,
      y: normalizedPosition.y - normalizedPreviousPosition.y
    };
    model.previousPosition = position;
    var deltaT = Date.now() / 1000 - model.time;
    model.dist += Math.sqrt(Math.pow(delta.x, 2) + Math.pow(delta.y, 2));
    var sDelta = {
      x: position.x - model.startPosition.x,
      y: position.y - model.startPosition.y
    };
    var len = Math.sqrt(Math.pow(sDelta.x, 2) + Math.pow(sDelta.y, 2));

    if (Math.abs(sDelta.y) / len > 0.9 && deltaT > 0.05) {
      model.state = States.IS_DOLLY;
    } else if (deltaT >= 0.1 || model.dist >= 0.03) {
      if (Math.abs(sDelta.x) / len > 0.6) {
        model.state = States.IS_PAN;
      } else {
        model.state = States.IS_DOLLY;
      }
    }
  }; //----------------------------------------------------------------------------
  // Transform mouse horizontal & vertical movements to a world
  // space offset for the camera that maintains pick correlation.


  var pan = function pan(interactor, position) {
    var renderer = interactor.findPokedRenderer();
    var normalizedPosition = normalize$1(position, interactor);
    var normalizedPreviousPosition = normalize$1(model.previousPosition, interactor);
    var delta = {
      x: normalizedPosition.x - normalizedPreviousPosition.x,
      y: normalizedPosition.y - normalizedPreviousPosition.y
    };
    var camera = renderer.getActiveCamera();
    model.previousPosition = position;

    var _getRightVAndUpV = getRightVAndUpV(model.downPoint, interactor),
        rightV = _getRightVAndUpV.rightV,
        upV = _getRightVAndUpV.upV;

    var offset = [];

    for (var index = 0; index < 3; index++) {
      offset[index] = delta.x * rightV[index] + delta.y * upV[index];
    }

    camera.translate.apply(camera, offset);
    renderer.resetCameraClippingRange();
    interactor.render();
  }; //----------------------------------------------------------------------------


  var dolly = function dolly(interactor, position) {
    var renderer = interactor.findPokedRenderer();
    var normalizedPosition = normalize$1(position, interactor);
    var normalizedPreviousPosition = normalize$1(model.previousPosition, interactor);
    var delta = {
      x: normalizedPosition.x - normalizedPreviousPosition.x,
      y: normalizedPosition.y - normalizedPreviousPosition.y
    };
    var camera = renderer.getActiveCamera();
    var cameraPosition = camera.getPosition(); // 1. Handle dollying

    if (camera.getParallelProjection()) {
      camera.zoom(1 - delta.y);
    } else {
      var offset1 = [];
      subtract(model.downPoint, cameraPosition, offset1);
      multiplyScalar(offset1, delta.y * -4);
      camera.translate.apply(camera, offset1);
    } // 2. Now handle side-to-side panning


    var _getRightVAndUpV2 = getRightVAndUpV(model.downPoint, interactor),
        offset2 = _getRightVAndUpV2.rightV;

    multiplyScalar(offset2, delta.x);
    camera.translate.apply(camera, _toConsumableArray(offset2));
    renderer.resetCameraClippingRange();
    interactor.render();
  }; //----------------------------------------------------------------------------
  // Public API methods
  //----------------------------------------------------------------------------


  publicAPI.onButtonDown = function (interactor, renderer, position) {
    model.buttonPressed = true;
    model.startPosition = position;
    model.previousPosition = position;
    model.time = Date.now() / 1000.0;
    model.dist = 0; // Picking is delegated to the rotate manipulator

    model.rotateManipulator.onButtonDown(interactor, renderer, position);
    model.downPoint = model.rotateManipulator.getDownPoint();
  }; //----------------------------------------------------------------------------


  publicAPI.onMouseMove = function (interactor, renderer, position) {
    if (!model.buttonPressed) {
      return;
    }

    if (model.rotateManipulator.getState() === States.IS_ROTATE) {
      model.rotateManipulator.onMouseMove(interactor, renderer, position);
    } else {
      switch (model.state) {
        case States.IS_NONE:
          choose(interactor, position);
          break;

        case States.IS_PAN:
          pan(interactor, position);
          break;

        case States.IS_DOLLY:
          dolly(interactor, position);
          break;
      }
    }

    model.previousPosition = position;
  }; //--------------------------------------------------------------------------


  publicAPI.onButtonUp = function (interactor) {
    model.buttonPressed = false;

    if (model.state === States.IS_NONE) {
      model.rotateManipulator.onButtonUp(interactor);
    }

    model.state = States.IS_NONE;
  };

  publicAPI.getUseWorldUpVec = function () {
    return model.rotateManipulator.getUseWorldUpVec();
  };

  publicAPI.setUseWorldUpVec = function (useWorldUpVec) {
    model.rotateManipulator.setUseWorldUpVec(useWorldUpVec);
  };

  publicAPI.getWorldUpVec = function () {
    return model.rotateManipulator.getWorldUpVec();
  };

  publicAPI.setWorldUpVec = function (x, y, z) {
    model.rotateManipulator.setWorldUpVec(x, y, z);
  };

  publicAPI.getUseHardwareSelector = function () {
    return model.rotateManipulator.getUseHardwareSelector();
  };

  publicAPI.setUseHardwareSelector = function (useHardwareSelector) {
    model.rotateManipulator.setUseHardwareSelector(useHardwareSelector);
  };

  publicAPI.getFocusSphereColor = function () {
    model.rotateManipulator.getFocusSphereColor();
  };

  publicAPI.setFocusSphereColor = function (r, g, b) {
    model.rotateManipulator.setFocusSphereColor(r, g, b);
  };

  publicAPI.getFocusSphereRadiusFactor = function () {
    return model.rotateManipulator.getFocusSphereRadiusFactor();
  };

  publicAPI.setFocusSphereRadiusFactor = function (focusSphereRadiusFactor) {
    model.rotateManipulator.setFocusSphereRadiusFactor(focusSphereRadiusFactor);
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  macro.obj(publicAPI, model);
  vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues);
  vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues); // Object specific methods

  vtkMouseCameraUnicamManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkMouseCameraUnicamManipulator'); // ----------------------------------------------------------------------------

var vtkMouseCameraUnicamManipulator$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkMouseCameraUnicamManipulator$1 as default, extend, newInstance };
