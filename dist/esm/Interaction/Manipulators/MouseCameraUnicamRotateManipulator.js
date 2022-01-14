import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _slicedToArray from '@babel/runtime/helpers/slicedToArray';
import vtkActor from '../../Rendering/Core/Actor.js';
import vtkCompositeCameraManipulator from './CompositeCameraManipulator.js';
import vtkCompositeMouseManipulator from './CompositeMouseManipulator.js';
import vtkInteractorStyleConstants from '../../Rendering/Core/InteractorStyle/Constants.js';
import vtkMapper from '../../Rendering/Core/Mapper.js';
import vtkPointPicker from '../../Rendering/Core/PointPicker.js';
import vtkSphereSource from '../../Filters/Sources/SphereSource.js';
import { FieldAssociations } from '../../Common/DataModel/DataSet/Constants.js';
import { mat4, vec3 } from 'gl-matrix';
import macro from '../../macros.js';
import { y as areEquals, f as normalize, d as dot, z as clampValue, g as subtract, j as cross, w as multiplyScalar, e as distance2BetweenPoints } from '../../Common/Core/Math/index.js';

var States = vtkInteractorStyleConstants.States; // ----------------------------------------------------------------------------
// vtkMouseCameraUnicamRotateManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseCameraUnicamRotateManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMouseCameraUnicamRotateManipulator'); // Setup Picker to pick points

  model.picker = vtkPointPicker.newInstance();
  model.downPoint = [0, 0, 0];
  model.isDot = false;
  model.state = States.IS_NONE; // Setup focus dot

  var sphereSource = vtkSphereSource.newInstance();
  sphereSource.setThetaResolution(6);
  sphereSource.setPhiResolution(6);
  var sphereMapper = vtkMapper.newInstance();
  sphereMapper.setInputConnection(sphereSource.getOutputPort());
  model.focusSphere = vtkActor.newInstance();
  model.focusSphere.setMapper(sphereMapper);
  model.focusSphere.getProperty().setColor(0.89, 0.66, 0.41);
  model.focusSphere.getProperty().setAmbient(1);
  model.focusSphere.getProperty().setDiffuse(0);
  model.focusSphere.getProperty().setRepresentationToWireframe(); //----------------------------------------------------------------------------

  var updateAndRender = function updateAndRender(interactor) {
    if (!interactor) {
      return;
    }

    if (model.useWorldUpVec) {
      var camera = interactor.findPokedRenderer().getActiveCamera();

      if (!areEquals(model.worldUpVec, camera.getViewPlaneNormal())) {
        camera.setViewUp(model.worldUpVec);
      }
    }

    interactor.render();
  }; //----------------------------------------------------------------------------


  var normalize$1 = function normalize(position, interactor) {
    var _interactor$getView$g = interactor.getView().getSize(),
        _interactor$getView$g2 = _slicedToArray(_interactor$getView$g, 2),
        width = _interactor$getView$g2[0],
        height = _interactor$getView$g2[1];

    var nx = -1.0 + 2.0 * position.x / width;
    var ny = -1.0 + 2.0 * position.y / height;
    return {
      x: nx,
      y: ny
    };
  }; //----------------------------------------------------------------------------
  // Rotate the camera by 'angle' degrees about the point <cx, cy, cz>
  // and around the vector/axis <ax, ay, az>.


  var rotateCamera = function rotateCamera(camera, cx, cy, cz, ax, ay, az, angle) {
    var cameraPosition = camera.getPosition();
    var cameraFocalPoint = camera.getFocalPoint();
    var cameraViewUp = camera.getViewUp();
    cameraPosition[3] = 1.0;
    cameraFocalPoint[3] = 1.0;
    cameraViewUp[3] = 0.0;
    var transform = mat4.identity(new Float64Array(16));
    mat4.translate(transform, transform, [cx, cy, cz]);
    mat4.rotate(transform, transform, angle, [ax, ay, az]);
    mat4.translate(transform, transform, [-cx, -cy, -cz]);
    var newCameraPosition = [];
    var newCameraFocalPoint = [];
    vec3.transformMat4(newCameraPosition, cameraPosition, transform);
    vec3.transformMat4(newCameraFocalPoint, cameraFocalPoint, transform);
    mat4.identity(transform);
    mat4.rotate(transform, transform, angle, [ax, ay, az]);
    var newCameraViewUp = [];
    vec3.transformMat4(newCameraViewUp, cameraViewUp, transform);
    camera.setPosition.apply(camera, newCameraPosition);
    camera.setFocalPoint.apply(camera, newCameraFocalPoint);
    camera.setViewUp.apply(camera, newCameraViewUp);
  }; //----------------------------------------------------------------------------


  var rotate = function rotate(interactor, position) {
    var _interactor$getView;

    var renderer = interactor.findPokedRenderer();
    var normalizedPosition = normalize$1(position, interactor);
    var normalizedPreviousPosition = normalize$1(model.previousPosition, interactor);
    var center = model.focusSphere.getPosition();

    var normalizedCenter = (_interactor$getView = interactor.getView()).worldToDisplay.apply(_interactor$getView, _toConsumableArray(center).concat([renderer])); // let normalizedCenter = publicAPI.computeWorldToDisplay(renderer, ...center);


    normalizedCenter = normalize$1({
      x: center[0],
      y: center[1]
    }, interactor);
    normalizedCenter = [normalizedCenter.x, normalizedCenter.y, center[2]]; // Squared rad of virtual cylinder

    var radsq = Math.pow(1.0 + Math.abs(normalizedCenter[0]), 2.0);
    var op = [normalizedPreviousPosition.x, 0, 0];
    var oe = [normalizedPosition.x, 0, 0];
    var opsq = Math.pow(op[0], 2);
    var oesq = Math.pow(oe[0], 2);
    var lop = opsq > radsq ? 0 : Math.sqrt(radsq - opsq);
    var loe = oesq > radsq ? 0 : Math.sqrt(radsq - oesq);
    var nop = [op[0], 0, lop];
    normalize(nop);
    var noe = [oe[0], 0, loe];
    normalize(noe);
    var dot$1 = dot(nop, noe);

    if (Math.abs(dot$1) > 0.0001) {
      var angle = -2 * Math.acos(clampValue(dot$1, -1.0, 1.0)) * Math.sign(normalizedPosition.x - normalizedPreviousPosition.x) * publicAPI.getRotationFactor();
      var camera = renderer.getActiveCamera();
      var upVec = model.useWorldUpVec ? model.worldUpVec : camera.getViewUp();
      normalize(upVec);
      rotateCamera.apply(void 0, [camera].concat(_toConsumableArray(center), _toConsumableArray(upVec), [angle]));
      var dVec = [];
      var cameraPosition = camera.getPosition();
      subtract(cameraPosition, position, dVec);
      var rDist = (normalizedPosition.y - normalizedPreviousPosition.y) * publicAPI.getRotationFactor();
      normalize(dVec);
      var atV = camera.getViewPlaneNormal();
      var upV = camera.getViewUp();
      var rightV = [];
      cross(upV, atV, rightV);
      normalize(rightV); //
      // The following two tests try to prevent chaotic camera movement
      // that results from rotating over the poles defined by the
      // "WorldUpVector".  The problem is the constraint to keep the
      // camera's up vector in line w/ the WorldUpVector is at odds with
      // the action of rotating over the top of the virtual sphere used
      // for rotation.  The solution here is to prevent the user from
      // rotating the last bit required to "go over the top"-- as a
      // consequence, you can never look directly down on the poles.
      //
      // The "0.99" value is somewhat arbitrary, but seems to produce
      // reasonable results.  (Theoretically, some sort of clamping
      // function could probably be used rather than a hard cutoff, but
      // time constraints prevent figuring that out right now.)
      //

      if (model.useWorldUpVec) {
        var OVER_THE_TOP_THRESHOLD = 0.99;

        if (dot(upVec, atV) > OVER_THE_TOP_THRESHOLD && rDist < 0) {
          rDist = 0;
        }

        if (dot(upVec, atV) < -OVER_THE_TOP_THRESHOLD && rDist > 0) {
          rDist = 0;
        }
      }

      rotateCamera.apply(void 0, [camera].concat(_toConsumableArray(center), rightV, [rDist]));

      if (model.useWorldUpVec && !areEquals(upVec, camera.getViewPlaneNormal())) {
        camera.setViewUp.apply(camera, _toConsumableArray(upVec));
      }

      model.previousPosition = position;
      renderer.resetCameraClippingRange();
      updateAndRender(interactor);
    }
  }; //----------------------------------------------------------------------------


  var placeFocusSphere = function placeFocusSphere(interactor) {
    var _model$focusSphere;

    var renderer = interactor.findPokedRenderer();

    (_model$focusSphere = model.focusSphere).setPosition.apply(_model$focusSphere, _toConsumableArray(model.downPoint));

    var camera = renderer.getActiveCamera();
    var cameraPosition = camera.getPosition();
    var cameraToPointVec = [];
    subtract(model.downPoint, cameraPosition, cameraToPointVec);

    if (camera.getParallelProjection()) {
      multiplyScalar(cameraToPointVec, camera.getParallelScale());
    }

    var atV = camera.getDirectionOfProjection();
    normalize(atV); // Scales the focus dot so it always appears the same size

    var scale = 0.02 * dot(atV, cameraToPointVec) * model.focusSphereRadiusFactor;
    model.focusSphere.setScale(scale, scale, scale);
  };

  var placeAndDisplayFocusSphere = function placeAndDisplayFocusSphere(interactor) {
    placeFocusSphere(interactor);
    interactor.findPokedRenderer().addActor(model.focusSphere);
    model.isDot = true;
  };

  var hideFocusSphere = function hideFocusSphere(interactor) {
    interactor.findPokedRenderer().removeActor(model.focusSphere);
    model.isDot = false;
  }; //----------------------------------------------------------------------------


  var pickWithPointPicker = function pickWithPointPicker(interactor, position) {
    var renderer = interactor.findPokedRenderer();
    model.picker.pick([position.x, position.y, position.z], renderer);
    var pickedPositions = model.picker.getPickedPositions();

    if (pickedPositions.length === 0) {
      return model.picker.getPickPosition();
    }

    var cameraPosition = renderer.getActiveCamera().getPosition();
    pickedPositions.sort(function (pointA, pointB) {
      return distance2BetweenPoints(pointA, cameraPosition) - distance2BetweenPoints(pointB, cameraPosition);
    });
    return pickedPositions[0];
  }; //----------------------------------------------------------------------------


  var pickPoint = function pickPoint(interactor, position) {
    var renderer = interactor.findPokedRenderer(); // Finds the point under the cursor.
    // Note: If no object has been rendered to the pixel (X, Y), then
    // vtkPicker will return a z-value with depth equal
    // to the distance from the camera's position to the focal point.
    // This seems like an arbitrary, but perhaps reasonable, default value.

    var selections = null;

    if (model.useHardwareSelector) {
      var selector = interactor.getView().getSelector();
      selector.setCaptureZValues(true);
      selector.setFieldAssociation(FieldAssociations.FIELD_ASSOCIATION_POINTS);
      selector.attach(interactor.getView(), renderer);
      selector.setArea(position.x, position.y, position.x, position.y);
      selections = selector.select();
    }

    if (selections && selections.length !== 0) {
      // convert Float64Array to regular array
      return Array.from(selections[0].getProperties().worldPosition);
    }

    return pickWithPointPicker(interactor, position);
  }; //----------------------------------------------------------------------------
  // Public API methods
  //----------------------------------------------------------------------------


  publicAPI.onButtonDown = function (interactor, renderer, position) {
    model.buttonPressed = true;
    model.startPosition = position;
    model.previousPosition = position;
    var normalizedPosition = normalize$1(position, interactor); // borderRatio defines the percentage of the screen size that is considered to be
    // the border of the screen on each side

    var borderRatio = 0.1; // If the user is clicking on the perimeter of the screen,
    // then we want to go into rotation mode, and there is no need to determine the downPoint

    if (Math.abs(normalizedPosition.x) > 1 - borderRatio || Math.abs(normalizedPosition.y) > 1 - borderRatio) {
      model.state = States.IS_ROTATE;
      placeAndDisplayFocusSphere(interactor);
      return;
    }

    model.downPoint = pickPoint(interactor, position);

    if (model.isDot) {
      model.state = States.IS_ROTATE;
    } else {
      model.state = States.IS_NONE;

      if (model.displayFocusSphereOnButtonDown) {
        placeAndDisplayFocusSphere(interactor);
      }
    }
  }; //----------------------------------------------------------------------------


  publicAPI.onMouseMove = function (interactor, renderer, position) {
    if (!model.buttonPressed) {
      return;
    }

    model.state = States.IS_ROTATE;
    rotate(interactor, position);
    model.previousPosition = position;
  }; //--------------------------------------------------------------------------


  publicAPI.onButtonUp = function (interactor) {
    var renderer = interactor.findPokedRenderer();
    model.buttonPressed = false; // If rotation without a focus sphere, nothing to do

    if (model.state === States.IS_ROTATE && !model.isDot) {
      return;
    }

    if (model.state === States.IS_ROTATE) {
      hideFocusSphere(interactor);
    } else if (model.state === States.IS_NONE) {
      placeAndDisplayFocusSphere(interactor);
    }

    renderer.resetCameraClippingRange();
    updateAndRender(interactor);
  };

  publicAPI.getFocusSphereColor = function () {
    model.focusSphere.getProperty().getColor();
  };

  publicAPI.setFocusSphereColor = function (r, g, b) {
    model.focusSphere.getProperty().setColor(r, g, b);
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  focusSphereRadiusFactor: 1,
  displayFocusSphereOnButtonDown: true,
  useHardwareSelector: true,
  useWorldUpVec: true,
  // set WorldUpVector to be z-axis by default
  worldUpVec: [0, 0, 1]
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  macro.obj(publicAPI, model);
  vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues);
  vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues); // Create get-set macros

  macro.setGet(publicAPI, model, ['focusSphereRadiusFactor', 'displayFocusSphereOnButtonDown', 'useHardwareSelector', 'useWorldUpVec']);
  macro.get(publicAPI, model, ['state']);
  macro.getArray(publicAPI, model, ['downPoint'], 3);
  macro.setGetArray(publicAPI, model, ['worldUpVec'], 3); // Object specific methods

  vtkMouseCameraUnicamRotateManipulator(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkMouseCameraUnicamRotateManipulator'); // ----------------------------------------------------------------------------

var vtkMouseCameraUnicamRotateManipulator$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkMouseCameraUnicamRotateManipulator$1 as default, extend, newInstance };
