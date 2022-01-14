import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../../macros.js';
import { mat4, vec4 } from 'gl-matrix';
import vtkImageMapper from '../../../Rendering/Core/ImageMapper.js';
import vtkImageReslice from '../../../Imaging/Core/ImageReslice.js';
import vtkImageSlice from '../../../Rendering/Core/ImageSlice.js';
import { k as add, g as subtract, f as normalize } from '../../../Common/Core/Math/index.js';
import vtkPlaneSource from '../../../Filters/Sources/PlaneSource.js';
import vtkWidgetRepresentation from '../WidgetRepresentation.js';
import { transformPlane, boundPlane } from '../../../Widgets/Widgets3D/ResliceCursorWidget/helpers.js';

var vtkErrorMacro = macro.vtkErrorMacro;
var VTK_INT_MAX = 2147483647; // ----------------------------------------------------------------------------
// vtkResliceCursorRepresentation methods
// ----------------------------------------------------------------------------

function vtkResliceCursorRepresentation(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkResliceCursorRepresentation');
  var buildTime = {};
  macro.obj(buildTime); //----------------------------------------------------------------------------
  // Public API methods
  //----------------------------------------------------------------------------

  publicAPI.getResliceCursor = function () {};

  publicAPI.getCursorAlgorithm = function () {};

  publicAPI.createDefaultResliceAlgorithm = function () {
    if (!model.reslice) {
      model.reslice = vtkImageReslice.newInstance();
      model.reslice.setTransformInputSampling(false);
      model.reslice.setAutoCropOutput(true);
      model.reslice.setOutputDimensionality(2);
    }
  };

  publicAPI.buildRepresentation = function () {
    if (publicAPI.getResliceCursor()) {
      var image = publicAPI.getResliceCursor().getImage();

      if (image) {
        model.reslice.setInputData(image);
        model.imageActor.setVisibility(model.showReslicedImage);
        var modifiedTime = Math.max(publicAPI.getMTime(), publicAPI.getResliceCursor().getMTime());

        if (buildTime.getMTime() < modifiedTime) {
          publicAPI.updateReslicePlane();
        }
      } else {
        model.imageActor.setVisibility(false);
      }
    }
  };

  publicAPI.computeReslicePlaneOrigin = function () {
    var resliceCursor = publicAPI.getResliceCursor();
    var bounds = resliceCursor.getImage().getBounds();
    var center = resliceCursor.getCenter();
    var imageCenter = resliceCursor.getImage().getCenter(); // Offset based on the center of the image and how far from it the
    // reslice cursor is. This allows us to capture the whole image even
    // if we resliced in awkward places.

    var offset = [];

    for (var i = 0; i < 3; i++) {
      offset[i] = -Math.abs(center[i] - imageCenter[i]);
      offset[i] *= 2; // give us room
    } // Now resize the plane based on these offsets.


    var planeOrientation = publicAPI.getCursorAlgorithm().getReslicePlaneNormal(); // Now set the size of the plane based on the location of the cursor so as to
    // at least completely cover the viewed region

    if (planeOrientation === 1) {
      model.planeSource.setOrigin(bounds[0] + offset[0], center[1], bounds[4] + offset[2]);
      model.planeSource.setPoint1(bounds[1] - offset[0], center[1], bounds[4] + offset[2]);
      model.planeSource.setPoint2(bounds[0] + offset[0], center[1], bounds[5] - offset[2]);
    } else if (planeOrientation === 2) {
      model.planeSource.setOrigin(bounds[0] + offset[0], bounds[2] + offset[1], center[2]);
      model.planeSource.setPoint1(bounds[1] - offset[0], bounds[2] + offset[1], center[2]);
      model.planeSource.setPoint2(bounds[0] + offset[0], bounds[3] - offset[1], center[2]);
    } else if (planeOrientation === 0) {
      model.planeSource.setOrigin(center[0], bounds[2] + offset[1], bounds[4] + offset[2]);
      model.planeSource.setPoint1(center[0], bounds[3] - offset[1], bounds[4] + offset[2]);
      model.planeSource.setPoint2(center[0], bounds[2] + offset[1], bounds[5] - offset[2]);
    }
  };

  publicAPI.resetCamera = function () {
    if (model.renderer) {
      var center = publicAPI.getResliceCursor().getCenter();
      model.renderer.getActiveCamera().setFocalPoint(center[0], center[1], center[2]);
      var normalAxis = publicAPI.getCursorAlgorithm().getReslicePlaneNormal();
      var normal = publicAPI.getResliceCursor().getPlane(normalAxis).getNormal();
      var cameraPosition = [];
      add(center, normal, cameraPosition);
      model.renderer.getActiveCamera().setPosition(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
      model.renderer.resetCamera();
      model.renderer.resetCameraClippingRange();
    }
  };

  publicAPI.initializeReslicePlane = function () {
    if (!publicAPI.getResliceCursor().getImage()) {
      return;
    } // Initialize the reslice plane origins. Offset should be zero within
    // this function here.


    publicAPI.computeReslicePlaneOrigin(); // Finally reset the camera to whatever orientation they were staring in

    publicAPI.resetCamera();
  };

  publicAPI.updateReslicePlane = function () {
    if (!publicAPI.getResliceCursor().getImage() || !model.imageActor.getVisibility()) {
      return;
    } // Reinitialize the reslice plane.. We will recompute everything here.


    if (!model.planeInitialized) {
      publicAPI.initializeReslicePlane();
      model.planeInitialized = true;
    } // Calculate appropriate pixel spacing for the reslicing


    var spacing = publicAPI.getResliceCursor().getImage().getSpacing();
    var planeNormalType = publicAPI.getCursorAlgorithm().getReslicePlaneNormal();
    var plane = publicAPI.getResliceCursor().getPlane(planeNormalType); // Compute the origin of the reslice plane prior to transformations.

    publicAPI.computeReslicePlaneOrigin(); // Compute view up to configure camera later on

    var viewUp = publicAPI.getResliceCursor().getViewUp(planeNormalType);
    transformPlane(model.planeSource, publicAPI.getResliceCursor().getCenter(), plane.getNormal(), viewUp);

    var boundedOrigin = _toConsumableArray(model.planeSource.getOrigin());

    var boundedP1 = _toConsumableArray(model.planeSource.getPoint1());

    var boundedP2 = _toConsumableArray(model.planeSource.getPoint2());

    boundPlane(publicAPI.getResliceCursor().getImage().getBounds(), boundedOrigin, boundedP1, boundedP2);
    model.planeSource.setOrigin(boundedOrigin);
    model.planeSource.setPoint1(boundedP1[0], boundedP1[1], boundedP1[2]);
    model.planeSource.setPoint2(boundedP2[0], boundedP2[1], boundedP2[2]);
    var o = model.planeSource.getOrigin();
    var p1 = model.planeSource.getPoint1();
    var planeAxis1 = [];
    subtract(p1, o, planeAxis1);
    var p2 = model.planeSource.getPoint2();
    var planeAxis2 = [];
    subtract(p2, o, planeAxis2); // The x,y dimensions of the plane

    var planeSizeX = normalize(planeAxis1);
    var planeSizeY = normalize(planeAxis2);
    var normal = model.planeSource.getNormal();
    mat4.identity(model.newResliceAxes);

    for (var i = 0; i < 3; i++) {
      model.newResliceAxes[4 * i + 0] = planeAxis1[i];
      model.newResliceAxes[4 * i + 1] = planeAxis2[i];
      model.newResliceAxes[4 * i + 2] = normal[i];
    }

    var spacingX = Math.abs(planeAxis1[0] * spacing[0]) + Math.abs(planeAxis1[1] * spacing[1]) + Math.abs(planeAxis1[2] * spacing[2]);
    var spacingY = Math.abs(planeAxis2[0] * spacing[0]) + Math.abs(planeAxis2[1] * spacing[1]) + Math.abs(planeAxis2[2] * spacing[2]);
    var planeOrigin = [].concat(_toConsumableArray(model.planeSource.getOrigin()), [1.0]);
    var originXYZW = [];
    var newOriginXYZW = [];
    vec4.transformMat4(originXYZW, planeOrigin, model.newResliceAxes);
    mat4.transpose(model.newResliceAxes, model.newResliceAxes);
    vec4.transformMat4(newOriginXYZW, originXYZW, model.newResliceAxes);
    model.newResliceAxes[4 * 3 + 0] = newOriginXYZW[0];
    model.newResliceAxes[4 * 3 + 1] = newOriginXYZW[1];
    model.newResliceAxes[4 * 3 + 2] = newOriginXYZW[2]; // Compute a new set of resliced extents

    var extentX = 0;
    var extentY = 0; // Pad extent up to a power of two for efficient texture mapping
    // make sure we're working with valid values

    var realExtentX = spacingX === 0 ? Number.MAX_SAFE_INTEGER : planeSizeX / spacingX; // Sanity check the input data:
    // * if realExtentX is too large, extentX will wrap
    // * if spacingX is 0, things will blow up.

    var value = VTK_INT_MAX >> 1; // eslint-disable-line no-bitwise

    if (realExtentX > value) {
      vtkErrorMacro('Invalid X extent: ', realExtentX);
      extentX = 0;
    } else {
      extentX = 1;

      while (extentX < realExtentX) {
        extentX <<= 1; // eslint-disable-line no-bitwise
      }
    } // make sure extentY doesn't wrap during padding


    var realExtentY = spacingY === 0 ? Number.MAX_SAFE_INTEGER : planeSizeY / spacingY;

    if (realExtentY > value) {
      vtkErrorMacro('Invalid Y extent:', realExtentY);
      extentY = 0;
    } else {
      extentY = 1;

      while (extentY < realExtentY) {
        extentY <<= 1; // eslint-disable-line no-bitwise
      }
    }

    var outputSpacingX = extentX === 0 ? 1.0 : planeSizeX / extentX;
    var outputSpacingY = extentY === 0 ? 1.0 : planeSizeY / extentY;
    var modify = false;

    for (var _i = 0; _i < 4; _i++) {
      for (var j = 0; j < 4; j++) {
        var index = 4 * j + _i;
        var d = model.newResliceAxes[index];

        if (d !== model.resliceAxes[index]) {
          model.resliceAxes[index] = d;
          modify = true;
        }
      }
    }

    if (modify) {
      publicAPI.setResliceParameters(outputSpacingX, outputSpacingY, extentX, extentY);
      publicAPI.modified();
    }

    buildTime.modified();
    publicAPI.resetCamera();
  };

  publicAPI.setResliceParameters = function (outputSpacingX, outputSpacingY, extentX, extentY) {
    if (model.reslice) {
      model.reslice.setResliceAxes(model.resliceAxes);
      model.reslice.setOutputSpacing([outputSpacingX, outputSpacingY, 1]);
      model.reslice.setOutputOrigin([0.5 * outputSpacingX, 0.5 * outputSpacingY, 0]);
      model.reslice.setOutputExtent([0, extentX - 1, 0, extentY - 1, 0, 0]);
      model.imageActor.setUserMatrix(model.resliceAxes);
      model.reslice.update();
    }
  };

  publicAPI.computeOrigin = function (matrix) {
    var center = publicAPI.getResliceCursor().getCenter();
    var centerTransformed = [];
    vec4.transformMat4(centerTransformed, center, matrix);

    for (var i = 0; i < 3; i++) {
      matrix[4 * 3 + i] = matrix[4 * 3 + i] + center[i] - centerTransformed[i];
    }
  };

  publicAPI.getActors = function () {
    return model.imageActor;
  };

  publicAPI.getNestedProps = function () {
    return publicAPI.getActors();
  };
  /**
   * t1 and t2 should be orthogonal and axis aligned
   */


  publicAPI.boundPoint = function (inPoint, t1, t2, outPoint) {
    if (!publicAPI.getResliceCursor()) {
      return;
    }

    var bounds = publicAPI.getResliceCursor().getImage().getBounds();
    var absT1 = t1.map(function (val) {
      return Math.abs(val);
    });
    var absT2 = t2.map(function (val) {
      return Math.abs(val);
    });
    var epsilon = 0.00001;
    var o1 = 0.0;
    var o2 = 0.0;

    for (var i = 0; i < 3; i++) {
      var axisOffset = 0;
      var useT1 = absT1[i] > absT2[i];
      var t = useT1 ? t1 : t2;
      var absT = useT1 ? absT1 : absT2;

      if (inPoint[i] < bounds[i * 2]) {
        axisOffset = absT[i] > epsilon ? (bounds[2 * i] - inPoint[i]) / t[i] : 0;
      } else if (inPoint[i] > bounds[2 * i + 1]) {
        axisOffset = absT[i] !== epsilon ? (bounds[2 * i + 1] - inPoint[i]) / t[i] : 0;
      }

      if (useT1) {
        if (Math.abs(axisOffset) > Math.abs(o1)) {
          o1 = axisOffset;
        }
      } else if (Math.abs(axisOffset) > Math.abs(o2)) {
        o2 = axisOffset;
      }
    }

    outPoint[0] = inPoint[0];
    outPoint[1] = inPoint[1];
    outPoint[2] = inPoint[2];

    if (o1 !== 0.0) {
      var translation = [];
      translation[0] = t1[0] * o1;
      translation[1] = t1[1] * o1;
      translation[2] = t1[2] * o1;
      add(outPoint, translation, outPoint);
    }

    if (o2 !== 0) {
      var _translation = [];
      _translation[0] = t2[0] * o2;
      _translation[1] = t2[1] * o2;
      _translation[2] = t2[2] * o2;
      add(outPoint, _translation, outPoint);
    }
  };

  publicAPI.getBounds = function () {
    return model.imageActor.getBounds();
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  tolerance: 5,
  showReslicedImage: true
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  vtkWidgetRepresentation.extend(publicAPI, model, initialValues);
  model.reslice = null;
  model.planeSource = vtkPlaneSource.newInstance();
  model.resliceAxes = mat4.identity(new Float64Array(16));
  model.newResliceAxes = mat4.identity(new Float64Array(16));
  model.imageActor = vtkImageSlice.newInstance();
  model.imageMapper = vtkImageMapper.newInstance();
  model.imageMapper.setResolveCoincidentTopologyToPolygonOffset();
  model.imageMapper.setRelativeCoincidentTopologyPolygonOffsetParameters(1.0, 1.0);
  model.planeInitialized = false;
  macro.setGet(publicAPI, model, ['tolerance', 'planeSource', 'showReslicedImage']);
  macro.get(publicAPI, model, ['resliceAxes', 'reslice', 'imageActor']); // Object methods

  vtkResliceCursorRepresentation(publicAPI, model);
  publicAPI.createDefaultResliceAlgorithm();
  model.imageMapper.setInputConnection(model.reslice.getOutputPort());
  model.imageActor.setMapper(model.imageMapper);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkResliceCursorRepresentation'); // ----------------------------------------------------------------------------

var vtkResliceCursorRepresentation$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkResliceCursorRepresentation$1 as default, extend, newInstance };
