import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../macros.js';
import vtkCell from './Cell.js';
import { e as distance2BetweenPoints, d as dot, l as determinant2x2 } from '../Core/Math/index.js';
import vtkLine from './Line.js';
import vtkPlane from './Plane.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
// Global methods
// ----------------------------------------------------------------------------

function computeNormalDirection(v1, v2, v3, n) {
  // order is important!!! maintain consistency with triangle vertex order
  var ax = v3[0] - v2[0];
  var ay = v3[1] - v2[1];
  var az = v3[2] - v2[2];
  var bx = v1[0] - v2[0];
  var by = v1[1] - v2[1];
  var bz = v1[2] - v2[2];
  n[0] = ay * bz - az * by;
  n[1] = az * bx - ax * bz;
  n[2] = ax * by - ay * bx;
}

function computeNormal(v1, v2, v3, n) {
  computeNormalDirection(v1, v2, v3, n);
  var length = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);

  if (length !== 0.0) {
    n[0] /= length;
    n[1] /= length;
    n[2] /= length;
  }
} // ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------


var STATIC = {
  computeNormalDirection: computeNormalDirection,
  computeNormal: computeNormal
}; // ----------------------------------------------------------------------------
// vtkTriangle methods
// ----------------------------------------------------------------------------

function vtkTriangle(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkTriangle');

  publicAPI.getCellDimension = function () {
    return 2;
  };

  publicAPI.intersectWithLine = function (p1, p2, tol, x, pcoords) {
    var outObj = {
      subId: 0,
      t: Number.MAX_VALUE,
      intersect: 0,
      betweenPoints: false
    };
    pcoords[2] = 0.0;
    var closestPoint = [];
    var tol2 = tol * tol; // Get normal for triangle

    var pt1 = [];
    var pt2 = [];
    var pt3 = [];
    model.points.getPoint(0, pt1);
    model.points.getPoint(1, pt2);
    model.points.getPoint(2, pt3);
    var n = [];
    var weights = [];
    computeNormal(pt1, pt2, pt3, n);

    if (n[0] !== 0 || n[1] !== 0 || n[2] !== 0) {
      // Intersect plane of triangle with line
      var plane = vtkPlane.intersectWithLine(p1, p2, pt1, n);
      outObj.betweenPoints = plane.betweenPoints;
      outObj.t = plane.t;
      x[0] = plane.x[0];
      x[1] = plane.x[1];
      x[2] = plane.x[2];

      if (!plane.intersection) {
        pcoords[0] = 0.0;
        pcoords[1] = 0.0;
        outObj.intersect = 0;
        return outObj;
      } // Evaluate position


      var inside = publicAPI.evaluatePosition(x, closestPoint, pcoords, weights);

      if (inside.evaluation >= 0) {
        if (inside.dist2 <= tol2) {
          outObj.intersect = 1;
          return outObj;
        }

        outObj.intersect = inside.evaluation;
        return outObj;
      }
    } // Normals are null, so the triangle is degenerated and
    // we still need to check intersection between line and
    // the longest edge.


    var dist2Pt1Pt2 = distance2BetweenPoints(pt1, pt2);
    var dist2Pt2Pt3 = distance2BetweenPoints(pt2, pt3);
    var dist2Pt3Pt1 = distance2BetweenPoints(pt3, pt1);

    if (!model.line) {
      model.line = vtkLine.newInstance();
    }

    if (dist2Pt1Pt2 > dist2Pt2Pt3 && dist2Pt1Pt2 > dist2Pt3Pt1) {
      model.line.getPoints().setPoint(0, pt1);
      model.line.getPoints().setPoint(1, pt2);
    } else if (dist2Pt2Pt3 > dist2Pt3Pt1 && dist2Pt2Pt3 > dist2Pt1Pt2) {
      model.line.getPoints().setPoint(0, pt2);
      model.line.getPoints().setPoint(1, pt3);
    } else {
      model.line.getPoints().setPoint(0, pt3);
      model.line.getPoints().setPoint(1, pt1);
    }

    var intersectLine = model.line.intersectWithLine(p1, p2, tol, x, pcoords);
    outObj.betweenPoints = intersectLine.betweenPoints;
    outObj.t = intersectLine.t;

    if (intersectLine.intersect) {
      var pt3Pt1 = [];
      var pt3Pt2 = [];
      var pt3X = []; // Compute r and s manually, using dot and norm.

      for (var i = 0; i < 3; i++) {
        pt3Pt1[i] = pt1[i] - pt3[i];
        pt3Pt2[i] = pt2[i] - pt3[i];
        pt3X[i] = x[i] - pt3[i];
      }

      pcoords[0] = dot(pt3X, pt3Pt1) / dist2Pt3Pt1;
      pcoords[1] = dot(pt3X, pt3Pt2) / dist2Pt2Pt3;
      outObj.intersect = 1;
      return outObj;
    }

    pcoords[0] = 0.0;
    pcoords[1] = 0.0;
    outObj.intersect = 0;
    return outObj;
  };

  publicAPI.evaluatePosition = function (x, closestPoint, pcoords, weights) {
    // will return obj
    var outObj = {
      subId: 0,
      dist2: 0,
      evaluation: -1
    };
    var i;
    var j;
    var pt1 = [];
    var pt2 = [];
    var pt3 = [];
    var n = [];
    var fabsn;
    var rhs = [];
    var c1 = [];
    var c2 = [];
    var det = 0;
    var idx = 0;
    var indices = [];
    var dist2Point;
    var dist2Line1;
    var dist2Line2;
    var closest = [];
    var closestPoint1 = [];
    var closestPoint2 = [];
    var cp = [];
    outObj.subId = 0;
    pcoords[2] = 0.0; // Get normal for triangle, only the normal direction is needed, i.e. the
    // normal need not be normalized (unit length)
    //

    model.points.getPoint(1, pt1);
    model.points.getPoint(2, pt2);
    model.points.getPoint(0, pt3);
    computeNormalDirection(pt1, pt2, pt3, n); // Project point to plane

    vtkPlane.generalizedProjectPoint(x, pt1, n, cp); // Construct matrices.  Since we have over determined system, need to find
    // which 2 out of 3 equations to use to develop equations. (Any 2 should
    // work since we've projected point to plane.)

    var maxComponent = 0.0;

    for (i = 0; i < 3; i++) {
      // trying to avoid an expensive call to fabs()
      if (n[i] < 0) {
        fabsn = -n[i];
      } else {
        fabsn = n[i];
      }

      if (fabsn > maxComponent) {
        maxComponent = fabsn;
        idx = i;
      }
    }

    for (j = 0, i = 0; i < 3; i++) {
      if (i !== idx) {
        indices[j++] = i;
      }
    }

    for (i = 0; i < 2; i++) {
      rhs[i] = cp[indices[i]] - pt3[indices[i]];
      c1[i] = pt1[indices[i]] - pt3[indices[i]];
      c2[i] = pt2[indices[i]] - pt3[indices[i]];
    }

    det = determinant2x2(c1, c2);

    if (det === 0.0) {
      pcoords[0] = 0.0;
      pcoords[1] = 0.0;
      outObj.evaluation = -1;
      return outObj;
    }

    pcoords[0] = determinant2x2(rhs, c2) / det;
    pcoords[1] = determinant2x2(c1, rhs) / det; // Okay, now find closest point to element

    weights[0] = 1 - (pcoords[0] + pcoords[1]);
    weights[1] = pcoords[0];
    weights[2] = pcoords[1];

    if (weights[0] >= 0.0 && weights[0] <= 1.0 && weights[1] >= 0.0 && weights[1] <= 1.0 && weights[2] >= 0.0 && weights[2] <= 1.0) {
      // projection distance
      if (closestPoint) {
        outObj.dist2 = distance2BetweenPoints(cp, x);
        closestPoint[0] = cp[0];
        closestPoint[1] = cp[1];
        closestPoint[2] = cp[2];
      }

      outObj.evaluation = 1;
    } else {
      var t;

      if (closestPoint) {
        if (weights[1] < 0.0 && weights[2] < 0.0) {
          dist2Point = distance2BetweenPoints(x, pt3);
          dist2Line1 = vtkLine.distanceToLine(x, pt1, pt3, t, closestPoint1);
          dist2Line2 = vtkLine.distanceToLine(x, pt3, pt2, t, closestPoint2);

          if (dist2Point < dist2Line1) {
            outObj.dist2 = dist2Point;
            closest = pt3;
          } else {
            outObj.dist2 = dist2Line1;
            closest = closestPoint1;
          }

          if (dist2Line2 < outObj.dist2) {
            outObj.dist2 = dist2Line2;
            closest = closestPoint2;
          }

          for (i = 0; i < 3; i++) {
            closestPoint[i] = closest[i];
          }
        } else if (weights[2] < 0.0 && weights[0] < 0.0) {
          dist2Point = distance2BetweenPoints(x, pt1);
          dist2Line1 = vtkLine.distanceToLine(x, pt1, pt3, t, closestPoint1);
          dist2Line2 = vtkLine.distanceToLine(x, pt1, pt2, t, closestPoint2);

          if (dist2Point < dist2Line1) {
            outObj.dist2 = dist2Point;
            closest = pt1;
          } else {
            outObj.dist2 = dist2Line1;
            closest = closestPoint1;
          }

          if (dist2Line2 < outObj.dist2) {
            outObj.dist2 = dist2Line2;
            closest = closestPoint2;
          }

          for (i = 0; i < 3; i++) {
            closestPoint[i] = closest[i];
          }
        } else if (weights[1] < 0.0 && weights[0] < 0.0) {
          dist2Point = distance2BetweenPoints(x, pt2);
          dist2Line1 = vtkLine.distanceToLine(x, pt2, pt3, t, closestPoint1);
          dist2Line2 = vtkLine.distanceToLine(x, pt1, pt2, t, closestPoint2);

          if (dist2Point < dist2Line1) {
            outObj.dist2 = dist2Point;
            closest = pt2;
          } else {
            outObj.dist2 = dist2Line1;
            closest = closestPoint1;
          }

          if (dist2Line2 < outObj.dist2) {
            outObj.dist2 = dist2Line2;
            closest = closestPoint2;
          }

          for (i = 0; i < 3; i++) {
            closestPoint[i] = closest[i];
          }
        } else if (weights[0] < 0.0) {
          var lineDistance = vtkLine.distanceToLine(x, pt1, pt2, closestPoint);
          outObj.dist2 = lineDistance.distance;
        } else if (weights[1] < 0.0) {
          var _lineDistance = vtkLine.distanceToLine(x, pt2, pt3, closestPoint);

          outObj.dist2 = _lineDistance.distance;
        } else if (weights[2] < 0.0) {
          var _lineDistance2 = vtkLine.distanceToLine(x, pt1, pt3, closestPoint);

          outObj.dist2 = _lineDistance2.distance;
        }
      }

      outObj.evaluation = 0;
    }

    return outObj;
  };

  publicAPI.evaluateLocation = function (pcoords, x, weights) {
    var p0 = [];
    var p1 = [];
    var p2 = [];
    model.points.getPoint(0, p0);
    model.points.getPoint(1, p1);
    model.points.getPoint(2, p2);
    var u3 = 1.0 - pcoords[0] - pcoords[1];

    for (var i = 0; i < 3; i++) {
      x[i] = p0[i] * u3 + p1[i] * pcoords[0] + p2[i] * pcoords[1];
    }

    weights[0] = u3;
    weights[1] = pcoords[0];
    weights[2] = pcoords[1];
  };

  publicAPI.getParametricDistance = function (pcoords) {
    var pDist;
    var pDistMax = 0.0;
    var pc = [];
    pc[0] = pcoords[0];
    pc[1] = pcoords[1];
    pc[2] = 1.0 - pcoords[0] - pcoords[1];

    for (var i = 0; i < 3; i++) {
      if (pc[i] < 0.0) {
        pDist = -pc[i];
      } else if (pc[i] > 1.0) {
        pDist = pc[i] - 1.0;
      } else {
        // inside the cell in the parametric direction
        pDist = 0.0;
      }

      if (pDist > pDistMax) {
        pDistMax = pDist;
      }
    }

    return pDistMax;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  vtkCell.extend(publicAPI, model, initialValues);
  vtkTriangle(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkTriangle'); // ----------------------------------------------------------------------------

var vtkTriangle$1 = _objectSpread({
  newInstance: newInstance,
  extend: extend
}, STATIC);

export { STATIC, vtkTriangle$1 as default, extend, newInstance };
