import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../../macros.js';
import vtkInteractorObserver from '../../../Rendering/Core/InteractorObserver.js';
import vtkLine from '../../../Common/DataModel/Line.js';
import { e as distance2BetweenPoints, f as normalize, d as dot, j as cross, u as uninitializeBounds } from '../../../Common/Core/Math/index.js';
import vtkMatrixBuilder from '../../../Common/Core/MatrixBuilder.js';
import vtkPlane from '../../../Common/DataModel/Plane.js';
import vtkResliceCursorActor from './ResliceCursorActor.js';
import vtkResliceCursorRepresentation from './ResliceCursorRepresentation.js';
import { InteractionState } from './ResliceCursorRepresentation/Constants.js';

// ResliceCursorLineRepresentation methods
// ----------------------------------------------------------------------------

function isAxisPicked(renderer, tolerance, axisPolyData, pickedPosition) {
  var points = axisPolyData.getPoints();
  var worldP1 = [];
  points.getPoint(0, worldP1);
  var displayP1 = vtkInteractorObserver.computeWorldToDisplay(renderer, worldP1[0], worldP1[1], worldP1[2]);
  var worldP2 = [];
  points.getPoint(points.getNumberOfPoints() - 1, worldP2);
  var displayP2 = vtkInteractorObserver.computeWorldToDisplay(renderer, worldP2[0], worldP2[1], worldP2[2]);
  var xyz = [pickedPosition[0], pickedPosition[1], 0];
  var p1 = [displayP1[0], displayP1[1], 0];
  var p2 = [displayP2[0], displayP2[1], 0];
  var output = vtkLine.distanceToLine(xyz, p1, p2);
  return output.distance <= tolerance * tolerance && output.t < 1.0 && output.t > 0.0;
}

function displayToWorld(displayPosition, renderer) {
  var activeCamera = renderer.getActiveCamera();
  var focalPoint = activeCamera.getFocalPoint();
  var displayFocalPoint = vtkInteractorObserver.computeWorldToDisplay(renderer, focalPoint[0], focalPoint[1], focalPoint[2]);
  var worldEventPosition = vtkInteractorObserver.computeDisplayToWorld(renderer, displayPosition[0], displayPosition[1], displayFocalPoint[2]);
  return worldEventPosition;
}

function vtkResliceCursorLineRepresentation(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkResliceCursorLineRepresentation'); //----------------------------------------------------------------------------
  // Public API methods
  //----------------------------------------------------------------------------

  publicAPI.getResliceCursor = function () {
    return model.resliceCursorActor.getCursorAlgorithm().getResliceCursor();
  };

  publicAPI.getCursorAlgorithm = function () {
    return model.resliceCursorActor.getCursorAlgorithm();
  };

  publicAPI.displayToReslicePlaneIntersection = function (displayPosition) {
    var activeCamera = model.renderer.getActiveCamera();
    var cameraPosition = activeCamera.getPosition();
    var resliceCursor = publicAPI.getResliceCursor();
    var worldEventPosition = displayToWorld(displayPosition, model.renderer);

    if (!resliceCursor) {
      return null;
    }

    var axisNormal = model.resliceCursorActor.getCursorAlgorithm().getReslicePlaneNormal();
    var plane = resliceCursor.getPlane(axisNormal);
    var intersection = vtkPlane.intersectWithLine(worldEventPosition, cameraPosition, plane.getOrigin(), plane.getNormal());
    return intersection.x;
  };

  publicAPI.computeInteractionState = function (displayPos) {
    model.interactionState = InteractionState.OUTSIDE;

    if (!model.renderer || !model.resliceCursorActor.getVisibility()) {
      return model.interactionState;
    }

    var resliceCursor = publicAPI.getResliceCursor();

    if (!resliceCursor) {
      return model.interactionState;
    }

    var axis1 = model.resliceCursorActor.getCursorAlgorithm().getAxis1();
    var bounds = model.resliceCursorActor.getCenterlineActor(axis1).getBounds();

    if (bounds[1] < bounds[0]) {
      return model.interactionState;
    } // Picking Axis1 interaction:


    var axis1PolyData = resliceCursor.getCenterlineAxisPolyData(axis1);
    var isAxis1Picked = isAxisPicked(model.renderer, model.tolerance, axis1PolyData, displayPos); // Picking Axis2 interaction:

    var axis2 = model.resliceCursorActor.getCursorAlgorithm().getAxis2();
    var axis2PolyData = resliceCursor.getCenterlineAxisPolyData(axis2);
    var isAxis2Picked = isAxisPicked(model.renderer, model.tolerance, axis2PolyData, displayPos); // Picking center interaction:

    var isCenterPicked = isAxis1Picked && isAxis2Picked;

    if (isCenterPicked) {
      var displayCenterPosition = vtkInteractorObserver.computeWorldToDisplay(model.renderer, resliceCursor.getCenter()[0], resliceCursor.getCenter()[1], resliceCursor.getCenter()[2]);
      var distance = distance2BetweenPoints([displayCenterPosition[0], displayCenterPosition[1], 0], [displayPos[0], displayPos[1], 0]);

      if (distance <= model.tolerance * model.tolerance) {
        model.interactionState = InteractionState.ON_CENTER;
      } else {
        model.interactionState = InteractionState.ON_AXIS1;
      }
    } else if (isAxis1Picked) {
      model.interactionState = InteractionState.ON_AXIS1;
    } else if (isAxis2Picked) {
      model.interactionState = InteractionState.ON_AXIS2;
    }

    model.startPickPosition = publicAPI.displayToReslicePlaneIntersection(displayPos);

    if (model.startPickPosition === null) {
      model.startPickPosition = [0, 0, 0];
    }

    return model.interactionState;
  };

  publicAPI.startComplexWidgetInteraction = function (startEventPos) {
    model.startEventPosition[0] = startEventPos[0];
    model.startEventPosition[1] = startEventPos[1];
    model.startEventPosition[2] = 0.0;
    var resliceCursor = publicAPI.getResliceCursor();

    if (resliceCursor) {
      model.startCenterPosition = resliceCursor.getCenter();
    }

    model.lastEventPosition[0] = startEventPos[0];
    model.lastEventPosition[1] = startEventPos[1];
    model.lastEventPosition[2] = 0.0;
  };

  publicAPI.complexWidgetInteraction = function (displayPosition) {
    var resliceCursor = publicAPI.getResliceCursor();

    if (model.interactionState === InteractionState.OUTSIDE || !model.renderer || !resliceCursor) {
      model.lastEventPosition[0] = displayPosition[0];
      model.lastEventPosition[1] = displayPosition[1];
      return;
    } // Depending on the state, perform different operations


    if (model.interactionState === InteractionState.ON_CENTER) {
      var intersectionPos = publicAPI.displayToReslicePlaneIntersection(displayPosition);

      if (intersectionPos !== null) {
        var newCenter = [];

        for (var i = 0; i < 3; i++) {
          newCenter[i] = model.startCenterPosition[i] + intersectionPos[i] - model.startPickPosition[i];
        }

        resliceCursor.setCenter(newCenter);
      }
    }

    if (model.interactionState === InteractionState.ON_AXIS1) {
      publicAPI.rotateAxis(displayPosition, model.resliceCursorActor.getCursorAlgorithm().getPlaneAxis1());
    }

    if (model.interactionState === InteractionState.ON_AXIS2) {
      publicAPI.rotateAxis(displayPosition, model.resliceCursorActor.getCursorAlgorithm().getPlaneAxis2());
    }

    model.lastEventPosition = [].concat(_toConsumableArray(displayPosition), [0]);
  };

  publicAPI.rotateAxis = function (displayPos, axis) {
    var resliceCursor = publicAPI.getResliceCursor();

    if (!resliceCursor) {
      return 0;
    }

    var center = resliceCursor.getCenter(); // Intersect with the viewing vector. We will use this point and the
    // start event point to compute the rotation angle

    var currentIntersectionPos = publicAPI.displayToReslicePlaneIntersection(displayPos);
    var lastIntersectionPos = publicAPI.displayToReslicePlaneIntersection(model.lastEventPosition);

    if (lastIntersectionPos[0] === currentIntersectionPos[0] && lastIntersectionPos[1] === currentIntersectionPos[1] && lastIntersectionPos[2] === currentIntersectionPos[2]) {
      return 0;
    }

    var lastVector = [];
    var currVector = [];

    for (var i = 0; i < 3; i++) {
      lastVector[i] = lastIntersectionPos[i] - center[i];
      currVector[i] = currentIntersectionPos[i] - center[i];
    }

    normalize(lastVector);
    normalize(currVector); // Compute the angle between both vectors. This is the amount to
    // rotate by.

    var angle = Math.acos(dot(lastVector, currVector));
    var crossVector = [];
    cross(lastVector, currVector, crossVector);
    var resliceCursorPlaneId = model.resliceCursorActor.getCursorAlgorithm().getReslicePlaneNormal();
    var normalPlane = resliceCursor.getPlane(resliceCursorPlaneId);
    var aboutAxis = normalPlane.getNormal();
    var align = dot(aboutAxis, crossVector);
    var sign = align > 0 ? 1.0 : -1.0;
    angle *= sign;

    if (angle === 0) {
      return 0;
    }

    publicAPI.applyRotation(axis, angle);
    return angle;
  };

  publicAPI.applyRotation = function (axis, angle) {
    var resliceCursor = publicAPI.getResliceCursor();
    var resliceCursorPlaneId = model.resliceCursorActor.getCursorAlgorithm().getReslicePlaneNormal();
    var planeToBeRotated = resliceCursor.getPlane(axis);
    var viewUp = resliceCursor.getViewUp(axis);
    var vectorToBeRotated = planeToBeRotated.getNormal();
    var normalPlane = resliceCursor.getPlane(resliceCursorPlaneId);
    var aboutAxis = normalPlane.getNormal();

    var rotatedVector = _toConsumableArray(vectorToBeRotated);

    vtkMatrixBuilder.buildFromRadian().rotate(angle, aboutAxis).apply(rotatedVector);
    vtkMatrixBuilder.buildFromRadian().rotate(angle, aboutAxis).apply(viewUp);
    planeToBeRotated.setNormal(rotatedVector);
  };

  publicAPI.getBounds = function () {
    var bounds = [];
    uninitializeBounds(bounds);
    var resliceCursor = publicAPI.getResliceCursor();

    if (resliceCursor) {
      if (resliceCursor.getImage()) {
        bounds = resliceCursor.getImage().getBounds();
      }
    }

    return bounds;
  };

  publicAPI.getActors = function () {
    // Update representation
    publicAPI.buildRepresentation(); // Update CameraPosition

    publicAPI.updateCamera();
    return [model.imageActor].concat(_toConsumableArray(model.resliceCursorActor.getActors()));
  };

  publicAPI.updateCamera = function () {
    var normalAxis = model.resliceCursorActor.getCursorAlgorithm().getReslicePlaneNormal(); // When the reslice plane is changed, update the camera to look at the
    // normal to the reslice plane always.

    var focalPoint = model.renderer.getActiveCamera().getFocalPoint();
    var position = model.renderer.getActiveCamera().getPosition();
    var normalPlane = publicAPI.getResliceCursor().getPlane(normalAxis);
    var normal = normalPlane.getNormal();
    var distance = Math.sqrt(distance2BetweenPoints(position, focalPoint));
    var estimatedCameraPosition = [focalPoint[0] + distance * normal[0], focalPoint[1] + distance * normal[1], focalPoint[2] + distance * normal[2]]; // intersect with the plane to get updated focal point

    var intersection = vtkPlane.intersectWithLine(focalPoint, estimatedCameraPosition, normalPlane.getOrigin(), normalPlane.getNormal());
    var newFocalPoint = intersection.x;
    model.renderer.getActiveCamera().setFocalPoint(newFocalPoint[0], newFocalPoint[1], newFocalPoint[2]);
    var newCameraPosition = [newFocalPoint[0] + distance * normal[0], newFocalPoint[1] + distance * normal[1], newFocalPoint[2] + distance * normal[2]];
    model.renderer.getActiveCamera().setPosition(newCameraPosition[0], newCameraPosition[1], newCameraPosition[2]); // Renderer may not have yet actor bounds

    var rendererBounds = model.renderer.computeVisiblePropBounds();
    var bounds = publicAPI.getBounds();
    rendererBounds[0] = Math.min(bounds[0], rendererBounds[0]);
    rendererBounds[1] = Math.max(bounds[1], rendererBounds[1]);
    rendererBounds[2] = Math.min(bounds[2], rendererBounds[2]);
    rendererBounds[3] = Math.max(bounds[3], rendererBounds[3]);
    rendererBounds[4] = Math.min(bounds[4], rendererBounds[4]);
    rendererBounds[5] = Math.max(bounds[5], rendererBounds[5]); // Don't clip away any part of the data.

    model.renderer.resetCameraClippingRange(rendererBounds);
  };
  /**
   * Reimplemented to look at image center instead of reslice cursor.
   */


  publicAPI.resetCamera = function () {
    if (model.renderer) {
      var normalAxis = publicAPI.getCursorAlgorithm().getReslicePlaneNormal();
      var normal = publicAPI.getResliceCursor().getPlane(normalAxis).getNormal();
      var viewUp = publicAPI.getResliceCursor().getViewUp(normalAxis);
      var focalPoint = model.renderer.getActiveCamera().getFocalPoint();
      var position = model.renderer.getActiveCamera().getPosition(); // Distance is preserved

      var distance = Math.sqrt(distance2BetweenPoints(position, focalPoint));
      var newCameraPosition = [focalPoint[0] + distance * normal[0], focalPoint[1] + distance * normal[1], focalPoint[2] + distance * normal[2]];
      model.renderer.getActiveCamera().setPosition(newCameraPosition[0], newCameraPosition[1], newCameraPosition[2]);
      model.renderer.getActiveCamera().setViewUp(viewUp[0], viewUp[1], viewUp[2]);
    }
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  vtkResliceCursorRepresentation.extend(publicAPI, model, DEFAULT_VALUES, initialValues);
  model.resliceCursorActor = vtkResliceCursorActor.newInstance({
    parentProp: publicAPI
  });
  model.startPickPosition = null;
  model.startCenterPosition = null;
  macro.get(publicAPI, model, ['resliceCursorActor']); // Object methods

  vtkResliceCursorLineRepresentation(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkResliceCursorLineRepresentation'); // ----------------------------------------------------------------------------

var vtkResliceCursorLineRepresentation$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkResliceCursorLineRepresentation$1 as default, extend, newInstance };
