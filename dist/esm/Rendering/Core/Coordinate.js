import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../macros.js';
import Constants from './Coordinate/Constants.js';
import { L as round, I as floor } from '../../Common/Core/Math/index.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var Coordinate = Constants.Coordinate;
var vtkErrorMacro = macro.vtkErrorMacro; // ----------------------------------------------------------------------------
// vtkActor methods
// ----------------------------------------------------------------------------

function vtkCoordinate(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCoordinate');

  publicAPI.setValue = function () {
    if (model.deleted) {
      vtkErrorMacro('instance deleted - cannot call any method');
      return false;
    }

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var array = args; // allow an array passed as a single arg.

    if (array.length === 1 && Array.isArray(array[0])) {
      array = array[0];
    }

    if (array.length === 2) {
      publicAPI.setValue(array[0], array[1], 0.0);
      return true;
    }

    if (array.length !== 3) {
      throw new RangeError('Invalid number of values for array setter');
    }

    var changeDetected = false;
    model.value.forEach(function (item, index) {
      if (item !== array[index]) {
        if (changeDetected) {
          return;
        }

        changeDetected = true;
      }
    });

    if (changeDetected) {
      model.value = [].concat(array);
      publicAPI.modified();
    }

    return true;
  };

  publicAPI.setCoordinateSystemToDisplay = function () {
    publicAPI.setCoordinateSystem(Coordinate.DISPLAY);
  };

  publicAPI.setCoordinateSystemToNormalizedDisplay = function () {
    publicAPI.setCoordinateSystem(Coordinate.NORMALIZED_DISPLAY);
  };

  publicAPI.setCoordinateSystemToViewport = function () {
    publicAPI.setCoordinateSystem(Coordinate.VIEWPORT);
  };

  publicAPI.setCoordinateSystemToNormalizedViewport = function () {
    publicAPI.setCoordinateSystem(Coordinate.NORMALIZED_VIEWPORT);
  };

  publicAPI.setCoordinateSystemToProjection = function () {
    publicAPI.setCoordinateSystem(Coordinate.PROJECTION);
  };

  publicAPI.setCoordinateSystemToView = function () {
    publicAPI.setCoordinateSystem(Coordinate.VIEW);
  };

  publicAPI.setCoordinateSystemToWorld = function () {
    publicAPI.setCoordinateSystem(Coordinate.WORLD);
  };

  publicAPI.getCoordinateSystemAsString = function () {
    return macro.enumToString(Coordinate, model.coordinateSystem);
  };

  publicAPI.getComputedWorldValue = function (ren) {
    var val = model.computedWorldValue;

    if (model.computing) {
      return val;
    }

    model.computing = 1;
    val[0] = model.value[0];
    val[1] = model.value[1];
    val[2] = model.value[2]; // Use our renderer if is defined

    var renderer = ren;

    if (model.renderer) {
      renderer = model.renderer;
    }

    if (!renderer) {
      if (model.coordinateSystem === Coordinate.WORLD) {
        if (model.referenceCoordinate) {
          var refValue = model.referenceCoordinate.getComputedWorldValue(renderer);
          val[0] += refValue[0];
          val[1] += refValue[1];
          val[2] += refValue[2];
        }

        model.computing = 0;
      } else {
        vtkErrorMacro('Attempt to compute world coordinates from another coordinate system without a renderer');
      }

      return val;
    } // convert to current coordinate system


    var view = null;

    if (renderer && renderer.getRenderWindow().getViews()) {
      view = renderer.getRenderWindow().getViews()[0];
    } else {
      return model.computedWorldValue;
    }

    var dims = view.getViewportSize(renderer);
    var aspect = dims[0] / dims[1];

    if (model.referenceCoordinate && model.coordinateSystem !== Coordinate.WORLD) {
      var fval = model.referenceCoordinate.getComputedDoubleDisplayValue(renderer);
      var _refValue = [fval[0], fval[1], 0.0];

      switch (model.coordinateSystem) {
        case Coordinate.NORMALIZED_DISPLAY:
          _refValue = view.displayToNormalizedDisplay(_refValue[0], _refValue[1], _refValue[2]);
          break;

        case Coordinate.VIEWPORT:
          _refValue = view.displayToNormalizedDisplay(_refValue[0], _refValue[1], _refValue[2]);
          _refValue = view.normalizedDisplayToViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          break;

        case Coordinate.NORMALIZED_VIEWPORT:
          _refValue = view.displayToNormalizedDisplay(_refValue[0], _refValue[1], _refValue[2]);
          _refValue = view.normalizedDisplayToViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          _refValue = view.viewportToNormalizedViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          break;

        case Coordinate.PROJECTION:
          _refValue = view.displayToNormalizedDisplay(_refValue[0], _refValue[1], _refValue[2]);
          _refValue = view.normalizedDisplayToViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          _refValue = view.viewportToNormalizedViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          _refValue = renderer.normalizedViewportToProjection(_refValue[0], _refValue[1], _refValue[2]);
          break;

        case Coordinate.VIEW:
          _refValue = view.displayToNormalizedDisplay(_refValue[0], _refValue[1], _refValue[2]);
          _refValue = view.normalizedDisplayToViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          _refValue = view.viewportToNormalizedViewport(_refValue[0], _refValue[1], _refValue[2], renderer);
          _refValue = renderer.normalizedViewportToProjection(_refValue[0], _refValue[1], _refValue[2]);
          _refValue = renderer.projectionToView(_refValue[0], _refValue[1], _refValue[2], aspect);
          break;
      }

      val[0] += _refValue[0];
      val[1] += _refValue[1];
      val[2] += _refValue[2];
    }

    switch (model.coordinateSystem) {
      case Coordinate.DISPLAY:
        val = view.displayToNormalizedDisplay(val[0], val[1], val[2]);
        val = view.normalizedDisplayToViewport(val[0], val[1], val[2], renderer);
        val = view.viewportToNormalizedViewport(val[0], val[1], val[2], renderer);
        val = renderer.normalizedViewportToProjection(val[0], val[1], val[2]);
        val = renderer.projectionToView(val[0], val[1], val[2], aspect);
        val = renderer.viewToWorld(val[0], val[1], val[2]);
        break;

      case Coordinate.NORMALIZED_DISPLAY:
        val = view.normalizedDisplayToViewport(val[0], val[1], val[2], renderer);
        val = view.viewportToNormalizedViewport(val[0], val[1], val[2], renderer);
        val = renderer.normalizedViewportToProjection(val[0], val[1], val[2]);
        val = renderer.projectionToView(val[0], val[1], val[2], aspect);
        val = renderer.viewToWorld(val[0], val[1], val[2]);
        break;

      case Coordinate.VIEWPORT:
        val = view.viewportToNormalizedViewport(val[0], val[1], val[2], renderer);
        val = renderer.normalizedViewportToProjection(val[0], val[1], val[2]);
        val = renderer.projectionToView(val[0], val[1], val[2], aspect);
        val = renderer.viewToWorld(val[0], val[1], val[2]);
        break;

      case Coordinate.NORMALIZED_VIEWPORT:
        val = renderer.normalizedViewportToProjection(val[0], val[1], val[2]);
        val = renderer.projectionToView(val[0], val[1], val[2], aspect);
        val = renderer.viewToWorld(val[0], val[1], val[2]);
        break;

      case Coordinate.PROJECTION:
        val = renderer.projectionToView(val[0], val[1], val[2], aspect);
        val = renderer.viewToWorld(val[0], val[1], val[2]);
        break;

      case Coordinate.VIEW:
        val = renderer.viewToWorld(val[0], val[1], val[2]);
        break;
    }

    if (model.referenceCoordinate && model.coordinateSystem === Coordinate.WORLD) {
      var _refValue2 = publicAPI.getComputedWorldValue(renderer);

      val[0] += _refValue2[0];
      val[1] += _refValue2[1];
      val[2] += _refValue2[2];
    }

    model.computing = 0;
    model.computedWorldValue = val.slice(0);
    return val;
  };

  publicAPI.getComputedViewportValue = function (ren) {
    var f = publicAPI.getComputedDoubleViewportValue(ren);
    return [round(f[0]), round(f[1])];
  };

  publicAPI.getComputedDisplayValue = function (ren) {
    var val = publicAPI.getComputedDoubleDisplayValue(ren);
    return [floor(val[0]), floor(val[1])];
  };

  publicAPI.getComputedLocalDisplayValue = function (ren) {
    // Use our renderer if it is defined
    var renderer = ren;

    if (model.renderer) {
      renderer = model.renderer;
    }

    var val = publicAPI.getComputedDisplayValue(renderer);

    if (!renderer) {
      vtkErrorMacro('Attempt to convert to local display coordinates without a renderer');
      return val;
    }

    var view = null;

    if (renderer && renderer.getRenderWindow().getViews()) {
      view = renderer.getRenderWindow().getViews()[0];
    } else {
      return val;
    }

    val = view.displayToLocalDisplay(val[0], val[1], val[2]);
    return [round(val[0]), round(val[1])];
  };

  publicAPI.getComputedDoubleViewportValue = function (ren) {
    var renderer = ren;

    if (model.renderer) {
      renderer = model.renderer;
    }

    var val = publicAPI.getComputedDoubleDisplayValue(renderer);

    if (!renderer) {
      return val;
    }

    var view = null;

    if (renderer && renderer.getRenderWindow().getViews()) {
      view = renderer.getRenderWindow().getViews()[0];
    } else {
      return val;
    }

    val = view.displayToNormalizedDisplay(val[0], val[1], val[2]);
    val = view.normalizedDisplayToViewport(val[0], val[1], val[2], renderer);
    return [val[0], val[1]];
  };

  publicAPI.getComputedDoubleDisplayValue = function (ren) {
    if (model.computing) {
      return model.computedDoubleDisplayValue;
    }

    model.computing = 1;
    var val = model.value.slice(0);
    var renderer = ren;

    if (model.renderer) {
      renderer = model.renderer;
    }

    if (!renderer) {
      if (model.coordinateSystem === Coordinate.DISPLAY) {
        model.computedDoubleDisplayValue[0] = val[0];
        model.computedDoubleDisplayValue[1] = val[1];

        if (model.referenceCoordinate) {
          var refValue = model.referenceCoordinate.getComputedDoubleDisplayValue();
          model.computedDoubleDisplayValue[0] += refValue[0];
          model.computedDoubleDisplayValue[1] += refValue[1];
        }
      } else {
        model.computedDoubleDisplayValue[0] = Number.MAX_VALUE;
        model.computedDoubleDisplayValue[1] = Number.MAX_VALUE;
        vtkErrorMacro('Request for coordinate transformation without required viewport');
      }

      return model.computedDoubleDisplayValue;
    }

    var view = null;

    if (renderer && renderer.getRenderWindow().getViews()) {
      view = renderer.getRenderWindow().getViews()[0];
    } else {
      return val;
    }

    var dims = view.getViewportSize(renderer);
    var aspect = dims[0] / dims[1];

    switch (model.coordinateSystem) {
      case Coordinate.WORLD:
        {
          if (model.referenceCoordinate) {
            var _refValue3 = model.referenceCoordinate.getComputedWorldValue(renderer);

            val[0] += _refValue3[0];
            val[1] += _refValue3[1];
            val[2] += _refValue3[2];
          }

          val = renderer.worldToView(val[0], val[1], val[2]);
          val = renderer.viewToProjection(val[0], val[1], val[2], aspect);
          val = renderer.projectionToNormalizedViewport(val[0], val[1], val[2]);
          val = view.normalizedViewportToViewport(val[0], val[1], val[2], renderer);
          val = view.viewportToNormalizedDisplay(val[0], val[1], val[2], renderer);
          val = view.normalizedDisplayToDisplay(val[0], val[1], val[2]);
          break;
        }

      case Coordinate.VIEW:
        {
          val = renderer.viewToProjection(val[0], val[1], val[2], aspect);
          val = renderer.projectionToNormalizedViewport(val[0], val[1], val[2]);
          val = view.normalizedViewportToViewport(val[0], val[1], val[2], renderer);
          val = view.viewportToNormalizedDisplay(val[0], val[1], val[2], renderer);
          val = view.normalizedDisplayToDisplay(val[0], val[1], val[2]);
          break;
        }

      case Coordinate.PROJECTION:
        {
          val = renderer.projectionToNormalizedViewport(val[0], val[1], val[2]);
          val = view.normalizedViewportToViewport(val[0], val[1], val[2], renderer);
          val = view.viewportToNormalizedDisplay(val[0], val[1], val[2], renderer);
          val = view.normalizedDisplayToDisplay(val[0], val[1], val[2]);
          break;
        }

      case Coordinate.NORMALIZED_VIEWPORT:
        {
          val = view.normalizedViewportToViewport(val[0], val[1], val[2], renderer);

          if (model.referenceCoordinate) {
            var _refValue4 = model.referenceCoordinate.getComputedDoubleViewportValue(renderer);

            val[0] += _refValue4[0];
            val[1] += _refValue4[1];
          }

          val = view.viewportToNormalizedDisplay(val[0], val[1], val[2], renderer);
          val = view.normalizedDisplayToDisplay(val[0], val[1], val[2]);
          break;
        }

      case Coordinate.VIEWPORT:
        {
          if (model.referenceCoordinate) {
            var _refValue5 = model.referenceCoordinate.getComputedDoubleViewportValue(renderer);

            val[0] += _refValue5[0];
            val[1] += _refValue5[1];
          }

          val = view.viewportToNormalizedDisplay(val[0], val[1], val[2], renderer);
          val = view.normalizedDisplayToDisplay(val[0], val[1], val[2]);
          break;
        }

      case Coordinate.NORMALIZED_DISPLAY:
        val = view.normalizedDisplayToDisplay(val[0], val[1], val[2]);
        break;

      case Coordinate.USERDEFINED:
        val = model.value.slice(0);
        break;
    } // if we have a reference coordinate and we haven't handled it yet


    if (model.referenceCoordinate && (model.coordinateSystem === Coordinate.DISPLAY || model.coordinateSystem === Coordinate.NORMALIZED_DISPLAY)) {
      var _refValue6 = model.referenceCoordinate.getComputedDoubleDisplayValue(renderer);

      val[0] += _refValue6[0];
      val[1] += _refValue6[1];
    }

    model.computedDoubleDisplayValue[0] = val[0];
    model.computedDoubleDisplayValue[1] = val[1];
    model.computing = 0;
    return model.computedDoubleDisplayValue;
  };

  publicAPI.getComputedValue = function (ren) {
    var renderer = ren;

    if (model.renderer) {
      renderer = model.renderer;
    }

    switch (model.coordinateSystem) {
      case Coordinate.WORLD:
        return publicAPI.getComputedWorldValue(renderer);

      case Coordinate.VIEW:
      case Coordinate.NORMALIZED_VIEWPORT:
      case Coordinate.VIEWPORT:
        {
          var val = publicAPI.getComputedViewportValue(renderer);
          model.computedWorldValue[0] = val[0];
          model.computedWorldValue[1] = val[1];
          break;
        }

      case Coordinate.NORMALIZED_DISPLAY:
      case Coordinate.DISPLAY:
        {
          var _val = model.getComputedDisplayValue(renderer);

          model.computedWorldValue[0] = _val[0];
          model.computedWorldValue[1] = _val[1];
          break;
        }
    }

    return model.computedWorldValue;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  coordinateSystem: Coordinate.WORLD,
  value: [0.0, 0.0, 0.0],
  renderer: null,
  referenceCoordinate: null,
  computing: 0,
  computedWorldValue: [0.0, 0.0, 0.0],
  computedDoubleDisplayValue: [0.0, 0.0]
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  macro.obj(publicAPI, model); // Build VTK API

  macro.set(publicAPI, model, ['property']);
  macro.get(publicAPI, model, ['value']);
  macro.setGet(publicAPI, model, ['coordinateSystem', 'referenceCoordinate', 'renderer']);
  macro.getArray(publicAPI, model, ['value'], 3); // Object methods

  vtkCoordinate(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkCoordinate'); // ----------------------------------------------------------------------------

var vtkCoordinate$1 = _objectSpread({
  newInstance: newInstance,
  extend: extend
}, Constants);

export { vtkCoordinate$1 as default, extend, newInstance };
