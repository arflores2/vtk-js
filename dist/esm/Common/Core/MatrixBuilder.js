import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _classCallCheck from '@babel/runtime/helpers/classCallCheck';
import _createClass from '@babel/runtime/helpers/createClass';
import { mat4, vec3, glMatrix } from 'gl-matrix';
import { C as areMatricesEqual } from './Math/index.js';

var NoOp = function NoOp(v) {
  return v;
};

var IDENTITY = mat4.identity(new Float64Array(16));
var EPSILON = 1e-6;

var Transform = /*#__PURE__*/function () {
  function Transform() {
    var useDegree = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

    _classCallCheck(this, Transform);

    this.matrix = mat4.identity(new Float64Array(16));
    this.tmp = new Float64Array(3);
    this.angleConv = useDegree ? glMatrix.toRadian : NoOp;
  }

  _createClass(Transform, [{
    key: "rotateFromDirections",
    value: function rotateFromDirections(originDirection, targetDirection) {
      var src = new Float64Array(3);
      var dst = new Float64Array(3);
      var transf = new Float64Array(16);
      vec3.set(src, originDirection[0], originDirection[1], originDirection[2]);
      vec3.set(dst, targetDirection[0], targetDirection[1], targetDirection[2]);
      vec3.normalize(src, src);
      vec3.normalize(dst, dst);
      var cosAlpha = vec3.dot(src, dst);

      if (cosAlpha >= 1) {
        return this;
      }

      vec3.cross(this.tmp, src, dst);

      if (vec3.length(this.tmp) < EPSILON) {
        // cross product is 0, so pick arbitrary axis perpendicular
        // to originDirection.
        vec3.cross(this.tmp, [1, 0, 0], originDirection);

        if (vec3.length(this.tmp) < EPSILON) {
          vec3.cross(this.tmp, [0, 1, 0], originDirection);
        }
      }

      mat4.fromRotation(transf, Math.acos(cosAlpha), this.tmp);
      mat4.multiply(this.matrix, this.matrix, transf);
      return this;
    }
  }, {
    key: "rotate",
    value: function rotate(angle, axis) {
      vec3.set.apply(vec3, [this.tmp].concat(_toConsumableArray(axis)));
      vec3.normalize(this.tmp, this.tmp);
      mat4.rotate(this.matrix, this.matrix, this.angleConv(angle), this.tmp);
      return this;
    }
  }, {
    key: "rotateX",
    value: function rotateX(angle) {
      mat4.rotateX(this.matrix, this.matrix, this.angleConv(angle));
      return this;
    }
  }, {
    key: "rotateY",
    value: function rotateY(angle) {
      mat4.rotateY(this.matrix, this.matrix, this.angleConv(angle));
      return this;
    }
  }, {
    key: "rotateZ",
    value: function rotateZ(angle) {
      mat4.rotateZ(this.matrix, this.matrix, this.angleConv(angle));
      return this;
    }
  }, {
    key: "translate",
    value: function translate(x, y, z) {
      vec3.set(this.tmp, x, y, z);
      mat4.translate(this.matrix, this.matrix, this.tmp);
      return this;
    }
  }, {
    key: "scale",
    value: function scale(sx, sy, sz) {
      vec3.set(this.tmp, sx, sy, sz);
      mat4.scale(this.matrix, this.matrix, this.tmp);
      return this;
    }
  }, {
    key: "multiply",
    value: function multiply(mat4x4) {
      mat4.multiply(this.matrix, this.matrix, mat4x4);
      return this;
    }
  }, {
    key: "identity",
    value: function identity() {
      mat4.identity(this.matrix);
      return this;
    } //-----------

  }, {
    key: "apply",
    value: function apply(typedArray) {
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var nbIterations = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;

      if (areMatricesEqual(IDENTITY, this.matrix)) {
        // Make sure we can chain apply...
        return this;
      }

      var size = nbIterations === -1 ? typedArray.length : offset + nbIterations * 3;

      for (var i = offset; i < size; i += 3) {
        vec3.set(this.tmp, typedArray[i], typedArray[i + 1], typedArray[i + 2]);
        vec3.transformMat4(this.tmp, this.tmp, this.matrix);
        typedArray[i] = this.tmp[0];
        typedArray[i + 1] = this.tmp[1];
        typedArray[i + 2] = this.tmp[2];
      } // Make sure we can chain apply...


      return this;
    }
  }, {
    key: "getMatrix",
    value: function getMatrix() {
      return this.matrix;
    }
  }, {
    key: "setMatrix",
    value: function setMatrix(mat4x4) {
      if (!!mat4x4 && mat4x4.length === 16) {
        mat4.copy(this.matrix, mat4x4);
      }

      return this;
    }
  }]);

  return Transform;
}();

function buildFromDegree() {
  return new Transform(true);
}

function buildFromRadian() {
  return new Transform(false);
}

var vtkMatrixBuilder = {
  buildFromDegree: buildFromDegree,
  buildFromRadian: buildFromRadian
};

export { vtkMatrixBuilder as default };
