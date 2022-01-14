import { mat4 } from 'gl-matrix';
import { newInstance as newInstance$1, setGet, obj, vtkErrorMacro as vtkErrorMacro$1 } from '../../macros.js';
import vtkHelper from './Helper.js';
import vtkMapper2D from '../Core/Mapper2D.js';
import vtkOpenGLPolyDataMapper from './PolyDataMapper.js';
import vtkPoints from '../../Common/Core/Points.js';
import { v as vtkPolyData2DFS } from './glsl/vtkPolyData2DFS.glsl.js';
import { v as vtkPolyData2DVS } from './glsl/vtkPolyData2DVS.glsl.js';
import vtkReplacementShaderMapper from './ReplacementShaderMapper.js';
import vtkShaderProgram from './ShaderProgram.js';
import vtkViewNode from '../SceneGraph/ViewNode.js';
import { L as round } from '../../Common/Core/Math/index.js';
import { Representation } from '../Core/Property/Constants.js';
import { DisplayLocation } from '../Core/Property2D/Constants.js';
import { registerOverride } from './ViewNodeFactory.js';

// import { mat3, mat4, vec3 } from 'gl-matrix';
var primTypes = vtkOpenGLPolyDataMapper.primTypes;
var ScalarMode = vtkMapper2D.ScalarMode;
var vtkErrorMacro = vtkErrorMacro$1;
var StartEvent = {
  type: 'StartEvent'
};
var EndEvent = {
  type: 'EndEvent'
}; // ----------------------------------------------------------------------------
// vtkOpenGLPolyDataMapper2D methods
// ----------------------------------------------------------------------------

function vtkOpenGLPolyDataMapper2D(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkOpenGLPolyDataMapper2D');

  publicAPI.buildPass = function (prepass) {
    if (prepass) {
      model.openGLActor2D = publicAPI.getFirstAncestorOfType('vtkOpenGLActor2D');
      model.openGLRenderer = model.openGLActor2D.getFirstAncestorOfType('vtkOpenGLRenderer');
      model.openGLRenderWindow = model.openGLRenderer.getParent();
      model.openGLCamera = model.openGLRenderer.getViewNodeFor(model.openGLRenderer.getRenderable().getActiveCamera());
    }
  };

  publicAPI.overlayPass = function (prepass) {
    if (prepass) {
      publicAPI.render();
    }
  };

  publicAPI.getShaderTemplate = function (shaders, ren, actor) {
    var openGLSpecProp = model.renderable.getViewSpecificProperties().OpenGL;
    var vertexShaderCode = vtkPolyData2DVS;

    if (openGLSpecProp) {
      var vertexSpecProp = openGLSpecProp.VertexShaderCode;

      if (vertexSpecProp !== undefined && vertexSpecProp !== '') {
        vertexShaderCode = vertexSpecProp;
      }
    }

    shaders.Vertex = vertexShaderCode;
    var fragmentShaderCode = vtkPolyData2DFS;

    if (openGLSpecProp) {
      var fragmentSpecProp = openGLSpecProp.FragmentShaderCode;

      if (fragmentSpecProp !== undefined && fragmentSpecProp !== '') {
        fragmentShaderCode = fragmentSpecProp;
      }
    }

    shaders.Fragment = fragmentShaderCode;
    var geometryShaderCode = '';

    if (openGLSpecProp) {
      var geometrySpecProp = openGLSpecProp.GeometryShaderCode;

      if (geometrySpecProp !== undefined) {
        geometryShaderCode = geometrySpecProp;
      }
    }

    shaders.Geometry = geometryShaderCode;
  };

  publicAPI.render = function () {
    var ctx = model.openGLRenderWindow.getContext();

    if (model.context !== ctx) {
      model.context = ctx;

      for (var i = primTypes.Start; i < primTypes.End; i++) {
        model.primitives[i].setOpenGLRenderWindow(model.openGLRenderWindow);
      }
    }

    var actor = model.openGLActor2D.getRenderable();
    var ren = model.openGLRenderer.getRenderable();
    publicAPI.renderPiece(ren, actor);
  };

  publicAPI.renderPiece = function (ren, actor) {
    publicAPI.invokeEvent(StartEvent);

    if (!model.renderable.getStatic()) {
      model.renderable.update();
    }

    model.currentInput = model.renderable.getInputData();
    publicAPI.invokeEvent(EndEvent);

    if (!model.currentInput) {
      vtkErrorMacro('No input!');
      return;
    } // if there are no points then we are done


    if (!model.currentInput.getPoints || !model.currentInput.getPoints().getNumberOfValues()) {
      return;
    }

    publicAPI.renderPieceStart(ren, actor);
    publicAPI.renderPieceDraw(ren, actor);
    publicAPI.renderPieceFinish(ren, actor);
  };

  publicAPI.renderPieceStart = function (ren, actor) {
    model.primitiveIDOffset = 0;

    if (model.openGLRenderer.getSelector()) {
      switch (model.openGLRenderer.getSelector().getCurrentPass()) {
        default:
          model.openGLRenderer.getSelector().renderProp(actor);
      }
    } // make sure the BOs are up to date


    publicAPI.updateBufferObjects(ren, actor); // Bind the OpenGL, this is shared between the different primitive/cell types.

    model.lastBoundBO = null;
  };

  publicAPI.getNeedToRebuildShaders = function (cellBO, ren, actor) {
    // has something changed that would require us to recreate the shader?
    // candidates are
    // property modified (representation interpolation and lighting)
    // input modified
    // light complexity changed
    if (cellBO.getProgram() === 0 || cellBO.getShaderSourceTime().getMTime() < publicAPI.getMTime() || cellBO.getShaderSourceTime().getMTime() < actor.getMTime() || cellBO.getShaderSourceTime().getMTime() < model.renderable.getMTime() || cellBO.getShaderSourceTime().getMTime() < model.currentInput.getMTime()) {
      return true;
    }

    return false;
  };

  publicAPI.updateBufferObjects = function (ren, actor) {
    // Rebuild buffers if needed
    if (publicAPI.getNeedToRebuildBufferObjects(ren, actor)) {
      publicAPI.buildBufferObjects(ren, actor);
    }
  };

  publicAPI.getNeedToRebuildBufferObjects = function (ren, actor) {
    // first do a coarse check
    // Note that the actor's mtime includes it's properties mtime
    var vmtime = model.VBOBuildTime.getMTime();

    if (vmtime < publicAPI.getMTime() || vmtime < model.renderable.getMTime() || vmtime < actor.getMTime() || vmtime < model.currentInput.getMTime() || model.renderable.getTransformCoordinate() && vmtime < ren.getMTime()) {
      return true;
    }

    return false;
  };

  publicAPI.getOpenGLMode = function (rep, type) {
    if (rep === Representation.POINTS || type === primTypes.Points) {
      return model.context.POINTS;
    }

    if (rep === Representation.WIREFRAME || type === primTypes.Lines || type === primTypes.TrisEdges || type === primTypes.TriStripsEdges) {
      return model.context.LINES;
    }

    return model.context.TRIANGLES;
  };

  publicAPI.buildBufferObjects = function (ren, actor) {
    var poly = model.currentInput;

    if (poly === null) {
      return;
    }

    model.renderable.mapScalars(poly, actor.getProperty().getOpacity());
    var c = model.renderable.getColorMapColors();
    model.haveCellScalars = false;
    var scalarMode = model.renderable.getScalarMode();

    if (model.renderable.getScalarVisibility()) {
      // We must figure out how the scalars should be mapped to the polydata.
      if ((scalarMode === ScalarMode.USE_CELL_DATA || scalarMode === ScalarMode.USE_CELL_FIELD_DATA || scalarMode === ScalarMode.USE_FIELD_DATA || !poly.getPointData().getScalars()) && scalarMode !== ScalarMode.USE_POINT_FIELD_DATA && c) {
        model.haveCellScalars = true;
      }
    }

    var representation = actor.getProperty().getRepresentation();
    var tcoords = poly.getPointData().getTCoords();

    if (!model.openGLActor2D.getActiveTextures()) {
      tcoords = null;
    }

    var transformCoordinate = model.renderable.getTransformCoordinate();
    var toString = "".concat(poly.getMTime(), "A").concat(representation, "B").concat(poly.getMTime()) + "C".concat(c ? c.getMTime() : 1) + "D".concat(tcoords ? tcoords.getMTime() : 1) + "E".concat(transformCoordinate ? ren.getMTime() : 1);

    if (model.VBOBuildString !== toString) {
      // Build the VBOs
      var points = poly.getPoints();

      if (transformCoordinate) {
        var p = vtkPoints.newInstance();
        var numPts = points.getNumberOfPoints();
        p.setNumberOfPoints(numPts);

        for (var i = 0; i < numPts; ++i) {
          transformCoordinate.setValue(points.getPoint(i));
          var v = transformCoordinate.getComputedDoubleViewportValue(ren);
          p.setPoint(i, v[0], v[1], 0.0);
        }

        points = p;
      }

      var options = {
        points: points,
        tcoords: tcoords,
        colors: c,
        cellOffset: 0,
        haveCellScalars: model.haveCellSCalars,
        customAttributes: model.renderable.getCustomShaderAttributes().map(function (arrayName) {
          return poly.getPointData().getArrayByName(arrayName);
        })
      };
      options.cellOffset += model.primitives[primTypes.Points].getCABO().createVBO(poly.getVerts(), 'verts', representation, options);
      options.cellOffset += model.primitives[primTypes.Lines].getCABO().createVBO(poly.getLines(), 'lines', representation, options);
      options.cellOffset += model.primitives[primTypes.Tris].getCABO().createVBO(poly.getPolys(), 'polys', representation, options);
      options.cellOffset += model.primitives[primTypes.TriStrips].getCABO().createVBO(poly.getStrips(), 'strips', representation, options);
      model.VBOBuildTime.modified();
      model.VBOBuildString = toString;
    }
  };

  publicAPI.renderPieceDraw = function (ren, actor) {
    var representation = actor.getProperty().getRepresentation();
    var drawSurfaceWithEdges = false;
    var gl = model.context;
    gl.lineWidth(actor.getProperty().getLineWidth());
    gl.depthMask(true); // for every primitive type

    for (var i = primTypes.Start; i < primTypes.End; i++) {
      // if there are entries
      var cabo = model.primitives[i].getCABO();

      if (cabo.getElementCount()) {
        // are we drawing edges
        model.drawingEdges = drawSurfaceWithEdges ;
        var mode = publicAPI.getOpenGLMode(representation, i);

        if (!model.drawingEdges || !model.renderDepth) {
          publicAPI.updateShaders(model.primitives[i], ren, actor);
          gl.drawArrays(mode, 0, cabo.getElementCount());
        }

        var stride = (mode === gl.POINTS ? 1 : 0) || (mode === gl.LINES ? 2 : 3);
        model.primitiveIDOffset += cabo.getElementCount() / stride;
      }
    } // reset the line width


    gl.lineWidth(1);
  };

  publicAPI.renderPieceFinish = function (ren, actor) {
    if (model.LastBoundBO) {
      model.LastBoundBO.getVAO().release();
    }
  };

  publicAPI.buildShaders = function (shaders, ren, actor) {
    publicAPI.getShaderTemplate(shaders, ren, actor); // user specified pre replacements

    var openGLSpec = model.renderable.getViewSpecificProperties().OpenGL;
    var shaderReplacements = null;

    if (openGLSpec) {
      shaderReplacements = openGLSpec.ShaderReplacements;
    }

    if (shaderReplacements) {
      for (var i = 0; i < shaderReplacements.length; i++) {
        var currReplacement = shaderReplacements[i];

        if (currReplacement.replaceFirst) {
          var shaderType = currReplacement.shaderType;
          var ssrc = shaders[shaderType];
          var substituteRes = vtkShaderProgram.substitute(ssrc, currReplacement.originalValue, currReplacement.replacementValue, currReplacement.replaceAll);
          shaders[shaderType] = substituteRes.result;
        }
      }
    }

    publicAPI.replaceShaderValues(shaders, ren, actor); // user specified post replacements

    if (shaderReplacements) {
      for (var _i = 0; _i < shaderReplacements.length; _i++) {
        var _currReplacement = shaderReplacements[_i];

        if (!_currReplacement.replaceFirst) {
          var _shaderType = _currReplacement.shaderType;
          var _ssrc = shaders[_shaderType];

          var _substituteRes = vtkShaderProgram.substitute(_ssrc, _currReplacement.originalValue, _currReplacement.replacementValue, _currReplacement.replaceAll);

          shaders[_shaderType] = _substituteRes.result;
        }
      }
    }
  };

  publicAPI.replaceShaderValues = function (shaders, ren, actor) {
    publicAPI.replaceShaderColor(shaders, ren, actor);
    publicAPI.replaceShaderTCoord(shaders, ren, actor);
    publicAPI.replaceShaderPicking(shaders, ren, actor);
    publicAPI.replaceShaderPositionVC(shaders, ren, actor);
  };

  publicAPI.replaceShaderColor = function (shaders, ren, actor) {
    var VSSource = shaders.Vertex;
    var GSSource = shaders.Geometry;
    var FSSource = shaders.Fragment;

    if (model.haveCellScalars) {
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Dec', ['uniform samplerBuffer texture1;']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Impl', ['gl_FragData[0] = texelFetchBuffer(texture1, gl_PrimitiveID + PrimitiveIDOffset);']).result;
    }

    if (model.lastBoundBO.getCABO().getColorComponents() !== 0) {
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Color::Dec', ['in vec4 diffuseColor;', 'out vec4 fcolorVSOutput;']).result;
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Color::Impl', ['fcolorVSOutput = diffuseColor;']).result;
      GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::Color::Dec', ['in vec4 fcolorVSOutput[];\n', 'out vec4 fcolorGSOutput;']).result;
      GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::Color::Impl', ['fcolorGSOutput = fcolorVSOutput[i];']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Dec', ['in vec4 fcolorVSOutput;']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Impl', ['gl_FragData[0] = fcolorVSOutput;']).result;
    } else {
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Dec', ['uniform vec4 diffuseColor;']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Impl', ['gl_FragData[0] = diffuseColor;']).result;
    }

    shaders.Vertex = VSSource;
    shaders.Geometry = GSSource;
    shaders.Fragment = FSSource;
  };

  publicAPI.replaceShaderTCoord = function (shaders, ren, actor) {
    if (model.lastBoundBO.getCABO().getTCoordOffset()) {
      var VSSource = shaders.Vertex;
      var GSSource = shaders.Geometry;
      var FSSource = shaders.Fragment;
      var tcdim = model.lastBoundBO.getCABO().getTCoordComponents();

      if (tcdim === 1) {
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Dec', ['in float tcoordMC;', 'out float tcoordVCVSOutput;']).result;
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Impl', ['tcoordVCVSOutput = tcoordMC;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Dec', ['in float tcoordVCVSOutput[];\n', 'out float tcoordVCGSOutput;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, ['//VTK::TCoord::Impl', 'tcoordVCGSOutput = tcoordVCVSOutput[i];']).result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Dec', ['in float tcoordVCVSOutput;', 'uniform sampler2D texture1;']).result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['gl_FragData[0] = gl_FragData[0]*texture2D(texture1, vec2(tcoordVCVSOutput,0));']).result;
      } else if (tcdim === 2) {
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Dec', ['in vec2 tcoordMC;', 'out vec2 tcoordVCVSOutput;']).result;
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Impl', ['tcoordVCVSOutput = tcoordMC;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Dec', ['in vec2 tcoordVCVSOutput[];\n', 'out vec2 tcoordVCGSOutput;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Impl', ['tcoordVCGSOutput = tcoordVCVSOutput[i];']).result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Dec', ['in vec2 tcoordVCVSOutput;', 'uniform sampler2D texture1;']).result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['gl_FragData[0] = gl_FragData[0]*texture2D(texture1, tcoordVCVSOutput.st);']).result;
      }

      if (model.haveCellScalars) {
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::PrimID::Impl', ['gl_PrimitiveID = gl_PrimitiveIDIn;']).result;
      }

      shaders.Vertex = VSSource;
      shaders.Geometry = GSSource;
      shaders.Fragment = FSSource;
    }
  };

  publicAPI.replaceShaderPicking = function (shaders, ren, actor) {
    var FSSource = shaders.Fragment;
    FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Picking::Dec', ['uniform vec3 mapperIndex;', 'uniform int picking;']).result;
    FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Picking::Impl', '  gl_FragData[0] = picking != 0 ? vec4(mapperIndex,1.0) : gl_FragData[0];').result;
    shaders.Fragment = FSSource;
  };

  publicAPI.replaceShaderPositionVC = function (shaders, ren, actor) {
    var VSSource = shaders.Vertex;
    var GSSource = shaders.Geometry;
    var FSSource = shaders.Fragment; // for points make sure to add in the point size

    if (actor.getProperty().getRepresentation() === Representation.POINTS || model.lastBoundBO.getPrimitiveType() === primTypes.Points) {
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::PositionVC::Impl', ['//VTK::PositionVC::Impl', "  gl_PointSize = ".concat(actor.getProperty().getPointSize(), ".0;")], false).result;
    }

    shaders.Vertex = VSSource;
    shaders.Geometry = GSSource;
    shaders.Fragment = FSSource;
  };

  publicAPI.updateShaders = function (cellBO, ren, actor) {
    model.lastBoundBO = cellBO; // has something changed that would require us to recreate the shader?

    if (publicAPI.getNeedToRebuildShaders(cellBO, ren, actor)) {
      var shaders = {
        Vertex: null,
        Fragment: null,
        Geometry: null
      };
      publicAPI.buildShaders(shaders, ren, actor); // compile and bind the program if needed

      var newShader = model.openGLRenderWindow.getShaderCache().readyShaderProgramArray(shaders.Vertex, shaders.Fragment, shaders.Geometry); // if the shader changed reinitialize the VAO

      if (newShader !== cellBO.getProgram()) {
        cellBO.setProgram(newShader); // reset the VAO as the shader has changed

        cellBO.getVAO().releaseGraphicsResources();
      }

      cellBO.getShaderSourceTime().modified();
    } else {
      model.openGLRenderWindow.getShaderCache().readyShaderProgram(cellBO.getProgram());
    }

    cellBO.getVAO().bind();
    publicAPI.setMapperShaderParameters(cellBO, ren, actor);
    publicAPI.setPropertyShaderParameters(cellBO, ren, actor);
    publicAPI.setCameraShaderParameters(cellBO, ren, actor);
    var listCallbacks = model.renderable.getViewSpecificProperties().ShadersCallbacks;

    if (listCallbacks) {
      listCallbacks.forEach(function (object) {
        object.callback(object.userData, cellBO, ren, actor);
      });
    }
  };

  publicAPI.setMapperShaderParameters = function (cellBO, ren, actor) {
    // Now to update the VAO too, if necessary.
    if (cellBO.getProgram().isUniformUsed('PrimitiveIDOffset')) {
      cellBO.getProgram().setUniformi('PrimitiveIDOffset', model.primitiveIDOffset);
    }

    if (cellBO.getProgram().isAttributeUsed('vertexWC')) {
      if (!cellBO.getVAO().addAttributeArray(cellBO.getProgram(), cellBO.getCABO(), 'vertexWC', cellBO.getCABO().getVertexOffset(), cellBO.getCABO().getStride(), model.context.FLOAT, 3, false)) {
        vtkErrorMacro('Error setting vertexWC in shader VAO.');
      }
    }

    if (cellBO.getCABO().getElementCount() && (model.VBOBuildTime.getMTime() > cellBO.getAttributeUpdateTime().getMTime() || cellBO.getShaderSourceTime().getMTime() > cellBO.getAttributeUpdateTime().getMTime())) {
      model.renderable.getCustomShaderAttributes().forEach(function (attrName, idx) {
        if (cellBO.getProgram().isAttributeUsed("".concat(attrName, "MC"))) {
          if (!cellBO.getVAO().addAttributeArray(cellBO.getProgram(), cellBO.getCABO(), "".concat(attrName, "MC"), cellBO.getCABO().getCustomData()[idx].offset, cellBO.getCABO().getStride(), model.context.FLOAT, cellBO.getCABO().getCustomData()[idx].components, false)) {
            vtkErrorMacro("Error setting ".concat(attrName, "MC in shader VAO."));
          }
        }
      });

      if (cellBO.getProgram().isAttributeUsed('tcoordMC') && cellBO.getCABO().getTCoordOffset()) {
        if (!cellBO.getVAO().addAttributeArray(cellBO.getProgram(), cellBO.getCABO(), 'tcoordMC', cellBO.getCABO().getTCoordOffset(), cellBO.getCABO().getStride(), model.context.FLOAT, cellBO.getCABO().getTCoordComponents(), false)) {
          vtkErrorMacro('Error setting tcoordMC in shader VAO.');
        }
      } else {
        cellBO.getVAO().removeAttributeArray('tcoordMC');
      }

      if (model.internalColorTexture && cellBO.getProgram().isUniformUsed('texture1')) {
        cellBO.getProgram().setUniformi('texture1', model.internalColorTexture.getTextureUnit());
      }

      var tus = model.openGLActor2D.getActiveTextures();

      if (tus) {
        for (var index = 0; index < tus.length; ++index) {
          var tex = tus[index];
          var texUnit = tex.getTextureUnit();
          var tname = "texture".concat(texUnit + 1);

          if (cellBO.getProgram().isUniformUsed(tname)) {
            cellBO.getProgram().setUniformi(tname, texUnit);
          }
        }
      } // handle wide lines


      if (publicAPI.haveWideLines(ren, actor)) {
        var gl = model.context;
        var vp = gl.getParameter(gl.VIEWPORT);
        var lineWidth = [1, 1];
        lineWidth[0] = 2.0 * actor.getProperty().getLineWidth() / vp[2];
        lineWidth[1] = 2.0 * actor.getProperty().getLineWidth() / vp[3];
        cellBO.getProgram().setUniform2f('lineWidthNVC', lineWidth);
      }

      var selector = model.openGLRenderer.getSelector();
      cellBO.getProgram().setUniform3fArray('mapperIndex', selector ? selector.getPropColorValue() : [0.0, 0.0, 0.0]);
      cellBO.getProgram().setUniformi('picking', selector ? selector.getCurrentPass() + 1 : 0);
    }
  };

  publicAPI.setPropertyShaderParameters = function (cellBO, ren, actor) {
    var c = model.renderable.getColorMapColors();

    if (!c || c.getNumberOfComponents() === 0) {
      var program = cellBO.getProgram();
      var ppty = actor.getProperty();
      var opacity = ppty.getOpacity();
      var dColor = ppty.getColor();
      var diffuseColor = [dColor[0], dColor[1], dColor[2], opacity];
      program.setUniform4f('diffuseColor', diffuseColor);
    }
  };

  function safeMatrixMultiply(matrixArray, matrixType, tmpMat) {
    matrixType.identity(tmpMat);
    return matrixArray.reduce(function (res, matrix, index) {
      if (index === 0) {
        return matrix ? matrixType.copy(res, matrix) : matrixType.identity(res);
      }

      return matrix ? matrixType.multiply(res, res, matrix) : res;
    }, tmpMat);
  }

  publicAPI.setCameraShaderParameters = function (cellBO, ren, actor) {
    var program = cellBO.getProgram();
    var shiftScaleEnabled = cellBO.getCABO().getCoordShiftAndScaleEnabled();
    var inverseShiftScaleMatrix = shiftScaleEnabled ? cellBO.getCABO().getInverseShiftAndScaleMatrix() : null; // Get the position of the actor

    var size = model.openGLRenderer.getTiledSizeAndOrigin();
    var vport = ren.getViewport();
    var actorPos = actor.getActualPositionCoordinate().getComputedViewportValue(ren); // Get the window info
    // const tileViewport = ren.getVTKWindow().getTileViewport();
    // Assume tile viewport is 0 1 based on vtkOpenGLRenderer

    var tileViewport = [0.0, 0.0, 1.0, 1.0];
    var visVP = [0, 1, 0, 1];
    visVP[0] = vport[0] >= tileViewport[0] ? vport[0] : tileViewport[0];
    visVP[1] = vport[1] >= tileViewport[1] ? vport[1] : tileViewport[1];
    visVP[2] = vport[2] >= tileViewport[2] ? vport[2] : tileViewport[2];
    visVP[3] = vport[3] >= tileViewport[3] ? vport[3] : tileViewport[3];

    if (visVP[0] >= visVP[2]) {
      return;
    }

    if (visVP[1] >= visVP[3]) {
      return;
    }

    size.usize = round(size.usize * (visVP[2] - visVP[0]) / (vport[2] - vport[0]));
    size.vsize = round(size.vsize * (visVP[3] - visVP[1]) / (vport[3] - vport[1]));
    var winSize = model.openGLRenderer.getParent().getSize();
    var xoff = round(actorPos[0] - (visVP[0] - vport[0]) * winSize[0]);
    var yoff = round(actorPos[1] - (visVP[1] - vport[1]) * winSize[1]); // set ortho projection

    var left = -xoff;
    var right = -xoff + size.usize;
    var bottom = -yoff;
    var top = -yoff + size.vsize; // it's an error to call glOrtho with
    // either left==right or top==bottom

    if (left === right) {
      right = left + 1.0;
    }

    if (bottom === top) {
      top = bottom + 1.0;
    } // compute the combined ModelView matrix and send it down to save time in the shader


    var tmpMat4 = mat4.identity(new Float64Array(16));
    tmpMat4[0] = 2.0 / (right - left);
    tmpMat4[1 * 4 + 1] = 2.0 / (top - bottom);
    tmpMat4[0 * 4 + 3] = -1.0 * (right + left) / (right - left);
    tmpMat4[1 * 4 + 3] = -1.0 * (top + bottom) / (top - bottom);
    tmpMat4[2 * 4 + 2] = 0.0;
    tmpMat4[2 * 4 + 3] = actor.getProperty().getDisplayLocation() === DisplayLocation.FOREGROUND ? -1.0 : 1.0;
    tmpMat4[3 * 4 + 3] = 1.0;
    mat4.transpose(tmpMat4, tmpMat4);
    program.setUniformMatrix('WCVCMatrix', safeMatrixMultiply([tmpMat4, inverseShiftScaleMatrix], mat4, model.tmpMat4));
  };

  publicAPI.haveWideLines = function (ren, actor) {
    if (model.lastBoundBO === model.lines && actor.getProperty().getLineWidth() > 1.0) {
      // we have wide lines, but the OpenGL implementation may
      // actually support them, check the range to see if we
      // really need have to implement our own wide lines
      // vtkOpenGLRenderWindow* renWin = vtkOpenGLRenderWindow::SafeDownCast(ren->GetVTKWindow());
      // return !(
      //   renWin && renWin->GetMaximumHardwareLineWidth() >= actor->GetProperty()->GetLineWidth());
      return true;
    }

    return false;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  context: null,
  VBOBuildTime: 0,
  VBOBuildString: null,
  primitives: null,
  primTypes: null,
  shaderRebuildString: null
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkViewNode.extend(publicAPI, model, initialValues);
  vtkReplacementShaderMapper.implementReplaceShaderCoincidentOffset(publicAPI, model, initialValues);
  model.primitives = [];
  model.primTypes = primTypes;
  model.tmpMat4 = mat4.identity(new Float64Array(16));

  for (var i = primTypes.Start; i < primTypes.End; i++) {
    model.primitives[i] = vtkHelper.newInstance();
    model.primitives[i].setPrimitiveType(i);
    model.primitives[i].set({
      lastLightComplexity: 0,
      lastLightCount: 0,
      lastSelectionPass: false
    }, true);
  } // Build VTK API


  setGet(publicAPI, model, ['context']);
  model.VBOBuildTime = {};
  obj(model.VBOBuildTime, {
    mtime: 0
  }); // Object methods

  vtkOpenGLPolyDataMapper2D(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = newInstance$1(extend, 'vtkOpenGLPolyDataMapper2D'); // ----------------------------------------------------------------------------

var vtkPolyDataMapper2D = {
  newInstance: newInstance,
  extend: extend
}; // Register ourself to OpenGL backend if imported

registerOverride('vtkMapper2D', newInstance);

export { vtkPolyDataMapper2D as default, extend, newInstance };
