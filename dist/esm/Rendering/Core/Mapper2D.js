import macro from '../../macros.js';
import vtkAbstractMapper from './AbstractMapper.js';
import vtkLookupTable from '../../Common/Core/LookupTable.js';
import Constants from './Mapper/Constants.js';

var ColorMode = Constants.ColorMode,
    ScalarMode = Constants.ScalarMode,
    GetArray = Constants.GetArray; // ---------------------------------------------------------------------------
// vtkMapper2D methods
// ---------------------------------------------------------------------------

function vtkMapper2D(publicAPI, model) {
  // Set out className
  model.classHierarchy.push('vtkMapper2D');

  publicAPI.createDefaultLookupTable = function () {
    model.lookupTable = vtkLookupTable.newInstance();
  };

  publicAPI.getColorModeAsString = function () {
    return macro.enumToString(ColorMode, model.colorMode);
  };

  publicAPI.setColorModeToDefault = function () {
    return publicAPI.setColorMode(0);
  };

  publicAPI.setColorModeToMapScalars = function () {
    return publicAPI.setColorMode(1);
  };

  publicAPI.setColorModeToDirectScalars = function () {
    return publicAPI.setColorMode(2);
  };

  publicAPI.getScalarModeAsString = function () {
    return macro.enumToString(ScalarMode, model.scalarMode);
  };

  publicAPI.setScalarModeToDefault = function () {
    return publicAPI.setScalarMode(0);
  };

  publicAPI.setScalarModeToUsePointData = function () {
    return publicAPI.setScalarMode(1);
  };

  publicAPI.setScalarModeToUseCellData = function () {
    return publicAPI.setScalarMode(2);
  };

  publicAPI.setScalarModeToUsePointFieldData = function () {
    return publicAPI.setScalarMode(3);
  };

  publicAPI.setScalarModeToUseCellFieldData = function () {
    return publicAPI.setScalarMode(4);
  };

  publicAPI.setScalarModeToUseFieldData = function () {
    return publicAPI.setScalarMode(5);
  };

  publicAPI.getAbstractScalars = function (input, scalarMode, arrayAccessMode, arrayId, arrayName) {
    // make sure we have an input
    if (!input || !model.scalarVisibility) {
      return {
        scalars: null,
        cellFLag: false
      };
    }

    var scalars = null;
    var cellFlag = false; // get scalar data and point/cell attribute according to scalar mode

    if (scalarMode === ScalarMode.DEFAULT) {
      scalars = input.getPointData().getScalars();

      if (!scalars) {
        scalars = input.getCellData().getScalars();
        cellFlag = true;
      }
    } else if (scalarMode === ScalarMode.USE_POINT_DATA) {
      scalars = input.getPointData().getScalars();
    } else if (scalarMode === ScalarMode.USE_CELL_DATA) {
      scalars = input.getCellData().getScalars();
      cellFlag = true;
    } else if (scalarMode === ScalarMode.USE_POINT_FIELD_DATA) {
      var pd = input.getPointData();

      if (arrayAccessMode === GetArray.BY_ID) {
        scalars = pd.getArrayByIndex(arrayId);
      } else {
        scalars = pd.getArrayByName(arrayName);
      }
    } else if (scalarMode === ScalarMode.USE_CELL_FIELD_DATA) {
      var cd = input.getCellData();
      cellFlag = true;

      if (arrayAccessMode === GetArray.BY_ID) {
        scalars = cd.getArrayByIndex(arrayId);
      } else {
        scalars = cd.getArrayByName(arrayName);
      }
    } else if (scalarMode === ScalarMode.USE_FIELD_DATA) {
      var fd = input.getFieldData();

      if (arrayAccessMode === GetArray.BY_ID) {
        scalars = fd.getArrayByIndex(arrayId);
      } else {
        scalars = fd.getArrayByName(arrayName);
      }
    }

    return {
      scalars: scalars,
      cellFlag: cellFlag
    };
  };

  publicAPI.getLookupTable = function () {
    if (!model.lookupTable) {
      publicAPI.createDefaultLookupTable();
    }

    return model.lookupTable;
  };

  publicAPI.getMTime = function () {
    var mt = model.mtime;

    if (model.lookupTable !== null) {
      var time = model.lookupTable.getMTime();
      mt = time > mt ? time : mt;
    }

    return mt;
  };

  publicAPI.mapScalars = function (input, alpha) {
    var scalars = publicAPI.getAbstractScalars(input, model.scalarMode, model.arrayAccessMode, model.arrayId, model.colorByArrayName).scalars;

    if (!scalars) {
      model.colorMapColors = null;
      return;
    } // we want to only recompute when something has changed


    var toString = "".concat(publicAPI.getMTime()).concat(scalars.getMTime()).concat(alpha);
    if (model.colorBuildString === toString) return;

    if (!model.useLookupTableScalarRange) {
      publicAPI.getLookupTable().setRange(model.scalarRange[0], model.scalarRange[1]);
    }

    var lut = publicAPI.getLookupTable();

    if (lut) {
      // Ensure that the lookup table is built
      lut.build();
      model.colorMapColors = lut.mapScalars(scalars, model.colorMode, -1);
    }

    model.colorBuildString = "".concat(publicAPI.getMTime()).concat(scalars.getMTime()).concat(alpha);
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  static: false,
  lookupTable: null,
  scalarVisibility: false,
  scalarRange: [0, 1],
  useLookupTableScalarRange: false,
  colorMode: 0,
  scalarMode: 0,
  arrayAccessMode: 1,
  // By_NAME
  renderTime: 0,
  colorByArrayName: null,
  transformCoordinate: null,
  viewSpecificProperties: null,
  customShaderAttributes: []
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkAbstractMapper.extend(publicAPI, model, initialValues);
  macro.get(publicAPI, model, ['colorMapColors']);
  macro.setGet(publicAPI, model, ['arrayAccessMode', 'colorByArrayName', 'colorMode', 'lookupTable', 'renderTime', 'scalarMode', 'scalarVisibility', 'static', 'transformCoordinate', 'useLookupTableScalarRange', 'viewSpecificProperties', 'customShaderAttributes' // point data array names that will be transferred to the VBO
  ]);
  macro.setGetArray(publicAPI, model, ['scalarRange'], 2);

  if (!model.viewSpecificProperties) {
    model.viewSpecificProperties = {};
  } // Object methods


  vtkMapper2D(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkMapper2D'); // ----------------------------------------------------------------------------

var vtkMapper2D$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkMapper2D$1 as default, extend, newInstance };
