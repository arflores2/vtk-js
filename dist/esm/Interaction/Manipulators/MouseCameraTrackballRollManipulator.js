import { mat4, vec3 } from 'gl-matrix';
import macro from '../../macros.js';
import vtkCompositeCameraManipulator from './CompositeCameraManipulator.js';
import vtkCompositeMouseManipulator from './CompositeMouseManipulator.js';
import { r as radiansFromDegrees, x as degreesFromRadians } from '../../Common/Core/Math/index.js';

// vtkMouseCameraTrackballRollManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseCameraTrackballRollManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMouseCameraTrackballRollManipulator');
  var axis = new Float64Array(3);
  var direction = new Float64Array(3);
  var centerNeg = new Float64Array(3);
  var transform = new Float64Array(16);
  var newCamPos = new Float64Array(3);
  var newFp = new Float64Array(3);
  var newViewUp = new Float64Array(3);

  publicAPI.onButtonDown = function (interactor, renderer, position) {
    model.previousPosition = position;
  };

  publicAPI.onMouseMove = function (interactor, renderer, position) {
    if (!position) {
      return;
    }

    var camera = renderer.getActiveCamera(); // compute view vector (rotation axis)

    var cameraPos = camera.getPosition();
    var cameraFp = camera.getFocalPoint();
    var viewUp = camera.getViewUp();
    axis[0] = cameraFp[0] - cameraPos[0];
    axis[1] = cameraFp[1] - cameraPos[1];
    axis[2] = cameraFp[2] - cameraPos[2]; // compute the angle of rotation
    // - first compute the two vectors (center to mouse)

    publicAPI.computeDisplayCenter(interactor.getInteractorStyle(), renderer);
    var x1 = model.previousPosition.x - model.displayCenter[0];
    var x2 = position.x - model.displayCenter[0];
    var y1 = model.previousPosition.y - model.displayCenter[1];
    var y2 = position.y - model.displayCenter[1];

    if (x2 === 0 && y2 === 0 || x1 === 0 && y1 === 0) {
      // don't ever want to divide by zero
      return;
    } // - divide by magnitudes to get angle


    var angle = degreesFromRadians((x1 * y2 - y1 * x2) / (Math.sqrt(x1 * x1 + y1 * y1) * Math.sqrt(x2 * x2 + y2 * y2)));
    var center = model.center;
    mat4.identity(transform);
    centerNeg[0] = -center[0];
    centerNeg[1] = -center[1];
    centerNeg[2] = -center[2]; // Translate to center

    mat4.translate(transform, transform, center); // roll

    mat4.rotate(transform, transform, radiansFromDegrees(angle), axis); // Translate back

    mat4.translate(transform, transform, centerNeg); // Apply transformation to camera position, focal point, and view up

    vec3.transformMat4(newCamPos, cameraPos, transform);
    vec3.transformMat4(newFp, cameraFp, transform);
    direction[0] = viewUp[0] + cameraPos[0];
    direction[1] = viewUp[1] + cameraPos[1];
    direction[2] = viewUp[2] + cameraPos[2];
    vec3.transformMat4(newViewUp, direction, transform);
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


var DEFAULT_VALUES = {}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  macro.obj(publicAPI, model);
  vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues);
  vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues); // Object specific methods

  vtkMouseCameraTrackballRollManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkMouseCameraTrackballRollManipulator'); // ----------------------------------------------------------------------------

var vtkMouseCameraTrackballRollManipulator$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkMouseCameraTrackballRollManipulator$1 as default, extend, newInstance };
