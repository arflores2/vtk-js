import macro from '../../macros.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import { g as subtract, n as norm } from '../../Common/Core/Math/index.js';

var vtkWarningMacro = macro.vtkWarningMacro; // ----------------------------------------------------------------------------
// vtkLineSource methods
// ----------------------------------------------------------------------------

function vtkLineSource(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLineSource');

  publicAPI.requestData = function (inData, outData) {
    if (model.deleted) {
      return;
    }

    var dataset = outData[0]; // Check input

    var pointDataType = dataset ? dataset.getPoints().getDataType() : 'Float32Array';
    var pd = vtkPolyData.newInstance();
    var v21 = new Float32Array(3);
    subtract(model.point2, model.point1, v21);

    if (norm(v21) <= 0.0) {
      vtkWarningMacro('Zero-length line definition');
      return;
    } // hand create a line with special scalars


    var res = model.resolution;
    var numPts = res + 1; // Points

    var points = macro.newTypedArray(pointDataType, numPts * 3);
    pd.getPoints().setData(points, 3); // Cells

    var lines = new Uint32Array(numPts + 1);
    pd.getLines().setData(lines, 1);
    var idx = 0;
    var t = 0.0;

    for (var i = 0; i < res + 1; i++) {
      t = i / res;
      points[idx * 3] = model.point1[0] + t * v21[0];
      points[idx * 3 + 1] = model.point1[1] + t * v21[1];
      points[idx * 3 + 2] = model.point1[2] + t * v21[2];
      idx++;
    } // Generate line connectivity
    //


    idx = 0;
    lines[0] = numPts;

    for (var _i = 0; _i < numPts; _i++) {
      lines[_i + 1] = _i;
    } // Update output


    outData[0] = pd;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  resolution: 10,
  point1: [-1, 0, 0],
  point2: [1, 0, 0],
  pointType: 'Float32Array'
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Build VTK API

  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, ['resolution']);
  macro.setGetArray(publicAPI, model, ['point1', 'point2'], 3);
  macro.algo(publicAPI, model, 0, 1);
  vtkLineSource(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkLineSource'); // ----------------------------------------------------------------------------

var vtkLineSource$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkLineSource$1 as default, extend, newInstance };
