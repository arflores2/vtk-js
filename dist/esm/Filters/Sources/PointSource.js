import macro from '../../macros.js';
import { q as random } from '../../Common/Core/Math/index.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';

// vtkPointSource methods
// ----------------------------------------------------------------------------

function vtkPointSource(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPointSource');

  publicAPI.requestData = function (inData, outData) {
    if (model.deleted) {
      return;
    }

    var dataset = outData[0]; // Check input

    var pointDataType = dataset ? dataset.getPoints().getDataType() : 'Float32Array';
    var pd = vtkPolyData.newInstance(); // hand create a point cloud

    var numPts = model.numberOfPoints; // Points

    var points = macro.newTypedArray(pointDataType, numPts * 3);
    pd.getPoints().setData(points, 3); // Cells

    var verts = new Uint32Array(numPts + 1);
    pd.getVerts().setData(verts, 1);
    var cosphi;
    var sinphi;
    var rho;
    var radius;
    var theta;

    for (var i = 0; i < numPts; i++) {
      cosphi = 1 - 2.0 * random();
      sinphi = Math.sqrt(1 - cosphi * cosphi);
      rho = model.radius * Math.pow(random(), 0.33333333);
      radius = rho * sinphi;
      theta = 2.0 * Math.PI * random();
      points[i * 3] = model.center[0] + radius * Math.cos(theta);
      points[i * 3 + 1] = model.center[1] + radius * Math.sin(theta);
      points[i * 3 + 2] = model.center[2] + rho * cosphi;
    } // Generate point connectivity
    //


    verts[0] = numPts;

    for (var _i = 0; _i < numPts; _i++) {
      verts[_i + 1] = _i;
    } // Update output


    outData[0] = pd;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  numberOfPoints: 10,
  center: [0, 0, 0],
  radius: 0.5,
  pointType: 'Float32Array'
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Build VTK API

  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, ['numberOfPoints', 'radius']);
  macro.setGetArray(publicAPI, model, ['center'], 3);
  macro.algo(publicAPI, model, 0, 1);
  vtkPointSource(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkPointSource'); // ----------------------------------------------------------------------------

var vtkPointSource$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkPointSource$1 as default, extend, newInstance };
