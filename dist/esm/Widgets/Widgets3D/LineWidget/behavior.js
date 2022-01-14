import _defineProperty from '@babel/runtime/helpers/defineProperty';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import Constants from './Constants.js';
import macro from '../../../macros.js';
import { g as subtract, k as add, f as normalize } from '../../../Common/Core/Math/index.js';
import { getNumberOfPlacedHandles, isHandlePlaced, calculateTextPosition, updateTextPosition, getPoint } from './helpers.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var ShapeType = Constants.ShapeType; // Total number of points to place

var MAX_POINTS = 2;
var handleGetters = ['getHandle1', 'getHandle2', 'getMoveHandle'];
function widgetBehavior(publicAPI, model) {
  model.classHierarchy.push('vtkLineWidgetProp');
  /**
   * Returns the handle at the handleIndex'th index.
   * @param {number} handleIndex 0, 1 or 2
   */

  publicAPI.getHandle = function (handleIndex) {
    return model.widgetState[handleGetters[handleIndex]]();
  };

  publicAPI.isPlaced = function () {
    return getNumberOfPlacedHandles(model.widgetState) === MAX_POINTS;
  }; // --------------------------------------------------------------------------
  // Interactor event
  // --------------------------------------------------------------------------


  function ignoreKey(e) {
    return e.altKey || e.controlKey || e.shiftKey;
  }

  function updateCursor(callData) {
    model.isDragging = true;
    model.previousPosition = _toConsumableArray(model.manipulator.handleEvent(callData, model.apiSpecificRenderWindow));
    model.apiSpecificRenderWindow.setCursor('grabbing');
    model.interactor.requestAnimation(publicAPI);
  } // --------------------------------------------------------------------------
  // Text methods
  // --------------------------------------------------------------------------

  /**
   * check for handle 2 position in comparison to handle 1 position
   * and sets text offset to not overlap on the line representation
   */


  function getOffsetDirectionForTextPosition() {
    var pos1 = publicAPI.getHandle(0).getOrigin();
    var pos2 = publicAPI.getHandle(1).getOrigin();
    var dySign = 1;

    if (pos1 && pos2) {
      if (pos1[0] <= pos2[0]) {
        dySign = pos1[1] <= pos2[1] ? 1 : -1;
      } else {
        dySign = pos1[1] <= pos2[1] ? -1 : 1;
      }
    }

    return dySign;
  }
  /**
   * place SVGText on line according to both handle positions
   * which purpose is to never have text representation overlapping
   * on PolyLine representation
   * */


  publicAPI.placeText = function () {
    var dySign = getOffsetDirectionForTextPosition();

    var textPropsCp = _objectSpread({}, model.representations[3].getTextProps());

    textPropsCp.dy = dySign * Math.abs(textPropsCp.dy);
    model.representations[3].setTextProps(textPropsCp);
    model.interactor.render();
  };

  publicAPI.setText = function (text) {
    model.widgetState.getText().setText(text);
    model.interactor.render();
  }; // --------------------------------------------------------------------------
  // Handle positioning methods
  // --------------------------------------------------------------------------
  // Handle utilities ---------------------------------------------------------


  function getLineDirection(p1, p2) {
    var dir = subtract(p1, p2, []);
    normalize(dir);
    return dir;
  } // Handle orientation & rotation ---------------------------------------------------------


  function computeMousePosition(p1, callData) {
    var displayMousePos = publicAPI.computeWorldToDisplay.apply(publicAPI, [model.renderer].concat(_toConsumableArray(p1)));
    var worldMousePos = publicAPI.computeDisplayToWorld(model.renderer, callData.position.x, callData.position.y, displayMousePos[2]);
    return worldMousePos;
  }
  /**
   * Returns the  handle orientation to match the direction vector of the polyLine from one tip to another
   * @param {number} handleIndex 0 for handle1, 1 for handle2
   * @param {object} callData if specified, uses mouse position as 2nd point
   */


  function getHandleOrientation(handleIndex) {
    var callData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var point1 = getPoint(handleIndex, model.widgetState);
    var point2 = callData ? computeMousePosition(point1, callData) : getPoint(1 - handleIndex, model.widgetState);
    return point1 && point2 ? getLineDirection(point1, point2) : null;
  }
  /**
   * Orient handle
   * @param {number} handleIndex 0, 1 or 2
   * @param {object} callData optional, see getHandleOrientation for details.
   */


  function updateHandleOrientation(handleIndex) {
    var orientation = getHandleOrientation(Math.min(1, handleIndex));
    model.representations[handleIndex].setOrientation(orientation);
  }

  publicAPI.updateHandleOrientations = function () {
    updateHandleOrientation(0);
    updateHandleOrientation(1);
    updateHandleOrientation(2);
  };

  publicAPI.rotateHandlesToFaceCamera = function () {
    model.representations[0].setViewMatrix(Array.from(model.camera.getViewMatrix()));
    model.representations[1].setViewMatrix(Array.from(model.camera.getViewMatrix()));
  }; // Handles visibility ---------------------------------------------------------


  publicAPI.setMoveHandleVisibility = function (visibility) {
    model.representations[2].setVisibilityFlagArray([visibility, visibility]);
    model.widgetState.getMoveHandle().setVisible(visibility);
    model.representations[2].updateActorVisibility();
  };
  /**
   * Set actor visibility to true unless it is a NONE handle
   * and uses state visibility variable for the displayActor visibility to
   * allow pickable handles even when they are not displayed on screen
   * @param handle : the handle state object
   * @param handleNb : the handle number according to its label in widget state
   */


  publicAPI.updateHandleVisibility = function (handleIndex) {
    var handle = publicAPI.getHandle(handleIndex);
    var visibility = handle.getVisible() && isHandlePlaced(handleIndex, model.widgetState);
    model.representations[handleIndex].setVisibilityFlagArray([visibility, visibility && handle.getShape() !== ShapeType.NONE]);
    model.representations[handleIndex].updateActorVisibility();
    model.interactor.render();
  };
  /**
   * Called when placing a point from the first time.
   * @param {number} handleIndex
   */


  publicAPI.placeHandle = function (handleIndex) {
    var handle = publicAPI.getHandle(handleIndex);
    handle.setOrigin.apply(handle, _toConsumableArray(model.widgetState.getMoveHandle().getOrigin()));
    publicAPI.updateHandleOrientations();
    publicAPI.rotateHandlesToFaceCamera();
    model.widgetState.getText().setOrigin(calculateTextPosition(model));
    publicAPI.updateHandleVisibility(handleIndex);

    if (handleIndex === 0) {
      var _publicAPI$getHandle;

      // For the line (handle1, handle2, moveHandle) to be displayed
      // correctly, handle2 origin must be valid.
      (_publicAPI$getHandle = publicAPI.getHandle(1)).setOrigin.apply(_publicAPI$getHandle, _toConsumableArray(model.widgetState.getMoveHandle().getOrigin())); // Now that handle2 has a valid origin, hide it


      publicAPI.updateHandleVisibility(1);
      model.widgetState.getMoveHandle().setShape(publicAPI.getHandle(1).getShape());
    }

    if (handleIndex === 1) {
      publicAPI.placeText();
      publicAPI.setMoveHandleVisibility(false);
    }
  }; // --------------------------------------------------------------------------
  // Left press: Select handle to drag
  // --------------------------------------------------------------------------


  publicAPI.handleLeftButtonPress = function (e) {
    if (!model.activeState || !model.activeState.getActive() || !model.pickable || ignoreKey(e)) {
      return macro.VOID;
    }

    if (model.activeState === model.widgetState.getMoveHandle() && getNumberOfPlacedHandles(model.widgetState) === 0) {
      publicAPI.placeHandle(0);
    } else if (model.widgetState.getMoveHandle().getActive() && getNumberOfPlacedHandles(model.widgetState) === 1) {
      publicAPI.placeHandle(1);
    } else if (!model.widgetState.getText().getActive()) {
      // Grab handle1, handle2 or whole widget
      updateCursor(e);
    }

    publicAPI.invokeStartInteractionEvent();
    return macro.EVENT_ABORT;
  }; // --------------------------------------------------------------------------
  // Mouse move: Drag selected handle / Handle follow the mouse
  // --------------------------------------------------------------------------


  publicAPI.handleMouseMove = function (callData) {
    if (model.hasFocus && publicAPI.isPlaced() && !model.isDragging) {
      publicAPI.loseFocus();
      return macro.VOID;
    }

    if (model.pickable && model.dragable && model.manipulator && model.activeState && model.activeState.getActive() && !ignoreKey(callData)) {
      var worldCoords = model.manipulator.handleEvent(callData, model.apiSpecificRenderWindow);
      var translation = model.previousPosition ? subtract(worldCoords, model.previousPosition, []) : [0, 0, 0];
      model.previousPosition = worldCoords;

      if ( // is placing first or second handle
      model.activeState === model.widgetState.getMoveHandle() || // is dragging already placed first or second handle
      model.isDragging) {
        if (model.activeState.setOrigin) {
          model.activeState.setOrigin(worldCoords);
        } else {
          // Dragging line
          publicAPI.getHandle(0).setOrigin(add(publicAPI.getHandle(0).getOrigin(), translation, []));
          publicAPI.getHandle(1).setOrigin(add(publicAPI.getHandle(1).getOrigin(), translation, []));
        }

        publicAPI.updateHandleOrientations();
        updateTextPosition(model);
        publicAPI.invokeInteractionEvent();
        return macro.EVENT_ABORT;
      }
    }

    return macro.VOID;
  }; // --------------------------------------------------------------------------
  // Left release: Finish drag / Create new handle
  // --------------------------------------------------------------------------


  publicAPI.handleLeftButtonRelease = function () {
    // After dragging a point or placing all points
    if (model.activeState && model.activeState.getActive() && (model.isDragging || publicAPI.isPlaced())) {
      var wasTextActive = model.widgetState.getText().getActive(); // Recompute offsets

      publicAPI.placeText();
      model.widgetState.deactivate();
      model.widgetState.getMoveHandle().deactivate();
      model.activeState = null;

      if (!wasTextActive) {
        model.interactor.cancelAnimation(publicAPI);
      }

      model.apiSpecificRenderWindow.setCursor('pointer');
      model.hasFocus = false;
      publicAPI.invokeEndInteractionEvent();
      model.widgetManager.enablePicking();
      model.interactor.render();
    }

    if (model.isDragging === false && (!model.activeState || !model.activeState.getActive())) {
      publicAPI.rotateHandlesToFaceCamera();
    }

    model.isDragging = false;
  }; // --------------------------------------------------------------------------
  // Focus API - moveHandle follow mouse when widget has focus
  // --------------------------------------------------------------------------


  publicAPI.grabFocus = function () {
    if (!model.hasFocus && !publicAPI.isPlaced()) {
      model.activeState = model.widgetState.getMoveHandle();
      model.activeState.setShape(publicAPI.getHandle(0).getShape());
      publicAPI.setMoveHandleVisibility(true);
      model.activeState.activate();
      model.interactor.requestAnimation(publicAPI);
      publicAPI.invokeStartInteractionEvent();
    }

    model.hasFocus = true;
  }; // --------------------------------------------------------------------------


  publicAPI.loseFocus = function () {
    if (model.hasFocus) {
      model.interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
    }

    model.widgetState.deactivate();
    model.widgetState.getMoveHandle().deactivate();
    model.activeState = null;
    model.hasFocus = false;
    model.widgetManager.enablePicking();
    model.interactor.render();
  };
}

export { widgetBehavior as default };
