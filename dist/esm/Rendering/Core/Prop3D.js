import { mat4, quat } from 'gl-matrix';
import macro from '../../macros.js';
import vtkBoundingBox from '../../Common/DataModel/BoundingBox.js';
import { x as degreesFromRadians, r as radiansFromDegrees } from '../../Common/Core/Math/index.js';
import vtkProp from './Prop.js';

// vtkProp3D methods
// ----------------------------------------------------------------------------

function vtkProp3D(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkProp3D');

  publicAPI.addPosition = function (deltaXYZ) {
    model.position = model.position.map(function (value, index) {
      return value + deltaXYZ[index];
    });
    publicAPI.modified();
  };

  publicAPI.getOrientationWXYZ = function () {
    var q = quat.create();
    mat4.getRotation(q, model.rotation);
    var oaxis = new Float64Array(3);
    var w = quat.getAxisAngle(oaxis, q);
    return [degreesFromRadians(w), oaxis[0], oaxis[1], oaxis[2]];
  };

  publicAPI.rotateX = function (val) {
    if (val === 0.0) {
      return;
    }

    mat4.rotateX(model.rotation, model.rotation, radiansFromDegrees(val));
    publicAPI.modified();
  };

  publicAPI.rotateY = function (val) {
    if (val === 0.0) {
      return;
    }

    mat4.rotateY(model.rotation, model.rotation, radiansFromDegrees(val));
    publicAPI.modified();
  };

  publicAPI.rotateZ = function (val) {
    if (val === 0.0) {
      return;
    }

    mat4.rotateZ(model.rotation, model.rotation, radiansFromDegrees(val));
    publicAPI.modified();
  };

  publicAPI.rotateWXYZ = function (degrees, x, y, z) {
    if (degrees === 0.0 || x === 0.0 && y === 0.0 && z === 0.0) {
      return;
    } // convert to radians


    var angle = radiansFromDegrees(degrees);
    var q = quat.create();
    quat.setAxisAngle(q, [x, y, z], angle);
    var quatMat = new Float64Array(16);
    mat4.fromQuat(quatMat, q);
    mat4.multiply(model.rotation, model.rotation, quatMat);
    publicAPI.modified();
  };

  publicAPI.setOrientation = function (x, y, z) {
    if (x === model.orientation[0] && y === model.orientation[1] && z === model.orientation[2]) {
      return false;
    }

    model.orientation = [x, y, z];
    mat4.identity(model.rotation);
    publicAPI.rotateZ(z);
    publicAPI.rotateX(x);
    publicAPI.rotateY(y);
    publicAPI.modified();
    return true;
  };

  publicAPI.setUserMatrix = function (matrix) {
    mat4.copy(model.userMatrix, matrix);
    publicAPI.modified();
  };

  publicAPI.getMatrix = function () {
    publicAPI.computeMatrix();
    return model.matrix;
  };

  publicAPI.computeMatrix = function () {
    // check whether or not need to rebuild the matrix
    if (publicAPI.getMTime() > model.matrixMTime.getMTime()) {
      mat4.identity(model.matrix);

      if (model.userMatrix) {
        mat4.multiply(model.matrix, model.matrix, model.userMatrix);
      }

      mat4.translate(model.matrix, model.matrix, model.origin);
      mat4.translate(model.matrix, model.matrix, model.position);
      mat4.multiply(model.matrix, model.matrix, model.rotation);
      mat4.scale(model.matrix, model.matrix, model.scale);
      mat4.translate(model.matrix, model.matrix, [-model.origin[0], -model.origin[1], -model.origin[2]]);
      mat4.transpose(model.matrix, model.matrix); // check for identity

      model.isIdentity = true;

      for (var i = 0; i < 4; ++i) {
        for (var j = 0; j < 4; ++j) {
          if ((i === j ? 1.0 : 0.0) !== model.matrix[i + j * 4]) {
            model.isIdentity = false;
          }
        }
      }

      model.matrixMTime.modified();
    }
  };

  publicAPI.getCenter = function () {
    return vtkBoundingBox.getCenter(model.bounds);
  };

  publicAPI.getLength = function () {
    return vtkBoundingBox.getLength(model.bounds);
  };

  publicAPI.getXRange = function () {
    return vtkBoundingBox.getXRange(model.bounds);
  };

  publicAPI.getYRange = function () {
    return vtkBoundingBox.getYRange(model.bounds);
  };

  publicAPI.getZRange = function () {
    return vtkBoundingBox.getZRange(model.bounds);
  };

  publicAPI.getUserMatrix = function () {
    return model.userMatrix;
  };

  function updateIdentityFlag() {
    publicAPI.computeMatrix();
  }

  publicAPI.onModified(updateIdentityFlag);
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  origin: [0, 0, 0],
  position: [0, 0, 0],
  orientation: [0, 0, 0],
  rotation: null,
  scale: [1, 1, 1],
  bounds: [1, -1, 1, -1, 1, -1],
  userMatrix: null,
  userMatrixMTime: null,
  cachedProp3D: null,
  isIdentity: true,
  matrixMTime: null
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkProp.extend(publicAPI, model, initialValues);
  model.matrixMTime = {};
  macro.obj(model.matrixMTime); // Build VTK API

  macro.get(publicAPI, model, ['bounds', 'isIdentity']);
  macro.getArray(publicAPI, model, ['orientation']);
  macro.setGetArray(publicAPI, model, ['origin', 'position', 'scale'], 3); // Object internal instance

  model.matrix = mat4.identity(new Float64Array(16));
  model.rotation = mat4.identity(new Float64Array(16));
  model.userMatrix = mat4.identity(new Float64Array(16));
  model.transform = null; // FIXME
  // Object methods

  vtkProp3D(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkProp3D'); // ----------------------------------------------------------------------------

var vtkProp3D$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkProp3D$1 as default, extend, newInstance };
