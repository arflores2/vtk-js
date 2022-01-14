import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { mat4, vec3 } from 'gl-matrix';
import * as d3 from 'd3-scale';
import { J as nearestPowerOfTwo, K as normalize2D } from '../../Common/Core/Math/index.js';
import macro from '../../macros.js';
import vtkActor from './Actor.js';
import vtkBoundingBox from '../../Common/DataModel/BoundingBox.js';
import vtkDataArray from '../../Common/Core/DataArray.js';
import vtkMapper from './Mapper.js';
import vtkPixelSpaceCallbackMapper from './PixelSpaceCallbackMapper.js';
import vtkPolyData from '../../Common/DataModel/PolyData.js';
import vtkTexture from './Texture.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
// vtkCubeAxesActor
// ----------------------------------------------------------------------------
// faces are -x x -y y -z z
// point 0 is 0,0,0 and then +x fastest changing, +y then +z

var faceNormals = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
var faceEdges = [[8, 7, 11, 3], [9, 1, 10, 5], [4, 9, 0, 8], [2, 11, 6, 10], [0, 3, 2, 1], [4, 5, 6, 7]];
var edgePoints = [[0, 1], [1, 3], [2, 3], [0, 2], [4, 5], [5, 7], [6, 7], [4, 6], [0, 4], [1, 5], [3, 7], [2, 6]];
var edgeAxes = [0, 1, 0, 1, 0, 1, 0, 1, 2, 2, 2, 2];
var faceAxes = [[1, 2], [1, 2], [0, 2], [0, 2], [0, 1], [0, 1]]; // some shared temp variables to reduce heap allocs

var ptv3 = new Float64Array(3);
var pt2v3 = new Float64Array(3);
var tmpv3 = new Float64Array(3);
var tmp2v3 = new Float64Array(3);
var xDir = new Float64Array(3);
var yDir = new Float64Array(3);
var invmat = new Float64Array(16);

function applyTextStyle(ctx, style) {
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.strokeSize;
  ctx.fillStyle = style.fontColor;
  ctx.font = "".concat(style.fontStyle, " ").concat(style.fontSize, "px ").concat(style.fontFamily);
}

function vtkCubeAxesActor(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCubeAxesActor');

  publicAPI.setCamera = function (cam) {
    if (model.camera === cam) {
      return;
    }

    if (model.cameraModifiedSub) {
      model.cameraModifiedSub.unsubscribe();
      model.cameraModifiedSub = null;
    }

    model.camera = cam;

    if (cam) {
      model.cameraModifiedSub = cam.onModified(publicAPI.update);
    }

    publicAPI.update();
    publicAPI.modified();
  }; // estimate from a camera model what faces to draw
  // return true if the list of faces to draw has changed


  publicAPI.computeFacesToDraw = function () {
    var cmat = model.camera.getViewMatrix();
    mat4.transpose(cmat, cmat);
    var changed = false;
    var length = vtkBoundingBox.getDiagonalLength(model.dataBounds);
    var faceDot = Math.sin(model.faceVisibilityAngle * Math.PI / 180.0);

    for (var f = 0; f < 6; f++) {
      var drawit = false;
      var faceAxis = Math.floor(f / 2);
      var otherAxis1 = (faceAxis + 1) % 3;
      var otherAxis2 = (faceAxis + 2) % 3; // only for non degenerate axes

      if (model.dataBounds[otherAxis1 * 2] !== model.dataBounds[otherAxis1 * 2 + 1] && model.dataBounds[otherAxis2 * 2] !== model.dataBounds[otherAxis2 * 2 + 1]) {
        // for each face transform the center and off center to get a direction vector
        ptv3[faceAxis] = model.dataBounds[f] - 0.1 * length * faceNormals[f][faceAxis];
        ptv3[otherAxis1] = 0.5 * (model.dataBounds[otherAxis1 * 2] + model.dataBounds[otherAxis1 * 2 + 1]);
        ptv3[otherAxis2] = 0.5 * (model.dataBounds[otherAxis2 * 2] + model.dataBounds[otherAxis2 * 2 + 1]);
        vec3.transformMat4(tmpv3, ptv3, cmat);
        ptv3[faceAxis] = model.dataBounds[f];
        vec3.transformMat4(tmp2v3, ptv3, cmat);
        vec3.subtract(tmpv3, tmp2v3, tmpv3);
        vec3.normalize(tmpv3, tmpv3); // tmpv3 now holds the face normal vector

        drawit = tmpv3[2] > faceDot; // for perspctive we need the view direction to the plane

        if (!model.camera.getParallelProjection()) {
          vec3.normalize(tmp2v3, tmp2v3);
          drawit = vec3.dot(tmp2v3, tmpv3) > faceDot;
        }
      }

      if (drawit !== model.lastFacesToDraw[f]) {
        model.lastFacesToDraw[f] = drawit;
        changed = true;
      }
    }

    return changed;
  }; // update the polydata that represents the boundingd edges and gridlines


  publicAPI.updatePolyData = function (facesToDraw, edgesToDraw, ticks) {
    // compute the number of points and lines required
    var numPts = 0;
    var numLines = 0;
    numPts += 8; // always start with the 8 cube points
    // count edgesToDraw

    var numEdgesToDraw = 0;

    for (var e = 0; e < 12; e++) {
      if (edgesToDraw[e] > 0) {
        numEdgesToDraw++;
      }
    }

    numLines += numEdgesToDraw; // add values for gridlines

    if (model.gridLines) {
      for (var f = 0; f < 6; f++) {
        if (facesToDraw[f]) {
          numPts += ticks[faceAxes[f][0]].length * 2 + ticks[faceAxes[f][1]].length * 2;
          numLines += ticks[faceAxes[f][0]].length + ticks[faceAxes[f][1]].length;
        }
      }
    } // now allocate the memory


    var points = new Float64Array(numPts * 3);
    var lines = new Uint32Array(numLines * 3);
    var ptIdx = 0;
    var lineIdx = 0; // add the 8 corner points

    for (var z = 0; z < 2; z++) {
      for (var y = 0; y < 2; y++) {
        for (var x = 0; x < 2; x++) {
          points[ptIdx * 3] = model.dataBounds[x];
          points[ptIdx * 3 + 1] = model.dataBounds[2 + y];
          points[ptIdx * 3 + 2] = model.dataBounds[4 + z];
          ptIdx++;
        }
      }
    } // draw the edges


    for (var _e = 0; _e < 12; _e++) {
      if (edgesToDraw[_e] > 0) {
        lines[lineIdx * 3] = 2;
        lines[lineIdx * 3 + 1] = edgePoints[_e][0];
        lines[lineIdx * 3 + 2] = edgePoints[_e][1];
        lineIdx++;
      }
    } // now handle gridlines
    // grid lines are tick[axis1] + ticks[axes2] lines each having two points
    // for simplicity we don;t worry about duplicating points, this is tiny


    if (model.gridLines) {
      // for each visible face
      // add the points
      for (var _f = 0; _f < 6; _f++) {
        if (facesToDraw[_f]) {
          var faceIdx = Math.floor(_f / 2);
          var aticks = ticks[faceAxes[_f][0]];

          for (var t = 0; t < aticks.length; t++) {
            points[ptIdx * 3 + faceIdx] = model.dataBounds[_f];
            points[ptIdx * 3 + faceAxes[_f][0]] = aticks[t];
            points[ptIdx * 3 + faceAxes[_f][1]] = model.dataBounds[faceAxes[_f][1] * 2];
            ptIdx++;
            points[ptIdx * 3 + faceIdx] = model.dataBounds[_f];
            points[ptIdx * 3 + faceAxes[_f][0]] = aticks[t];
            points[ptIdx * 3 + faceAxes[_f][1]] = model.dataBounds[faceAxes[_f][1] * 2 + 1];
            ptIdx++;
            lines[lineIdx * 3] = 2;
            lines[lineIdx * 3 + 1] = ptIdx - 2;
            lines[lineIdx * 3 + 2] = ptIdx - 1;
            lineIdx++;
          }

          aticks = ticks[faceAxes[_f][1]];

          for (var _t = 0; _t < aticks.length; _t++) {
            points[ptIdx * 3 + faceIdx] = model.dataBounds[_f];
            points[ptIdx * 3 + faceAxes[_f][1]] = aticks[_t];
            points[ptIdx * 3 + faceAxes[_f][0]] = model.dataBounds[faceAxes[_f][0] * 2];
            ptIdx++;
            points[ptIdx * 3 + faceIdx] = model.dataBounds[_f];
            points[ptIdx * 3 + faceAxes[_f][1]] = aticks[_t];
            points[ptIdx * 3 + faceAxes[_f][0]] = model.dataBounds[faceAxes[_f][0] * 2 + 1];
            ptIdx++;
            lines[lineIdx * 3] = 2;
            lines[lineIdx * 3 + 1] = ptIdx - 2;
            lines[lineIdx * 3 + 2] = ptIdx - 1;
            lineIdx++;
          }
        }
      }
    }

    model.polyData.getPoints().setData(points, 3);
    model.polyData.getPoints().modified();
    model.polyData.getLines().setData(lines, 1);
    model.polyData.getLines().modified();
    model.polyData.modified();
  }; // update the data that represents where to put the labels
  // in world coordinates. This only changes when faces to draw changes
  // of dataBounds changes


  publicAPI.updateTextData = function (facesToDraw, edgesToDraw, ticks, tickStrings) {
    // count outside edgesToDraw
    var textPointCount = 0;

    for (var e = 0; e < 12; e++) {
      if (edgesToDraw[e] === 1) {
        textPointCount += 2;
        textPointCount += ticks[edgeAxes[e]].length;
      }
    }

    var points = model.polyData.getPoints().getData();
    var textPoints = new Float64Array(textPointCount * 3);
    var ptIdx = 0;
    var textIdx = 0;
    var axisCount = 0;

    for (var f = 0; f < 6; f++) {
      if (facesToDraw[f]) {
        for (var _e2 = 0; _e2 < 4; _e2++) {
          var edgeIdx = faceEdges[f][_e2];

          if (edgesToDraw[edgeIdx] === 1) {
            var edgeAxis = edgeAxes[edgeIdx]; // add a middle point on the edge

            var ptIdx1 = edgePoints[edgeIdx][0] * 3;
            var ptIdx2 = edgePoints[edgeIdx][1] * 3;
            textPoints[ptIdx * 3] = 0.5 * (points[ptIdx1] + points[ptIdx2]);
            textPoints[ptIdx * 3 + 1] = 0.5 * (points[ptIdx1 + 1] + points[ptIdx2 + 1]);
            textPoints[ptIdx * 3 + 2] = 0.5 * (points[ptIdx1 + 2] + points[ptIdx2 + 2]);
            ptIdx++; // add a middle face point, we use this to
            // move the labels away from the edge in the right direction

            var faceIdx = Math.floor(f / 2);
            textPoints[ptIdx * 3 + faceIdx] = model.dataBounds[f];
            textPoints[ptIdx * 3 + faceAxes[f][0]] = 0.5 * (model.dataBounds[faceAxes[f][0] * 2] + model.dataBounds[faceAxes[f][0] * 2 + 1]);
            textPoints[ptIdx * 3 + faceAxes[f][1]] = 0.5 * (model.dataBounds[faceAxes[f][1] * 2] + model.dataBounds[faceAxes[f][1] * 2 + 1]);
            ptIdx++; // set the text

            model.textValues[textIdx] = model.axisLabels[edgeAxis];
            textIdx++; // now add the tick marks along the edgeAxis

            var otherAxis1 = (edgeAxis + 1) % 3;
            var otherAxis2 = (edgeAxis + 2) % 3;
            var aticks = ticks[edgeAxis];
            var atickStrings = tickStrings[edgeAxis];
            model.tickCounts[axisCount] = aticks.length;

            for (var t = 0; t < aticks.length; t++) {
              textPoints[ptIdx * 3 + edgeAxis] = aticks[t];
              textPoints[ptIdx * 3 + otherAxis1] = points[ptIdx1 + otherAxis1];
              textPoints[ptIdx * 3 + otherAxis2] = points[ptIdx1 + otherAxis2];
              ptIdx++; // set the text

              model.textValues[textIdx] = atickStrings[t];
              textIdx++;
            }

            axisCount++;
          }
        }
      }
    }

    model.textPolyData.getPoints().setData(textPoints, 3);
    model.textPolyData.modified();
  }; // main method to rebuild the cube axes, gets called on camera modify
  // and changes to key members


  publicAPI.update = function () {
    // Can't do anything if we don't have a camera...
    if (!model.camera) {
      return;
    } // compute what faces to draw


    var facesChanged = publicAPI.computeFacesToDraw();
    var facesToDraw = model.lastFacesToDraw; // have the bounds changed?

    var boundsChanged = false;

    for (var i = 0; i < 6; i++) {
      if (model.dataBounds[i] !== model.lastTickBounds[i]) {
        boundsChanged = true;
        model.lastTickBounds[i] = model.dataBounds[i];
      }
    } // did something significant change? If so rebuild a lot of things


    if (facesChanged || boundsChanged || model.forceUpdate) {
      // compute the edges to draw
      // for each drawn face, mark edges, all single mark edges we draw
      var edgesToDraw = new Array(12).fill(0);

      for (var f = 0; f < 6; f++) {
        if (facesToDraw[f]) {
          for (var e = 0; e < 4; e++) {
            edgesToDraw[faceEdges[f][e]]++;
          }
        }
      } // compute tick marks for axes


      var ticks = [];
      var tickStrings = [];

      for (var _i = 0; _i < 3; _i++) {
        var scale = d3.scaleLinear().domain([model.dataBounds[_i * 2], model.dataBounds[_i * 2 + 1]]);
        ticks[_i] = scale.ticks(5);
        var format = scale.tickFormat(5);
        tickStrings[_i] = ticks[_i].map(format);
      } // update gridlines / edge lines


      publicAPI.updatePolyData(facesToDraw, edgesToDraw, ticks); // compute label world coords and text

      publicAPI.updateTextData(facesToDraw, edgesToDraw, ticks, tickStrings); // rebuild the texture only when force or changed bounds, face
      // visibility changes do to change the atlas

      if (boundsChanged || model.forceUpdate) {
        publicAPI.updateTextureAtlas(tickStrings);
      }
    } // compute bounds for label quads whenever the camera changes


    publicAPI.updateTexturePolyData();
    model.forceUpdate = false;
  }; // create the texture map atlas that contains the rendering of
  // all the text strings. Only needs to be called when the text strings
  // have changed (labels and ticks)


  publicAPI.updateTextureAtlas = function (tickStrings) {
    // compute the width and height we need
    // set the text properties
    model.tmContext.textBaseline = 'bottom';
    model.tmContext.textAlign = 'left'; // first the three labels

    model._tmAtlas.clear();

    var maxWidth = 0;
    var totalHeight = 1; // start one pixel in so we have a border

    for (var i = 0; i < 3; i++) {
      if (!model._tmAtlas.has(model.axisLabels[i])) {
        applyTextStyle(model.tmContext, model.axisTextStyle);
        var metrics = model.tmContext.measureText(model.axisLabels[i]);
        var entry = {
          height: metrics.actualBoundingBoxAscent + 2,
          startingHeight: totalHeight,
          width: metrics.width + 2,
          textStyle: model.axisTextStyle
        };

        model._tmAtlas.set(model.axisLabels[i], entry);

        totalHeight += entry.height;

        if (maxWidth < entry.width) {
          maxWidth = entry.width;
        }
      } // and the ticks


      applyTextStyle(model.tmContext, model.tickTextStyle);

      for (var t = 0; t < tickStrings[i].length; t++) {
        if (!model._tmAtlas.has(tickStrings[i][t])) {
          var _metrics = model.tmContext.measureText(tickStrings[i][t]);

          var _entry = {
            height: _metrics.actualBoundingBoxAscent + 2,
            startingHeight: totalHeight,
            width: _metrics.width + 2,
            textStyle: model.tickTextStyle
          };

          model._tmAtlas.set(tickStrings[i][t], _entry);

          totalHeight += _entry.height;

          if (maxWidth < _entry.width) {
            maxWidth = _entry.width;
          }
        }
      }
    } // always use power of two to avoid interpolation
    // in cases where PO2 is required


    maxWidth = nearestPowerOfTwo(maxWidth);
    totalHeight = nearestPowerOfTwo(totalHeight); // set the tcoord values

    model._tmAtlas.forEach(function (value) {
      value.tcoords = [0.0, (totalHeight - value.startingHeight - value.height) / totalHeight, value.width / maxWidth, (totalHeight - value.startingHeight - value.height) / totalHeight, value.width / maxWidth, (totalHeight - value.startingHeight) / totalHeight, 0.0, (totalHeight - value.startingHeight) / totalHeight];
    }); // make sure we have power of two dimensions


    model.tmCanvas.width = maxWidth;
    model.tmCanvas.height = totalHeight;
    model.tmContext.textBaseline = 'bottom';
    model.tmContext.textAlign = 'left';
    model.tmContext.clearRect(0, 0, maxWidth, totalHeight); // draw the text onto the texture

    model._tmAtlas.forEach(function (value, key) {
      applyTextStyle(model.tmContext, value.textStyle);
      model.tmContext.fillText(key, 1, value.startingHeight + value.height - 1);
    });

    var image = new Image();
    image.src = model.tmCanvas.toDataURL('image/png');
    model.tmTexture.setImage(image);
    model.tmTexture.modified();
  }; // called by updateTexturePolyData


  publicAPI.createPolyDataForOneLabel = function (text, pos, cmat, imat, dir, offset, results) {
    var value = model._tmAtlas.get(text);

    if (!value) {
      return;
    }

    var coords = model.textPolyData.getPoints().getData(); // compute pixel to distance factors

    var size = model.lastSize;
    ptv3[0] = coords[pos * 3];
    ptv3[1] = coords[pos * 3 + 1];
    ptv3[2] = coords[pos * 3 + 2];
    vec3.transformMat4(tmpv3, ptv3, cmat); // moving 0.1 in NDC

    tmpv3[0] += 0.1;
    vec3.transformMat4(pt2v3, tmpv3, imat); // results in WC move of

    vec3.subtract(xDir, pt2v3, ptv3);
    tmpv3[0] -= 0.1;
    tmpv3[1] += 0.1;
    vec3.transformMat4(pt2v3, tmpv3, imat); // results in WC move of

    vec3.subtract(yDir, pt2v3, ptv3);

    for (var i = 0; i < 3; i++) {
      xDir[i] /= 0.5 * 0.1 * size[0];
      yDir[i] /= 0.5 * 0.1 * size[1];
    } // have to find the four corners of the texture polygon for this label
    // convert anchor point to View Coords


    var ptIdx = results.ptIdx;
    var cellIdx = results.cellIdx;
    ptv3[0] = coords[pos * 3];
    ptv3[1] = coords[pos * 3 + 1];
    ptv3[2] = coords[pos * 3 + 2]; // horizontal left, right, or middle alignment based on dir[0]

    if (dir[0] < -0.5) {
      vec3.scale(tmpv3, xDir, dir[0] * offset - value.width);
    } else if (dir[0] > 0.5) {
      vec3.scale(tmpv3, xDir, dir[0] * offset);
    } else {
      vec3.scale(tmpv3, xDir, dir[0] * offset - value.width / 2.0);
    }

    vec3.add(ptv3, ptv3, tmpv3);
    vec3.scale(tmpv3, yDir, dir[1] * offset - value.height / 2.0);
    vec3.add(ptv3, ptv3, tmpv3);
    results.points[ptIdx * 3] = ptv3[0];
    results.points[ptIdx * 3 + 1] = ptv3[1];
    results.points[ptIdx * 3 + 2] = ptv3[2];
    results.tcoords[ptIdx * 2] = value.tcoords[0];
    results.tcoords[ptIdx * 2 + 1] = value.tcoords[1];
    ptIdx++;
    vec3.scale(tmpv3, xDir, value.width);
    vec3.add(ptv3, ptv3, tmpv3);
    results.points[ptIdx * 3] = ptv3[0];
    results.points[ptIdx * 3 + 1] = ptv3[1];
    results.points[ptIdx * 3 + 2] = ptv3[2];
    results.tcoords[ptIdx * 2] = value.tcoords[2];
    results.tcoords[ptIdx * 2 + 1] = value.tcoords[3];
    ptIdx++;
    vec3.scale(tmpv3, yDir, value.height);
    vec3.add(ptv3, ptv3, tmpv3);
    results.points[ptIdx * 3] = ptv3[0];
    results.points[ptIdx * 3 + 1] = ptv3[1];
    results.points[ptIdx * 3 + 2] = ptv3[2];
    results.tcoords[ptIdx * 2] = value.tcoords[4];
    results.tcoords[ptIdx * 2 + 1] = value.tcoords[5];
    ptIdx++;
    vec3.scale(tmpv3, xDir, value.width);
    vec3.subtract(ptv3, ptv3, tmpv3);
    results.points[ptIdx * 3] = ptv3[0];
    results.points[ptIdx * 3 + 1] = ptv3[1];
    results.points[ptIdx * 3 + 2] = ptv3[2];
    results.tcoords[ptIdx * 2] = value.tcoords[6];
    results.tcoords[ptIdx * 2 + 1] = value.tcoords[7];
    ptIdx++; // add the two triangles to represent the quad

    results.polys[cellIdx * 4] = 3;
    results.polys[cellIdx * 4 + 1] = ptIdx - 4;
    results.polys[cellIdx * 4 + 2] = ptIdx - 3;
    results.polys[cellIdx * 4 + 3] = ptIdx - 2;
    cellIdx++;
    results.polys[cellIdx * 4] = 3;
    results.polys[cellIdx * 4 + 1] = ptIdx - 4;
    results.polys[cellIdx * 4 + 2] = ptIdx - 2;
    results.polys[cellIdx * 4 + 3] = ptIdx - 1;
    results.ptIdx += 4;
    results.cellIdx += 2;
  }; // update the polydata associated with drawing the text labels
  // specifically the quads used for each label and their associated tcoords
  // etc. This changes every time the camera viewpoint changes


  publicAPI.updateTexturePolyData = function () {
    var cmat = model.camera.getCompositeProjectionMatrix(model.lastAspectRatio, -1, 1);
    mat4.transpose(cmat, cmat); // update the polydata

    var numLabels = model.textValues.length;
    var numPts = numLabels * 4;
    var numTris = numLabels * 2;
    var points = new Float64Array(numPts * 3);
    var polys = new Uint16Array(numTris * 4);
    var tcoords = new Float32Array(numPts * 2);
    mat4.invert(invmat, cmat);
    var results = {
      ptIdx: 0,
      cellIdx: 0,
      polys: polys,
      points: points,
      tcoords: tcoords
    };
    var ptIdx = 0;
    var textIdx = 0;
    var axisIdx = 0;
    var coords = model.textPolyData.getPoints().getData();

    while (ptIdx < coords.length / 3) {
      // compute the direction to move out
      ptv3[0] = coords[ptIdx * 3];
      ptv3[1] = coords[ptIdx * 3 + 1];
      ptv3[2] = coords[ptIdx * 3 + 2];
      vec3.transformMat4(tmpv3, ptv3, cmat);
      ptv3[0] = coords[ptIdx * 3 + 3];
      ptv3[1] = coords[ptIdx * 3 + 4];
      ptv3[2] = coords[ptIdx * 3 + 5];
      vec3.transformMat4(tmp2v3, ptv3, cmat);
      vec3.subtract(tmpv3, tmpv3, tmp2v3);
      var dir = [tmpv3[0], tmpv3[1]];
      normalize2D(dir); // write the axis label

      publicAPI.createPolyDataForOneLabel(model.textValues[textIdx], ptIdx, cmat, invmat, dir, model.axisTitlePixelOffset, results);
      ptIdx += 2;
      textIdx++; // write the tick labels

      for (var t = 0; t < model.tickCounts[axisIdx]; t++) {
        publicAPI.createPolyDataForOneLabel(model.textValues[textIdx], ptIdx, cmat, invmat, dir, model.tickLabelPixelOffset, results);
        ptIdx++;
        textIdx++;
      }

      axisIdx++;
    }

    var tcoordDA = vtkDataArray.newInstance({
      numberOfComponents: 2,
      values: tcoords,
      name: 'TextureCoordinates'
    });
    model.tmPolyData.getPointData().setTCoords(tcoordDA);
    model.tmPolyData.getPoints().setData(points, 3);
    model.tmPolyData.getPoints().modified();
    model.tmPolyData.getPolys().setData(polys, 1);
    model.tmPolyData.getPolys().modified();
    model.tmPolyData.modified();
  };

  publicAPI.getActors = function () {
    return [model.pixelActor, model.tmActor];
  };

  publicAPI.getNestedProps = function () {
    return publicAPI.getActors();
  }; // Make sure the data is correct


  publicAPI.onModified(function () {
    model.forceUpdate = true;
    publicAPI.update();
  });
  var setVisibility = macro.chain(publicAPI.setVisibility, model.pixelActor.setVisibility, model.tmActor.setVisibility);

  publicAPI.setVisibility = function () {
    return setVisibility.apply(void 0, arguments).some(Boolean);
  };

  publicAPI.setTickTextStyle = function (tickStyle) {
    model.tickTextStyle = _objectSpread(_objectSpread({}, model.tickTextStyle), tickStyle);
    publicAPI.modified();
  };

  publicAPI.setAxisTextStyle = function (axisStyle) {
    model.axisTextStyle = _objectSpread(_objectSpread({}, model.axisTextStyle), axisStyle);
    publicAPI.modified();
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


function defaultValues(initialValues) {
  return _objectSpread({
    camera: null,
    dataBounds: _toConsumableArray(vtkBoundingBox.INIT_BOUNDS),
    faceVisibilityAngle: 8,
    gridLines: true,
    axisLabels: null,
    axisTitlePixelOffset: 35.0,
    axisTextStyle: {
      fontColor: 'white',
      fontStyle: 'normal',
      fontSize: 18,
      fontFamily: 'serif'
    },
    tickLabelPixelOffset: 12.0,
    tickTextStyle: {
      fontColor: 'white',
      fontStyle: 'normal',
      fontSize: 14,
      fontFamily: 'serif'
    }
  }, initialValues);
} // ----------------------------------------------------------------------------


function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, defaultValues(initialValues)); // Inheritance

  vtkActor.extend(publicAPI, model, initialValues); // internal variables

  model.lastSize = [800, 800];
  model.lastAspectRatio = 1.0;
  model.lastFacesToDraw = [false, false, false, false, false, false];
  model.axisLabels = ['X-Axis', 'Y-Axis', 'Z-Axis'];
  model.tickCounts = [];
  model.textValues = [];
  model.lastTickBounds = [];
  model._tmAtlas = new Map();
  model.mapper = vtkMapper.newInstance();
  model.polyData = vtkPolyData.newInstance();
  model.mapper.setInputData(model.polyData);
  publicAPI.getProperty().setDiffuse(0.0);
  publicAPI.getProperty().setAmbient(1.0);
  model.textPolyData = vtkPolyData.newInstance(); // for texture atlas

  model.tmPolyData = vtkPolyData.newInstance();
  model.tmMapper = vtkMapper.newInstance();
  model.tmMapper.setInputData(model.tmPolyData);
  model.tmTexture = vtkTexture.newInstance();
  model.tmTexture.setInterpolate(false);
  model.tmActor = vtkActor.newInstance({
    parentProp: publicAPI
  });
  model.tmActor.setMapper(model.tmMapper);
  model.tmActor.addTexture(model.tmTexture);
  model.tmCanvas = document.createElement('canvas');
  model.tmContext = model.tmCanvas.getContext('2d'); // PixelSpaceCallbackMapper - we do need an empty polydata
  // really just used to get the window size which we need to do
  // proper text positioning and scaling.

  model.pixelMapper = vtkPixelSpaceCallbackMapper.newInstance();
  model.pixelMapperPolyData = vtkPolyData.newInstance();
  model.pixelMapper.setInputData(model.pixelMapperPolyData);
  model.pixelMapper.setCallback(function (coords, camera, aspect, depthValues, size) {
    model.lastSize = size;
    model.lastAspectRatio = size[0] / size[1];
  });
  model.pixelActor = vtkActor.newInstance({
    parentProp: publicAPI
  });
  model.pixelActor.setMapper(model.pixelMapper);
  macro.setGet(publicAPI, model, ['axisTitlePixelOffset', 'faceVisibilityAngle', 'gridLines', 'tickLabelPixelOffset']);
  macro.setGetArray(publicAPI, model, ['dataBounds'], 6);
  macro.setGetArray(publicAPI, model, ['axisLabels'], 3);
  macro.get(publicAPI, model, ['axisTextStyle', 'tickTextStyle', 'camera']); // Object methods

  vtkCubeAxesActor(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkCubeAxesActor'); // ----------------------------------------------------------------------------

var vtkCubeAxesActor$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkCubeAxesActor$1 as default, extend, newInstance };
