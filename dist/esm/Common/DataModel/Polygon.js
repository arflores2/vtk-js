import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import { f as normalize, g as subtract, j as cross, k as add, d as dot, n as norm } from '../Core/Math/index.js';
import vtkLine from './Line.js';
import vtkPlane from './Plane.js';
import vtkPriorityQueue from '../Core/PriorityQueue.js';
import { IntersectionState } from './Line/Constants.js';

// vtkPolygon methods
// ----------------------------------------------------------------------------

var EPSILON = 1e-6;

function vtkPolygon(publicAPI, model) {
  // Set our classname
  model.classHierarchy.push('vtkPolygon');

  function computeNormal() {
    var v1 = [0, 0, 0];
    var v2 = [0, 0, 0];
    model.normal = [0, 0, 0];

    var anchor = _toConsumableArray(model.firstPoint.point);

    var point = model.firstPoint;

    for (var i = 0; i < model.pointCount; i++) {
      subtract(point.point, anchor, v1);
      subtract(point.next.point, anchor, v2);
      var n = [0, 0, 0];
      cross(v1, v2, n);
      add(model.normal, n, model.normal);
      point = point.next;
    }

    return normalize(model.normal);
  }

  function computeMeasure(point) {
    var v1 = [0, 0, 0];
    var v2 = [0, 0, 0];
    var v3 = [0, 0, 0];
    var v4 = [0, 0, 0];
    subtract(point.point, point.previous.point, v1);
    subtract(point.next.point, point.point, v2);
    subtract(point.previous.point, point.next.point, v3);
    cross(v1, v2, v4);
    var area = dot(v4, model.normal);

    if (area <= 0) {
      return -1;
    }

    var perimeter = norm(v1) + norm(v2) + norm(v3);
    return perimeter * perimeter / area;
  }

  function canRemoveVertex(point) {
    if (model.pointCount <= 3) {
      return true;
    }

    var previous = point.previous;
    var next = point.next;
    var v = [0, 0, 0];
    subtract(next.point, previous.point, v);
    var sN = [0, 0, 0];
    cross(v, model.normal, sN);
    normalize(sN);

    if (norm(sN) === 0) {
      return false;
    }

    var val = vtkPlane.evaluate(sN, previous.point, next.next.point); // eslint-disable-next-line no-nested-ternary

    var currentSign = val > EPSILON ? 1 : val < -EPSILON ? -1 : 0;
    var oneNegative = currentSign < 0 ? 1 : 0;

    for (var vertex = next.next.next; vertex.id !== previous.id; vertex = vertex.next) {
      var previousVertex = vertex.previous;
      val = vtkPlane.evaluate(sN, previous.point, vertex.point); // eslint-disable-next-line no-nested-ternary

      var sign = val > EPSILON ? 1 : val < -EPSILON ? -1 : 0;

      if (sign !== currentSign) {
        if (!oneNegative) {
          oneNegative = sign <= 0 ? 1 : 0;
        }

        if (vtkLine.intersection(previous.point, next.point, vertex.point, previousVertex.point, [0], [0]) === IntersectionState.YES_INTERSECTION) {
          return false;
        }

        currentSign = sign;
      }
    }

    return oneNegative === 1;
  }

  function removePoint(point, queue) {
    model.pointCount -= 1;
    var previous = point.previous;
    var next = point.next;
    model.tris = model.tris.concat(point.point);
    model.tris = model.tris.concat(next.point);
    model.tris = model.tris.concat(previous.point);
    previous.next = next;
    next.previous = previous;
    queue.deleteById(previous.id);
    queue.deleteById(next.id);
    var previousMeasure = computeMeasure(previous);

    if (previousMeasure > 0) {
      queue.push(previousMeasure, previous);
    }

    var nextMeasure = computeMeasure(next);

    if (nextMeasure > 0) {
      queue.push(nextMeasure, next);
    }

    if (point.id === model.firstPoint.id) {
      model.firstPoint = next;
    }
  }

  function earCutTriangulation() {
    computeNormal();
    var vertexQueue = vtkPriorityQueue.newInstance();
    var point = model.firstPoint;

    for (var i = 0; i < model.pointCount; i++) {
      var measure = computeMeasure(point);

      if (measure > 0) {
        vertexQueue.push(measure, point);
      }

      point = point.next;
    }

    while (model.pointCount > 2 && vertexQueue.length() > 0) {
      if (model.pointCount === vertexQueue.length()) {
        // convex
        var pointToRemove = vertexQueue.pop();
        removePoint(pointToRemove, vertexQueue);
      } else {
        // concave
        var _pointToRemove = vertexQueue.pop();

        if (canRemoveVertex(_pointToRemove)) {
          removePoint(_pointToRemove, vertexQueue);
        }
      }
    }

    return model.pointCount <= 2;
  }

  publicAPI.triangulate = function () {
    if (!model.firstPoint) {
      return null;
    }

    return earCutTriangulation();
  };

  publicAPI.setPoints = function (points) {
    model.pointCount = points.length;
    model.firstPoint = {
      id: 0,
      point: points[0],
      next: null,
      previous: null
    };
    var currentPoint = model.firstPoint;

    for (var i = 1; i < model.pointCount; i++) {
      currentPoint.next = {
        id: i,
        point: points[i],
        next: null,
        previous: currentPoint
      };
      currentPoint = currentPoint.next;
    }

    model.firstPoint.previous = currentPoint;
    currentPoint.next = model.firstPoint;
  };

  publicAPI.getPointArray = function () {
    return model.tris;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  firstPoint: null,
  pointCount: 0,
  tris: []
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Build VTK API

  macro.obj(publicAPI, model);
  vtkPolygon(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkPolygon'); // ----------------------------------------------------------------------------

var vtkPolygon$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkPolygon$1 as default, extend, newInstance };
