import _defineProperty from '@babel/runtime/helpers/defineProperty';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import { g as subtract, Q as multiplyAccumulate, f as normalize, j as cross } from '../../Common/Core/Math/index.js';
import vtkActor from '../../Rendering/Core/Actor.js';
import vtkCylinderSource from '../../Filters/Sources/CylinderSource.js';
import vtkMapper from '../../Rendering/Core/Mapper.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import vtkSphereSource from '../../Filters/Sources/SphereSource.js';
import vtkWidgetRepresentation from './WidgetRepresentation.js';
import { RenderingTypes } from '../Core/WidgetManager/Constants.js';
import { InteractionMethodsName } from '../Widgets3D/ResliceCursorWidget/Constants.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
// vtkResliceCursorContextRepresentation methods
// ----------------------------------------------------------------------------

function vtkResliceCursorContextRepresentation(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkResliceCursorContextRepresentation'); // --------------------------------------------------------------------------
  // Generic rendering pipeline
  // --------------------------------------------------------------------------

  model.mapper = vtkMapper.newInstance();
  model.actor = vtkActor.newInstance({
    parentProp: publicAPI
  });
  model.mapper.setInputConnection(publicAPI.getOutputPort());
  model.actor.setMapper(model.mapper);
  publicAPI.addActor(model.actor);
  model.pipelines = {};
  model.pipelines.center = {
    source: vtkSphereSource.newInstance(),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      parentProp: publicAPI
    })
  };
  model.pipelines.axes = [];
  var squarishCylinderProperties = {
    initAngle: Math.PI / 4,
    otherRadius: 0,
    resolution: 4
  }; // Create axis 1

  var axis1 = {};
  axis1.line = {
    source: vtkCylinderSource.newInstance(squarishCylinderProperties),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      pickable: true,
      parentProp: publicAPI
    })
  };
  axis1.rotation1 = {
    source: vtkSphereSource.newInstance(),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      pickable: true,
      parentProp: publicAPI
    })
  };
  axis1.rotation2 = {
    source: vtkSphereSource.newInstance(),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      pickable: true,
      parentProp: publicAPI
    })
  }; // Create axis 2

  var axis2 = {};
  axis2.line = {
    source: vtkCylinderSource.newInstance(squarishCylinderProperties),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      pickable: true,
      parentProp: publicAPI
    })
  };
  axis2.rotation1 = {
    source: vtkSphereSource.newInstance(),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      pickable: true,
      parentProp: publicAPI
    })
  };
  axis2.rotation2 = {
    source: vtkSphereSource.newInstance(),
    mapper: vtkMapper.newInstance(),
    actor: vtkActor.newInstance({
      pickable: true,
      parentProp: publicAPI
    })
  };
  model.pipelines.axes.push(axis1);
  model.pipelines.axes.push(axis2); // Improve actors rendering

  model.pipelines.center.actor.getProperty().setAmbient(1, 1, 1);
  model.pipelines.center.actor.getProperty().setDiffuse(0, 0, 0);
  model.pipelines.center.actor.getProperty().setBackfaceCulling(true);
  model.pipelines.axes.forEach(function (axis) {
    Object.values(axis).forEach(function (lineOrRotationHandle) {
      vtkWidgetRepresentation.connectPipeline(lineOrRotationHandle);
      var actor = lineOrRotationHandle.actor;
      actor.getProperty().setAmbient(1, 1, 1);
      actor.getProperty().setDiffuse(0, 0, 0);
      actor.getProperty().setBackfaceCulling(true);
      publicAPI.addActor(actor);
    });
  });
  vtkWidgetRepresentation.connectPipeline(model.pipelines.center);
  publicAPI.addActor(model.pipelines.center.actor);

  publicAPI.setLineThickness = function (lineThickness) {
    var scaledLineThickness = lineThickness;

    if (publicAPI.getScaleInPixels()) {
      var centerCoords = model.pipelines.center.source.getCenter();
      scaledLineThickness *= publicAPI.getPixelWorldHeightAtCoord(centerCoords);
    }

    model.pipelines.axes[0].line.source.setRadius(scaledLineThickness);
    model.pipelines.axes[1].line.source.setRadius(scaledLineThickness);
  };

  publicAPI.setSphereRadius = function (radius) {
    publicAPI.setSphereRadiusOnSphere(radius, model.pipelines.center.source);
    publicAPI.setSphereRadiusOnSphere(radius, model.pipelines.axes[0].rotation1.source);
    publicAPI.setSphereRadiusOnSphere(radius, model.pipelines.axes[0].rotation2.source);
    publicAPI.setSphereRadiusOnSphere(radius, model.pipelines.axes[1].rotation1.source);
    publicAPI.setSphereRadiusOnSphere(radius, model.pipelines.axes[1].rotation2.source);
  };

  publicAPI.setSphereRadiusOnSphere = function (radius, source) {
    var scaledRadius = radius;

    if (publicAPI.getScaleInPixels()) {
      var centerCoords = source.getCenter();
      scaledRadius *= publicAPI.getPixelWorldHeightAtCoord(centerCoords);
    }

    source.setRadius(scaledRadius);
  };

  publicAPI.setSphereRadius(7);

  function updateRender(state, axis) {
    var color = state.getColor();
    axis.line.actor.getProperty().setColor(color);
    axis.rotation1.actor.getProperty().setColor(color);
    axis.rotation2.actor.getProperty().setColor(color);
    var vector = [0, 0, 0];
    subtract(state.getPoint2(), state.getPoint1(), vector);
    var center = [0, 0, 0];
    multiplyAccumulate(state.getPoint1(), vector, 0.5, center);
    var length = normalize(vector);
    axis.line.source.setHeight(20 * length); // make it an infinite line
    // Rotate the cylinder to be along vector

    var viewNormal = model.inputData[0].getPlanes()[state.getInViewType()].normal;
    var x = cross(vector, viewNormal, []);
    var mat = [].concat(_toConsumableArray(x), [0], vector, [0], _toConsumableArray(viewNormal), [0], center, [1]);
    axis.line.actor.setUserMatrix(mat); // Rotation handles

    var distance = 0;

    if (publicAPI.getScaleInPixels()) {
      var pixelWorldHeight = publicAPI.getPixelWorldHeightAtCoord(center);
      var rendererPixelDims = model.displayScaleParams.rendererPixelDims;
      var totalSize = Math.min(rendererPixelDims[0], rendererPixelDims[1]) / 2;
      distance = publicAPI.getRotationHandlePosition() * pixelWorldHeight * totalSize;
    } else {
      distance = publicAPI.getRotationHandlePosition() * length / 2;
    }

    var rotationHandlePosition = [];
    multiplyAccumulate(center, vector, distance, rotationHandlePosition);
    axis.rotation1.source.setCenter(rotationHandlePosition);
    multiplyAccumulate(center, vector, -distance, rotationHandlePosition);
    axis.rotation2.source.setCenter(rotationHandlePosition);
  }
  /**
   * Returns the line actors in charge of translating the views.
   */


  publicAPI.getTranslationActors = function () {
    return [model.pipelines.axes[0].line.actor, model.pipelines.axes[1].line.actor];
  };

  publicAPI.getRotationActors = function () {
    return [model.pipelines.axes[0].rotation1.actor, model.pipelines.axes[0].rotation2.actor, model.pipelines.axes[1].rotation1.actor, model.pipelines.axes[1].rotation2.actor];
  };

  publicAPI.requestData = function (inData, outData) {
    var state = inData[0];
    var origin = state.getCenter();
    model.pipelines.center.source.setCenter(origin);
    var getAxis1 = "get".concat(model.axis1Name);
    var getAxis2 = "get".concat(model.axis2Name);
    var axis1State = state[getAxis1]();
    var axis2State = state[getAxis2]();
    updateRender(axis1State, model.pipelines.axes[0]);
    updateRender(axis2State, model.pipelines.axes[1]);
    publicAPI.setLineThickness(state.getLineThickness());
    publicAPI.setSphereRadius(state.getSphereRadius()); // TODO: return meaningful polydata (e.g. appended lines)

    outData[0] = vtkPolyData.newInstance();
  };

  publicAPI.updateActorVisibility = function (renderingType, ctxVisible, hVisible) {
    var state = model.inputData[0];
    var visibility = hVisible || renderingType === RenderingTypes.PICKING_BUFFER;
    publicAPI.getActors().forEach(function (actor) {
      actor.getProperty().setOpacity(state.getOpacity());
      var actorVisibility = visibility; // Conditionally display rotation handles

      if (publicAPI.getRotationActors().includes(actor)) {
        actorVisibility = actorVisibility && state.getEnableRotation();
      } // Conditionally display center handle but always show it for picking


      if (!state.getShowCenter() && actor === model.pipelines.center.actor) {
        actorVisibility = actorVisibility && renderingType === RenderingTypes.PICKING_BUFFER;
      }

      actor.setVisibility(actorVisibility); // Conditionally pick lines

      if (publicAPI.getTranslationActors().includes(actor)) {
        actor.setPickable(state.getEnableTranslation());
      }
    });
    var lineThickness = state.getLineThickness();

    if (renderingType === RenderingTypes.PICKING_BUFFER) {
      lineThickness = Math.max(3, lineThickness);
    }

    publicAPI.setLineThickness(lineThickness);
    var radius = state.getSphereRadius();

    if (renderingType === RenderingTypes.PICKING_BUFFER) {
      radius += 1;
    }

    publicAPI.setSphereRadius(radius);
  };

  publicAPI.getSelectedState = function (prop, compositeID) {
    var state = model.inputData[0];
    state.setActiveViewType(model.viewType);
    var getAxis1 = "get".concat(model.axis1Name);
    var getAxis2 = "get".concat(model.axis2Name);
    var axis1State = state[getAxis1]();
    var axis2State = state[getAxis2]();
    var activeLineState = null;
    var activeRotationPointName = '';
    var methodName = '';

    switch (prop) {
      case model.pipelines.axes[0].line.actor:
        activeLineState = axis1State;
        methodName = InteractionMethodsName.TranslateAxis;
        break;

      case model.pipelines.axes[1].line.actor:
        activeLineState = axis2State;
        methodName = InteractionMethodsName.TranslateAxis;
        break;

      case model.pipelines.axes[0].rotation1.actor:
        activeLineState = axis1State;
        activeRotationPointName = 'point1';
        methodName = InteractionMethodsName.RotateLine;
        break;

      case model.pipelines.axes[0].rotation2.actor:
        activeLineState = axis1State;
        activeRotationPointName = 'point2';
        methodName = InteractionMethodsName.RotateLine;
        break;

      case model.pipelines.axes[1].rotation1.actor:
        activeLineState = axis2State;
        activeRotationPointName = 'point1';
        methodName = InteractionMethodsName.RotateLine;
        break;

      case model.pipelines.axes[1].rotation2.actor:
        activeLineState = axis2State;
        activeRotationPointName = 'point2';
        methodName = InteractionMethodsName.RotateLine;
        break;

      default:
        methodName = InteractionMethodsName.TranslateCenter;
        break;
    }

    state.setActiveLineState(activeLineState);
    state.setActiveRotationPointName(activeRotationPointName);
    state.setUpdateMethodName(methodName);
    return state;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


function defaultValues(initialValues) {
  return _objectSpread(_objectSpread({
    axis1Name: '',
    axis2Name: '',
    rotationEnabled: true,
    rotationHandlePosition: 0.5,
    scaleInPixels: true,
    viewType: null
  }, initialValues), {}, {
    coincidentTopologyParameters: _objectSpread({
      Point: {
        factor: -1.0,
        offset: -1.0
      },
      Line: {
        factor: -1.5,
        offset: -1.5
      },
      Polygon: {
        factor: -2.0,
        offset: -2.0
      }
    }, initialValues.coincidentTopologyParameters)
  });
} // ----------------------------------------------------------------------------


function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, defaultValues(initialValues));
  vtkWidgetRepresentation.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['rotationHandlePosition']); // Object specific methods

  vtkResliceCursorContextRepresentation(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkResliceCursorContextRepresentation'); // ----------------------------------------------------------------------------

var vtkResliceCursorContextRepresentation$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkResliceCursorContextRepresentation$1 as default, extend, newInstance };
