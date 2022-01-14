import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../../macros.js';
import { o as vtkMath } from '../../../Common/Core/Math/index.js';
import vtkBoundingBox from '../../../Common/DataModel/BoundingBox.js';
import vtkPlane from '../../../Common/DataModel/Plane.js';
import { ShapeBehavior, BehaviorCategory, TextPosition } from './Constants.js';
import { boundPlane } from '../ResliceCursorWidget/helpers.js';
import { vec3 } from 'gl-matrix';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var vtkErrorMacro = macro.vtkErrorMacro;
var EPSILON = 1e-6;
function widgetBehavior(publicAPI, model) {
  model.classHierarchy.push('vtkShapeWidgetProp');
  model.keysDown = {};

  var superClass = _objectSpread({}, publicAPI); // --------------------------------------------------------------------------
  // Display 2D
  // --------------------------------------------------------------------------


  publicAPI.setDisplayCallback = function (callback) {
    return model.representations[0].setDisplayCallback(callback);
  };

  publicAPI.setText = function (text) {
    model.widgetState.getText().setText(text); // Recompute position

    model.interactor.render();
  }; // --------------------------------------------------------------------------
  // Public methods
  // --------------------------------------------------------------------------


  publicAPI.setResetAfterPointPlacement = model.factory.setResetAfterPointPlacement;
  publicAPI.getResetAfterPointPlacement = model.factory.getResetAfterPointPlacement;
  publicAPI.setModifierBehavior = model.factory.setModifierBehavior;
  publicAPI.getModifierBehavior = model.factory.getModifierBehavior;

  publicAPI.isBehaviorActive = function (category, flag) {
    return Object.keys(model.keysDown).some(function (key) {
      return model.keysDown[key] && publicAPI.getModifierBehavior()[key] && publicAPI.getModifierBehavior()[key][category] === flag;
    });
  };

  publicAPI.isOppositeBehaviorActive = function (category, flag) {
    return Object.values(ShapeBehavior[category]).some(function (flagToTry) {
      return flag !== flagToTry && publicAPI.isBehaviorActive(category, flagToTry);
    });
  };

  publicAPI.getActiveBehaviorFromCategory = function (category) {
    return Object.values(ShapeBehavior[category]).find(function (flag) {
      return publicAPI.isBehaviorActive(category, flag) || !publicAPI.isOppositeBehaviorActive(category, flag) && publicAPI.getModifierBehavior().None[category] === flag;
    });
  };

  publicAPI.isRatioFixed = function () {
    return publicAPI.getActiveBehaviorFromCategory(BehaviorCategory.RATIO) === ShapeBehavior[BehaviorCategory.RATIO].FIXED;
  };

  publicAPI.isDraggingEnabled = function () {
    var behavior = publicAPI.getActiveBehaviorFromCategory(BehaviorCategory.PLACEMENT);
    return behavior === ShapeBehavior[BehaviorCategory.PLACEMENT].DRAG || behavior === ShapeBehavior[BehaviorCategory.PLACEMENT].CLICK_AND_DRAG;
  };

  publicAPI.isDraggingForced = function () {
    return publicAPI.isBehaviorActive(BehaviorCategory.PLACEMENT, ShapeBehavior[BehaviorCategory.PLACEMENT].DRAG) || publicAPI.getModifierBehavior().None[BehaviorCategory.PLACEMENT] === ShapeBehavior[BehaviorCategory.PLACEMENT].DRAG;
  };

  publicAPI.getPoint1 = function () {
    return model.point1;
  };

  publicAPI.getPoint2 = function () {
    return model.point2;
  };

  publicAPI.setPoints = function (point1, point2) {
    model.point1 = point1;
    model.point2 = point2;
    model.point1Handle.setOrigin(model.point1);
    model.point2Handle.setOrigin(model.point2);
    publicAPI.updateShapeBounds();
  }; // This method is to be called to place the first point
  // for the first time. It is not inlined so that
  // the user can specify himself where the first point
  // is right after publicAPI.grabFocus() without waiting
  // for interactions.


  publicAPI.placePoint1 = function (point) {
    if (model.hasFocus) {
      publicAPI.setPoints(point, point);
      model.point1Handle.deactivate();
      model.point2Handle.activate();
      model.activeState = model.point2Handle;
      model.point2Handle.setVisible(true);
      model.widgetState.getText().setVisible(true);
      publicAPI.updateShapeBounds();
      model.shapeHandle.setVisible(true);
    }
  };

  publicAPI.placePoint2 = function (point2) {
    if (model.hasFocus) {
      model.point2 = point2;
      model.point2Handle.setOrigin(model.point2);
      publicAPI.updateShapeBounds();
    }
  }; // --------------------------------------------------------------------------
  // Private methods
  // --------------------------------------------------------------------------


  publicAPI.makeSquareFromPoints = function (point1, point2) {
    var diagonal = [0, 0, 0];
    vec3.subtract(diagonal, point2, point1);
    var dir = model.shapeHandle.getDirection();
    var right = model.shapeHandle.getRight();
    var up = model.shapeHandle.getUp();
    var dirComponent = vec3.dot(diagonal, dir);
    var rightComponent = vec3.dot(diagonal, right);
    var upComponent = vec3.dot(diagonal, up);
    var absRightComponent = Math.abs(rightComponent);
    var absUpComponent = Math.abs(upComponent);

    if (absRightComponent < EPSILON) {
      rightComponent = upComponent;
    } else if (absUpComponent < EPSILON) {
      upComponent = rightComponent;
    } else if (absRightComponent > absUpComponent) {
      upComponent = upComponent / absUpComponent * absRightComponent;
    } else {
      rightComponent = rightComponent / absRightComponent * absUpComponent;
    }

    return [point1[0] + rightComponent * right[0] + upComponent * up[0] + dirComponent * dir[0], point1[1] + rightComponent * right[1] + upComponent * up[1] + dirComponent * dir[1], point1[2] + rightComponent * right[2] + upComponent * up[2] + dirComponent * dir[2]];
  };

  var getCornersFromRadius = function getCornersFromRadius(center, pointOnCircle) {
    var radius = vec3.distance(center, pointOnCircle);
    var up = model.shapeHandle.getUp();
    var right = model.shapeHandle.getRight();
    var point1 = [center[0] + (up[0] - right[0]) * radius, center[1] + (up[1] - right[1]) * radius, center[2] + (up[2] - right[2]) * radius];
    var point2 = [center[0] + (right[0] - up[0]) * radius, center[1] + (right[1] - up[1]) * radius, center[2] + (right[2] - up[2]) * radius];
    return {
      point1: point1,
      point2: point2
    };
  };

  var getCornersFromDiameter = function getCornersFromDiameter(point1, point2) {
    var center = [0.5 * (point1[0] + point2[0]), 0.5 * (point1[1] + point2[1]), 0.5 * (point1[2] + point2[2])];
    return getCornersFromRadius(center, point1);
  }; // TODO: move to ShapeWidget/index.js


  publicAPI.getBounds = function () {
    return model.point1 && model.point2 ? vtkMath.computeBoundsFromPoints(model.point1, model.point2, []) : vtkMath.uninitializeBounds([]);
  }; // To be reimplemented by subclass


  publicAPI.setCorners = function (point1, point2) {
    publicAPI.updateTextPosition(point1, point2);
  };

  publicAPI.updateShapeBounds = function () {
    if (model.point1 && model.point2) {
      var point1 = _toConsumableArray(model.point1);

      var point2 = _toConsumableArray(model.point2);

      if (publicAPI.isRatioFixed()) {
        point2 = publicAPI.makeSquareFromPoints(point1, point2);
      }

      switch (publicAPI.getActiveBehaviorFromCategory(BehaviorCategory.POINTS)) {
        case ShapeBehavior[BehaviorCategory.POINTS].CORNER_TO_CORNER:
          {
            publicAPI.setCorners(point1, point2);
            break;
          }

        case ShapeBehavior[BehaviorCategory.POINTS].CENTER_TO_CORNER:
          {
            var diagonal = [0, 0, 0];
            vec3.subtract(diagonal, point1, point2);
            vec3.add(point1, point1, diagonal);
            publicAPI.setCorners(point1, point2);
            break;
          }

        case ShapeBehavior[BehaviorCategory.POINTS].RADIUS:
          {
            var points = getCornersFromRadius(point1, point2);
            publicAPI.setCorners(points.point1, points.point2);
            break;
          }

        case ShapeBehavior[BehaviorCategory.POINTS].DIAMETER:
          {
            var _points = getCornersFromDiameter(point1, point2);

            publicAPI.setCorners(_points.point1, _points.point2);
            break;
          }

        default:
          // This should never be executed
          vtkErrorMacro('vtk internal error');
      }
    }
  };

  var computePositionVector = function computePositionVector(textPosition, minPoint, maxPoint) {
    var positionVector = [0, 0, 0];

    switch (textPosition) {
      case TextPosition.MIN:
        break;

      case TextPosition.MAX:
        vtkMath.subtract(maxPoint, minPoint, positionVector);
        break;

      case TextPosition.CENTER:
      default:
        vtkMath.subtract(maxPoint, minPoint, positionVector);
        vtkMath.multiplyScalar(positionVector, 0.5);
        break;
    }

    return positionVector;
  };

  var computeTextPosition = function computeTextPosition(worldBounds, textPosition) {
    var _model$apiSpecificRen, _model$apiSpecificRen2, _model$apiSpecificRen5;

    var worldMargin = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var viewPlaneOrigin = model.manipulator.getOrigin();
    var viewPlaneNormal = model.manipulator.getNormal();
    var viewUp = model.renderer.getActiveCamera().getViewUp();
    var positionMargin = Array.isArray(worldMargin) ? _toConsumableArray(worldMargin) : [worldMargin, worldMargin, viewPlaneOrigin ? worldMargin : 0]; // Map bounds from world positions to display positions

    var minPoint = (_model$apiSpecificRen = model.apiSpecificRenderWindow).worldToDisplay.apply(_model$apiSpecificRen, _toConsumableArray(vtkBoundingBox.getMinPoint(worldBounds)).concat([model.renderer]));

    var maxPoint = (_model$apiSpecificRen2 = model.apiSpecificRenderWindow).worldToDisplay.apply(_model$apiSpecificRen2, _toConsumableArray(vtkBoundingBox.getMaxPoint(worldBounds)).concat([model.renderer]));

    var displayBounds = vtkMath.computeBoundsFromPoints(minPoint, maxPoint, []);
    var planeOrigin = [];
    var p1 = [];
    var p2 = [];
    var p3 = []; // If we are in a 2D projection

    if (viewPlaneOrigin && viewPlaneNormal && viewUp && vtkBoundingBox.intersectPlane(displayBounds, viewPlaneOrigin, viewPlaneNormal)) {
      var _model$apiSpecificRen3, _model$apiSpecificRen4;

      // Map plane origin from world positions to display positions
      var displayPlaneOrigin = (_model$apiSpecificRen3 = model.apiSpecificRenderWindow).worldToDisplay.apply(_model$apiSpecificRen3, _toConsumableArray(viewPlaneOrigin).concat([model.renderer])); // Map plane normal from world positions to display positions


      var planeNormalPoint = vtkMath.add(viewPlaneOrigin, viewPlaneNormal, []);

      var displayPlaneNormalPoint = (_model$apiSpecificRen4 = model.apiSpecificRenderWindow).worldToDisplay.apply(_model$apiSpecificRen4, _toConsumableArray(planeNormalPoint).concat([model.renderer]));

      var displayPlaneNormal = vtkMath.subtract(displayPlaneNormalPoint, displayPlaneOrigin); // Project view plane into bounding box

      var largeDistance = 10 * vtkBoundingBox.getDiagonalLength(displayBounds);
      vtkPlane.projectPoint(vtkBoundingBox.getCenter(displayBounds), displayPlaneOrigin, displayPlaneNormal, planeOrigin);
      var planeU = vtkMath.cross(viewUp, displayPlaneNormal, []);
      vtkMath.normalize(planeU); // u

      vtkMath.normalize(viewUp); // v

      vtkMath.normalize(displayPlaneNormal); // w

      vtkMath.multiplyAccumulate(planeOrigin, viewUp, -largeDistance, planeOrigin);
      vtkMath.multiplyAccumulate(planeOrigin, planeU, -largeDistance, planeOrigin);
      p1 = vtkMath.multiplyAccumulate(planeOrigin, planeU, 2 * largeDistance, []);
      p2 = vtkMath.multiplyAccumulate(planeOrigin, viewUp, 2 * largeDistance, []);
      p3 = planeOrigin;
      boundPlane(displayBounds, planeOrigin, p1, p2);
    } else {
      planeOrigin = [displayBounds[0], displayBounds[2], displayBounds[4]];
      p1 = [displayBounds[1], displayBounds[2], displayBounds[4]];
      p2 = [displayBounds[0], displayBounds[3], displayBounds[4]];
      p3 = [displayBounds[0], displayBounds[2], displayBounds[5]];
    } // Compute horizontal, vertical and depth position


    var u = computePositionVector(textPosition[0], planeOrigin, p1);
    var v = computePositionVector(textPosition[1], planeOrigin, p2);
    var w = computePositionVector(textPosition[2], planeOrigin, p3);
    var finalPosition = planeOrigin;
    vtkMath.add(finalPosition, u, finalPosition);
    vtkMath.add(finalPosition, v, finalPosition);
    vtkMath.add(finalPosition, w, finalPosition);
    vtkMath.add(finalPosition, positionMargin, finalPosition);
    return (_model$apiSpecificRen5 = model.apiSpecificRenderWindow).displayToWorld.apply(_model$apiSpecificRen5, finalPosition.concat([model.renderer]));
  };

  publicAPI.updateTextPosition = function (point1, point2) {
    var bounds = vtkMath.computeBoundsFromPoints(point1, point2, []);
    var screenPosition = computeTextPosition(bounds, model.widgetState.getTextPosition(), model.widgetState.getTextWorldMargin());
    var textHandle = model.widgetState.getText();
    textHandle.setOrigin(screenPosition);
  };
  /*
   * If the widget has the focus, this method reset the widget
   * to it's state just after it grabbed the focus. Otherwise
   * it resets the widget to its state before it grabbed the focus.
   */


  publicAPI.reset = function () {
    model.point1 = null;
    model.point2 = null;
    model.widgetState.getText().setVisible(false);
    model.point1Handle.setOrigin(null);
    model.point2Handle.setOrigin(null);
    model.shapeHandle.setOrigin(null);
    model.shapeHandle.setVisible(false);
    model.point2Handle.setVisible(false);
    model.point2Handle.deactivate();

    if (model.hasFocus) {
      model.point1Handle.activate();
      model.activeState = model.point1Handle;
    } else {
      model.point1Handle.setVisible(false);
      model.point1Handle.deactivate();
      model.activeState = null;
    }

    publicAPI.updateShapeBounds();
  }; // --------------------------------------------------------------------------
  // Interactor events
  // --------------------------------------------------------------------------


  publicAPI.handleMouseMove = function (callData) {
    if (!model.activeState || !model.activeState.getActive() || !model.pickable || !model.dragable || !model.manipulator) {
      return macro.VOID;
    }

    if (!model.point2) {
      // Update orientation to match the camera's plane
      // if the corners are not yet placed
      var normal = model.camera.getDirectionOfProjection();
      var up = model.camera.getViewUp();
      var right = [];
      vec3.cross(right, up, normal);
      model.shapeHandle.setUp(up);
      model.shapeHandle.setRight(right);
      model.shapeHandle.setDirection(normal);
      model.manipulator.setNormal(normal);
    }

    var worldCoords = model.manipulator.handleEvent(callData, model.apiSpecificRenderWindow);

    if (!worldCoords.length) {
      return macro.VOID;
    }

    if (model.hasFocus) {
      if (!model.point1) {
        model.point1Handle.setOrigin(worldCoords);
      } else {
        model.point2Handle.setOrigin(worldCoords);
        model.point2 = worldCoords;
        publicAPI.updateShapeBounds();
        publicAPI.invokeInteractionEvent();
      }
    } else if (model.isDragging) {
      if (model.activeState === model.point1Handle) {
        model.point1Handle.setOrigin(worldCoords);
        model.point1 = worldCoords;
      } else {
        model.point2Handle.setOrigin(worldCoords);
        model.point2 = worldCoords;
      }

      publicAPI.updateShapeBounds();
      publicAPI.invokeInteractionEvent();
    }

    return model.hasFocus ? macro.EVENT_ABORT : macro.VOID;
  }; // --------------------------------------------------------------------------
  // Left click: Add point / End interaction
  // --------------------------------------------------------------------------


  publicAPI.handleLeftButtonPress = function (e) {
    if (!model.activeState || !model.activeState.getActive() || !model.pickable) {
      return macro.VOID;
    }

    if (model.hasFocus) {
      if (!model.point1) {
        publicAPI.placePoint1(model.point1Handle.getOrigin());
        publicAPI.invokeStartInteractionEvent();
      } else {
        publicAPI.placePoint2(model.point2Handle.getOrigin());
        publicAPI.invokeInteractionEvent();
        publicAPI.invokeEndInteractionEvent();

        if (publicAPI.getResetAfterPointPlacement()) {
          publicAPI.reset();
        } else {
          publicAPI.loseFocus();
        }
      }

      return macro.EVENT_ABORT;
    }

    if (model.point1 && (model.activeState === model.point1Handle || model.activeState === model.point2Handle)) {
      model.isDragging = true;
      model.apiSpecificRenderWindow.setCursor('grabbing');
      model.interactor.requestAnimation(publicAPI);
      publicAPI.invokeStartInteractionEvent();
      return macro.EVENT_ABORT;
    }

    return macro.VOID;
  }; // --------------------------------------------------------------------------
  // Left release: Maybe end interaction
  // --------------------------------------------------------------------------


  publicAPI.handleLeftButtonRelease = function (e) {
    if (model.isDragging) {
      model.isDragging = false;
      model.apiSpecificRenderWindow.setCursor('pointer');
      model.widgetState.deactivate();
      model.interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
      return macro.EVENT_ABORT;
    }

    if (!model.hasFocus || !model.pickable) {
      return macro.VOID;
    }

    var viewSize = model.apiSpecificRenderWindow.getSize();

    if (e.position.x < 0 || e.position.x > viewSize[0] - 1 || e.position.y < 0 || e.position.y > viewSize[1] - 1) {
      return macro.VOID;
    }

    if (model.point1) {
      publicAPI.placePoint2(model.point2Handle.getOrigin());

      if (publicAPI.isDraggingEnabled()) {
        var distance = vec3.squaredDistance(model.point1, model.point2);
        var maxDistance = 100;

        if (distance > maxDistance || publicAPI.isDraggingForced()) {
          publicAPI.invokeInteractionEvent();
          publicAPI.invokeEndInteractionEvent();

          if (publicAPI.getResetAfterPointPlacement()) {
            publicAPI.reset();
          } else {
            publicAPI.loseFocus();
          }
        }
      }
    }

    return macro.EVENT_ABORT;
  }; // --------------------------------------------------------------------------
  // Register key presses/releases
  // --------------------------------------------------------------------------


  publicAPI.handleKeyDown = function (_ref) {
    var key = _ref.key;

    if (key === 'Escape') {
      if (model.hasFocus) {
        publicAPI.reset();
        publicAPI.loseFocus();
        publicAPI.invokeEndInteractionEvent();
      }
    } else {
      model.keysDown[key] = true;
    }

    if (model.hasFocus) {
      if (model.point1) {
        model.point2 = model.point2Handle.getOrigin();
        publicAPI.updateShapeBounds();
      }
    }
  };

  publicAPI.handleKeyUp = function (_ref2) {
    var key = _ref2.key;
    model.keysDown[key] = false;

    if (model.hasFocus) {
      if (model.point1) {
        model.point2 = model.point2Handle.getOrigin();
        publicAPI.updateShapeBounds();
      }
    }
  }; // --------------------------------------------------------------------------
  // Focus API - follow mouse when widget has focus
  // --------------------------------------------------------------------------


  publicAPI.grabFocus = function () {
    if (!model.hasFocus) {
      publicAPI.reset();
      model.point1Handle.activate();
      model.activeState = model.point1Handle;
      model.point1Handle.setVisible(true);
      model.shapeHandle.setVisible(false);
      model.interactor.requestAnimation(publicAPI);
    }

    superClass.grabFocus();
  }; // --------------------------------------------------------------------------


  publicAPI.loseFocus = function () {
    if (model.hasFocus) {
      model.interactor.cancelAnimation(publicAPI);
    }

    if (!model.point1) {
      model.point1Handle.setVisible(false);
      model.point2Handle.setVisible(false);
    }

    model.widgetState.deactivate();
    model.point1Handle.deactivate();
    model.point2Handle.deactivate();
    model.activeState = null;
    model.interactor.render();
    model.widgetManager.enablePicking();
    superClass.loseFocus();
  };
}

export { widgetBehavior as default };
