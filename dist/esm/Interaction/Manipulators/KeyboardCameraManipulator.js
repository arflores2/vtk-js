import macro from '../../macros.js';
import vtkBoundingBox from '../../Common/DataModel/BoundingBox.js';
import vtkCompositeKeyboardManipulator from './CompositeKeyboardManipulator.js';
import { k as add, f as normalize, j as cross } from '../../Common/Core/Math/index.js';

var vtkErrorMacro = macro.vtkErrorMacro;
var ANIMATION_REQUESTER = 'vtkKeyboardCameraManipulator'; // ----------------------------------------------------------------------------
// vtkKeyboardCameraManipulator methods
// ----------------------------------------------------------------------------

function vtkKeyboardCameraManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkKeyboardCameraManipulator');
  var internal = {
    keysDown: [],
    direction: [0, 0, 0],
    skipUpdateDirection: false,
    animationSub: null,
    cameraModifiedSub: null
  }; //--------------------------------------------------------------------------

  publicAPI.inMotion = function () {
    return internal.animationSub !== null;
  }; //--------------------------------------------------------------------------


  publicAPI.resetMovementSpeed = function () {
    // Reset the movement speed to be proportional to the longest length
    // of the renderer's bounds.
    var renderer = model.renderer;
    var bounds = renderer.computeVisiblePropBounds(); // Just a number that seems to work okay for our examples...

    var divisor = 500;
    model.movementSpeed = vtkBoundingBox.getMaxLength(bounds) / divisor;
  }; //--------------------------------------------------------------------------


  publicAPI.startMovement = function () {
    if (publicAPI.inMotion()) {
      vtkErrorMacro('Camera is already in motion!');
      return;
    }

    if (model.movementSpeed === null) {
      publicAPI.resetMovementSpeed();
    }

    var interactor = model.interactor,
        renderer = model.renderer;

    var move = function move() {
      if (internal.keysDown.length === 0) {
        return;
      } // No need to update the direction when we move the camera here...


      internal.skipUpdateDirection = true;
      publicAPI.moveCamera(renderer.getActiveCamera(), internal.direction, model.movementSpeed);
      renderer.resetCameraClippingRange();

      if (interactor.getLightFollowCamera()) {
        renderer.updateLightsGeometryToFollowCamera();
      }

      internal.skipUpdateDirection = false;
    };

    publicAPI.calculateCurrentDirection();
    var camera = renderer.getActiveCamera(); // If the camera gets modified elsewhere, let's update the direction

    internal.cameraModifiedSub = camera.onModified(publicAPI.calculateCurrentDirection);
    interactor.requestAnimation(ANIMATION_REQUESTER);
    internal.animationSub = interactor.onAnimation(function () {
      return move();
    });
  }; //--------------------------------------------------------------------------


  publicAPI.endMovement = function () {
    if (internal.animationSub) {
      internal.animationSub.unsubscribe();
      internal.animationSub = null;
    }

    model.interactor.cancelAnimation(ANIMATION_REQUESTER);

    if (internal.cameraModifiedSub) {
      internal.cameraModifiedSub.unsubscribe();
      internal.cameraModifiedSub = null;
    }
  }; //--------------------------------------------------------------------------


  publicAPI.calculateCurrentDirection = function () {
    if (internal.skipUpdateDirection) {
      return;
    } // Reset


    internal.direction = [0, 0, 0];
    var renderer = model.renderer;

    if (!renderer) {
      return;
    }

    var camera = renderer.getActiveCamera();

    if (!camera) {
      return;
    }

    if (internal.keysDown.length === 0) {
      return;
    }

    var directions = internal.keysDown.map(function (key) {
      return publicAPI.getDirectionFromKey(key, camera);
    });
    directions = directions.filter(function (item) {
      return item;
    });

    if (directions.length === 0) {
      return;
    }

    var netDirection = directions.reduce(function (a, b) {
      add(a, b, b);
      return b;
    });
    normalize(netDirection);
    internal.direction = netDirection;
  }; //--------------------------------------------------------------------------


  publicAPI.getDirectionFromKey = function (key, camera) {
    var direction;

    if (model.moveForwardKeys.includes(key)) {
      // Move forward
      direction = camera.getDirectionOfProjection();
    } else if (model.moveLeftKeys.includes(key)) {
      // Move left
      var dirProj = camera.getDirectionOfProjection();
      direction = [0, 0, 0];
      cross(camera.getViewUp(), dirProj, direction);
    } else if (model.moveBackwardKeys.includes(key)) {
      // Move backward
      direction = camera.getDirectionOfProjection().map(function (e) {
        return -e;
      });
    } else if (model.moveRightKeys.includes(key)) {
      // Move right
      var _dirProj = camera.getDirectionOfProjection();

      direction = [0, 0, 0];
      cross(_dirProj, camera.getViewUp(), direction);
    } else if (model.moveUpKeys.includes(key)) {
      // Move up
      direction = camera.getViewUp();
    } else if (model.moveDownKeys.includes(key)) {
      // Move down
      direction = camera.getViewUp().map(function (e) {
        return -e;
      });
    } else {
      return undefined;
    }

    normalize(direction);
    return direction;
  }; //--------------------------------------------------------------------------


  publicAPI.moveCamera = function (camera, direction, speed) {
    var position = camera.getPosition();
    var focalPoint = camera.getFocalPoint();
    camera.setFocalPoint(focalPoint[0] + direction[0] * speed, focalPoint[1] + direction[1] * speed, focalPoint[2] + direction[2] * speed);
    camera.setPosition(position[0] + direction[0] * speed, position[1] + direction[1] * speed, position[2] + direction[2] * speed);
  }; //--------------------------------------------------------------------------


  publicAPI.onKeyPress = function (interactor, renderer, key) {}; //--------------------------------------------------------------------------


  publicAPI.onKeyDown = function (interactor, renderer, key) {
    if (!internal.keysDown.includes(key)) {
      internal.keysDown.push(key);
      publicAPI.calculateCurrentDirection();
    }

    if (!publicAPI.inMotion()) {
      Object.assign(model, {
        interactor: interactor,
        renderer: renderer
      });
      publicAPI.startMovement();
    }
  }; //--------------------------------------------------------------------------


  publicAPI.onKeyUp = function (interactor, renderer, key) {
    // The following is case insensitive for when the user
    // presses/releases the shift key while this key is down.
    internal.keysDown = internal.keysDown.filter(function (item) {
      return item.toUpperCase() !== key.toUpperCase();
    });
    publicAPI.calculateCurrentDirection();

    if (internal.keysDown.length === 0) {
      publicAPI.endMovement();
    }
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  // The movementSpeed is the magnitude of the camera translation
  // for each animation frame (which occur each 1/60 second)
  // If null, publicAPI.resetMovementSpeed() will be called when
  // movement starts.
  movementSpeed: null,
  moveForwardKeys: ['w', 'W', 'ArrowUp'],
  moveLeftKeys: ['a', 'A', 'ArrowLeft'],
  moveBackwardKeys: ['s', 'S', 'ArrowDown'],
  moveRightKeys: ['d', 'D', 'ArrowRight'],
  moveUpKeys: [' '],
  moveDownKeys: ['Shift'],
  interactor: null,
  renderer: null
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  macro.obj(publicAPI, model);
  vtkCompositeKeyboardManipulator.extend(publicAPI, model, initialValues); // Create get-set macros

  macro.setGet(publicAPI, model, ['movementSpeed', 'moveForwardKeys', 'moveLeftKeys', 'moveBackwardKeys', 'moveRightKeys', 'moveUpKeys', 'moveDownKeys', 'interactor', 'renderer']); // Object specific methods

  vtkKeyboardCameraManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkKeyboardCameraManipulator'); // ----------------------------------------------------------------------------

var vtkKeyboardCameraManipulator$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkKeyboardCameraManipulator$1 as default, extend, newInstance };
