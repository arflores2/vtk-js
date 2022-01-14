import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import vtkAbstractWidgetFactory from '../Core/AbstractWidgetFactory.js';
import vtkPlane from '../../Common/DataModel/Plane.js';
import vtkPlaneSource from '../../Filters/Sources/PlaneSource.js';
import vtkResliceCursorContextRepresentation from '../Representations/ResliceCursorContextRepresentation.js';
import { e as distance2BetweenPoints, Q as multiplyAccumulate, g as subtract, f as normalize, w as multiplyScalar, k as add } from '../../Common/Core/Math/index.js';
import widgetBehavior from './ResliceCursorWidget/behavior.js';
import generateState from './ResliceCursorWidget/state.js';
import { updateState, transformPlane, boundPlane } from './ResliceCursorWidget/helpers.js';
import { ViewTypes } from '../Core/WidgetManager/Constants.js';
import { mat4, vec4 } from 'gl-matrix';
import vtkMatrixBuilder from '../../Common/Core/MatrixBuilder.js';

var VTK_INT_MAX = 2147483647;
var vtkErrorMacro = macro.vtkErrorMacro; // ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------

function vtkResliceCursorWidget(publicAPI, model) {
  model.classHierarchy.push('vtkResliceCursorWidget');
  model.methodsToLink = ['scaleInPixels', 'rotationHandlePosition']; // --------------------------------------------------------------------------
  // Private methods
  // --------------------------------------------------------------------------

  /**
   * Compute the origin of the reslice plane prior to transformations
   * It does not take into account the current view normal. (always axis aligned)
   * @param {*} viewType axial, coronal or sagittal
   */

  function computeReslicePlaneOrigin(viewType) {
    var bounds = model.widgetState.getImage().getBounds();
    var center = publicAPI.getWidgetState().getCenter();
    var imageCenter = model.widgetState.getImage().getCenter(); // Offset based on the center of the image and how far from it the
    // reslice cursor is. This allows us to capture the whole image even
    // if we resliced in awkward places.

    var offset = [];

    for (var i = 0; i < 3; i++) {
      offset[i] = -Math.abs(center[i] - imageCenter[i]);
      offset[i] *= 2; // give us room
    } // Now set the size of the plane based on the location of the cursor so as to
    // at least completely cover the viewed region


    var planeSource = vtkPlaneSource.newInstance();

    if (viewType === ViewTypes.XZ_PLANE) {
      planeSource.setOrigin(bounds[0] + offset[0], center[1], bounds[4] + offset[2]);
      planeSource.setPoint1(bounds[1] - offset[0], center[1], bounds[4] + offset[2]);
      planeSource.setPoint2(bounds[0] + offset[0], center[1], bounds[5] - offset[2]);
    } else if (viewType === ViewTypes.XY_PLANE) {
      planeSource.setOrigin(bounds[0] + offset[0], bounds[2] + offset[1], center[2]);
      planeSource.setPoint1(bounds[1] - offset[0], bounds[2] + offset[1], center[2]);
      planeSource.setPoint2(bounds[0] + offset[0], bounds[3] - offset[1], center[2]);
    } else if (viewType === ViewTypes.YZ_PLANE) {
      planeSource.setOrigin(center[0], bounds[2] + offset[1], bounds[4] + offset[2]);
      planeSource.setPoint1(center[0], bounds[3] - offset[1], bounds[4] + offset[2]);
      planeSource.setPoint2(center[0], bounds[2] + offset[1], bounds[5] - offset[2]);
    }

    return planeSource;
  }
  /**
   * Compute the offset between display reslice cursor position and
   * display focal point position
   * This will be used to keep the same offset between reslice cursor
   * center and focal point when needed.
   */


  function computeFocalPointOffsetFromResliceCursorCenter(viewType, renderer) {
    var worldFocalPoint = renderer.getActiveCamera().getFocalPoint();
    var worldResliceCenter = model.widgetState.getCenter();
    var view = renderer.getRenderWindow().getViews()[0];
    var dims = view.getViewportSize(renderer);
    var aspect = dims[0] / dims[1];
    var displayFocalPoint = renderer.worldToNormalizedDisplay.apply(renderer, _toConsumableArray(worldFocalPoint).concat([aspect]));
    var displayResliceCenter = renderer.worldToNormalizedDisplay.apply(renderer, _toConsumableArray(worldResliceCenter).concat([aspect]));
    var newOffset = subtract(displayFocalPoint, displayResliceCenter, [0, 0, 0]);
    var cameraOffsets = model.widgetState.getCameraOffsets();
    cameraOffsets[viewType] = newOffset;
    model.widgetState.setCameraOffsets(cameraOffsets);
  }

  function updateCamera(renderer, normal, viewType, resetFocalPoint, keepCenterFocalDistance) {
    // When the reslice plane is changed, update the camera to look at the
    // normal to the reslice plane.
    var focalPoint = renderer.getActiveCamera().getFocalPoint();
    var distance = renderer.getActiveCamera().getDistance();
    var estimatedCameraPosition = multiplyAccumulate(focalPoint, normal, distance, [0, 0, 0]);
    var newFocalPoint = focalPoint;

    if (resetFocalPoint) {
      // intersect with the plane to get updated focal point
      var intersection = vtkPlane.intersectWithLine(focalPoint, estimatedCameraPosition, model.widgetState.getCenter(), // reslice cursor center
      normal);
      newFocalPoint = intersection.x;
    } // Update the estimated focal point so that it will be at the same
    // distance from the reslice center


    if (keepCenterFocalDistance) {
      var worldResliceCenter = model.widgetState.getCenter();
      var view = renderer.getRenderWindow().getViews()[0];
      var dims = view.getViewportSize(renderer);
      var aspect = dims[0] / dims[1];
      var displayResliceCenter = renderer.worldToNormalizedDisplay.apply(renderer, _toConsumableArray(worldResliceCenter).concat([aspect]));
      var realOffset = model.widgetState.getCameraOffsets()[viewType];
      var displayFocal = add(displayResliceCenter, realOffset, [0, 0, 0]);
      var worldFocal = renderer.normalizedDisplayToWorld.apply(renderer, _toConsumableArray(displayFocal).concat([aspect])); // Reproject focal point on slice in order to keep it on the
      // same plane as the reslice cursor center

      var intersection2 = vtkPlane.intersectWithLine(worldFocal, estimatedCameraPosition, worldResliceCenter, normal);
      newFocalPoint[0] = intersection2.x[0];
      newFocalPoint[1] = intersection2.x[1];
      newFocalPoint[2] = intersection2.x[2];
    }

    renderer.getActiveCamera().setFocalPoint(newFocalPoint[0], newFocalPoint[1], newFocalPoint[2]);
    var newCameraPosition = multiplyAccumulate(newFocalPoint, normal, distance, [0, 0, 0]);
    renderer.getActiveCamera().setPosition(newCameraPosition[0], newCameraPosition[1], newCameraPosition[2]); // Don't clip away any part of the data.
    // Renderer may not have yet actor bounds

    var bounds = model.widgetState.getImage().getBounds();

    if (resetFocalPoint) {
      renderer.resetCamera(bounds);
    }

    renderer.resetCameraClippingRange(bounds);
  } // --------------------------------------------------------------------------
  // initialization
  // --------------------------------------------------------------------------


  model.behavior = widgetBehavior;
  model.widgetState = generateState();

  publicAPI.getRepresentationsForViewType = function (viewType) {
    switch (viewType) {
      case ViewTypes.XY_PLANE:
        return [{
          builder: vtkResliceCursorContextRepresentation,
          labels: ['AxisXinZ', 'AxisYinZ'],
          initialValues: {
            axis1Name: 'AxisXinZ',
            axis2Name: 'AxisYinZ',
            viewType: ViewTypes.XY_PLANE,
            rotationEnabled: model.widgetState.getEnableRotation()
          }
        }];

      case ViewTypes.XZ_PLANE:
        return [{
          builder: vtkResliceCursorContextRepresentation,
          labels: ['AxisXinY', 'AxisZinY'],
          initialValues: {
            axis1Name: 'AxisXinY',
            axis2Name: 'AxisZinY',
            viewType: ViewTypes.XZ_PLANE,
            rotationEnabled: model.widgetState.getEnableRotation()
          }
        }];

      case ViewTypes.YZ_PLANE:
        return [{
          builder: vtkResliceCursorContextRepresentation,
          labels: ['AxisYinX', 'AxisZinX'],
          initialValues: {
            axis1Name: 'AxisYinX',
            axis2Name: 'AxisZinX',
            viewType: ViewTypes.YZ_PLANE,
            rotationEnabled: model.widgetState.getEnableRotation()
          }
        }];

      case ViewTypes.DEFAULT:
      case ViewTypes.GEOMETRY:
      case ViewTypes.SLICE:
      case ViewTypes.VOLUME:
      default:
        return [];
    }
  };

  publicAPI.setImage = function (image) {
    model.widgetState.setImage(image);
    var center = image.getCenter();
    model.widgetState.setCenter(center);
    updateState(model.widgetState);
  };

  publicAPI.setCenter = function (center) {
    model.widgetState.setCenter(center);
    updateState(model.widgetState);
    publicAPI.modified();
  }; // --------------------------------------------------------------------------
  // Methods
  // --------------------------------------------------------------------------


  publicAPI.updateCameraPoints = function (renderer, viewType, resetFocalPoint, keepCenterFocalDistance, computeFocalPointOffset) {
    publicAPI.resetCamera(renderer, viewType, resetFocalPoint, keepCenterFocalDistance);

    if (computeFocalPointOffset) {
      computeFocalPointOffsetFromResliceCursorCenter(viewType, renderer);
    }
  };
  /**
   *
   * @param {*} renderer
   * @param {*} viewType
   * @param {*} resetFocalPoint Defines if the focal point is reset to the image center
   * @param {*} keepCenterFocalDistance Defines if the estimated focal point has to be updated
   * in order to keep the same distance to the center (according to the computed focal point
   * shift)
   */


  publicAPI.resetCamera = function (renderer, viewType, resetFocalPoint, keepCenterFocalDistance) {
    var _renderer$getActiveCa, _renderer$getActiveCa2;

    var center = model.widgetState.getImage().getCenter();
    var focalPoint = renderer.getActiveCamera().getFocalPoint();
    var position = renderer.getActiveCamera().getPosition(); // Distance is preserved

    var distance = Math.sqrt(distance2BetweenPoints(position, focalPoint));
    var normal = publicAPI.getPlaneNormalFromViewType(viewType); // ResetFocalPoint will reset focal point to the center of the image

    var estimatedFocalPoint = resetFocalPoint ? center : focalPoint;
    var estimatedCameraPosition = multiplyAccumulate(estimatedFocalPoint, normal, distance, [0, 0, 0]);

    (_renderer$getActiveCa = renderer.getActiveCamera()).setFocalPoint.apply(_renderer$getActiveCa, _toConsumableArray(estimatedFocalPoint));

    (_renderer$getActiveCa2 = renderer.getActiveCamera()).setPosition.apply(_renderer$getActiveCa2, _toConsumableArray(estimatedCameraPosition));

    renderer.getActiveCamera().setViewUp(model.widgetState.getPlanes()[viewType].viewUp); // Project focalPoint onto image plane and preserve distance

    updateCamera(renderer, normal, viewType, resetFocalPoint, keepCenterFocalDistance);
  };

  publicAPI.updateReslicePlane = function (imageReslice, viewType) {
    // Calculate appropriate pixel spacing for the reslicing
    var spacing = model.widgetState.getImage().getSpacing(); // Compute original (i.e. before rotation) plane (i.e. origin, p1, p2)
    // centered on cursor center.

    var planeSource = computeReslicePlaneOrigin(viewType);
    var _model$widgetState$ge = model.widgetState.getPlanes()[viewType],
        normal = _model$widgetState$ge.normal,
        viewUp = _model$widgetState$ge.viewUp; // Adapt plane orientation in order to fit the correct viewUp
    // so that the rotations will be more understandable than now.

    transformPlane(planeSource, model.widgetState.getCenter(), normal, viewUp); // Clip to bounds

    var boundedOrigin = _toConsumableArray(planeSource.getOrigin());

    var boundedP1 = _toConsumableArray(planeSource.getPoint1());

    var boundedP2 = _toConsumableArray(planeSource.getPoint2());

    boundPlane(model.widgetState.getImage().getBounds(), boundedOrigin, boundedP1, boundedP2);
    planeSource.setOrigin.apply(planeSource, _toConsumableArray(boundedOrigin));
    planeSource.setPoint1.apply(planeSource, _toConsumableArray(boundedP1));
    planeSource.setPoint2.apply(planeSource, _toConsumableArray(boundedP2));
    var o = planeSource.getOrigin();
    var p1 = planeSource.getPoint1();
    var planeAxis1 = [];
    subtract(p1, o, planeAxis1);
    var p2 = planeSource.getPoint2();
    var planeAxis2 = [];
    subtract(p2, o, planeAxis2); // The x,y dimensions of the plane

    var planeSizeX = normalize(planeAxis1);
    var planeSizeY = normalize(planeAxis2);
    var newResliceAxes = mat4.identity(new Float64Array(16));

    for (var i = 0; i < 3; i++) {
      newResliceAxes[4 * i + 0] = planeAxis1[i];
      newResliceAxes[4 * i + 1] = planeAxis2[i];
      newResliceAxes[4 * i + 2] = normal[i];
    }

    var spacingX = Math.abs(planeAxis1[0] * spacing[0]) + Math.abs(planeAxis1[1] * spacing[1]) + Math.abs(planeAxis1[2] * spacing[2]);
    var spacingY = Math.abs(planeAxis2[0] * spacing[0]) + Math.abs(planeAxis2[1] * spacing[1]) + Math.abs(planeAxis2[2] * spacing[2]);
    var planeOrigin = [].concat(_toConsumableArray(planeSource.getOrigin()), [1.0]);
    var originXYZW = [];
    var newOriginXYZW = [];
    vec4.transformMat4(originXYZW, planeOrigin, newResliceAxes);
    mat4.transpose(newResliceAxes, newResliceAxes);
    vec4.transformMat4(newOriginXYZW, originXYZW, newResliceAxes);
    newResliceAxes[4 * 3 + 0] = newOriginXYZW[0];
    newResliceAxes[4 * 3 + 1] = newOriginXYZW[1];
    newResliceAxes[4 * 3 + 2] = newOriginXYZW[2]; // Compute a new set of resliced extents

    var extentX = 0;
    var extentY = 0; // Pad extent up to a power of two for efficient texture mapping
    // make sure we're working with valid values

    var realExtentX = spacingX === 0 ? Number.MAX_SAFE_INTEGER : planeSizeX / spacingX; // Sanity check the input data:
    // * if realExtentX is too large, extentX will wrap
    // * if spacingX is 0, things will blow up.

    var value = VTK_INT_MAX >> 1; // eslint-disable-line no-bitwise

    if (realExtentX > value) {
      vtkErrorMacro('Invalid X extent: ', realExtentX, ' on view type : ', viewType);
      extentX = 0;
    } else {
      extentX = 1;

      while (extentX < realExtentX) {
        extentX <<= 1; // eslint-disable-line no-bitwise
      }
    } // make sure extentY doesn't wrap during padding


    var realExtentY = spacingY === 0 ? Number.MAX_SAFE_INTEGER : planeSizeY / spacingY;

    if (realExtentY > value) {
      vtkErrorMacro('Invalid Y extent:', realExtentY, ' on view type : ', viewType);
      extentY = 0;
    } else {
      extentY = 1;

      while (extentY < realExtentY) {
        extentY <<= 1; // eslint-disable-line no-bitwise
      }
    }

    var outputSpacingX = extentX === 0 ? 1.0 : planeSizeX / extentX;
    var outputSpacingY = extentY === 0 ? 1.0 : planeSizeY / extentY;
    var modified = imageReslice.setResliceAxes(newResliceAxes);
    modified = imageReslice.setOutputSpacing([outputSpacingX, outputSpacingY, 1]) || modified;
    modified = imageReslice.setOutputOrigin([0.5 * outputSpacingX, 0.5 * outputSpacingY, 0]) || modified;
    modified = imageReslice.setOutputExtent([0, extentX - 1, 0, extentY - 1, 0, 0]) || modified;
    return {
      modified: modified,
      origin: o,
      point1: p1,
      point2: p2
    };
  };
  /**
   * Returns a plane source with origin at cursor center and
   * normal from the view.
   * @param {ViewType} type: Axial, Coronal or Sagittal
   */


  publicAPI.getPlaneSourceFromViewType = function (type) {
    var planeSource = vtkPlaneSource.newInstance();
    var origin = publicAPI.getWidgetState().getCenter();
    var planeNormal = publicAPI.getPlaneNormalFromViewType(type);
    planeSource.setNormal(planeNormal);
    planeSource.setOrigin(origin);
    return planeSource;
  };

  publicAPI.getPlaneNormalFromViewType = function (viewType) {
    return publicAPI.getWidgetState().getPlanes()[viewType].normal;
  };
  /**
   * Returns the normals of the planes that are not viewType.
   * @param {ViewType} viewType ViewType to extract other normals
   */


  publicAPI.getOtherPlaneNormals = function (viewType) {
    return [ViewTypes.YZ_PLANE, ViewTypes.XZ_PLANE, ViewTypes.XY_PLANE].filter(function (vt) {
      return vt !== viewType;
    }).map(function (vt) {
      return publicAPI.getPlaneNormalFromViewType(vt);
    });
  };
  /**
   * Return the reslice cursor matrix built as such: [YZ, XZ, XY, center]
   */


  publicAPI.getResliceMatrix = function () {
    var _vtkMatrixBuilder$bui, _vtkMatrixBuilder$bui2;

    var resliceMatrix = mat4.identity(new Float64Array(16));

    for (var i = 0; i < 3; i++) {
      resliceMatrix[4 * i + 0] = publicAPI.getPlaneNormalFromViewType(ViewTypes.YZ_PLANE)[i];
      resliceMatrix[4 * i + 1] = publicAPI.getPlaneNormalFromViewType(ViewTypes.XZ_PLANE)[i];
      resliceMatrix[4 * i + 2] = publicAPI.getPlaneNormalFromViewType(ViewTypes.XY_PLANE)[i];
    }

    var origin = publicAPI.getWidgetState().getCenter();

    var m = (_vtkMatrixBuilder$bui = (_vtkMatrixBuilder$bui2 = vtkMatrixBuilder.buildFromRadian()).translate.apply(_vtkMatrixBuilder$bui2, _toConsumableArray(origin)).multiply(resliceMatrix)).translate.apply(_vtkMatrixBuilder$bui, _toConsumableArray(multiplyScalar(_toConsumableArray(origin), -1))).getMatrix();

    return m;
  };
} // ----------------------------------------------------------------------------


var DEFAULT_VALUES = {}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  vtkAbstractWidgetFactory.extend(publicAPI, model, initialValues);
  vtkResliceCursorWidget(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkResliceCursorWidget'); // ----------------------------------------------------------------------------

var vtkResliceCursorWidget$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkResliceCursorWidget$1 as default, extend, newInstance };
