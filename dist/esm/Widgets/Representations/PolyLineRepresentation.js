import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../macros.js';
import vtkActor from '../../Rendering/Core/Actor.js';
import vtkMapper from '../../Rendering/Core/Mapper.js';
import { y as areEquals, e as distance2BetweenPoints } from '../../Common/Core/Math/index.js';
import vtkBoundingBox from '../../Common/DataModel/BoundingBox.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import vtkTubeFilter from '../../Filters/General/TubeFilter.js';
import vtkWidgetRepresentation from './WidgetRepresentation.js';
import { RenderingTypes } from '../Core/WidgetManager/Constants.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
// vtkPolyLineRepresentation methods
// ----------------------------------------------------------------------------

function vtkPolyLineRepresentation(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPolyLineRepresentation');

  var superClass = _objectSpread({}, publicAPI); // --------------------------------------------------------------------------
  // Internal polydata dataset
  // --------------------------------------------------------------------------


  model.internalPolyData = vtkPolyData.newInstance({
    mtime: 0
  });
  model.cells = [];

  function allocateSize(size) {
    var closePolyLine = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (size < 2) {
      model.internalPolyData.getPoints().setData(new Float32Array([0, 0, 0]));
      model.internalPolyData.getLines().setData(new Uint8Array(0));
    } else if (!model.points || model.points.length !== size * 3) {
      model.points = new Float32Array(size * 3);
      model.cells = new Uint8Array(size + 1 + (closePolyLine ? 1 : 0));
      model.cells[0] = model.cells.length - 1;

      for (var i = 1; i < model.cells.length; i++) {
        model.cells[i] = i - 1;
      }

      if (closePolyLine) {
        model.cells[model.cells.length - 1] = 0;
        console.log('closePolyLine', closePolyLine, model.cells);
      }

      model.internalPolyData.getPoints().setData(model.points, 3);
      model.internalPolyData.getLines().setData(model.cells);
    }

    return model.points;
  }
  /**
   * Change the line/tube thickness.
   * @param {number} lineThickness
   */


  function applyLineThickness(lineThickness) {
    var scaledLineThickness = lineThickness;

    if (publicAPI.getScaleInPixels()) {
      var center = vtkBoundingBox.getCenter(model.internalPolyData.getBounds());
      scaledLineThickness *= publicAPI.getPixelWorldHeightAtCoord(center);
    }

    model.tubes.setRadius(scaledLineThickness);
  } // --------------------------------------------------------------------------
  // Generic rendering pipeline
  // --------------------------------------------------------------------------


  model.mapper = vtkMapper.newInstance();
  model.actor = vtkActor.newInstance({
    parentProp: publicAPI
  });
  model.tubes = vtkTubeFilter.newInstance({
    radius: model.lineThickness,
    numberOfSides: 12,
    capping: false
  });
  model.tubes.setInputConnection(publicAPI.getOutputPort());
  model.mapper.setInputConnection(model.tubes.getOutputPort()); // model.mapper.setInputConnection(publicAPI.getOutputPort());

  model.actor.setMapper(model.mapper);
  publicAPI.addActor(model.actor); // --------------------------------------------------------------------------

  publicAPI.requestData = function (inData, outData) {
    var state = inData[0]; // Remove invalid and coincident points for tube filter.

    var list = publicAPI.getRepresentationStates(state).reduce(function (subStates, subState) {
      var subStateOrigin = subState.getOrigin && subState.getOrigin() ? subState.getOrigin() : null;
      var previousSubStateOrigin = subStates.length && subStates[subStates.length - 1].getOrigin();

      if (!subStateOrigin || previousSubStateOrigin && areEquals(subStateOrigin, previousSubStateOrigin)) {
        return subStates;
      }

      subStates.push(subState);
      return subStates;
    }, []);
    var size = list.length; // Do not render last point if not visible or too close from previous point.

    if (size > 1) {
      var lastState = list[list.length - 1];
      var last = lastState.getOrigin();
      var prevLast = list[list.length - 2].getOrigin();
      var delta = distance2BetweenPoints(last, prevLast) > model.threshold ? 0 : 1;

      if (!delta && lastState.isVisible && !lastState.isVisible()) {
        delta++;
      }

      size -= delta;
    }

    var points = allocateSize(size, model.closePolyLine && size > 2);

    if (points) {
      for (var i = 0; i < size; i++) {
        var coords = list[i].getOrigin();
        points[i * 3] = coords[0];
        points[i * 3 + 1] = coords[1];
        points[i * 3 + 2] = coords[2];
      }
    }

    model.internalPolyData.modified();
    var lineThickness = state.getLineThickness ? state.getLineThickness() : null;
    applyLineThickness(lineThickness || model.lineThickness);
    outData[0] = model.internalPolyData;
  };
  /**
   * When mousing over the line, if behavior != CONTEXT,
   * returns the parent state.
   * @param {object} prop
   * @param {number} compositeID
   * @returns {object}
   */


  publicAPI.getSelectedState = function (prop, compositeID) {
    return model.inputData[0];
  };

  publicAPI.updateActorVisibility = function (renderingType, ctxVisible, hVisible) {
    var state = model.inputData[0]; // Make lines/tubes thicker for picking

    var lineThickness = state.getLineThickness ? state.getLineThickness() : null;
    lineThickness = lineThickness || model.lineThickness;

    if (renderingType === RenderingTypes.PICKING_BUFFER) {
      lineThickness = Math.max(4, lineThickness);
    }

    applyLineThickness(lineThickness);
    var isValid = model.points && model.points.length > 3;
    return superClass.updateActorVisibility(renderingType, ctxVisible && isValid, hVisible && isValid);
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  threshold: Number.EPSILON,
  closePolyLine: false,
  lineThickness: 2,
  scaleInPixels: true
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  var newDefault = _objectSpread(_objectSpread({}, DEFAULT_VALUES), initialValues);

  vtkWidgetRepresentation.extend(publicAPI, model, newDefault);
  macro.setGet(publicAPI, model, ['threshold', 'closePolyLine', 'lineThickness']);
  vtkPolyLineRepresentation(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkPolyLineRepresentation'); // ----------------------------------------------------------------------------

var vtkPolyLineRepresentation$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkPolyLineRepresentation$1 as default, extend, newInstance };
