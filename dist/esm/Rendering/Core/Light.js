import macro from '../../macros.js';
import { f as normalize, r as radiansFromDegrees } from '../../Common/Core/Math/index.js';

var LIGHT_TYPES = ['HeadLight', 'CameraLight', 'SceneLight']; // ----------------------------------------------------------------------------
// vtkLight methods
// ----------------------------------------------------------------------------

function vtkLight(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLight');

  publicAPI.getTransformedPosition = function () {
    if (model.transformMatrix) {
      return []; // FIXME !!!!
    }

    return [].concat(model.position);
  };

  publicAPI.getTransformedFocalPoint = function () {
    if (model.transformMatrix) {
      return []; // FIXME !!!!
    }

    return [].concat(model.focalPoint);
  };

  publicAPI.getDirection = function () {
    if (model.directionMTime < model.mtime) {
      model.direction[0] = model.focalPoint[0] - model.position[0];
      model.direction[1] = model.focalPoint[1] - model.position[1];
      model.direction[2] = model.focalPoint[2] - model.position[2];
      normalize(model.direction);
      model.directionMTime = model.mtime;
    }

    return model.direction;
  };

  publicAPI.setDirectionAngle = function (elevation, azimuth) {
    var elevationRadians = radiansFromDegrees(elevation);
    var azimuthRadians = radiansFromDegrees(azimuth);
    publicAPI.setPosition(Math.cos(elevationRadians) * Math.sin(azimuthRadians), Math.sin(elevationRadians), Math.cos(elevationRadians) * Math.cos(azimuthRadians));
    publicAPI.setFocalPoint(0, 0, 0);
    publicAPI.setPositional(0);
  };

  publicAPI.setLightTypeToHeadLight = function () {
    publicAPI.setLightType('HeadLight');
  };

  publicAPI.setLightTypeToCameraLight = function () {
    publicAPI.setLightType('CameraLight');
  };

  publicAPI.setLightTypeToSceneLight = function () {
    publicAPI.setTransformMatrix(null);
    publicAPI.setLightType('SceneLight');
  };

  publicAPI.lightTypeIsHeadLight = function () {
    return model.lightType === 'HeadLight';
  };

  publicAPI.lightTypeIsSceneLight = function () {
    return model.lightType === 'SceneLight';
  };

  publicAPI.lightTypeIsCameraLight = function () {
    return model.lightType === 'CameraLight';
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  switch: true,
  intensity: 1,
  color: [1, 1, 1],
  position: [0, 0, 1],
  focalPoint: [0, 0, 0],
  positional: false,
  exponent: 1,
  coneAngle: 30,
  attenuationValues: [1, 0, 0],
  transformMatrix: null,
  lightType: 'SceneLight',
  shadowAttenuation: 1,
  direction: [0, 0, 0],
  directionMTime: 0
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Build VTK API

  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, ['intensity', 'switch', 'positional', 'exponent', 'coneAngle', 'transformMatrix', 'lightType', 'shadowAttenuation']);
  macro.setGetArray(publicAPI, model, ['color', 'position', 'focalPoint', 'attenuationValues'], 3); // Object methods

  vtkLight(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkLight'); // ----------------------------------------------------------------------------

var vtkLight$1 = {
  newInstance: newInstance,
  extend: extend,
  LIGHT_TYPES: LIGHT_TYPES
};

export { LIGHT_TYPES, vtkLight$1 as default, extend, newInstance };
