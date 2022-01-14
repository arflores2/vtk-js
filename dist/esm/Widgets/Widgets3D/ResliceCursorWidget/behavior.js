import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../../macros.js';
import vtkBoundingBox from '../../../Common/DataModel/BoundingBox.js';
import vtkLine from '../../../Common/DataModel/Line.js';
import vtkPlanePointManipulator from '../../Manipulators/PlaneManipulator.js';
import { w as multiplyScalar, g as subtract, f as normalize, d as dot, j as cross, Q as multiplyAccumulate, S as signedAngleBetweenVectors } from '../../../Common/Core/Math/index.js';
import { updateState, getAssociatedLinesName, boundPointOnPlane, rotateVector } from './helpers.js';
import { InteractionMethodsName, ScrollingMethods } from './Constants.js';

function widgetBehavior(publicAPI, model) {
  var isDragging = null;
  var isScrolling = false; // Reset "updateMethodName" attribute when no actors are selected
  // Useful to update 'updateMethodeName' to the correct name which
  // will be TranslateCenter by default

  publicAPI.resetUpdateMethod = function () {
    if (model.representations.length !== 0) {
      model.representations[0].getSelectedState();
    }
  };

  publicAPI.startScrolling = function (newPosition) {
    if (newPosition) {
      model.previousPosition = newPosition;
    }

    isScrolling = true;
    publicAPI.resetUpdateMethod();
    publicAPI.startInteraction();
  };

  publicAPI.endScrolling = function () {
    isScrolling = false;
    publicAPI.endInteraction();
  };

  publicAPI.updateCursor = function () {
    switch (model.activeState.getUpdateMethodName()) {
      case InteractionMethodsName.TranslateCenter:
        model.apiSpecificRenderWindow.setCursor('move');
        break;

      case InteractionMethodsName.RotateLine:
        model.apiSpecificRenderWindow.setCursor('alias');
        break;

      case InteractionMethodsName.TranslateAxis:
        model.apiSpecificRenderWindow.setCursor('pointer');
        break;

      default:
        model.apiSpecificRenderWindow.setCursor('default');
        break;
    }
  };

  publicAPI.handleLeftButtonPress = function (callData) {
    if (model.activeState && model.activeState.getActive()) {
      isDragging = true;
      var viewType = model.widgetState.getActiveViewType();
      var currentPlaneNormal = model.widgetState.getPlanes()[viewType].normal;
      model.planeManipulator.setOrigin(model.widgetState.getCenter());
      model.planeManipulator.setNormal(currentPlaneNormal);
      publicAPI.startInteraction();
    } else if (model.widgetState.getScrollingMethod() === ScrollingMethods.LEFT_MOUSE_BUTTON) {
      publicAPI.startScrolling(callData.position);
    } else {
      return macro.VOID;
    }

    return macro.EVENT_ABORT;
  };

  publicAPI.handleMouseMove = function (callData) {
    if (isDragging && model.pickable && model.dragable) {
      return publicAPI.handleEvent(callData);
    }

    if (isScrolling) {
      if (model.previousPosition.y !== callData.position.y) {
        var step = model.previousPosition.y - callData.position.y;
        publicAPI.translateCenterOnCurrentDirection(step, callData.pokedRenderer);
        model.previousPosition = callData.position;
        publicAPI.invokeInternalInteractionEvent();
      }
    }

    return macro.VOID;
  };

  publicAPI.handleLeftButtonRelease = function () {
    if (isDragging || isScrolling) {
      publicAPI.endScrolling();
    }

    isDragging = false;
    model.widgetState.deactivate();
  };

  publicAPI.handleRightButtonPress = function (calldata) {
    if (model.widgetState.getScrollingMethod() === ScrollingMethods.RIGHT_MOUSE_BUTTON) {
      publicAPI.startScrolling(calldata.position);
    }
  };

  publicAPI.handleRightButtonRelease = function (calldata) {
    if (model.widgetState.getScrollingMethod() === ScrollingMethods.RIGHT_MOUSE_BUTTON) {
      publicAPI.endScrolling();
    }
  };

  publicAPI.handleStartMouseWheel = function (callData) {
    publicAPI.resetUpdateMethod();
    publicAPI.startInteraction();
  };

  publicAPI.handleMouseWheel = function (calldata) {
    var step = calldata.spinY;
    isScrolling = true;
    publicAPI.translateCenterOnCurrentDirection(step, calldata.pokedRenderer);
    publicAPI.invokeInternalInteractionEvent();
    isScrolling = false;
    return macro.EVENT_ABORT;
  };

  publicAPI.handleEndMouseWheel = function (calldata) {
    publicAPI.endScrolling();
  };

  publicAPI.handleMiddleButtonPress = function (calldata) {
    if (model.widgetState.getScrollingMethod() === ScrollingMethods.MIDDLE_MOUSE_BUTTON) {
      publicAPI.startScrolling(calldata.position);
    }
  };

  publicAPI.handleMiddleButtonRelease = function (calldata) {
    if (model.widgetState.getScrollingMethod() === ScrollingMethods.MIDDLE_MOUSE_BUTTON) {
      publicAPI.endScrolling();
    }
  };

  publicAPI.handleEvent = function (callData) {
    if (model.activeState.getActive()) {
      publicAPI[model.activeState.getUpdateMethodName()](callData);
      publicAPI.invokeInternalInteractionEvent();
      return macro.EVENT_ABORT;
    }

    return macro.VOID;
  };

  publicAPI.invokeInternalInteractionEvent = function () {
    var methodName = model.activeState ? model.activeState.getUpdateMethodName() : '';
    var computeFocalPointOffset = methodName !== InteractionMethodsName.RotateLine;
    var canUpdateFocalPoint = methodName === InteractionMethodsName.RotateLine;
    publicAPI.invokeInteractionEvent({
      computeFocalPointOffset: computeFocalPointOffset,
      canUpdateFocalPoint: canUpdateFocalPoint
    });
  };

  publicAPI.startInteraction = function () {
    publicAPI.invokeStartInteractionEvent(); // When interacting, plane actor and lines must be re-rendered on other views

    publicAPI.getViewWidgets().forEach(function (viewWidget) {
      viewWidget.getInteractor().requestAnimation(publicAPI);
    });
  };

  publicAPI.endInteraction = function () {
    publicAPI.invokeEndInteractionEvent();
    publicAPI.getViewWidgets().forEach(function (viewWidget) {
      viewWidget.getInteractor().cancelAnimation(publicAPI);
    });
  };

  publicAPI.translateCenterOnCurrentDirection = function (nbSteps, renderer) {
    var dirProj = renderer.getRenderWindow().getRenderers()[0].getActiveCamera().getDirectionOfProjection(); // Direction of the projection is the inverse of what we want

    var direction = multiplyScalar(dirProj, -1);
    var oldCenter = model.widgetState.getCenter();
    var image = model.widgetState.getImage();
    var imageSpacing = image.getSpacing(); // Use Chebyshev norm
    // https://math.stackexchange.com/questions/71423/what-is-the-term-for-the-projection-of-a-vector-onto-the-unit-cube

    var absDirProj = dirProj.map(function (value) {
      return Math.abs(value);
    });
    var index = absDirProj.indexOf(Math.max.apply(Math, _toConsumableArray(absDirProj)));
    var movingFactor = nbSteps * (imageSpacing[index] / dirProj[index]); // Define the potentially new center

    var newCenter = [oldCenter[0] + movingFactor * direction[0], oldCenter[1] + movingFactor * direction[1], oldCenter[2] + movingFactor * direction[2]];
    newCenter = publicAPI.getBoundedCenter(newCenter);
    model.widgetState.setCenter(newCenter);
    updateState(model.widgetState);
  };

  publicAPI[InteractionMethodsName.TranslateAxis] = function (calldata) {
    var stateLine = model.widgetState.getActiveLineState();
    var worldCoords = model.planeManipulator.handleEvent(calldata, model.apiSpecificRenderWindow);
    var point1 = stateLine.getPoint1();
    var point2 = stateLine.getPoint2(); // Translate the current line along the other line

    var otherLineName = getAssociatedLinesName(stateLine.getName());
    var otherLine = model.widgetState["get".concat(otherLineName)]();
    var otherLineVector = subtract(otherLine.getPoint2(), otherLine.getPoint1(), []);
    normalize(otherLineVector);
    var axisTranslation = otherLineVector;
    var currentLineVector = subtract(point2, point1, [0, 0, 0]);
    normalize(currentLineVector);
    var dot$1 = dot(currentLineVector, otherLineVector); // lines are colinear, translate along perpendicular axis from current line

    if (dot$1 === 1 || dot$1 === -1) {
      cross(currentLineVector, model.planeManipulator.getNormal(), axisTranslation);
    }

    var closestPoint = [];
    vtkLine.distanceToLine(worldCoords, point1, point2, closestPoint);
    var translationVector = subtract(worldCoords, closestPoint, []);
    var translationDistance = dot(translationVector, axisTranslation);
    var center = model.widgetState.getCenter();
    var newOrigin = multiplyAccumulate(center, axisTranslation, translationDistance, [0, 0, 0]);
    newOrigin = publicAPI.getBoundedCenter(newOrigin);
    model.widgetState.setCenter(newOrigin);
    updateState(model.widgetState);
  };

  publicAPI.getBoundedCenter = function (newCenter) {
    var oldCenter = model.widgetState.getCenter();
    var imageBounds = model.widgetState.getImage().getBounds();

    if (vtkBoundingBox.containsPoint.apply(vtkBoundingBox, [imageBounds].concat(_toConsumableArray(newCenter)))) {
      return newCenter;
    }

    return boundPointOnPlane(newCenter, oldCenter, imageBounds);
  };

  publicAPI[InteractionMethodsName.TranslateCenter] = function (calldata) {
    var worldCoords = model.planeManipulator.handleEvent(calldata, model.apiSpecificRenderWindow);
    worldCoords = publicAPI.getBoundedCenter(worldCoords);
    model.activeState.setCenter(worldCoords);
    updateState(model.widgetState);
  };

  publicAPI[InteractionMethodsName.RotateLine] = function (calldata) {
    var activeLine = model.widgetState.getActiveLineState();
    var planeNormal = model.planeManipulator.getNormal();
    var worldCoords = model.planeManipulator.handleEvent(calldata, model.apiSpecificRenderWindow);
    var center = model.widgetState.getCenter();
    var previousLineDirection = subtract(activeLine.getPoint1(), activeLine.getPoint2(), []);
    normalize(previousLineDirection);

    if (model.widgetState.getActiveRotationPointName() === 'point1') {
      multiplyScalar(previousLineDirection, -1);
    }

    var currentVectorToOrigin = [0, 0, 0];
    subtract(worldCoords, center, currentVectorToOrigin);
    normalize(currentVectorToOrigin);
    var radianAngle = signedAngleBetweenVectors(previousLineDirection, currentVectorToOrigin, planeNormal);
    publicAPI.rotateLineInView(activeLine, radianAngle);
  };
  /**
   * Rotate a line by a specified angle
   * @param {Line} line The line to rotate (e.g. getActiveLineState())
   * @param {Number} radianAngle Applied angle in radian
   */


  publicAPI.rotateLineInView = function (line, radianAngle) {
    var viewType = line.getViewType();
    var inViewType = line.getInViewType();
    var planeNormal = model.widgetState.getPlanes()[inViewType].normal;
    publicAPI.rotatePlane(viewType, radianAngle, planeNormal);

    if (model.widgetState.getKeepOrthogonality()) {
      var associatedLineName = getAssociatedLinesName(line.getName());
      var associatedLine = model.widgetState["get".concat(associatedLineName)]();
      var associatedViewType = associatedLine.getViewType();
      publicAPI.rotatePlane(associatedViewType, radianAngle, planeNormal);
    }

    updateState(model.widgetState);
  };
  /**
   * Rotate a specified plane around an other specified plane.
   * @param {ViewTypes} viewType Define which plane will be rotated
   * @param {Number} radianAngle Applied angle in radian
   * @param {vec3} planeNormal Define the axis to rotate around
   */


  publicAPI.rotatePlane = function (viewType, radianAngle, planeNormal) {
    var _model$widgetState$ge = model.widgetState.getPlanes()[viewType],
        normal = _model$widgetState$ge.normal,
        viewUp = _model$widgetState$ge.viewUp;
    var newNormal = rotateVector(normal, planeNormal, radianAngle);
    var newViewUp = rotateVector(viewUp, planeNormal, radianAngle);
    model.widgetState.getPlanes()[viewType] = {
      normal: newNormal,
      viewUp: newViewUp
    };
  }; // --------------------------------------------------------------------------
  // initialization
  // --------------------------------------------------------------------------


  model.planeManipulator = vtkPlanePointManipulator.newInstance();
}

export { widgetBehavior as default };
