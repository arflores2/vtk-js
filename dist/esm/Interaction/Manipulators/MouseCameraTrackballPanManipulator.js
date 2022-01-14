import macro from '../../macros.js';
import vtkCompositeCameraManipulator from './CompositeCameraManipulator.js';
import vtkCompositeMouseManipulator from './CompositeMouseManipulator.js';
import { j as cross } from '../../Common/Core/Math/index.js';

// vtkMouseCameraTrackballPanManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseCameraTrackballPanManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMouseCameraTrackballPanManipulator');

  publicAPI.onButtonDown = function (interactor, renderer, position) {
    model.previousPosition = position;
  };

  publicAPI.onMouseMove = function (interactor, renderer, position) {
    if (!position) {
      return;
    }

    var pos = position;
    var lastPos = model.previousPosition;
    model.previousPosition = position;
    var camera = renderer.getActiveCamera();
    var camPos = camera.getPosition();
    var fp = camera.getFocalPoint();

    if (camera.getParallelProjection()) {
      camera.orthogonalizeViewUp();
      var up = camera.getViewUp();
      var vpn = camera.getViewPlaneNormal();
      var right = [0, 0, 0];
      cross(vpn, up, right); // These are different because y is flipped.

      var height = interactor.getView().getSize()[1];
      var dx = (pos.x - lastPos.x) / height;
      var dy = (lastPos.y - pos.y) / height;
      var scale = camera.getParallelScale();
      dx *= scale * 2.0;
      dy *= scale * 2.0;
      var tmp = right[0] * dx + up[0] * dy;
      camPos[0] += tmp;
      fp[0] += tmp;
      tmp = right[1] * dx + up[1] * dy;
      camPos[1] += tmp;
      fp[1] += tmp;
      tmp = right[2] * dx + up[2] * dy;
      camPos[2] += tmp;
      fp[2] += tmp;
      camera.setPosition(camPos[0], camPos[1], camPos[2]);
      camera.setFocalPoint(fp[0], fp[1], fp[2]);
    } else {
      var center = model.center;
      var style = interactor.getInteractorStyle();
      var focalDepth = style.computeWorldToDisplay(renderer, center[0], center[1], center[2])[2];
      var worldPoint = style.computeDisplayToWorld(renderer, pos.x, pos.y, focalDepth);
      var lastWorldPoint = style.computeDisplayToWorld(renderer, lastPos.x, lastPos.y, focalDepth);
      var newCamPos = [camPos[0] + (lastWorldPoint[0] - worldPoint[0]), camPos[1] + (lastWorldPoint[1] - worldPoint[1]), camPos[2] + (lastWorldPoint[2] - worldPoint[2])];
      var newFp = [fp[0] + (lastWorldPoint[0] - worldPoint[0]), fp[1] + (lastWorldPoint[1] - worldPoint[1]), fp[2] + (lastWorldPoint[2] - worldPoint[2])];
      camera.setPosition(newCamPos[0], newCamPos[1], newCamPos[2]);
      camera.setFocalPoint(newFp[0], newFp[1], newFp[2]);
    }

    renderer.resetCameraClippingRange();

    if (interactor.getLightFollowCamera()) {
      renderer.updateLightsGeometryToFollowCamera();
    }
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

  vtkMouseCameraTrackballPanManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkMouseCameraTrackballPanManipulator'); // ----------------------------------------------------------------------------

var vtkMouseCameraTrackballPanManipulator$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkMouseCameraTrackballPanManipulator$1 as default, extend, newInstance };
