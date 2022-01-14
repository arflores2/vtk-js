import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import macro from '../../macros.js';
import vtkBoundingBox from '../../Common/DataModel/BoundingBox.js';
import vtkDataArray from '../../Common/Core/DataArray.js';
import { o as vtkMath } from '../../Common/Core/Math/index.js';
import { AttributeTypes } from '../../Common/DataModel/DataSetAttributes/Constants.js';
import vtkPoints from '../../Common/Core/Points.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import vtkTriangle from '../../Common/DataModel/Triangle.js';

var VertexType = {
  VTK_SIMPLE_VERTEX: 0,
  VTK_FIXED_VERTEX: 1,
  VTK_FEATURE_EDGE_VERTEX: 2,
  VTK_BOUNDARY_EDGE_VERTEX: 3
}; // ----------------------------------------------------------------------------
// vtkWindowedSincPolyDataFilter methods
// ----------------------------------------------------------------------------

function vtkWindowedSincPolyDataFilter(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkWindowedSincPolyDataFilter');

  publicAPI.vtkWindowedSincPolyDataFilterExecute = function (inPts, inputPolyData, output) {
    if (!inPts || model.numberOfIterations <= 0) {
      return inPts;
    }

    var inPtsData = inPts.getData();
    var inVerts = inputPolyData.getVerts().getData();
    var inLines = inputPolyData.getLines().getData();
    var inPolys = inputPolyData.getPolys().getData();
    var inStrips = inputPolyData.getStrips().getData();
    var cosFeatureAngle = Math.cos(vtkMath.radiansFromDegrees(model.featureAngle));
    var cosEdgeAngle = Math.cos(vtkMath.radiansFromDegrees(model.edgeAngle));
    var numPts = inPts.getNumberOfPoints(); // Perform topological analysis. What we're going to do is build a connectivity
    // array of connected vertices. The outcome will be one of three
    // classifications for a vertex: VTK_SIMPLE_VERTEX, VTK_FIXED_VERTEX. or
    // VTK_EDGE_VERTEX. Simple vertices are smoothed using all connected
    // vertices. FIXED vertices are never smoothed. Edge vertices are smoothed
    // using a subset of the attached vertices.

    var verts = new Array(numPts);

    for (var i = 0; i < numPts; ++i) {
      verts[i] = {
        type: VertexType.VTK_SIMPLE_VERTEX,
        edges: null
      };
    } // check vertices first. Vertices are never smoothed_--------------


    var npts = 0;

    for (var _i = 0; _i < inVerts.length; _i += npts + 1) {
      npts = inVerts[_i];
      var pts = inVerts.slice(_i + 1, _i + 1 + npts);

      for (var j = 0; j < pts.length; ++j) {
        verts[pts[j]].type = VertexType.VTK_FIXED_VERTEX;
      }
    } // now check lines. Only manifold lines can be smoothed------------


    for (var _i2 = 0; _i2 < inLines.length; _i2 += npts + 1) {
      npts = inLines[_i2];

      var _pts = inLines.slice(_i2 + 1, _i2 + 1 + npts); // Check for closed loop which are treated specially. Basically the
      // last point is ignored (set to fixed).


      var closedLoop = _pts[0] === _pts[npts - 1] && npts > 3;

      for (var _j = 0; _j < npts; ++_j) {
        if (verts[_pts[_j]].type === VertexType.VTK_SIMPLE_VERTEX) {
          // First point
          if (_j === 0) {
            if (!closedLoop) {
              verts[_pts[0]].type = VertexType.VTK_FIXED_VERTEX;
            } else {
              verts[_pts[0]].type = VertexType.VTK_FEATURE_EDGE_VERTEX;
              verts[_pts[0]].edges = [_pts[npts - 2], _pts[1]];
            }
          } // Last point
          else if (_j === npts - 1 && !closedLoop) {
            verts[_pts[_j]].type = VertexType.VTK_FIXED_VERTEX;
          } // In between point // is edge vertex (unless already edge vertex!)
          else {
            verts[_pts[_j]].type = VertexType.VTK_FEATURE_EDGE_VERTEX;
            verts[_pts[_j]].edges = [_pts[_j - 1], _pts[closedLoop && _j === npts - 2 ? 0 : _j + 1]];
          }
        } // if simple vertex
        // Vertex has been visited before, need to fix it. Special case
        // when working on closed loop.
        else if (verts[_pts[_j]].type === VertexType.VTK_FEATURE_EDGE_VERTEX && !(closedLoop && _j === npts - 1)) {
          verts[_pts[_j]].type = VertexType.VTK_FIXED_VERTEX;
          verts[_pts[_j]].edges = null;
        }
      } // for all points in this line

    } // for all lines
    // now polygons and triangle strips-------------------------------


    var numPolys = inPolys.length;
    var numStrips = inStrips.length;

    if (numPolys > 0 || numStrips > 0) {
      var inMesh = vtkPolyData.newInstance();
      inMesh.setPoints(inputPolyData.getPoints());
      inMesh.setPolys(inputPolyData.getPolys());
      var mesh = inMesh;
      var neighbors = [];
      var nei = 0; // const numNeiPts = 0;

      var normal = [];
      var neiNormal = [];
      /* TODO: Add vtkTriangleFilter
      if ( (numStrips = inputPolyData.getStrips().GetNumberOfCells()) > 0 )
      { // convert data to triangles
        inMesh.setStrips(inputPolyData.getStrips());
        const toTris = vtkTriangleFilter.newInstance();
        toTris.setInputData(inMesh);
        toTris.update();
        mesh = toTris.getOutput();
      }
      */

      mesh.buildLinks(); // to do neighborhood searching

      var polys = mesh.getPolys().getData();
      var cellId = 0;

      for (var _c = 0; _c < polys.length; _c += npts + 1, ++cellId) {
        npts = polys[_c];

        var _pts2 = polys.slice(_c + 1, _c + 1 + npts);

        for (var _i3 = 0; _i3 < npts; ++_i3) {
          var p1 = _pts2[_i3];
          var p2 = _pts2[(_i3 + 1) % npts];

          if (verts[p1].edges === null) {
            verts[p1].edges = [];
          }

          if (verts[p2].edges == null) {
            verts[p2].edges = [];
          }

          neighbors = mesh.getCellEdgeNeighbors(cellId, p1, p2);
          var numNei = neighbors.length; // neighbors->GetNumberOfIds();

          var edge = VertexType.VTK_SIMPLE_VERTEX;

          if (numNei === 0) {
            edge = VertexType.VTK_BOUNDARY_EDGE_VERTEX;
          } else if (numNei >= 2) {
            // non-manifold case, check nonmanifold smoothing state
            if (!model.nonManifoldSmoothing) {
              // check to make sure that this edge hasn't been marked already
              var _j2 = 0;

              for (; _j2 < numNei; ++_j2) {
                if (neighbors[_j2] < cellId) {
                  break;
                }
              }

              if (_j2 >= numNei) {
                edge = VertexType.VTK_FEATURE_EDGE_VERTEX;
              }
            }
            /* eslint-disable no-cond-assign */

          } else if (numNei === 1 && (nei = neighbors[0]) > cellId) {
            if (model.featureEdgeSmoothing) {
              // TODO: support polygons
              // vtkPolygon::ComputeNormal(inPts,npts,pts,normal);
              vtkTriangle.computeNormal(_toConsumableArray(inPts.getPoint(_pts2[0])), _toConsumableArray(inPts.getPoint(_pts2[1])), _toConsumableArray(inPts.getPoint(_pts2[2])), normal);

              var _mesh$getCellPoints = mesh.getCellPoints(nei),
                  cellPointIds = _mesh$getCellPoints.cellPointIds; // vtkPolygon::ComputeNormal(inPts,numNeiPts,neiPts,neiNormal);


              vtkTriangle.computeNormal(_toConsumableArray(inPts.getPoint(cellPointIds[0])), _toConsumableArray(inPts.getPoint(cellPointIds[1])), _toConsumableArray(inPts.getPoint(cellPointIds[2])), neiNormal);

              if (vtkMath.dot(normal, neiNormal) <= cosFeatureAngle) {
                edge = VertexType.VTK_FEATURE_EDGE_VERTEX;
              }
            }
          } // a visited edge; skip rest of analysis
          else {
            /* eslint-disable no-continue */
            continue;
          }

          if (edge && verts[p1].type === VertexType.VTK_SIMPLE_VERTEX) {
            verts[p1].edges = [p2];
            verts[p1].type = edge;
          } else if (edge && verts[p1].type === VertexType.VTK_BOUNDARY_EDGE_VERTEX || edge && verts[p1].type === VertexType.VTK_FEATURE_EDGE_VERTEX || !edge && verts[p1].type === VertexType.VTK_SIMPLE_VERTEX) {
            verts[p1].edges.push(p2);

            if (verts[p1].type && edge === VertexType.VTK_BOUNDARY_EDGE_VERTEX) {
              verts[p1].type = VertexType.VTK_BOUNDARY_EDGE_VERTEX;
            }
          }

          if (edge && verts[p2].type === VertexType.VTK_SIMPLE_VERTEX) {
            verts[p2].edges = [p1];
            verts[p2].type = edge;
          } else if (edge && verts[p2].type === VertexType.VTK_BOUNDARY_EDGE_VERTEX || edge && verts[p2].type === VertexType.VTK_FEATURE_EDGE_VERTEX || !edge && verts[p2].type === VertexType.VTK_SIMPLE_VERTEX) {
            verts[p2].edges.push(p1);

            if (verts[p2].type && edge === VertexType.VTK_BOUNDARY_EDGE_VERTEX) {
              verts[p2].type = VertexType.VTK_BOUNDARY_EDGE_VERTEX;
            }
          }
        }
      }
    } // if strips or polys

    for (var _i4 = 0; _i4 < numPts; ++_i4) {
      if (verts[_i4].type === VertexType.VTK_SIMPLE_VERTEX) ; else if (verts[_i4].type === VertexType.VTK_FIXED_VERTEX) ; else if (verts[_i4].type === VertexType.VTK_FEATURE_EDGE_VERTEX || verts[_i4].type === VertexType.VTK_BOUNDARY_EDGE_VERTEX) {
        // see how many edges; if two, what the angle is
        if (!model.boundarySmoothing && verts[_i4].type === VertexType.VTK_BOUNDARY_EDGE_VERTEX) {
          verts[_i4].type = VertexType.VTK_FIXED_VERTEX;
        } else if ((npts = verts[_i4].edges.length) !== 2) {
          // can only smooth edges on 2-manifold surfaces
          verts[_i4].type = VertexType.VTK_FIXED_VERTEX;
        } // check angle between edges
        else {
          var _x = [0, 0, 0];
          inPts.getPoint(verts[_i4].edges[0], _x);
          var _x2 = [0, 0, 0];
          inPts.getPoint(_i4, _x2);
          var x3 = [0, 0, 0];
          inPts.getPoint(verts[_i4].edges[1], x3);
          var l1 = [0, 0, 0];
          var l2 = [0, 0, 0];

          for (var k = 0; k < 3; ++k) {
            l1[k] = _x2[k] - _x[k];
            l2[k] = x3[k] - _x2[k];
          }

          if (vtkMath.normalize(l1) >= 0.0 && vtkMath.normalize(l2) >= 0.0 && vtkMath.dot(l1, l2) < cosEdgeAngle) {
            verts[_i4].type = VertexType.VTK_FIXED_VERTEX;
          } else if (verts[_i4].type === VertexType.VTK_FEATURE_EDGE_VERTEX) ; else ;
        } // if along edge

      } // if edge vertex

    } // for all points
    // Perform Windowed Sinc function interpolation
    //
    // console.log('Beginning smoothing iterations...');
    // need 4 vectors of points


    var zero = 0;
    var one = 1;
    var two = 2;
    var three = 3;
    var newPts = [];
    newPts.push(vtkPoints.newInstance());
    newPts[zero].setNumberOfPoints(numPts);
    newPts.push(vtkPoints.newInstance());
    newPts[one].setNumberOfPoints(numPts);
    newPts.push(vtkPoints.newInstance());
    newPts[two].setNumberOfPoints(numPts);
    newPts.push(vtkPoints.newInstance());
    newPts[three].setNumberOfPoints(numPts); // Get the center and length of the input dataset

    var inCenter = vtkBoundingBox.getCenter(inputPolyData.getBounds());
    var inLength = vtkBoundingBox.getDiagonalLength(inputPolyData.getBounds());

    if (!model.normalizeCoordinates) {
      // initialize to old coordinates
      // for (let i = 0; i < numPts; ++i) {
      //   newPts[zero].setPoint(i, inPts.subarray(i));
      // }
      var copy = macro.newTypedArray(newPts[zero].getDataType(), inPtsData);
      newPts[zero].setData(copy, 3);
    } else {
      // center the data and scale to be within unit cube [-1, 1]
      // initialize to old coordinates
      var normalizedPoint = [0, 0, 0];

      for (var _i5 = 0; _i5 < numPts; ++_i5) {
        var _newPts$zero;

        inPts.getPoint(_i5, normalizedPoint);
        normalizedPoint[0] = (normalizedPoint[0] - inCenter[0]) / inLength;
        normalizedPoint[1] = (normalizedPoint[1] - inCenter[1]) / inLength;
        normalizedPoint[2] = (normalizedPoint[2] - inCenter[2]) / inLength;

        (_newPts$zero = newPts[zero]).setPoint.apply(_newPts$zero, [_i5].concat(normalizedPoint));
      }
    } // Smooth with a low pass filter defined as a windowed sinc function.
    // Taubin describes this methodology is the IBM tech report RC-20404
    // (#90237, dated 3/12/96) "Optimal Surface Smoothing as Filter Design"
    // G. Taubin, T. Zhang and G. Golub. (Zhang and Golub are at Stanford
    // University)
    // The formulas here follow the notation of Taubin's TR, i.e.
    // newPts[zero], newPts[one], etc.
    // calculate weights and filter coefficients


    var kPb = model.passBand; // reasonable default for kPb in [0, 2] is 0.1

    var thetaPb = Math.acos(1.0 - 0.5 * kPb); // thetaPb in [0, M_PI/2]
    // vtkDebugMacro(<< "thetaPb = " << thetaPb);

    var w = new Array(model.numberOfIterations + 1);
    var c = new Array(model.numberOfIterations + 1);
    var cprime = new Array(model.numberOfIterations + 1);
    var zerovector = [0, 0, 0]; // Calculate the weights and the Chebychev coefficients c.
    //
    // Windowed sinc function weights. This is for a Hamming window. Other
    // windowing function could be implemented here.

    for (var _i6 = 0; _i6 <= model.numberOfIterations; ++_i6) {
      w[_i6] = 0.54 + 0.46 * Math.cos(_i6 * Math.PI / (model.numberOfIterations + 1));
    } // Calculate the optimal sigma (offset or fudge factor for the filter).
    // This is a Newton-Raphson Search.


    var fKpb = 0;
    var fPrimeKpb = 0;
    var done = false;
    var sigma = 0.0;

    for (var _j3 = 0; !done && _j3 < 500; ++_j3) {
      // Chebyshev coefficients
      c[0] = w[0] * (thetaPb + sigma) / Math.PI;

      for (var _i7 = 1; _i7 <= model.numberOfIterations; ++_i7) {
        c[_i7] = 2.0 * w[_i7] * Math.sin(_i7 * (thetaPb + sigma)) / (_i7 * Math.PI);
      } // calculate the Chebyshev coefficients for the derivative of the filter


      cprime[model.numberOfIterations] = 0.0;
      cprime[model.numberOfIterations - 1] = 0.0;

      if (model.numberOfIterations > 1) {
        cprime[model.numberOfIterations - 2] = 2.0 * (model.numberOfIterations - 1) * c[model.numberOfIterations - 1];
      }

      for (var _i8 = model.numberOfIterations - 3; _i8 >= 0; --_i8) {
        cprime[_i8] = cprime[_i8 + 2] + 2.0 * (_i8 + 1) * c[_i8 + 1];
      } // Evaluate the filter and its derivative at kPb (note the discrepancy
      // of calculating the c's based on thetaPb + sigma and evaluating the
      // filter at kPb (which is equivalent to thetaPb)


      fKpb = 0.0;
      fPrimeKpb = 0.0;
      fKpb += c[0];
      fPrimeKpb += cprime[0];

      for (var _i9 = 1; _i9 <= model.numberOfIterations; ++_i9) {
        if (_i9 === 1) {
          fKpb += c[_i9] * (1.0 - 0.5 * kPb);
          fPrimeKpb += cprime[_i9] * (1.0 - 0.5 * kPb);
        } else {
          fKpb += c[_i9] * Math.cos(_i9 * Math.acos(1.0 - 0.5 * kPb));
          fPrimeKpb += cprime[_i9] * Math.cos(_i9 * Math.acos(1.0 - 0.5 * kPb));
        }
      } // if fKpb is not close enough to 1.0, then adjust sigma


      if (model.numberOfIterations > 1) {
        if (Math.abs(fKpb - 1.0) >= 1e-3) {
          sigma -= (fKpb - 1.0) / fPrimeKpb; // Newton-Rhapson (want f=1)
        } else {
          done = true;
        }
      } else {
        // Order of Chebyshev is 1. Can't use Newton-Raphson to find an
        // optimal sigma. Object will most likely shrink.
        done = true;
        sigma = 0.0;
      }
    }

    if (Math.abs(fKpb - 1.0) >= 1e-3) {
      console.log('An optimal offset for the smoothing filter could not be found.  Unpredictable smoothing/shrinkage may result.');
    }

    var x = [0, 0, 0];
    var y = [0, 0, 0];
    var deltaX = [0, 0, 0];
    var xNew = [0, 0, 0];
    var x1 = [0, 0, 0];
    var x2 = [0, 0, 0]; // first iteration

    for (var _i10 = 0; _i10 < numPts; ++_i10) {
      if (verts[_i10].edges != null && (npts = verts[_i10].edges.length) > 0) {
        var _newPts$one, _newPts$three;

        // point is allowed to move
        newPts[zero].getPoint(_i10, x); // use current points

        deltaX[0] = 0.0;
        deltaX[1] = 0.0;
        deltaX[2] = 0.0; // calculate the negative of the laplacian
        // for all connected points

        for (var _j4 = 0; _j4 < npts; ++_j4) {
          newPts[zero].getPoint(verts[_i10].edges[_j4], y);

          for (var _k = 0; _k < 3; ++_k) {
            deltaX[_k] += (x[_k] - y[_k]) / npts;
          }
        } // newPts[one] = newPts[zero] - 0.5 newPts[one]


        for (var _k2 = 0; _k2 < 3; ++_k2) {
          deltaX[_k2] = x[_k2] - 0.5 * deltaX[_k2];
        }

        (_newPts$one = newPts[one]).setPoint.apply(_newPts$one, [_i10].concat(deltaX));

        if (verts[_i10].type === VertexType.VTK_FIXED_VERTEX) {
          newPts[zero].getPoint(_i10, deltaX);
        } else {
          // calculate newPts[three] = c0 newPts[zero] + c1 newPts[one]
          for (var _k3 = 0; _k3 < 3; ++_k3) {
            deltaX[_k3] = c[0] * x[_k3] + c[1] * deltaX[_k3];
          }
        }

        (_newPts$three = newPts[three]).setPoint.apply(_newPts$three, [_i10].concat(deltaX));
      } // if can move point
      else {
        var _newPts$one2, _newPts$three2;

        // point is not allowed to move, just use the old point...
        // (zero out the Laplacian)
        (_newPts$one2 = newPts[one]).setPoint.apply(_newPts$one2, [_i10].concat(zerovector));

        newPts[zero].getPoint(_i10, deltaX);

        (_newPts$three2 = newPts[three]).setPoint.apply(_newPts$three2, [_i10].concat(deltaX));
      }
    } // for all points
    // for the rest of the iterations


    var pX0 = [0, 0, 0];
    var pX1 = [0, 0, 0];
    var pX3 = [0, 0, 0];
    var iterationNumber = 2;

    for (; iterationNumber <= model.numberOfIterations; iterationNumber++) {

      for (var _i11 = 0; _i11 < numPts; ++_i11) {
        npts = verts[_i11].edges != null ? verts[_i11].edges.length : 0;

        if (npts > 0) {
          var _newPts$two;

          // point is allowed to move
          newPts[zero].getPoint(_i11, pX0); // use current points

          newPts[one].getPoint(_i11, pX1);
          deltaX[0] = 0.0;
          deltaX[1] = 0.0;
          deltaX[2] = 0.0; // calculate the negative laplacian of x1

          for (var _j5 = 0; _j5 < npts; ++_j5) {
            newPts[one].getPoint(verts[_i11].edges[_j5], y);

            for (var _k4 = 0; _k4 < 3; ++_k4) {
              deltaX[_k4] += (pX1[_k4] - y[_k4]) / npts;
            }
          } // for all connected points
          // Taubin:  x2 = (x1 - x0) + (x1 - x2)


          for (var _k5 = 0; _k5 < 3; ++_k5) {
            deltaX[_k5] = pX1[_k5] - pX0[_k5] + pX1[_k5] - deltaX[_k5];
          }

          (_newPts$two = newPts[two]).setPoint.apply(_newPts$two, [_i11].concat(deltaX)); // smooth the vertex (x3 = x3 + cj x2)


          newPts[three].getPoint(_i11, pX3);

          for (var _k6 = 0; _k6 < 3; ++_k6) {
            xNew[_k6] = pX3[_k6] + c[iterationNumber] * deltaX[_k6];
          }

          if (verts[_i11].type !== VertexType.VTK_FIXED_VERTEX) {
            var _newPts$three3;

            (_newPts$three3 = newPts[three]).setPoint.apply(_newPts$three3, [_i11].concat(xNew));
          }
        } // if can move point
        else {
          var _newPts$one3, _newPts$two2;

          // point is not allowed to move, just use the old point...
          // (zero out the Laplacian)
          (_newPts$one3 = newPts[one]).setPoint.apply(_newPts$one3, [_i11].concat(zerovector));

          (_newPts$two2 = newPts[two]).setPoint.apply(_newPts$two2, [_i11].concat(zerovector));
        }
      } // for all points
      // update the pointers. three is always three. all other pointers
      // shift by one and wrap.


      zero = (1 + zero) % 3;
      one = (1 + one) % 3;
      two = (1 + two) % 3;
    } // for all iterations or until converge
    // move the iteration count back down so that it matches the
    // actual number of iterations executed


    --iterationNumber; // set zero to three so the correct set of positions is outputted

    zero = three; // console.log('Performed', iterationNumber, 'smoothing passes');
    // if we scaled the data down to the unit cube, then scale data back
    // up to the original space

    if (model.normalizeCoordinates) {
      // Re-position the coordinated
      var repositionedPoint = [0, 0, 0];

      for (var _i12 = 0; _i12 < numPts; ++_i12) {
        var _newPts$zero2;

        newPts[zero].getPoint(_i12, repositionedPoint);

        for (var _j6 = 0; _j6 < 3; ++_j6) {
          repositionedPoint[_j6] = repositionedPoint[_j6] * inLength + inCenter[_j6];
        }

        (_newPts$zero2 = newPts[zero]).setPoint.apply(_newPts$zero2, [_i12].concat(repositionedPoint));
      }
    }

    if (model.generateErrorScalars) {
      var newScalars = new Float32Array(numPts);

      for (var _i13 = 0; _i13 < numPts; ++_i13) {
        inPts.getPoint(_i13, x1);
        newPts[zero].getPoint(_i13, x2);
        newScalars[_i13] = Math.sqrt(Math.distance2BetweenPoints(x1, x2));
      }

      var newScalarsArray = vtkDataArray.newInstance({
        numberOfComponents: 1,
        values: newScalars
      });
      var idx = output.getPointData().addArray(newScalarsArray);
      output.getPointData().setActiveAttribute(idx, AttributeTypes.SCALARS);
    }

    if (model.generateErrorVectors) {
      var newVectors = new Float32Array(3 * numPts);

      for (var _i14 = 0; _i14 < numPts; ++_i14) {
        inPts.getPoint(_i14, x1);
        newPts[zero].getPoint(_i14, x2);

        for (var _j7 = 0; _j7 < 3; ++_j7) {
          newVectors[3 * _i14 + _j7] = x2[_j7] - x1[_j7];
        }
      }

      var newVectorsArray = vtkDataArray.newInstance({
        numberOfComponents: 3,
        values: newVectors
      });
      output.getPointData().setVectors(newVectorsArray);
    }

    return newPts[zero];
  };

  publicAPI.requestData = function (inData, outData) {
    var numberOfInputs = publicAPI.getNumberOfInputPorts();

    if (!numberOfInputs) {
      return;
    }

    var input = inData[0];

    if (!input) {
      return;
    }

    var output = vtkPolyData.newInstance();
    var outputPoints = publicAPI.vtkWindowedSincPolyDataFilterExecute(input.getPoints(), input, output);
    output.setPointData(input.getPointData());
    output.setCellData(input.getCellData());
    output.setFieldData(input.getFieldData());
    output.setPoints(outputPoints);
    output.setVerts(input.getVerts());
    output.setLines(input.getLines());
    output.setPolys(input.getPolys());
    output.setStrips(input.getStrips());
    outData[0] = output;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  numberOfIterations: 20,
  passBand: 0.1,
  featureAngle: 45.0,
  edgeAngle: 15.0,
  featureEdgeSmoothing: 0,
  boundarySmoothing: 1,
  nonManifoldSmoothing: 0,
  generateErrorScalars: 0,
  generateErrorVectors: 0,
  normalizeCoordinates: 0
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  /* Make this a VTK object */

  macro.obj(publicAPI, model);
  /* Also make it an algorithm with one input and one output */

  macro.algo(publicAPI, model, 1, 1);
  /* Setters */

  macro.setGet(publicAPI, model, ['numberOfIterations', 'passBand', 'featureAngle', 'edgeAngle', 'featureEdgeSmoothing', 'boundarySmoothing', 'nonManifoldSmoothing', 'generateErrorScalars', 'generateErrorVectors', 'normalizeCoordinates']);
  /* Object specific methods */

  vtkWindowedSincPolyDataFilter(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkWindowedSincPolyDataFilter'); // ----------------------------------------------------------------------------

var vtkWindowedSincPolyDataFilter$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkWindowedSincPolyDataFilter$1 as default, extend, newInstance };
