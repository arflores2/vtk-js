import { mat4, vec3 } from 'gl-matrix';
import macro from '../../macros.js';
import vtkCompositeCameraManipulator from './CompositeCameraManipulator.js';
import vtkCompositeMouseManipulator from './CompositeMouseManipulator.js';
import { w as multiplyScalar, d as dot, k as add, r as radiansFromDegrees, j as cross } from '../../Common/Core/Math/index.js';

// vtkMouseCameraTrackballRotateManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseCameraTrackballRotateManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMouseCameraTrackballRotateManipulator');
  var newCamPos = new Float64Array(3);
  var newFp = new Float64Array(3);
  var newViewUp = new Float64Array(3);
  var trans = new Float64Array(16);
  var v2 = new Float64Array(3);
  var centerNeg = new Float64Array(3);
  var direction = new Float64Array(3);

  publicAPI.onButtonDown = function (interactor, renderer, position) {
    model.previousPosition = position;
  };

  publicAPI.onMouseMove = function (interactor, renderer, position) {
    if (!position) {
      return;
    }

    var camera = renderer.getActiveCamera();
    var cameraPos = camera.getPosition();
    var cameraFp = camera.getFocalPoint();
    mat4.identity(trans);
    var center = model.center,
        rotationFactor = model.rotationFactor;

    if (model.useFocalPointAsCenterOfRotation) {
      center[0] = cameraFp[0];
      center[1] = cameraFp[1];
      center[2] = cameraFp[2];
    }

    var dx = model.previousPosition.x - position.x;
    var dy = model.previousPosition.y - position.y;
    var size = interactor.getView().getSize(); // Azimuth

    var viewUp = camera.getViewUp();

    if (model.useWorldUpVec) {
      var centerOfRotation = new Float64Array(3);
      vec3.copy(centerOfRotation, model.worldUpVec); // Compute projection of cameraPos onto worldUpVec

      multiplyScalar(centerOfRotation, dot(cameraPos, model.worldUpVec) / dot(model.worldUpVec, model.worldUpVec));
      add(center, centerOfRotation, centerOfRotation);
      mat4.translate(trans, trans, centerOfRotation);
      mat4.rotate(trans, trans, radiansFromDegrees(360.0 * dx / size[0] * rotationFactor), model.worldUpVec); // Translate back

      centerOfRotation[0] = -centerOfRotation[0];
      centerOfRotation[1] = -centerOfRotation[1];
      centerOfRotation[2] = -centerOfRotation[2];
      mat4.translate(trans, trans, centerOfRotation);
      mat4.translate(trans, trans, center);
    } else {
      mat4.translate(trans, trans, center);
      mat4.rotate(trans, trans, radiansFromDegrees(360.0 * dx / size[0] * rotationFactor), viewUp);
    } // Elevation


    cross(camera.getDirectionOfProjection(), viewUp, v2);
    mat4.rotate(trans, trans, radiansFromDegrees(-360.0 * dy / size[1] * rotationFactor), v2); // Translate back

    centerNeg[0] = -center[0];
    centerNeg[1] = -center[1];
    centerNeg[2] = -center[2];
    mat4.translate(trans, trans, centerNeg); // Apply transformation to camera position, focal point, and view up

    vec3.transformMat4(newCamPos, cameraPos, trans);
    vec3.transformMat4(newFp, cameraFp, trans);
    direction[0] = viewUp[0] + cameraPos[0];
    direction[1] = viewUp[1] + cameraPos[1];
    direction[2] = viewUp[2] + cameraPos[2];
    vec3.transformMat4(newViewUp, direction, trans);
    camera.setPosition(newCamPos[0], newCamPos[1], newCamPos[2]);
    camera.setFocalPoint(newFp[0], newFp[1], newFp[2]);
    camera.setViewUp(newViewUp[0] - newCamPos[0], newViewUp[1] - newCamPos[1], newViewUp[2] - newCamPos[2]);
    camera.orthogonalizeViewUp();
    renderer.resetCameraClippingRange();

    if (interactor.getLightFollowCamera()) {
      renderer.updateLightsGeometryToFollowCamera();
    }

    model.previousPosition = position;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  useWorldUpVec: false,
  // set WorldUpVector to be y-axis by default
  worldUpVec: [0, 1, 0],
  useFocalPointAsCenterOfRotation: false
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  macro.obj(publicAPI, model);
  vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues);
  vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues); // Create get-set macro

  macro.setGet(publicAPI, model, ['useWorldUpVec']);
  macro.setGetArray(publicAPI, model, ['worldUpVec'], 3);
  macro.setGet(publicAPI, model, ['useFocalPointAsCenterOfRotation']); // Object specific methods

  vtkMouseCameraTrackballRotateManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkMouseCameraTrackballRotateManipulator'); // ----------------------------------------------------------------------------

var vtkMouseCameraTrackballRotateManipulator$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkMouseCameraTrackballRotateManipulator$1 as default, extend, newInstance };
