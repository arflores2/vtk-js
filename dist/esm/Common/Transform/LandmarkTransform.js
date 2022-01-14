import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { mat4, mat3 } from 'gl-matrix';
import Constants from './LandmarkTransform/Constants.js';
import macro from '../../macros.js';
import { m as jacobiN, p as perpendiculars } from '../Core/Math/index.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var Mode = Constants.Mode; // ----------------------------------------------------------------------------
// vtkLandmarkTransform methods
// ----------------------------------------------------------------------------

function vtkLandmarkTransform(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLandmarkTransform'); // Convert a mat4 matrix to a Matrix 2 dimensions

  function mat4To2DArray(mat) {
    var output = [[0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]];
    var cpt = 0;

    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        output[r][c] = mat[cpt++];
      }
    }

    return output;
  }

  function update() {
    mat4.identity(model.matrix);
    var N_PTS = model.sourceLandmark.getNumberOfPoints();

    if (model.targetLandmark.getNumberOfPoints() !== N_PTS || model.sourceLandmark === null || model.targetLandmark === null || N_PTS === 0) {
      console.error('Error : Bad inputs of vtkLandmarkTransform');
      return model.matrix;
    } // -- find the centroid of each set --


    var sourceCentroid = [0, 0, 0];
    var targetCentroid = [0, 0, 0];
    var p = [0, 0, 0];

    for (var i = 0; i < N_PTS; i++) {
      model.sourceLandmark.getPoint(i, p);
      sourceCentroid[0] += p[0];
      sourceCentroid[1] += p[1];
      sourceCentroid[2] += p[2];
      model.targetLandmark.getPoint(i, p);
      targetCentroid[0] += p[0];
      targetCentroid[1] += p[1];
      targetCentroid[2] += p[2];
    }

    sourceCentroid[0] /= N_PTS;
    sourceCentroid[1] /= N_PTS;
    sourceCentroid[2] /= N_PTS;
    targetCentroid[0] /= N_PTS;
    targetCentroid[1] /= N_PTS;
    targetCentroid[2] /= N_PTS; // -- if only one point, stop right here

    if (N_PTS === 1) {
      mat4.identity(model.matrix);
      model.matrix.elem[12] = targetCentroid[0] - sourceCentroid[0];
      model.matrix.elem[13] = targetCentroid[1] - sourceCentroid[1];
      model.matrix.elem[14] = targetCentroid[2] - sourceCentroid[2];
      return model.matrix;
    } // -- build the 3x3 matrix M --


    var M = new Float64Array(9);
    var AAT = new Float64Array(9);
    var a = [0, 0, 0];
    var b = [0, 0, 0];
    var sa = 0.0;
    var sb = 0.0;

    for (var pt = 0; pt < N_PTS; pt++) {
      // get the origin-centred point (a) in the source set
      model.sourceLandmark.getPoint(pt, a);
      a[0] -= sourceCentroid[0];
      a[1] -= sourceCentroid[1];
      a[2] -= sourceCentroid[2]; // get the origin-centred point (b) in the target set

      model.targetLandmark.getPoint(pt, b);
      b[0] -= targetCentroid[0];
      b[1] -= targetCentroid[1];
      b[2] -= targetCentroid[2]; // accumulate the products a*T(b) into the matrix M

      for (var _i = 0; _i < 3; _i++) {
        M[3 * 0 + _i] += a[_i] * b[0];
        M[3 * 1 + _i] += a[_i] * b[1];
        M[3 * 2 + _i] += a[_i] * b[2]; // for the affine transform, compute ((a.a^t)^-1 . a.b^t)^t.
        // a.b^t is already in M.  here we put a.a^t in AAT.

        if (model.mode === Mode.AFFINE) {
          AAT[3 * 0 + _i] += a[_i] * a[0];
          AAT[3 * 1 + _i] += a[_i] * a[1];
          AAT[3 * 2 + _i] += a[_i] * a[2];
        }
      } // accumulate scale factors (if desired)


      sa += a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
      sb += b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    }

    if (model.mode === Mode.AFFINE) {
      // AAT = (a.a^t)^-1
      mat3.invert(AAT, AAT); // M = (a.a^t)^-1 . a.b^t

      mat3.multiply(M, AAT, M); // this->Matrix = M^t

      for (var _i2 = 0; _i2 < 3; ++_i2) {
        for (var j = 0; j < 3; ++j) {
          model.matrix[4 * j + _i2] = M[4 * _i2 + j];
        }
      }
    } else {
      var scale = Math.sqrt(sb / sa); // -- build the 4x4 matrix N --

      var N = new Float64Array(16); // on-diagonal elements

      N[0] = M[0] + M[4] + M[8];
      N[5] = M[0] - M[4] - M[8];
      N[10] = -M[0] + M[4] - M[8];
      N[15] = -M[0] - M[4] + M[8]; // off-diagonal elements

      /* eslint-disable no-multi-assign */

      N[4] = N[1] = M[7] - M[5];
      N[8] = N[2] = M[2] - M[6];
      N[12] = N[3] = M[3] - M[1];
      N[9] = N[6] = M[3] + M[1];
      N[13] = N[7] = M[2] + M[6];
      N[14] = N[11] = M[7] + M[5];
      /* eslint-enable no-multi-assign */
      // -- eigen-decompose N (is symmetric) --

      var eigenVectors = [[0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]];
      var eigenValues = [0.0, 0.0, 0.0, 0.0];
      var NMatrix = mat4To2DArray(N);
      jacobiN(NMatrix, 4, eigenValues, eigenVectors); // The eigenvector with the largest eigenvalue is the quaternion we want
      // (they are sorted in decreasing order for us by JacobiN)

      var w;
      var x;
      var y;
      var z; // first; if points are collinear, choose the quaternion that
      // results in the smallest rotation

      if (eigenValues[0] === eigenValues[1] || N_PTS === 2) {
        var s0 = [0, 0, 0];
        var t0 = [0, 0, 0];
        var s1 = [0, 0, 0];
        var t1 = [0, 0, 0];
        model.sourceLandmark.getPoint(0, s0);
        model.targetLandmark.getPoint(0, t0);
        model.sourceLandmark.getPoint(1, s1);
        model.targetLandmark.getPoint(1, t1);
        var ds;
        var dt;
        var rs = 0;
        var rt = 0;

        for (var _i3 = 0; _i3 < 3; _i3++) {
          ds[_i3] = s1[_i3] - s0[_i3]; // vector between points

          rs = ds[_i3] * ds[_i3] + rs;
          dt[_i3] = t1[_i3] - t0[_i3];
          rt = dt[_i3] * dt[_i3] + rt;
        } // normalize the two vectors


        rs = Math.sqrt(rs);
        ds[0] /= rs;
        ds[1] /= rs;
        ds[2] /= rs;
        rt = Math.sqrt(rt);
        dt[0] /= rt;
        dt[1] /= rt;
        dt[2] /= rt; // take dot & cross product

        w = ds[0] * dt[0] + ds[1] * dt[1] + ds[2] * dt[2];
        x = ds[1] * dt[2] - ds[2] * dt[1];
        y = ds[2] * dt[0] - ds[0] * dt[2];
        z = ds[0] * dt[1] - ds[1] * dt[0];
        var r = Math.sqrt(x * x + y * y + z * z);
        var theta = Math.atan2(r, w); // construct quaternion

        w = Math.cos(theta / 2);

        if (r !== 0) {
          r = Math.sin(theta / 2) / r;
          x *= r;
          y *= r;
          z *= r;
        } else {
          // rotation by 180 degrees : special case
          // Rotate around a vector perpendicular to ds
          perpendiculars(ds, dt, 0, 0);
          r = Math.sin(theta / 2);
          x = dt[0] * r;
          y = dt[1] * r;
          z = dt[2] * r;
        }
      } else {
        // points are not collinear
        w = eigenVectors[0][0];
        x = eigenVectors[1][0];
        y = eigenVectors[2][0];
        z = eigenVectors[3][0];
      } // convert quaternion to a rotation matrix


      var ww = w * w;
      var wx = w * x;
      var wy = w * y;
      var wz = w * z;
      var xx = x * x;
      var yy = y * y;
      var zz = z * z;
      var xy = x * y;
      var xz = x * z;
      var yz = y * z;
      model.matrix[0] = ww + xx - yy - zz;
      model.matrix[1] = 2.0 * (wz + xy);
      model.matrix[2] = 2.0 * (-wy + xz);
      model.matrix[4] = 2.0 * (-wz + xy);
      model.matrix[5] = ww - xx + yy - zz;
      model.matrix[6] = 2.0 * (wx + yz);
      model.matrix[8] = 2.0 * (wy + xz);
      model.matrix[9] = 2.0 * (-wx + yz);
      model.matrix[10] = ww - xx - yy + zz; // add in the scale factor (if desired)

      if (model.mode !== Mode.RIGID_BODY) {
        for (var _i4 = 0; _i4 < 3; _i4++) {
          model.matrix[4 * 0 + _i4] = model.matrix[4 * 0 + _i4] * scale;
          model.matrix[4 * 1 + _i4] = model.matrix[4 * 1 + _i4] * scale;
          model.matrix[4 * 2 + _i4] = model.matrix[4 * 2 + _i4] * scale;
        }
      }
    } // the translation is given by the difference in the transformed source
    // centroid and the target centroid


    var sx = model.matrix[0] * sourceCentroid[0] + model.matrix[4] * sourceCentroid[1] + model.matrix[8] * sourceCentroid[2];
    var sy = model.matrix[1] * sourceCentroid[0] + model.matrix[5] * sourceCentroid[1] + model.matrix[9] * sourceCentroid[2];
    var sz = model.matrix[2] * sourceCentroid[0] + model.matrix[6] * sourceCentroid[1] + model.matrix[10] * sourceCentroid[2];
    model.matrix[12] = targetCentroid[0] - sx;
    model.matrix[13] = targetCentroid[1] - sy;
    model.matrix[14] = targetCentroid[2] - sz; // fill the bottom row of the 4x4 matrix

    model.matrix[3] = 0.0;
    model.matrix[7] = 0.0;
    model.matrix[11] = 0.0;
    model.matrix[15] = 1.0;
    return model.matrix;
  } // Expose method


  publicAPI.update = update;
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  mode: Mode.SIMILARITY
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  macro.obj(publicAPI, model); // Internal objects initialization

  model.matrix = mat4.identity(new Float64Array(16));
  macro.setGet(publicAPI, model, ['sourceLandmark', 'targetLandmark', 'mode']);
  macro.get(publicAPI, model, ['matrix']);
  vtkLandmarkTransform(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkLandmarkTransform'); // ----------------------------------------------------------------------------

var vtkLandmarkTransform$1 = _objectSpread({
  newInstance: newInstance,
  extend: extend
}, Constants);

export { vtkLandmarkTransform$1 as default, extend, newInstance };
