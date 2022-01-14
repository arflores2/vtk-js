import macro from '../../macros.js';
import { g as subtract, j as cross, d as dot, w as multiplyScalar, k as add } from '../../Common/Core/Math/index.js';

function projectDisplayToLine(x, y, lineOrigin, lineDirection, renderer, glRenderWindow) {
  var near = glRenderWindow.displayToWorld(x, y, 0, renderer);
  var far = glRenderWindow.displayToWorld(x, y, 1, renderer);
  var viewDir = [0, 0, 0];
  subtract(far, near, viewDir);
  var normal = [0, 0, 0];
  cross(lineDirection, viewDir, normal);
  cross(normal, viewDir, normal);
  var numerator = dot([near[0] - lineOrigin[0], near[1] - lineOrigin[1], near[2] - lineOrigin[2]], normal);
  var denominator = dot(normal, lineDirection);
  var result = lineDirection.slice();
  multiplyScalar(result, numerator / denominator);
  add(lineOrigin, result, result);
  return result;
} // ----------------------------------------------------------------------------
// vtkLineManipulator methods
// ----------------------------------------------------------------------------

function vtkLineManipulator(publicAPI, model) {
  // Set our classNae
  model.classHierarchy.push('vtkLineManipulator'); // --------------------------------------------------------------------------

  publicAPI.handleEvent = function (callData, glRenderWindow) {
    return projectDisplayToLine(callData.position.x, callData.position.y, model.origin, model.normal, callData.pokedRenderer, glRenderWindow);
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  origin: [0, 0, 0],
  normal: [0, 0, 1]
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  macro.obj(publicAPI, model);
  macro.setGetArray(publicAPI, model, ['origin', 'normal'], 3);
  vtkLineManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkLineManipulator'); // ----------------------------------------------------------------------------

var vtkLineManipulator$1 = {
  projectDisplayToLine: projectDisplayToLine,
  extend: extend,
  newInstance: newInstance
};

export { vtkLineManipulator$1 as default, extend, newInstance, projectDisplayToLine };
