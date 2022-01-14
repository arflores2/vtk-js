import macro from '../../macros.js';
import vtkCellArray from '../../Common/Core/CellArray.js';
import vtkDataArray from '../../Common/Core/DataArray.js';
import { f as normalize, j as cross, n as norm, d as dot, e as distance2BetweenPoints } from '../../Common/Core/Math/index.js';
import vtkPoints from '../../Common/Core/Points.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import { DesiredOutputPrecision } from '../../Common/DataModel/DataSetAttributes/Constants.js';
import { VtkDataTypes } from '../../Common/Core/DataArray/Constants.js';
import Constants from './TubeFilter/Constants.js';

var VaryRadius = Constants.VaryRadius,
    GenerateTCoords = Constants.GenerateTCoords;
var vtkDebugMacro = macro.vtkDebugMacro,
    vtkErrorMacro = macro.vtkErrorMacro,
    vtkWarningMacro = macro.vtkWarningMacro; // ----------------------------------------------------------------------------
// vtkTubeFilter methods
// ----------------------------------------------------------------------------

function vtkTubeFilter(publicAPI, model) {
  // Set our classname
  model.classHierarchy.push('vtkTubeFilter');

  function computeOffset(offset, npts) {
    var newOffset = offset;

    if (model.sidesShareVertices) {
      newOffset += model.numberOfSides * npts;
    } else {
      // points are duplicated
      newOffset += 2 * model.numberOfSides * npts;
    }

    if (model.capping) {
      // cap points are duplicated
      newOffset += 2 * model.numberOfSides;
    }

    return newOffset;
  }

  function findNextValidSegment(points, pointIds, start) {
    var ptId = pointIds[start];
    var ps = points.slice(3 * ptId, 3 * (ptId + 1));
    var end = start + 1;

    while (end < pointIds.length) {
      var endPtId = pointIds[end];
      var pe = points.slice(3 * endPtId, 3 * (endPtId + 1));

      if (ps !== pe) {
        return end - 1;
      }

      ++end;
    }

    return pointIds.length;
  }

  function generateSlidingNormals(pts, lines, normals) {
    var firstNormal = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
    var normal = [0.0, 0.0, 1.0];
    var lineData = lines; // lid = 0;

    var npts = lineData[0];

    for (var i = 0; i < lineData.length; i += npts + 1) {
      npts = lineData[i];

      if (npts === 1) {
        // return arbitrary
        normals.setTuple(lineData[i + 1], normal);
      } else if (npts > 1) {
        var sNextId = 0;
        var sPrev = [0, 0, 0];
        var sNext = [0, 0, 0];
        var linePts = lineData.slice(i + 1, i + 1 + npts);
        sNextId = findNextValidSegment(pts, linePts, 0);

        if (sNextId !== npts) {
          (function () {
            // at least one valid segment
            var pt1Id = linePts[sNextId];
            var pt1 = pts.slice(3 * pt1Id, 3 * (pt1Id + 1));
            var pt2Id = linePts[sNextId + 1];
            var pt2 = pts.slice(3 * pt2Id, 3 * (pt2Id + 1));
            sPrev = pt2.map(function (elem, idx) {
              return elem - pt1[idx];
            });
            normalize(sPrev); // compute first normal

            if (firstNormal) {
              normal = firstNormal;
            } else {
              // find the next valid, non-parallel segment
              while (++sNextId < npts) {
                sNextId = findNextValidSegment(pts, linePts, sNextId);

                if (sNextId !== npts) {
                  pt1Id = linePts[sNextId];
                  pt1 = pts.slice(3 * pt1Id, 3 * (pt1Id + 1));
                  pt2Id = linePts[sNextId + 1];
                  pt2 = pts.slice(3 * pt2Id, 3 * (pt2Id + 1));

                  for (var j = 0; j < 3; ++j) {
                    sNext[j] = pt2[j] - pt1[j];
                  }

                  normalize(sNext); // now the starting normal should simply be the cross product.
                  // In the following if statement, we check for the case where
                  // the two segments are parallel, in which case, continue
                  // searching for the next valid segment

                  var n = [0.0, 0.0, 0.0];
                  cross(sPrev, sNext, n);

                  if (norm(n) > 1.0e-3) {
                    normal = n;
                    sPrev = sNext;
                    break;
                  }
                }
              }

              if (sNextId >= npts) {
                // only one valid segment
                // a little trick to find orthogonal normal
                for (var _j = 0; _j < 3; ++_j) {
                  if (sPrev[_j] !== 0.0) {
                    normal[(_j + 2) % 3] = 0.0;
                    normal[(_j + 1) % 3] = 1.0;
                    normal[_j] = -sPrev[(_j + 1) % 3] / sPrev[_j];
                    break;
                  }
                }
              }
            }

            normalize(normal); // compute remaining normals

            var lastNormalId = 0;

            while (++sNextId < npts) {
              sNextId = findNextValidSegment(pts, linePts, sNextId);

              if (sNextId === npts) {
                break;
              }

              pt1Id = linePts[sNextId];
              pt1 = pts.slice(3 * pt1Id, 3 * (pt1Id + 1));
              pt2Id = linePts[sNextId + 1];
              pt2 = pts.slice(3 * pt2Id, 3 * (pt2Id + 1));

              for (var _j2 = 0; _j2 < 3; ++_j2) {
                sNext[_j2] = pt2[_j2] - pt1[_j2];
              }

              normalize(sNext); // compute rotation vector

              var w = [0.0, 0.0, 0.0];
              cross(sPrev, normal, w);

              if (normalize(w) !== 0.0) {
                // can't use this segment otherwise
                var q = [0.0, 0.0, 0.0];
                cross(sNext, sPrev, q);

                if (normalize(q) !== 0.0) {
                  // can't use this segment otherwise
                  var f1 = dot(q, normal);
                  var f2 = 1.0 - f1 * f1;

                  if (f2 > 0.0) {
                    f2 = Math.sqrt(f2);
                  } else {
                    f2 = 0.0;
                  }

                  var c = [0, 0, 0];

                  for (var _j3 = 0; _j3 < 3; ++_j3) {
                    c[_j3] = sNext[_j3] + sPrev[_j3];
                  }

                  normalize(c);
                  cross(c, q, w);
                  cross(sPrev, q, c);

                  if (dot(normal, c) * dot(w, c) < 0.0) {
                    f2 *= -1.0;
                  } // insert current normal before updating


                  for (var _j4 = lastNormalId; _j4 < sNextId; ++_j4) {
                    normals.setTuple(linePts[_j4], normal);
                  }

                  lastNormalId = sNextId;
                  sPrev = sNext; // compute next normal

                  normal = f1 * q + f2 * w;
                }
              }
            } // insert last normal for the remaining points


            for (var _j5 = lastNormalId; _j5 < npts; ++_j5) {
              normals.setTuple(linePts[_j5], normal);
            }
          })();
        } else {
          // no valid segments
          for (var j = 0; j < npts; ++j) {
            normals.setTuple(linePts[j], normal);
          }
        }
      }
    }

    return 1;
  }

  function generatePoints(offset, npts, pts, inPts, newPts, pd, outPD, newNormals, inScalars, range, inVectors, maxSpeed, inNormals, theta) {
    // Use averaged segment to create beveled effect.
    var sNext = [0.0, 0.0, 0.0];
    var sPrev = [0.0, 0.0, 0.0];
    var startCapNorm = [0.0, 0.0, 0.0];
    var endCapNorm = [0.0, 0.0, 0.0];
    var p = [0.0, 0.0, 0.0];
    var pNext = [0.0, 0.0, 0.0];
    var s = [0.0, 0.0, 0.0];
    var n = [0.0, 0.0, 0.0];
    var w = [0.0, 0.0, 0.0];
    var nP = [0.0, 0.0, 0.0];
    var normal = [0.0, 0.0, 0.0];
    var sFactor = 1.0;
    var ptId = offset;

    for (var j = 0; j < npts; ++j) {
      // First point
      if (j === 0) {
        p = inPts.slice(3 * pts[0], 3 * (pts[0] + 1));
        pNext = inPts.slice(3 * pts[1], 3 * (pts[1] + 1));

        for (var i = 0; i < 3; ++i) {
          sNext[i] = pNext[i] - p[i];
          sPrev[i] = sNext[i];
          startCapNorm[i] = -sPrev[i];
        }

        normalize(startCapNorm);
      } else if (j === npts - 1) {
        for (var _i = 0; _i < 3; ++_i) {
          sPrev[_i] = sNext[_i];
          p[_i] = pNext[_i];
          endCapNorm[_i] = sNext[_i];
        }

        normalize(endCapNorm);
      } else {
        for (var _i2 = 0; _i2 < 3; ++_i2) {
          p[_i2] = pNext[_i2];
        }

        pNext = inPts.slice(3 * pts[j + 1], 3 * (pts[j + 1] + 1));

        for (var _i3 = 0; _i3 < 3; ++_i3) {
          sPrev[_i3] = sNext[_i3];
          sNext[_i3] = pNext[_i3] - p[_i3];
        }
      }

      if (normalize(sNext) === 0.0) {
        vtkWarningMacro('Coincident points!');
        return 0;
      }

      for (var _i4 = 0; _i4 < 3; ++_i4) {
        s[_i4] = (sPrev[_i4] + sNext[_i4]) / 2.0; // average vector
      }

      n = inNormals.slice(3 * pts[j], 3 * (pts[j] + 1)); // if s is zero then just use sPrev cross n

      if (normalize(s) === 0.0) {
        cross(sPrev, n, s);

        if (normalize(s) === 0.0) {
          vtkDebugMacro('Using alternate bevel vector');
        }
      }

      cross(s, n, w);

      if (normalize(w) === 0.0) {
        var msg = 'Bad normal: s = ';
        msg += "".concat(s[0], ",  ").concat(s[1], ", ").concat(s[2]);
        msg += " n = ".concat(n[0], ",  ").concat(n[1], ", ").concat(n[2]);
        vtkWarningMacro(msg);
        return 0;
      }

      cross(w, s, nP); // create orthogonal coordinate system

      normalize(nP); // Compute a scalar factor based on scalars or vectors

      if (inScalars && model.varyRadius === VaryRadius.VARY_RADIUS_BY_SCALAR) {
        sFactor = 1.0 + (model.radiusFactor - 1.0) * (inScalars.getComponent(pts[j], 0) - range[0]) / (range[1] - range[0]);
      } else if (inVectors && model.varyRadius === VaryRadius.VARY_RADIUS_BY_VECTOR) {
        sFactor = Math.sqrt(maxSpeed / norm(inVectors.getTuple(pts[j])));

        if (sFactor > model.radiusFactor) {
          sFactor = model.radiusFactor;
        }
      } else if (inScalars && model.varyRadius === VaryRadius.VARY_RADIUS_BY_ABSOLUTE_SCALAR) {
        sFactor = inScalars.getComponent(pts[j], 0);

        if (sFactor < 0.0) {
          vtkWarningMacro('Scalar value less than zero, skipping line');
          return 0;
        }
      } // create points around line


      if (model.sidesShareVertices) {
        for (var k = 0; k < model.numberOfSides; ++k) {
          for (var _i5 = 0; _i5 < 3; ++_i5) {
            normal[_i5] = w[_i5] * Math.cos(k * theta) + nP[_i5] * Math.sin(k * theta);
            s[_i5] = p[_i5] + model.radius * sFactor * normal[_i5];
            newPts[3 * ptId + _i5] = s[_i5];
            newNormals[3 * ptId + _i5] = normal[_i5];
          }

          outPD.passData(pd, pts[j], ptId);
          ptId++;
        } // for each side

      } else {
        var nRight = [0, 0, 0];
        var nLeft = [0, 0, 0];

        for (var _k = 0; _k < model.numberOfSides; ++_k) {
          for (var _i6 = 0; _i6 < 3; ++_i6) {
            // Create duplicate vertices at each point
            // and adjust the associated normals so that they are
            // oriented with the facets. This preserves the tube's
            // polygonal appearance, as if by flat-shading around the tube,
            // while still allowing smooth (gouraud) shading along the
            // tube as it bends.
            normal[_i6] = w[_i6] * Math.cos(_k * theta) + nP[_i6] * Math.sin(_k * theta);
            nRight[_i6] = w[_i6] * Math.cos((_k - 0.5) * theta) + nP[_i6] * Math.sin((_k - 0.5) * theta);
            nLeft[_i6] = w[_i6] * Math.cos((_k + 0.5) * theta) + nP[_i6] * Math.sin((_k + 0.5) * theta);
            s[_i6] = p[_i6] + model.radius * sFactor * normal[_i6];
            newPts[3 * ptId + _i6] = s[_i6];
            newNormals[3 * ptId + _i6] = nRight[_i6];
            newPts[3 * (ptId + 1) + _i6] = s[_i6];
            newNormals[3 * (ptId + 1) + _i6] = nLeft[_i6];
          }

          outPD.passData(pd, pts[j], ptId + 1);
          ptId += 2;
        } // for each side

      } // else separate vertices

    } // for all points in the polyline
    // Produce end points for cap. They are placed at tail end of points.


    if (model.capping) {
      var numCapSides = model.numberOfSides;
      var capIncr = 1;

      if (!model.sidesShareVertices) {
        numCapSides = 2 * model.numberOfSides;
        capIncr = 2;
      } // the start cap


      for (var _k2 = 0; _k2 < numCapSides; _k2 += capIncr) {
        s = newPts.slice(3 * (offset + _k2), 3 * (offset + _k2 + 1));

        for (var _i7 = 0; _i7 < 3; ++_i7) {
          newPts[3 * ptId + _i7] = s[_i7];
          newNormals[3 * ptId + _i7] = startCapNorm[_i7];
        }

        outPD.passData(pd, pts[0], ptId);
        ptId++;
      } // the end cap


      var endOffset = offset + (npts - 1) * model.numberOfSides;

      if (!model.sidesShareVertices) {
        endOffset = offset + 2 * (npts - 1) * model.numberOfSides;
      }

      for (var _k3 = 0; _k3 < numCapSides; _k3 += capIncr) {
        s = newPts.slice(3 * (endOffset + _k3), 3 * (endOffset + _k3 + 1));

        for (var _i8 = 0; _i8 < 3; ++_i8) {
          newPts[3 * ptId + _i8] = s[_i8];
          newNormals[3 * ptId + _i8] = endCapNorm[_i8];
        }

        outPD.passData(pd, pts[npts - 1], ptId);
        ptId++;
      }
    } // if capping


    return 1;
  }

  function generateStrips(offset, npts, inCellId, outCellId, inCD, outCD, newStrips) {
    var i1 = 0;
    var i2 = 0;
    var i3 = 0;
    var newOutCellId = outCellId;
    var outCellIdx = 0;
    var newStripsData = newStrips.getData();
    var cellId = 0;

    while (outCellIdx < newStripsData.length) {
      if (cellId === outCellId) {
        break;
      }

      outCellIdx += newStripsData[outCellIdx] + 1;
      cellId++;
    }

    if (model.sidesShareVertices) {
      for (var k = offset; k < model.numberOfSides + offset; k += model.onRatio) {
        i1 = k % model.numberOfSides;
        i2 = (k + 1) % model.numberOfSides;
        newStripsData[outCellIdx++] = npts * 2;

        for (var i = 0; i < npts; ++i) {
          i3 = i * model.numberOfSides;
          newStripsData[outCellIdx++] = offset + i2 + i3;
          newStripsData[outCellIdx++] = offset + i1 + i3;
        }

        outCD.passData(inCD, inCellId, newOutCellId++);
      } // for each side of the tube

    } else {
      for (var _k4 = offset; _k4 < model.numberOfSides + offset; _k4 += model.onRatio) {
        i1 = 2 * (_k4 % model.numberOfSides) + 1;
        i2 = 2 * ((_k4 + 1) % model.numberOfSides); // outCellId = newStrips.getNumberOfCells(true);

        newStripsData[outCellIdx] = npts * 2;
        outCellIdx++;

        for (var _i9 = 0; _i9 < npts; ++_i9) {
          i3 = _i9 * 2 * model.numberOfSides;
          newStripsData[outCellIdx++] = offset + i2 + i3;
          newStripsData[outCellIdx++] = offset + i1 + i3;
        }

        outCD.passData(inCD, inCellId, newOutCellId++);
      } // for each side of the tube

    } // Take care of capping. The caps are n-sided polygons that can be easily
    // triangle stripped.


    if (model.capping) {
      var startIdx = offset + npts * model.numberOfSides;
      var idx = 0;

      if (!model.sidesShareVertices) {
        startIdx = offset + 2 * npts * model.numberOfSides;
      } // The start cap


      newStripsData[outCellIdx++] = model.numberOfSides;
      newStripsData[outCellIdx++] = startIdx;
      newStripsData[outCellIdx++] = startIdx + 1;
      var _k5 = 0;

      for (i1 = model.numberOfSides - 1, i2 = 2, _k5 = 0; _k5 < model.numberOfSides - 2; ++_k5) {
        if (_k5 % 2) {
          idx = startIdx + i2;
          newStripsData[outCellIdx++] = idx;
          i2++;
        } else {
          idx = startIdx + i1;
          newStripsData[outCellIdx++] = idx;
          i1--;
        }
      }

      outCD.passData(inCD, inCellId, newOutCellId++); // The end cap - reversed order to be consistent with normal

      startIdx += model.numberOfSides;
      newStripsData[outCellIdx++] = model.numberOfSides;
      newStripsData[outCellIdx++] = startIdx;
      newStripsData[outCellIdx++] = startIdx + model.numberOfSides - 1;

      for (i1 = model.numberOfSides - 2, i2 = 1, _k5 = 0; _k5 < model.numberOfSides - 2; ++_k5) {
        if (_k5 % 2) {
          idx = startIdx + i1;
          newStripsData[outCellIdx++] = idx;
          i1--;
        } else {
          idx = startIdx + i2;
          newStripsData[outCellIdx++] = idx;
          i2++;
        }
      }

      outCD.passData(inCD, inCellId, newOutCellId++);
    }

    return newOutCellId;
  }

  function generateTCoords(offset, npts, pts, inPts, inScalars, newTCoords) {
    var numSides = model.numberOfSides;

    if (!model.sidesShareVertices) {
      numSides = 2 * model.numberOfSides;
    }

    var tc = 0.0;
    var s0 = 0.0;
    var s = 0.0;
    var inScalarsData = inScalars.getData();

    if (model.generateTCoords === GenerateTCoords.TCOORDS_FROM_SCALARS) {
      s0 = inScalarsData[pts[0]];

      for (var i = 0; i < npts; ++i) {
        s = inScalarsData[pts[i]];
        tc = (s - s0) / model.textureLength;

        for (var k = 0; k < numSides; ++k) {
          var tcy = k / (numSides - 1);
          var tcId = 2 * (offset + i * numSides + k);
          newTCoords[tcId] = tc;
          newTCoords[tcId + 1] = tcy;
        }
      }
    } else if (model.generateTCoords === GenerateTCoords.TCOORDS_FROM_LENGTH) {
      var len = 0.0;
      var xPrev = inPts.slice(3 * pts[0], 3 * (pts[0] + 1));

      for (var _i10 = 0; _i10 < npts; ++_i10) {
        var x = inPts.slice(3 * pts[_i10], 3 * (pts[_i10] + 1));
        len += Math.sqrt(distance2BetweenPoints(x, xPrev));
        tc = len / model.textureLength;

        for (var _k6 = 0; _k6 < numSides; ++_k6) {
          var _tcy = _k6 / (numSides - 1);

          var _tcId = 2 * (offset + _i10 * numSides + _k6);

          newTCoords[_tcId] = tc;
          newTCoords[_tcId + 1] = _tcy;
        }

        for (var _k7 = 0; _k7 < 3; ++_k7) {
          xPrev[_k7] = x[_k7];
        }
      }
    } else if (model.generateTCoords === GenerateTCoords.TCOORDS_FROM_NORMALIZED_LENGTH) {
      var _len = 0.0;
      var len1 = 0.0;

      var _xPrev = inPts.slice(3 * pts[0], 3 * (pts[0] + 1));

      for (var _i11 = 0; _i11 < npts; ++_i11) {
        var _x = inPts.slice(3 * pts[_i11], 3 * (pts[_i11] + 1));

        len1 += Math.sqrt(distance2BetweenPoints(_x, _xPrev));

        for (var _k8 = 0; _k8 < 3; ++_k8) {
          _xPrev[_k8] = _x[_k8];
        }
      }

      _xPrev = inPts.slice(3 * pts[0], 3 * (pts[0] + 1));

      for (var _i12 = 0; _i12 < npts; ++_i12) {
        var _x2 = inPts.slice(3 * pts[_i12], 3 * (pts[_i12] + 1));

        _len += Math.sqrt(distance2BetweenPoints(_x2, _xPrev));
        tc = _len / len1;

        for (var _k9 = 0; _k9 < numSides; ++_k9) {
          var _tcy2 = _k9 / (numSides - 1);

          var _tcId2 = 2 * (offset + _i12 * numSides + _k9);

          newTCoords[_tcId2] = tc;
          newTCoords[_tcId2 + 1] = _tcy2;
        }

        for (var _k10 = 0; _k10 < 3; ++_k10) {
          _xPrev[_k10] = _x2[_k10];
        }
      }
    } // Capping, set the endpoints as appropriate


    if (model.capping) {
      var startIdx = offset + npts * numSides; // start cap

      for (var ik = 0; ik < model.numberOfSides; ++ik) {
        var _tcId3 = 2 * (startIdx + ik);

        newTCoords[_tcId3] = 0.0;
        newTCoords[_tcId3 + 1] = 0.0;
      } // end cap


      for (var _ik = 0; _ik < model.numberOfSides; ++_ik) {
        var _tcId4 = 2 * (startIdx + model.numberOfSides + _ik);

        newTCoords[_tcId4] = 0.0;
        newTCoords[_tcId4 + 1] = 0.0;
      }
    }
  }

  publicAPI.requestData = function (inData, outData) {
    // implement requestData
    // pass through for now
    var output = vtkPolyData.newInstance();
    outData[0] = output;
    var input = inData[0];

    if (!input) {
      vtkErrorMacro('Invalid or missing input');
      return;
    } // Allocate output


    var inPts = input.getPoints();

    if (!inPts) {
      return;
    }

    var numPts = inPts.getNumberOfPoints();

    if (numPts < 1) {
      return;
    }

    var inLines = input.getLines();

    if (!inLines) {
      return;
    }

    var numLines = inLines.getNumberOfCells();

    if (numLines < 1) {
      return;
    }

    var numNewPts = 0;
    var numStrips = 0;
    var inLinesData = inLines.getData();
    var npts = inLinesData[0];
    var sidesShareVerticesMultiplier = model.sidesShareVertices ? 1 : 2;

    for (var i = 0; i < inLinesData.length; i += npts + 1) {
      numNewPts += sidesShareVerticesMultiplier * npts * model.numberOfSides;

      if (model.capping) {
        numNewPts += 2 * model.numberOfSides;
      }

      npts = inLinesData[i];
      numStrips += (2 * npts + 1) * Math.ceil(model.numberOfSides / model.onRatio);

      if (model.capping) {
        numStrips += 2 * (model.numberOfSides + 1);
      }
    }

    var pointType = inPts.getDataType();

    if (model.outputPointsPrecision === DesiredOutputPrecision.SINGLE) {
      pointType = VtkDataTypes.FLOAT;
    } else if (model.outputPointsPrecision === DesiredOutputPrecision.DOUBLE) {
      pointType = VtkDataTypes.DOUBLE;
    }

    var newPts = vtkPoints.newInstance({
      dataType: pointType,
      size: numNewPts * 3,
      numberOfComponents: 3
    });
    var numNormals = 3 * numNewPts;
    var newNormalsData = new Float32Array(numNormals);
    var newNormals = vtkDataArray.newInstance({
      numberOfComponents: 3,
      values: newNormalsData,
      name: 'TubeNormals'
    });
    var newStripsData = new Uint32Array(numStrips);
    var newStrips = vtkCellArray.newInstance({
      values: newStripsData
    });
    var newStripId = 0;
    var inNormals = input.getPointData().getNormals();
    var inNormalsData = null;
    var generateNormals = false;

    if (!inNormals || model.useDefaultNormal) {
      inNormalsData = new Float32Array(3 * numPts);
      inNormals = vtkDataArray.newInstance({
        numberOfComponents: 3,
        values: inNormalsData,
        name: 'Normals'
      });

      if (model.useDefaultNormal) {
        inNormalsData = inNormalsData.map(function (elem, index) {
          var i = index % 3;
          return model.defaultNormal[i];
        });
      } else {
        generateNormals = true;
      }
    } // loop over pointData arrays and resize based on numNewPts


    var numArrays = input.getPointData().getNumberOfArrays();
    var oldArray = null;
    var newArray = null;

    for (var _i13 = 0; _i13 < numArrays; _i13++) {
      oldArray = input.getPointData().getArrayByIndex(_i13);
      newArray = vtkDataArray.newInstance({
        name: oldArray.getName(),
        dataType: oldArray.getDataType(),
        numberOfComponents: oldArray.getNumberOfComponents(),
        size: numNewPts * oldArray.getNumberOfComponents()
      });
      output.getPointData().removeArrayByIndex(0); // remove oldArray from beginning

      output.getPointData().addArray(newArray); // concat newArray to end
    } // loop over cellData arrays and resize based on numNewCells


    var numNewCells = inLines.getNumberOfCells() * model.numberOfSides;

    if (model.capping) {
      numNewCells += 2;
    }

    var numCellArrays = input.getCellData().getNumberOfArrays();

    for (var _i14 = 0; _i14 < numCellArrays; _i14++) {
      oldArray = input.getCellData().getArrayByIndex(_i14);
      newArray = vtkDataArray.newInstance({
        name: oldArray.getName(),
        dataType: oldArray.getDataType(),
        numberOfComponents: oldArray.getNumberOfComponents(),
        size: numNewCells * oldArray.getNumberOfComponents()
      });
      output.getCellData().removeArrayByIndex(0); // remove oldArray from beginning

      output.getCellData().addArray(newArray); // concat newArray to end
    }

    var inScalars = publicAPI.getInputArrayToProcess(0);
    var outScalars = null;
    var range = [];

    if (inScalars) {
      // allocate output scalar array
      // assuming point scalars for now
      outScalars = vtkDataArray.newInstance({
        name: inScalars.getName(),
        dataType: inScalars.getDataType(),
        numberOfComponents: inScalars.getNumberOfComponents(),
        size: numNewPts * inScalars.getNumberOfComponents()
      });
      range = inScalars.getRange();

      if (range[1] - range[0] === 0.0) {
        if (model.varyRadius === VaryRadius.VARY_RADIUS_BY_SCALAR) {
          vtkWarningMacro('Scalar range is zero!');
        }

        range[1] = range[0] + 1.0;
      }
    }

    var inVectors = publicAPI.getInputArrayToProcess(1);
    var maxSpeed = 0;

    if (inVectors) {
      maxSpeed = inVectors.getMaxNorm();
    }

    var outCD = output.getCellData();
    outCD.copyNormalsOff();
    outCD.passData(input.getCellData());
    var outPD = output.getPointData();

    if (outPD.getNormals() !== null) {
      outPD.copyNormalsOff();
    }

    if (inScalars && outScalars) {
      outPD.setScalars(outScalars);
    } // TCoords


    var newTCoords = null;

    if (model.generateTCoords === GenerateTCoords.TCOORDS_FROM_SCALARS && inScalars || model.generateTCoords === GenerateTCoords.TCOORDS_FROM_LENGTH || model.generateTCoords === GenerateTCoords.TCOORDS_FROM_NORMALIZED_LENGTH) {
      var newTCoordsData = new Float32Array(2 * numNewPts);
      newTCoords = vtkDataArray.newInstance({
        numberOfComponents: 2,
        values: newTCoordsData,
        name: 'TCoords'
      });
      outPD.copyTCoordsOff();
    }

    outPD.passData(input.getPointData()); // Create points along each polyline that are connected into numberOfSides
    // triangle strips.

    var theta = 2.0 * Math.PI / model.numberOfSides;
    npts = inLinesData[0];
    var offset = 0;
    var inCellId = input.getVerts().getNumberOfCells();

    for (var _i15 = 0; _i15 < inLinesData.length; _i15 += npts + 1) {
      npts = inLinesData[_i15];
      var pts = inLinesData.slice(_i15 + 1, _i15 + 1 + npts);

      if (npts > 1) {
        // if not, skip tubing this line
        if (generateNormals) {
          var polyLine = inLinesData.slice(_i15, _i15 + npts + 1);
          generateSlidingNormals(inPts.getData(), polyLine, inNormals);
        }
      } // generate points


      if (generatePoints(offset, npts, pts, inPts.getData(), newPts.getData(), input.getPointData(), outPD, newNormalsData, inScalars, range, inVectors, maxSpeed, inNormalsData, theta)) {
        // generate strips for the polyline
        newStripId = generateStrips(offset, npts, inCellId, newStripId, input.getCellData(), outCD, newStrips); // generate texture coordinates for the polyline

        if (newTCoords) {
          generateTCoords(offset, npts, pts, inPts.getData(), inScalars, newTCoords.getData());
        }
      } else {
        // skip tubing this line
        vtkWarningMacro('Could not generate points');
      } // lineIdx += npts;
      // Compute the new offset for the next polyline


      offset = computeOffset(offset, npts);
      inCellId++;
    }

    output.setPoints(newPts);
    output.setStrips(newStrips);
    output.setPointData(outPD);
    outPD.setNormals(newNormals);
    outData[0] = output;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  outputPointsPrecision: DesiredOutputPrecision.DEFAULT,
  radius: 0.5,
  varyRadius: VaryRadius.VARY_RADIUS_OFF,
  numberOfSides: 3,
  radiusFactor: 10,
  defaultNormal: [0, 0, 1],
  useDefaultNormal: false,
  sidesShareVertices: true,
  capping: false,
  onRatio: 1,
  offset: 0,
  generateTCoords: GenerateTCoords.TCOORDS_OFF,
  textureLength: 1.0
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Build VTK API

  macro.setGet(publicAPI, model, ['outputPointsPrecision', 'radius', 'varyRadius', 'numberOfSides', 'radiusFactor', 'defaultNormal', 'useDefaultNormal', 'sidesShareVertices', 'capping', 'onRatio', 'offset', 'generateTCoords', 'textureLength']); // Make this a VTK object

  macro.obj(publicAPI, model); // Also make it an algorithm with one input and one output

  macro.algo(publicAPI, model, 1, 1); // Object specific methods

  vtkTubeFilter(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkTubeFilter'); // ----------------------------------------------------------------------------

var vtkTubeFilter$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkTubeFilter$1 as default, extend, newInstance };
