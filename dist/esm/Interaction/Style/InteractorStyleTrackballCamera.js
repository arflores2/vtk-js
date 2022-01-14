import macro from '../../macros.js';
import vtkInteractorStyle from '../../Rendering/Core/InteractorStyle.js';
import vtkInteractorStyleConstants from '../../Rendering/Core/InteractorStyle/Constants.js';
import { x as degreesFromRadians } from '../../Common/Core/Math/index.js';
import { Device, Input } from '../../Rendering/Core/RenderWindowInteractor/Constants.js';

var States = vtkInteractorStyleConstants.States;
/* eslint-disable no-lonely-if */
// ----------------------------------------------------------------------------
// vtkInteractorStyleTrackballCamera methods
// ----------------------------------------------------------------------------

function vtkInteractorStyleTrackballCamera(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleTrackballCamera'); // Public API methods

  publicAPI.handleMouseMove = function (callData) {
    var pos = callData.position;
    var renderer = callData.pokedRenderer;

    switch (model.state) {
      case States.IS_ROTATE:
        publicAPI.handleMouseRotate(renderer, pos);
        publicAPI.invokeInteractionEvent({
          type: 'InteractionEvent'
        });
        break;

      case States.IS_PAN:
        publicAPI.handleMousePan(renderer, pos);
        publicAPI.invokeInteractionEvent({
          type: 'InteractionEvent'
        });
        break;

      case States.IS_DOLLY:
        publicAPI.handleMouseDolly(renderer, pos);
        publicAPI.invokeInteractionEvent({
          type: 'InteractionEvent'
        });
        break;

      case States.IS_SPIN:
        publicAPI.handleMouseSpin(renderer, pos);
        publicAPI.invokeInteractionEvent({
          type: 'InteractionEvent'
        });
        break;
    }

    model.previousPosition = pos;
  }; //----------------------------------------------------------------------------


  publicAPI.handleButton3D = function (ed) {
    if (ed && ed.pressed && ed.device === Device.RightController && ed.input === Input.TrackPad) {
      publicAPI.startCameraPose();
      return;
    }

    if (ed && !ed.pressed && ed.device === Device.RightController && ed.input === Input.TrackPad && model.state === States.IS_CAMERA_POSE) {
      publicAPI.endCameraPose(); // return;
    }
  };

  publicAPI.handleMove3D = function (ed) {
    switch (model.state) {
      case States.IS_CAMERA_POSE:
        publicAPI.updateCameraPose(ed);
        break;
    }
  };

  publicAPI.updateCameraPose = function (ed) {
    // move the world in the direction of the
    // controller
    var camera = ed.pokedRenderer.getActiveCamera();
    var oldTrans = camera.getPhysicalTranslation(); // look at the y axis to determine how fast / what direction to move

    var speed = ed.gamepad.axes[1]; // 0.05 meters / frame movement

    var pscale = speed * 0.05 * camera.getPhysicalScale(); // convert orientation to world coordinate direction

    var dir = camera.physicalOrientationToWorldDirection(ed.orientation);
    camera.setPhysicalTranslation(oldTrans[0] + dir[0] * pscale, oldTrans[1] + dir[1] * pscale, oldTrans[2] + dir[2] * pscale);
  }; //----------------------------------------------------------------------------


  publicAPI.handleLeftButtonPress = function (callData) {
    var pos = callData.position;
    model.previousPosition = pos;

    if (callData.shiftKey) {
      if (callData.controlKey || callData.altKey) {
        publicAPI.startDolly();
      } else {
        publicAPI.startPan();
      }
    } else {
      if (callData.controlKey || callData.altKey) {
        publicAPI.startSpin();
      } else {
        publicAPI.startRotate();
      }
    }
  }; //--------------------------------------------------------------------------


  publicAPI.handleLeftButtonRelease = function () {
    switch (model.state) {
      case States.IS_DOLLY:
        publicAPI.endDolly();
        break;

      case States.IS_PAN:
        publicAPI.endPan();
        break;

      case States.IS_SPIN:
        publicAPI.endSpin();
        break;

      case States.IS_ROTATE:
        publicAPI.endRotate();
        break;
    }
  }; //----------------------------------------------------------------------------


  publicAPI.handleStartMouseWheel = function (callData) {
    publicAPI.startDolly();
    publicAPI.handleMouseWheel(callData);
  }; //--------------------------------------------------------------------------


  publicAPI.handleEndMouseWheel = function () {
    publicAPI.endDolly();
  }; //----------------------------------------------------------------------------


  publicAPI.handleStartPinch = function (callData) {
    model.previousScale = callData.scale;
    publicAPI.startDolly();
  }; //--------------------------------------------------------------------------


  publicAPI.handleEndPinch = function () {
    publicAPI.endDolly();
  }; //----------------------------------------------------------------------------


  publicAPI.handleStartRotate = function (callData) {
    model.previousRotation = callData.rotation;
    publicAPI.startRotate();
  }; //--------------------------------------------------------------------------


  publicAPI.handleEndRotate = function () {
    publicAPI.endRotate();
  }; //----------------------------------------------------------------------------


  publicAPI.handleStartPan = function (callData) {
    model.previousTranslation = callData.translation;
    publicAPI.startPan();
  }; //--------------------------------------------------------------------------


  publicAPI.handleEndPan = function () {
    publicAPI.endPan();
  }; //----------------------------------------------------------------------------


  publicAPI.handlePinch = function (callData) {
    publicAPI.dollyByFactor(callData.pokedRenderer, callData.scale / model.previousScale);
    model.previousScale = callData.scale;
  }; //----------------------------------------------------------------------------


  publicAPI.handlePan = function (callData) {
    var camera = callData.pokedRenderer.getActiveCamera(); // Calculate the focal depth since we'll be using it a lot

    var viewFocus = camera.getFocalPoint();
    viewFocus = publicAPI.computeWorldToDisplay(callData.pokedRenderer, viewFocus[0], viewFocus[1], viewFocus[2]);
    var focalDepth = viewFocus[2];
    var trans = callData.translation;
    var lastTrans = model.previousTranslation;
    var newPickPoint = publicAPI.computeDisplayToWorld(callData.pokedRenderer, viewFocus[0] + trans[0] - lastTrans[0], viewFocus[1] + trans[1] - lastTrans[1], focalDepth); // Has to recalc old mouse point since the viewport has moved,
    // so can't move it outside the loop

    var oldPickPoint = publicAPI.computeDisplayToWorld(callData.pokedRenderer, viewFocus[0], viewFocus[1], focalDepth); // Camera motion is reversed

    var motionVector = [];
    motionVector[0] = oldPickPoint[0] - newPickPoint[0];
    motionVector[1] = oldPickPoint[1] - newPickPoint[1];
    motionVector[2] = oldPickPoint[2] - newPickPoint[2];
    viewFocus = camera.getFocalPoint();
    var viewPoint = camera.getPosition();
    camera.setFocalPoint(motionVector[0] + viewFocus[0], motionVector[1] + viewFocus[1], motionVector[2] + viewFocus[2]);
    camera.setPosition(motionVector[0] + viewPoint[0], motionVector[1] + viewPoint[1], motionVector[2] + viewPoint[2]);

    if (model.interactor.getLightFollowCamera()) {
      callData.pokedRenderer.updateLightsGeometryToFollowCamera();
    }

    camera.orthogonalizeViewUp();
    model.previousTranslation = callData.translation;
  }; //----------------------------------------------------------------------------


  publicAPI.handleRotate = function (callData) {
    var camera = callData.pokedRenderer.getActiveCamera();
    camera.roll(callData.rotation - model.previousRotation);
    camera.orthogonalizeViewUp();
    model.previousRotation = callData.rotation;
  }; //--------------------------------------------------------------------------


  publicAPI.handleMouseRotate = function (renderer, position) {
    var rwi = model.interactor;
    var dx = position.x - model.previousPosition.x;
    var dy = position.y - model.previousPosition.y;
    var size = rwi.getView().getViewportSize(renderer);
    var deltaElevation = -0.1;
    var deltaAzimuth = -0.1;

    if (size[0] && size[1]) {
      deltaElevation = -20.0 / size[1];
      deltaAzimuth = -20.0 / size[0];
    }

    var rxf = dx * deltaAzimuth * model.motionFactor;
    var ryf = dy * deltaElevation * model.motionFactor;
    var camera = renderer.getActiveCamera();

    if (!Number.isNaN(rxf) && !Number.isNaN(ryf)) {
      camera.azimuth(rxf);
      camera.elevation(ryf);
      camera.orthogonalizeViewUp();
    }

    if (model.autoAdjustCameraClippingRange) {
      renderer.resetCameraClippingRange();
    }

    if (rwi.getLightFollowCamera()) {
      renderer.updateLightsGeometryToFollowCamera();
    }
  }; //--------------------------------------------------------------------------


  publicAPI.handleMouseSpin = function (renderer, position) {
    var rwi = model.interactor;
    var camera = renderer.getActiveCamera();
    var center = rwi.getView().getViewportCenter(renderer);
    var oldAngle = degreesFromRadians(Math.atan2(model.previousPosition.y - center[1], model.previousPosition.x - center[0]));
    var newAngle = degreesFromRadians(Math.atan2(position.y - center[1], position.x - center[0])) - oldAngle;

    if (!Number.isNaN(newAngle)) {
      camera.roll(newAngle);
      camera.orthogonalizeViewUp();
    }
  }; //--------------------------------------------------------------------------


  publicAPI.handleMousePan = function (renderer, position) {
    var camera = renderer.getActiveCamera(); // Calculate the focal depth since we'll be using it a lot

    var viewFocus = camera.getFocalPoint();
    viewFocus = publicAPI.computeWorldToDisplay(renderer, viewFocus[0], viewFocus[1], viewFocus[2]);
    var focalDepth = viewFocus[2];
    var newPickPoint = publicAPI.computeDisplayToWorld(renderer, position.x, position.y, focalDepth); // Has to recalc old mouse point since the viewport has moved,
    // so can't move it outside the loop

    var oldPickPoint = publicAPI.computeDisplayToWorld(renderer, model.previousPosition.x, model.previousPosition.y, focalDepth); // Camera motion is reversed

    var motionVector = [];
    motionVector[0] = oldPickPoint[0] - newPickPoint[0];
    motionVector[1] = oldPickPoint[1] - newPickPoint[1];
    motionVector[2] = oldPickPoint[2] - newPickPoint[2];
    viewFocus = camera.getFocalPoint();
    var viewPoint = camera.getPosition();
    camera.setFocalPoint(motionVector[0] + viewFocus[0], motionVector[1] + viewFocus[1], motionVector[2] + viewFocus[2]);
    camera.setPosition(motionVector[0] + viewPoint[0], motionVector[1] + viewPoint[1], motionVector[2] + viewPoint[2]);

    if (model.interactor.getLightFollowCamera()) {
      renderer.updateLightsGeometryToFollowCamera();
    }
  }; //----------------------------------------------------------------------------


  publicAPI.handleMouseDolly = function (renderer, position) {
    var dy = position.y - model.previousPosition.y;
    var rwi = model.interactor;
    var center = rwi.getView().getViewportCenter(renderer);
    var dyf = model.motionFactor * dy / center[1];
    publicAPI.dollyByFactor(renderer, Math.pow(1.1, dyf));
  }; //----------------------------------------------------------------------------


  publicAPI.handleMouseWheel = function (callData) {
    var dyf = 1 - callData.spinY / model.zoomFactor;
    publicAPI.dollyByFactor(callData.pokedRenderer, dyf);
  }; //----------------------------------------------------------------------------


  publicAPI.dollyByFactor = function (renderer, factor) {
    if (Number.isNaN(factor)) {
      return;
    }

    var camera = renderer.getActiveCamera();

    if (camera.getParallelProjection()) {
      camera.setParallelScale(camera.getParallelScale() / factor);
    } else {
      camera.dolly(factor);

      if (model.autoAdjustCameraClippingRange) {
        renderer.resetCameraClippingRange();
      }
    }

    if (model.interactor.getLightFollowCamera()) {
      renderer.updateLightsGeometryToFollowCamera();
    }
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  motionFactor: 10.0,
  zoomFactor: 10.0
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkInteractorStyle.extend(publicAPI, model, initialValues); // Create get-set macros

  macro.setGet(publicAPI, model, ['motionFactor', 'zoomFactor']); // For more macro methods, see "Sources/macros.js"
  // Object specific methods

  vtkInteractorStyleTrackballCamera(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkInteractorStyleTrackballCamera'); // ----------------------------------------------------------------------------

var vtkInteractorStyleTrackballCamera$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkInteractorStyleTrackballCamera$1 as default, extend, newInstance };
