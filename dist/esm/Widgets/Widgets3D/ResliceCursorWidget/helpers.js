import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import vtkBoundingBox, { STATIC } from '../../../Common/DataModel/BoundingBox.js';
import vtkCubeSource from '../../../Filters/Sources/CubeSource.js';
import vtkCutter from '../../../Filters/Core/Cutter.js';
import vtkPlane from '../../../Common/DataModel/Plane.js';
import { g as subtract, f as normalize, j as cross, Q as multiplyAccumulate, S as signedAngleBetweenVectors } from '../../../Common/Core/Math/index.js';
import vtkMatrixBuilder from '../../../Common/Core/MatrixBuilder.js';
import { ViewTypes } from '../../Core/WidgetManager/Constants.js';

var EPSILON = 0.00001;
/**
 * Fit the plane defined by origin, p1, p2 onto the bounds.
 * Plane is untouched if does not intersect bounds.
 * @param {Array} bounds
 * @param {Array} origin
 * @param {Array} p1
 * @param {Array} p2
 */

function boundPlane(bounds, origin, p1, p2) {
  var v1 = [];
  subtract(p1, origin, v1);
  normalize(v1);
  var v2 = [];
  subtract(p2, origin, v2);
  normalize(v2);
  var n = [0, 0, 1];
  cross(v1, v2, n);
  normalize(n);
  var plane = vtkPlane.newInstance();
  plane.setOrigin.apply(plane, _toConsumableArray(origin));
  plane.setNormal.apply(plane, n);
  var cubeSource = vtkCubeSource.newInstance();
  cubeSource.setBounds(bounds);
  var cutter = vtkCutter.newInstance();
  cutter.setCutFunction(plane);
  cutter.setInputConnection(cubeSource.getOutputPort());
  var cutBounds = cutter.getOutputData();

  if (cutBounds.getNumberOfPoints() === 0) {
    return;
  }

  var localBounds = STATIC.computeLocalBounds(cutBounds.getPoints(), v1, v2, n);

  for (var i = 0; i < 3; i += 1) {
    origin[i] = localBounds[0] * v1[i] + localBounds[2] * v2[i] + localBounds[4] * n[i];
    p1[i] = localBounds[1] * v1[i] + localBounds[2] * v2[i] + localBounds[4] * n[i];
    p2[i] = localBounds[0] * v1[i] + localBounds[3] * v2[i] + localBounds[4] * n[i];
  }
} // Project point (inPoint) to the bounds of the image according to a plane
// defined by two vectors (v1, v2)

function boundPoint(inPoint, v1, v2, bounds) {
  var absT1 = v1.map(function (val) {
    return Math.abs(val);
  });
  var absT2 = v2.map(function (val) {
    return Math.abs(val);
  });
  var o1 = 0.0;
  var o2 = 0.0;

  for (var i = 0; i < 3; i++) {
    var axisOffset = 0;
    var useT1 = absT1[i] > absT2[i];
    var t = useT1 ? v1 : v2;
    var absT = useT1 ? absT1 : absT2;

    if (inPoint[i] < bounds[i * 2]) {
      axisOffset = absT[i] > EPSILON ? (bounds[2 * i] - inPoint[i]) / t[i] : 0;
    } else if (inPoint[i] > bounds[2 * i + 1]) {
      axisOffset = absT[i] > EPSILON ? (bounds[2 * i + 1] - inPoint[i]) / t[i] : 0;
    }

    if (useT1) {
      if (Math.abs(axisOffset) > Math.abs(o1)) {
        o1 = axisOffset;
      }
    } else if (Math.abs(axisOffset) > Math.abs(o2)) {
      o2 = axisOffset;
    }
  }

  var outPoint = [inPoint[0], inPoint[1], inPoint[2]];

  if (o1 !== 0.0) {
    multiplyAccumulate(outPoint, v1, o1, outPoint);
  }

  if (o2 !== 0.0) {
    multiplyAccumulate(outPoint, v2, o2, outPoint);
  }

  return outPoint;
} // Compute the intersection between p1 and p2 on bounds

function boundPointOnPlane(p1, p2, bounds) {
  var dir12 = [0, 0, 0];
  subtract(p2, p1, dir12);
  var out = [0, 0, 0];
  var tolerance = [0, 0, 0];
  vtkBoundingBox.intersectBox(bounds, p1, dir12, out, tolerance);
  return out;
}
/**
 * Rotates a vector around another.
 * @param {vec3} vectorToBeRotated Vector to rate
 * @param {vec3} axis Axis to rotate around
 * @param {Number} angle Angle in radian
 * @returns The rotated vector
 */

function rotateVector(vectorToBeRotated, axis, angle) {
  var rotatedVector = _toConsumableArray(vectorToBeRotated);

  vtkMatrixBuilder.buildFromRadian().rotate(angle, axis).apply(rotatedVector);
  return rotatedVector;
} // Update the extremities and the rotation point coordinate of the line

function updateLine(lineState, center, axis, lineLength) {
  var p1 = [center[0] - lineLength * axis[0], center[1] - lineLength * axis[1], center[2] - lineLength * axis[2]];
  var p2 = [center[0] + lineLength * axis[0], center[1] + lineLength * axis[1], center[2] + lineLength * axis[2]]; // FIXME: p1 and p2 should be placed on the boundaries of the volume.

  lineState.setPoint1(p1);
  lineState.setPoint2(p2);
} // Update the reslice cursor state according to the three planes normals and the origin


function updateState(widgetState) {
  // Compute line axis
  var xNormal = widgetState.getPlanes()[ViewTypes.YZ_PLANE].normal;
  var yNormal = widgetState.getPlanes()[ViewTypes.XZ_PLANE].normal;
  var zNormal = widgetState.getPlanes()[ViewTypes.XY_PLANE].normal;
  var yzIntersectionLineAxis = cross(yNormal, zNormal, []);
  var xzIntersectionLineAxis = cross(zNormal, xNormal, []);
  var xyIntersectionLineAxis = cross(xNormal, yNormal, []);
  var bounds = widgetState.getImage().getBounds();
  var center = widgetState.getCenter(); // Length of the principal diagonal.

  var pdLength = 0.5 * vtkBoundingBox.getDiagonalLength(bounds);
  updateLine(widgetState.getAxisXinY(), center, xyIntersectionLineAxis, pdLength);
  updateLine(widgetState.getAxisYinX(), center, xyIntersectionLineAxis, pdLength);
  updateLine(widgetState.getAxisYinZ(), center, yzIntersectionLineAxis, pdLength);
  updateLine(widgetState.getAxisZinY(), center, yzIntersectionLineAxis, pdLength);
  updateLine(widgetState.getAxisXinZ(), center, xzIntersectionLineAxis, pdLength);
  updateLine(widgetState.getAxisZinX(), center, xzIntersectionLineAxis, pdLength);
}
/**
 * First rotate planeToTransform to match targetPlane normal.
 * Then rotate around targetNormal to enforce targetViewUp "up" vector (i.e. Origin->p2 ).
 * There is an infinite number of options to rotate a plane normal to another. Here we attempt to
 * preserve Origin, P1 and P2 when rotating around targetPlane.
 * @param {vtkPlaneSource} planeToTransform
 * @param {vec3} targetOrigin Center of the plane
 * @param {vec3} targetNormal Normal to state to the plane
 * @param {vec3} viewType Vector that enforces view up
 */

function transformPlane(planeToTransform, targetCenter, targetNormal, targetViewUp) {
  planeToTransform.setNormal(targetNormal);
  var viewUp = subtract(planeToTransform.getPoint2(), planeToTransform.getOrigin(), []);
  var angle = signedAngleBetweenVectors(viewUp, targetViewUp, targetNormal);
  planeToTransform.rotate(angle, targetNormal);
  planeToTransform.setCenter(targetCenter);
} // Get name of the line in the same plane as the input

function getAssociatedLinesName(lineName) {
  switch (lineName) {
    case 'AxisXinY':
      return 'AxisZinY';

    case 'AxisXinZ':
      return 'AxisYinZ';

    case 'AxisYinX':
      return 'AxisZinX';

    case 'AxisYinZ':
      return 'AxisXinZ';

    case 'AxisZinX':
      return 'AxisYinX';

    case 'AxisZinY':
      return 'AxisXinY';

    default:
      return '';
  }
}
/**
 * Get the line name, constructs from the plane name and where the plane is displayed
 * Example: planeName='X' rotatedPlaneName='Y', then the return values will be 'AxisXinY'
 * @param {String} planeName Value between 'X', 'Y' and 'Z'
 * @param {String} rotatedPlaneName Value between 'X', 'Y' and 'Z'
 * @returns {String}
 */

function getLineNameFromPlaneAndRotatedPlaneName(planeName, rotatedPlaneName) {
  return "Axis".concat(planeName, "in").concat(rotatedPlaneName);
}
/**
 * Extract the plane name from the line name
 * Example: 'AxisXinY' will return 'X'
 * @param {String} lineName Should be following this template : 'Axis_in_' with _ a character
 * @returns {String} Value between 'X', 'Y' and 'Z' or null if an error occured
 */

function getPlaneNameFromLineName(lineName) {
  var match = lineName.match('([XYZ])in[XYZ]');

  if (match) {
    return match[1];
  }

  return null;
}
/**
 * Get the orthogonal plane name of 'planeName' in a specific 'rotatedPlaneName'
 * Example: planeName='X' on rotatedPlaneName='Z', then the associated plane name
 * of 'X' plane is 'Y'
 * @param {String} planeName
 * @param {String} rotatedPlaneName
 */

function getAssociatedPlaneName(planeName, rotatedPlaneName) {
  var lineName = getLineNameFromPlaneAndRotatedPlaneName(planeName, rotatedPlaneName);
  var associatedLine = getAssociatedLinesName(lineName);
  return getPlaneNameFromLineName(associatedLine);
}

export { boundPlane, boundPoint, boundPointOnPlane, getAssociatedLinesName, getAssociatedPlaneName, getLineNameFromPlaneAndRotatedPlaneName, getPlaneNameFromLineName, rotateVector, transformPlane, updateState };
