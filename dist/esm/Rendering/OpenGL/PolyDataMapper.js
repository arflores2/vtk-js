import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import { mat3, mat4, vec3 } from 'gl-matrix';
import { newInstance as newInstance$1, setGet, obj, vtkErrorMacro as vtkErrorMacro$1 } from '../../macros.js';
import vtkHelper from './Helper.js';
import vtkMapper from '../Core/Mapper.js';
import { f as normalize, u as uninitializeBounds } from '../../Common/Core/Math/index.js';
import vtkOpenGLTexture from './Texture.js';
import vtkProperty from '../Core/Property.js';
import vtkShaderProgram from './ShaderProgram.js';
import vtkViewNode from '../SceneGraph/ViewNode.js';
import { v as vtkPolyDataVS } from './glsl/vtkPolyDataVS.glsl.js';
import { v as vtkPolyDataFS } from './glsl/vtkPolyDataFS.glsl.js';
import vtkReplacementShaderMapper from './ReplacementShaderMapper.js';
import { registerOverride } from './ViewNodeFactory.js';

/* eslint-disable no-lonely-if */

var primTypes = {
  Start: 0,
  Points: 0,
  Lines: 1,
  Tris: 2,
  TriStrips: 3,
  TrisEdges: 4,
  TriStripsEdges: 5,
  End: 6
};
var Representation = vtkProperty.Representation,
    Shading = vtkProperty.Shading;
var ScalarMode = vtkMapper.ScalarMode;
var Filter = vtkOpenGLTexture.Filter,
    Wrap = vtkOpenGLTexture.Wrap;
var vtkErrorMacro = vtkErrorMacro$1;
var StartEvent = {
  type: 'StartEvent'
};
var EndEvent = {
  type: 'EndEvent'
}; // ----------------------------------------------------------------------------
// vtkOpenGLPolyDataMapper methods
// ----------------------------------------------------------------------------

function vtkOpenGLPolyDataMapper(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkOpenGLPolyDataMapper');

  publicAPI.buildPass = function (prepass) {
    if (prepass) {
      model.openGLActor = publicAPI.getFirstAncestorOfType('vtkOpenGLActor');
      model.openGLRenderer = model.openGLActor.getFirstAncestorOfType('vtkOpenGLRenderer');
      model.openGLRenderWindow = model.openGLRenderer.getParent();
      model.openGLCamera = model.openGLRenderer.getViewNodeFor(model.openGLRenderer.getRenderable().getActiveCamera());
    }
  }; // Renders myself


  publicAPI.translucentPass = function (prepass) {
    if (prepass) {
      publicAPI.render();
    }
  };

  publicAPI.opaqueZBufferPass = function (prepass) {
    if (prepass) {
      model.haveSeenDepthRequest = true;
      model.renderDepth = true;
      publicAPI.render();
      model.renderDepth = false;
    }
  };

  publicAPI.opaquePass = function (prepass) {
    if (prepass) {
      publicAPI.render();
    }
  };

  publicAPI.render = function () {
    var ctx = model.openGLRenderWindow.getContext();

    if (model.context !== ctx) {
      model.context = ctx;

      for (var i = primTypes.Start; i < primTypes.End; i++) {
        model.primitives[i].setOpenGLRenderWindow(model.openGLRenderWindow);
      }
    }

    var actor = model.openGLActor.getRenderable();
    var ren = model.openGLRenderer.getRenderable();
    publicAPI.renderPiece(ren, actor);
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

  publicAPI.getShaderTemplate = function (shaders, ren, actor) {
    var openGLSpecProp = model.renderable.getViewSpecificProperties().OpenGL;
    var vertexShaderCode = vtkPolyDataVS;

    if (openGLSpecProp) {
      var vertexSpecProp = openGLSpecProp.VertexShaderCode;

      if (vertexSpecProp !== undefined && vertexSpecProp !== '') {
        vertexShaderCode = vertexSpecProp;
      }
    }

    shaders.Vertex = vertexShaderCode;
    var fragmentShaderCode = vtkPolyDataFS;

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

  publicAPI.replaceShaderColor = function (shaders, ren, actor) {
    var VSSource = shaders.Vertex;
    var GSSource = shaders.Geometry;
    var FSSource = shaders.Fragment;
    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity'); // create the material/color property declarations, and VS implementation
    // these are always defined

    var colorDec = ['uniform float ambient;', 'uniform float diffuse;', 'uniform float specular;', 'uniform float opacityUniform; // the fragment opacity', 'uniform vec3 ambientColorUniform;', 'uniform vec3 diffuseColorUniform;']; // add more for specular

    if (lastLightComplexity) {
      colorDec = colorDec.concat(['uniform vec3 specularColorUniform;', 'uniform float specularPowerUniform;']);
    } // now handle the more complex fragment shader implementation
    // the following are always defined variables.  We start
    // by assigning a default value from the uniform


    var colorImpl = ['vec3 ambientColor;', '  vec3 diffuseColor;', '  float opacity;'];

    if (lastLightComplexity) {
      colorImpl = colorImpl.concat(['  vec3 specularColor;', '  float specularPower;']);
    }

    colorImpl = colorImpl.concat(['  ambientColor = ambientColorUniform;', '  diffuseColor = diffuseColorUniform;', '  opacity = opacityUniform;']);

    if (lastLightComplexity) {
      colorImpl = colorImpl.concat(['  specularColor = specularColorUniform;', '  specularPower = specularPowerUniform;']);
    } // add scalar vertex coloring


    if (model.lastBoundBO.getCABO().getColorComponents() !== 0 && !model.drawingEdges) {
      colorDec = colorDec.concat(['varying vec4 vertexColorVSOutput;']);
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Color::Dec', ['attribute vec4 scalarColor;', 'varying vec4 vertexColorVSOutput;']).result;
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Color::Impl', ['vertexColorVSOutput =  scalarColor;']).result;
      GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::Color::Dec', ['in vec4 vertexColorVSOutput[];', 'out vec4 vertexColorGSOutput;']).result;
      GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::Color::Impl', ['vertexColorGSOutput = vertexColorVSOutput[i];']).result;
    }

    if (model.lastBoundBO.getCABO().getColorComponents() !== 0 && !model.drawingEdges) {
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Impl', colorImpl.concat(['  diffuseColor = vertexColorVSOutput.rgb;', '  ambientColor = vertexColorVSOutput.rgb;', '  opacity = opacity*vertexColorVSOutput.a;'])).result;
    } else {
      if (model.renderable.getInterpolateScalarsBeforeMapping() && model.renderable.getColorCoordinates() && !model.drawingEdges) {
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Impl', colorImpl.concat(['  vec4 texColor = texture2D(texture1, tcoordVCVSOutput.st);', '  diffuseColor = texColor.rgb;', '  ambientColor = texColor.rgb;', '  opacity = opacity*texColor.a;'])).result;
      } else {
        if (actor.getBackfaceProperty() && !model.drawingEdges) {
          colorDec = colorDec.concat(['uniform float opacityUniformBF; // the fragment opacity', 'uniform float ambientIntensityBF; // the material ambient', 'uniform float diffuseIntensityBF; // the material diffuse', 'uniform vec3 ambientColorUniformBF; // ambient material color', 'uniform vec3 diffuseColorUniformBF; // diffuse material color']);

          if (lastLightComplexity) {
            colorDec = colorDec.concat(['uniform float specularIntensityBF; // the material specular intensity', 'uniform vec3 specularColorUniformBF; // intensity weighted color', 'uniform float specularPowerUniformBF;']);
            colorImpl = colorImpl.concat(['if (gl_FrontFacing == false) {', '  ambientColor = ambientIntensityBF * ambientColorUniformBF;', '  diffuseColor = diffuseIntensityBF * diffuseColorUniformBF;', '  specularColor = specularIntensityBF * specularColorUniformBF;', '  specularPower = specularPowerUniformBF;', '  opacity = opacityUniformBF; }']);
          } else {
            colorImpl = colorImpl.concat(['if (gl_FrontFacing == false) {', '  ambientColor = ambientIntensityBF * ambientColorUniformBF;', '  diffuseColor = diffuseIntensityBF * diffuseColorUniformBF;', '  opacity = opacityUniformBF; }']);
          }
        }

        if (model.haveCellScalars && !model.drawingEdges) {
          colorDec = colorDec.concat(['uniform samplerBuffer texture1;']);
        }

        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Impl', colorImpl).result;
      }
    }

    FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Color::Dec', colorDec).result;
    shaders.Vertex = VSSource;
    shaders.Geometry = GSSource;
    shaders.Fragment = FSSource;
  };

  publicAPI.replaceShaderLight = function (shaders, ren, actor) {
    var FSSource = shaders.Fragment; // check for shadow maps

    var shadowFactor = '';
    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');
    var lastLightCount = model.lastBoundBO.getReferenceByName('lastLightCount');
    var sstring = [];

    switch (lastLightComplexity) {
      case 0:
        // no lighting or RENDER_VALUES
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Light::Impl', ['  gl_FragData[0] = vec4(ambientColor * ambient + diffuseColor * diffuse, opacity);', '  //VTK::Light::Impl'], false).result;
        break;

      case 1:
        // headlight
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Light::Impl', ['  float df = max(0.0, normalVCVSOutput.z);', '  float sf = pow(df, specularPower);', '  vec3 diffuseL = df * diffuseColor;', '  vec3 specularL = sf * specularColor;', '  gl_FragData[0] = vec4(ambientColor * ambient + diffuseL * diffuse + specularL * specular, opacity);', '  //VTK::Light::Impl'], false).result;
        break;

      case 2:
        // light kit
        for (var lc = 0; lc < lastLightCount; ++lc) {
          sstring = sstring.concat(["uniform vec3 lightColor".concat(lc, ";"), "uniform vec3 lightDirectionVC".concat(lc, "; // normalized"), "uniform vec3 lightHalfAngleVC".concat(lc, "; // normalized")]);
        }

        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Light::Dec', sstring).result;
        sstring = ['vec3 diffuseL = vec3(0,0,0);', '  vec3 specularL = vec3(0,0,0);', '  float df;'];

        for (var _lc = 0; _lc < lastLightCount; ++_lc) {
          sstring = sstring.concat(["  df = max(0.0, dot(normalVCVSOutput, -lightDirectionVC".concat(_lc, "));"), "  diffuseL += ((df".concat(shadowFactor, ") * lightColor").concat(_lc, ");"), "  if (dot(normalVCVSOutput, lightDirectionVC".concat(_lc, ") < 0.0)"), '    {', "    float sf = pow( max(0.0, dot(lightHalfAngleVC".concat(_lc, ",normalVCVSOutput)), specularPower);"), "    specularL += ((sf".concat(shadowFactor, ") * lightColor").concat(_lc, ");"), '    }']);
        }

        sstring = sstring.concat(['  diffuseL = diffuseL * diffuseColor;', '  specularL = specularL * specularColor;', '  gl_FragData[0] = vec4(ambientColor * ambient + diffuseL * diffuse + specularL * specular, opacity);', '  //VTK::Light::Impl']);
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Light::Impl', sstring, false).result;
        break;

      case 3:
        // positional
        for (var _lc2 = 0; _lc2 < lastLightCount; ++_lc2) {
          sstring = sstring.concat(["uniform vec3 lightColor".concat(_lc2, ";"), "uniform vec3 lightDirectionVC".concat(_lc2, "; // normalized"), "uniform vec3 lightHalfAngleVC".concat(_lc2, "; // normalized"), "uniform vec3 lightPositionVC".concat(_lc2, ";"), "uniform vec3 lightAttenuation".concat(_lc2, ";"), "uniform float lightConeAngle".concat(_lc2, ";"), "uniform float lightExponent".concat(_lc2, ";"), "uniform int lightPositional".concat(_lc2, ";")]);
        }

        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Light::Dec', sstring).result;
        sstring = ['vec3 diffuseL = vec3(0,0,0);', '  vec3 specularL = vec3(0,0,0);', '  vec3 vertLightDirectionVC;', '  float attenuation;', '  float df;'];

        for (var _lc3 = 0; _lc3 < lastLightCount; ++_lc3) {
          sstring = sstring.concat(['  attenuation = 1.0;', "  if (lightPositional".concat(_lc3, " == 0)"), '    {', "      vertLightDirectionVC = lightDirectionVC".concat(_lc3, ";"), '    }', '  else', '    {', "    vertLightDirectionVC = vertexVC.xyz - lightPositionVC".concat(_lc3, ";"), '    float distanceVC = length(vertLightDirectionVC);', '    vertLightDirectionVC = normalize(vertLightDirectionVC);', '    attenuation = 1.0 /', "      (lightAttenuation".concat(_lc3, ".x"), "       + lightAttenuation".concat(_lc3, ".y * distanceVC"), "       + lightAttenuation".concat(_lc3, ".z * distanceVC * distanceVC);"), '    // per OpenGL standard cone angle is 90 or less for a spot light', "    if (lightConeAngle".concat(_lc3, " <= 90.0)"), '      {', "      float coneDot = dot(vertLightDirectionVC, lightDirectionVC".concat(_lc3, ");"), '      // if inside the cone', "      if (coneDot >= cos(radians(lightConeAngle".concat(_lc3, ")))"), '        {', "        attenuation = attenuation * pow(coneDot, lightExponent".concat(_lc3, ");"), '        }', '      else', '        {', '        attenuation = 0.0;', '        }', '      }', '    }', '    df = max(0.0, attenuation*dot(normalVCVSOutput, -vertLightDirectionVC));', "    diffuseL += ((df".concat(shadowFactor, ") * lightColor").concat(_lc3, ");"), '    if (dot(normalVCVSOutput, vertLightDirectionVC) < 0.0)', '      {', "      float sf = attenuation*pow( max(0.0, dot(lightHalfAngleVC".concat(_lc3, ",normalVCVSOutput)), specularPower);"), "    specularL += ((sf".concat(shadowFactor, ") * lightColor").concat(_lc3, ");"), '    }']);
        }

        sstring = sstring.concat(['  diffuseL = diffuseL * diffuseColor;', '  specularL = specularL * specularColor;', '  gl_FragData[0] = vec4(ambientColor * ambient + diffuseL * diffuse + specularL * specular, opacity);', '  //VTK::Light::Impl']);
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Light::Impl', sstring, false).result;
        break;

      default:
        vtkErrorMacro('bad light complexity');
    }

    shaders.Fragment = FSSource;
  };

  publicAPI.replaceShaderNormal = function (shaders, ren, actor) {
    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');

    if (lastLightComplexity > 0) {
      var VSSource = shaders.Vertex;
      var GSSource = shaders.Geometry;
      var FSSource = shaders.Fragment;

      if (model.lastBoundBO.getCABO().getNormalOffset()) {
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Normal::Dec', ['attribute vec3 normalMC;', 'uniform mat3 normalMatrix;', 'varying vec3 normalVCVSOutput;']).result;
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Normal::Impl', ['normalVCVSOutput = normalMatrix * normalMC;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::Normal::Dec', ['in vec3 normalVCVSOutput[];', 'out vec3 normalVCGSOutput;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::Normal::Impl', ['normalVCGSOutput = normalVCVSOutput[i];']).result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Dec', ['varying vec3 normalVCVSOutput;']).result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Impl', ['vec3 normalVCVSOutput = normalize(normalVCVSOutput);', //  if (!gl_FrontFacing) does not work in intel hd4000 mac
        //  if (int(gl_FrontFacing) == 0) does not work on mesa
        '  if (gl_FrontFacing == false) { normalVCVSOutput = -normalVCVSOutput; }']).result;
      } else {
        if (model.haveCellNormals) {
          FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Dec', ['uniform mat3 normalMatrix;', 'uniform samplerBuffer textureN;']).result;
          FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Impl', ['vec3 normalVCVSOutput = normalize(normalMatrix *', '    texelFetchBuffer(textureN, gl_PrimitiveID + PrimitiveIDOffset).xyz);', '  if (gl_FrontFacing == false) { normalVCVSOutput = -normalVCVSOutput; }']).result;
        } else {
          if (publicAPI.getOpenGLMode(actor.getProperty().getRepresentation(), model.lastBoundBO.getPrimitiveType()) === model.context.LINES) {
            // generate a normal for lines, it will be perpendicular to the line
            // and maximally aligned with the camera view direction
            // no clue if this is the best way to do this.
            // the code below has been optimized a bit so what follows is
            // an explanation of the basic approach. Compute the gradient of the line
            // with respect to x and y, the the larger of the two
            // cross that with the camera view direction. That gives a vector
            // orthogonal to the camera view and the line. Note that the line and the camera
            // view are probably not orthogonal. Which is why when we cross result that with
            // the line gradient again we get a reasonable normal. It will be othogonal to
            // the line (which is a plane but maximally aligned with the camera view.
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::UniformFlow::Impl', ['  vec3 fdx = dFdx(vertexVC.xyz);', '  vec3 fdy = dFdy(vertexVC.xyz);', '  //VTK::UniformFlow::Impl'] // For further replacements
            ).result;
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Impl', ['vec3 normalVCVSOutput;', '  if (abs(fdx.x) > 0.0)', '    { fdx = normalize(fdx); normalVCVSOutput = normalize(cross(vec3(fdx.y, -fdx.x, 0.0), fdx)); }', '  else { fdy = normalize(fdy); normalVCVSOutput = normalize(cross(vec3(fdy.y, -fdy.x, 0.0), fdy));}']).result;
          } else {
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Dec', ['uniform int cameraParallel;']).result;
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::UniformFlow::Impl', [// '  vec3 fdx = vec3(dFdx(vertexVC.x),dFdx(vertexVC.y),dFdx(vertexVC.z));',
            // '  vec3 fdy = vec3(dFdy(vertexVC.x),dFdy(vertexVC.y),dFdy(vertexVC.z));',
            '  vec3 fdx = dFdx(vertexVC.xyz);', '  vec3 fdy = dFdy(vertexVC.xyz);', '  //VTK::UniformFlow::Impl'] // For further replacements
            ).result;
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Normal::Impl', ['  fdx = normalize(fdx);', '  fdy = normalize(fdy);', '  vec3 normalVCVSOutput = normalize(cross(fdx,fdy));', // the code below is faster, but does not work on some devices
            // 'vec3 normalVC = normalize(cross(dFdx(vertexVC.xyz), dFdy(vertexVC.xyz)));',
            '  if (cameraParallel == 1 && normalVCVSOutput.z < 0.0) { normalVCVSOutput = -1.0*normalVCVSOutput; }', '  if (cameraParallel == 0 && dot(normalVCVSOutput,vertexVC.xyz) > 0.0) { normalVCVSOutput = -1.0*normalVCVSOutput; }']).result;
          }
        }
      }

      shaders.Vertex = VSSource;
      shaders.Geometry = GSSource;
      shaders.Fragment = FSSource;
    }
  };

  publicAPI.replaceShaderPositionVC = function (shaders, ren, actor) {
    var VSSource = shaders.Vertex;
    var GSSource = shaders.Geometry;
    var FSSource = shaders.Fragment; // for points make sure to add in the point size

    if (actor.getProperty().getRepresentation() === Representation.POINTS || model.lastBoundBO.getPrimitiveType() === primTypes.Points) {
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::PositionVC::Impl', ['//VTK::PositionVC::Impl', "  gl_PointSize = ".concat(actor.getProperty().getPointSize(), ".0;")], false).result;
    } // do we need the vertex in the shader in View Coordinates


    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');

    if (lastLightComplexity > 0) {
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::PositionVC::Dec', ['varying vec4 vertexVCVSOutput;']).result;
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::PositionVC::Impl', ['vertexVCVSOutput = MCVCMatrix * vertexMC;', '  gl_Position = MCPCMatrix * vertexMC;']).result;
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Camera::Dec', ['uniform mat4 MCPCMatrix;', 'uniform mat4 MCVCMatrix;']).result;
      GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::PositionVC::Dec', ['in vec4 vertexVCVSOutput[];', 'out vec4 vertexVCGSOutput;']).result;
      GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::PositionVC::Impl', ['vertexVCGSOutput = vertexVCVSOutput[i];']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::PositionVC::Dec', ['varying vec4 vertexVCVSOutput;']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::PositionVC::Impl', ['vec4 vertexVC = vertexVCVSOutput;']).result;
    } else {
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Camera::Dec', ['uniform mat4 MCPCMatrix;']).result;
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::PositionVC::Impl', ['  gl_Position = MCPCMatrix * vertexMC;']).result;
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

      if (model.drawingEdges) {
        return;
      }

      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Impl', 'tcoordVCVSOutput = tcoordMC;').result; // we only handle the first texture by default
      // additional textures are activated and we set the uniform
      // for the texture unit they are assigned to, but you have to
      // add in the shader code to do something with them

      var tus = model.openGLActor.getActiveTextures();
      var tNumComp = 2;
      var tcdim = 2;

      if (tus && tus.length > 0) {
        tNumComp = tus[0].getComponents();

        if (tus[0].getTarget() === model.context.TEXTURE_CUBE_MAP) {
          tcdim = 3;
        }
      }

      if (model.renderable.getColorTextureMap()) {
        tNumComp = model.renderable.getColorTextureMap().getPointData().getScalars().getNumberOfComponents();
        tcdim = 2;
      }

      if (tcdim === 2) {
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Dec', 'attribute vec2 tcoordMC; varying vec2 tcoordVCVSOutput;').result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Dec', ['in vec2 tcoordVCVSOutput[];', 'out vec2 tcoordVCGSOutput;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Impl', 'tcoordVCGSOutput = tcoordVCVSOutput[i];').result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Dec', ['varying vec2 tcoordVCVSOutput;', 'uniform sampler2D texture1;']).result;

        if (tus && tus.length >= 1) {
          switch (tNumComp) {
            case 1:
              FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['  vec4 tcolor = texture2D(texture1, tcoordVCVSOutput);', '  ambientColor = ambientColor*tcolor.r;', '  diffuseColor = diffuseColor*tcolor.r;']).result;
              break;

            case 2:
              FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['  vec4 tcolor = texture2D(texture1, tcoordVCVSOutput);', '  ambientColor = ambientColor*tcolor.r;', '  diffuseColor = diffuseColor*tcolor.r;', '  opacity = opacity * tcolor.g;']).result;
              break;

            default:
              FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['  vec4 tcolor = texture2D(texture1, tcoordVCVSOutput);', '  ambientColor = ambientColor*tcolor.rgb;', '  diffuseColor = diffuseColor*tcolor.rgb;', '  opacity = opacity * tcolor.a;']).result;
          }
        }
      } else {
        VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::TCoord::Dec', 'attribute vec3 tcoordMC; varying vec3 tcoordVCVSOutput;').result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Dec', ['in vec3 tcoordVCVSOutput[];', 'out vec3 tcoordVCGSOutput;']).result;
        GSSource = vtkShaderProgram.substitute(GSSource, '//VTK::TCoord::Impl', 'tcoordVCGSOutput = tcoordVCVSOutput[i];').result;
        FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Dec', ['varying vec3 tcoordVCVSOutput;', 'uniform samplerCube texture1;']).result;

        switch (tNumComp) {
          case 1:
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['  vec4 tcolor = textureCube(texture1, tcoordVCVSOutput);', '  ambientColor = ambientColor*tcolor.r;', '  diffuseColor = diffuseColor*tcolor.r;']).result;
            break;

          case 2:
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['  vec4 tcolor = textureCube(texture1, tcoordVCVSOutput);', '  ambientColor = ambientColor*tcolor.r;', '  diffuseColor = diffuseColor*tcolor.r;', '  opacity = opacity * tcolor.g;']).result;
            break;

          default:
            FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::TCoord::Impl', ['  vec4 tcolor = textureCube(texture1, tcoordVCVSOutput);', '  ambientColor = ambientColor*tcolor.rgb;', '  diffuseColor = diffuseColor*tcolor.rgb;', '  opacity = opacity * tcolor.a;']).result;
        }
      }

      shaders.Vertex = VSSource;
      shaders.Geometry = GSSource;
      shaders.Fragment = FSSource;
    }
  };

  publicAPI.replaceShaderClip = function (shaders, ren, actor) {
    var VSSource = shaders.Vertex;
    var FSSource = shaders.Fragment;

    if (model.renderable.getNumberOfClippingPlanes()) {
      var numClipPlanes = model.renderable.getNumberOfClippingPlanes();
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Clip::Dec', ['uniform int numClipPlanes;', "uniform vec4 clipPlanes[".concat(numClipPlanes, "];"), "varying float clipDistancesVSOutput[".concat(numClipPlanes, "];")]).result;
      VSSource = vtkShaderProgram.substitute(VSSource, '//VTK::Clip::Impl', ["for (int planeNum = 0; planeNum < ".concat(numClipPlanes, "; planeNum++)"), '    {', '    if (planeNum >= numClipPlanes)', '        {', '        break;', '        }', '    clipDistancesVSOutput[planeNum] = dot(clipPlanes[planeNum], vertexMC);', '    }']).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Clip::Dec', ['uniform int numClipPlanes;', "varying float clipDistancesVSOutput[".concat(numClipPlanes, "];")]).result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Clip::Impl', ["for (int planeNum = 0; planeNum < ".concat(numClipPlanes, "; planeNum++)"), '    {', '    if (planeNum >= numClipPlanes)', '        {', '        break;', '        }', '    if (clipDistancesVSOutput[planeNum] < 0.0) discard;', '    }']).result;
    }

    shaders.Vertex = VSSource;
    shaders.Fragment = FSSource;
  };

  publicAPI.getCoincidentParameters = function (ren, actor) {
    // 1. ResolveCoincidentTopology is On and non zero for this primitive
    // type
    var cp = null;
    var prop = actor.getProperty();

    if (model.renderable.getResolveCoincidentTopology() || prop.getEdgeVisibility() && prop.getRepresentation() === Representation.SURFACE) {
      var primType = model.lastBoundBO.getPrimitiveType();

      if (primType === primTypes.Points || prop.getRepresentation() === Representation.POINTS) {
        cp = model.renderable.getCoincidentTopologyPointOffsetParameter();
      } else if (primType === primTypes.Lines || prop.getRepresentation() === Representation.WIREFRAME) {
        cp = model.renderable.getCoincidentTopologyLineOffsetParameters();
      } else if (primType === primTypes.Tris || primType === primTypes.TriStrips) {
        cp = model.renderable.getCoincidentTopologyPolygonOffsetParameters();
      }

      if (primType === primTypes.TrisEdges || primType === primTypes.TriStripsEdges) {
        cp = model.renderable.getCoincidentTopologyPolygonOffsetParameters();
        cp.factor /= 2.0;
        cp.offset /= 2.0;
      }
    } // hardware picking always offset due to saved zbuffer
    // This gets you above the saved surface depth buffer.
    // vtkHardwareSelector* selector = ren->GetSelector();
    // if (selector &&
    //     selector->GetFieldAssociation() == vtkDataObject::FIELD_ASSOCIATION_POINTS)
    // {
    //   offset -= 2.0;
    //   return;
    // }


    return cp;
  };

  publicAPI.replaceShaderPicking = function (shaders, ren, actor) {
    var FSSource = shaders.Fragment;
    FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Picking::Dec', ['uniform vec3 mapperIndex;', 'uniform int picking;']).result;
    FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::Picking::Impl', '  gl_FragData[0] = picking != 0 ? vec4(mapperIndex,1.0) : gl_FragData[0];').result;
    shaders.Fragment = FSSource;
  };

  publicAPI.replaceShaderValues = function (shaders, ren, actor) {
    publicAPI.replaceShaderColor(shaders, ren, actor);
    publicAPI.replaceShaderNormal(shaders, ren, actor);
    publicAPI.replaceShaderLight(shaders, ren, actor);
    publicAPI.replaceShaderTCoord(shaders, ren, actor);
    publicAPI.replaceShaderPicking(shaders, ren, actor);
    publicAPI.replaceShaderClip(shaders, ren, actor);
    publicAPI.replaceShaderCoincidentOffset(shaders, ren, actor);
    publicAPI.replaceShaderPositionVC(shaders, ren, actor);

    if (model.haveSeenDepthRequest) {
      var FSSource = shaders.Fragment;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::ZBuffer::Dec', 'uniform int depthRequest;').result;
      FSSource = vtkShaderProgram.substitute(FSSource, '//VTK::ZBuffer::Impl', ['if (depthRequest == 1) {', 'float iz = floor(gl_FragCoord.z*65535.0 + 0.1);', 'float rf = floor(iz/256.0)/255.0;', 'float gf = mod(iz,256.0)/255.0;', 'gl_FragData[0] = vec4(rf, gf, 0.0, 1.0); }']).result;
      shaders.Fragment = FSSource;
    }
  };

  publicAPI.getNeedToRebuildShaders = function (cellBO, ren, actor) {
    var lightComplexity = 0;
    var numberOfLights = 0;
    var primType = cellBO.getPrimitiveType();
    var poly = model.currentInput; // different algo from C++ as of 5/2019

    var needLighting = false;
    var pointNormals = poly.getPointData().getNormals();
    var cellNormals = poly.getCellData().getNormals();
    var flat = actor.getProperty().getInterpolation() === Shading.FLAT;
    var representation = actor.getProperty().getRepresentation();
    var mode = publicAPI.getOpenGLMode(representation, primType); // 1) all surfaces need lighting

    if (mode === model.context.TRIANGLES) {
      needLighting = true; // 2) all cell normals without point normals need lighting
    } else if (cellNormals && !pointNormals) {
      needLighting = true; // 3) Phong + pointNormals need lighting
    } else if (!flat && pointNormals) {
      needLighting = true; // 4) Phong Lines need lighting
    } else if (!flat && mode === model.context.LINES) {
      needLighting = true;
    } // 5) everything else is unlit
    // do we need lighting?


    if (actor.getProperty().getLighting() && needLighting) {
      // consider the lighting complexity to determine which case applies
      // simple headlight, Light Kit, the whole feature set of VTK
      lightComplexity = 0;
      var lights = ren.getLightsByReference();

      for (var index = 0; index < lights.length; ++index) {
        var light = lights[index];
        var status = light.getSwitch();

        if (status > 0) {
          numberOfLights++;

          if (lightComplexity === 0) {
            lightComplexity = 1;
          }
        }

        if (lightComplexity === 1 && (numberOfLights > 1 || light.getIntensity() !== 1.0 || !light.lightTypeIsHeadLight())) {
          lightComplexity = 2;
        }

        if (lightComplexity < 3 && light.getPositional()) {
          lightComplexity = 3;
        }
      }
    }

    var needRebuild = false;
    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');
    var lastLightCount = model.lastBoundBO.getReferenceByName('lastLightCount');

    if (lastLightComplexity !== lightComplexity || lastLightCount !== numberOfLights) {
      model.lastBoundBO.set({
        lastLightComplexity: lightComplexity
      }, true);
      model.lastBoundBO.set({
        lastLightCount: numberOfLights
      }, true);
      needRebuild = true;
    } // has something changed that would require us to recreate the shader?
    // candidates are
    // property modified (representation interpolation and lighting)
    // input modified
    // light complexity changed


    if (model.lastHaveSeenDepthRequest !== model.haveSeenDepthRequest || cellBO.getProgram() === 0 || cellBO.getShaderSourceTime().getMTime() < publicAPI.getMTime() || cellBO.getShaderSourceTime().getMTime() < actor.getMTime() || cellBO.getShaderSourceTime().getMTime() < model.renderable.getMTime() || cellBO.getShaderSourceTime().getMTime() < model.currentInput.getMTime() || needRebuild) {
      model.lastHaveSeenDepthRequest = model.haveSeenDepthRequest;
      return true;
    }

    return false;
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
    publicAPI.setLightingShaderParameters(cellBO, ren, actor);
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

    if (cellBO.getCABO().getElementCount() && (model.VBOBuildTime.getMTime() > cellBO.getAttributeUpdateTime().getMTime() || cellBO.getShaderSourceTime().getMTime() > cellBO.getAttributeUpdateTime().getMTime())) {
      var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');

      if (cellBO.getProgram().isAttributeUsed('vertexMC')) {
        if (!cellBO.getVAO().addAttributeArray(cellBO.getProgram(), cellBO.getCABO(), 'vertexMC', cellBO.getCABO().getVertexOffset(), cellBO.getCABO().getStride(), model.context.FLOAT, 3, false)) {
          vtkErrorMacro('Error setting vertexMC in shader VAO.');
        }
      }

      if (cellBO.getProgram().isAttributeUsed('normalMC') && cellBO.getCABO().getNormalOffset() && lastLightComplexity > 0) {
        if (!cellBO.getVAO().addAttributeArray(cellBO.getProgram(), cellBO.getCABO(), 'normalMC', cellBO.getCABO().getNormalOffset(), cellBO.getCABO().getStride(), model.context.FLOAT, 3, false)) {
          vtkErrorMacro('Error setting normalMC in shader VAO.');
        }
      } else {
        cellBO.getVAO().removeAttributeArray('normalMC');
      }

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

      if (cellBO.getProgram().isAttributeUsed('scalarColor') && cellBO.getCABO().getColorComponents()) {
        if (!cellBO.getVAO().addAttributeArray(cellBO.getProgram(), cellBO.getCABO().getColorBO(), 'scalarColor', cellBO.getCABO().getColorOffset(), cellBO.getCABO().getColorBOStride(), model.context.UNSIGNED_BYTE, 4, true)) {
          vtkErrorMacro('Error setting scalarColor in shader VAO.');
        }
      } else {
        cellBO.getVAO().removeAttributeArray('scalarColor');
      }

      cellBO.getAttributeUpdateTime().modified();
    }

    if (model.renderable.getNumberOfClippingPlanes()) {
      // add all the clipping planes
      var numClipPlanes = model.renderable.getNumberOfClippingPlanes();
      var planeEquations = [];

      for (var i = 0; i < numClipPlanes; i++) {
        var planeEquation = [];
        model.renderable.getClippingPlaneInDataCoords(actor.getMatrix(), i, planeEquation);

        for (var j = 0; j < 4; j++) {
          planeEquations.push(planeEquation[j]);
        }
      }

      cellBO.getProgram().setUniformi('numClipPlanes', numClipPlanes);
      cellBO.getProgram().setUniform4fv('clipPlanes', planeEquations);
    }

    if (model.internalColorTexture && cellBO.getProgram().isUniformUsed('texture1')) {
      cellBO.getProgram().setUniformi('texture1', model.internalColorTexture.getTextureUnit());
    }

    var tus = model.openGLActor.getActiveTextures();

    if (tus) {
      for (var index = 0; index < tus.length; ++index) {
        var tex = tus[index];
        var texUnit = tex.getTextureUnit();
        var tname = "texture".concat(texUnit + 1);

        if (cellBO.getProgram().isUniformUsed(tname)) {
          cellBO.getProgram().setUniformi(tname, texUnit);
        }
      }
    } // handle depth requests


    if (model.haveSeenDepthRequest) {
      cellBO.getProgram().setUniformi('depthRequest', model.renderDepth ? 1 : 0);
    } // handle coincident


    if (cellBO.getProgram().isUniformUsed('coffset')) {
      var cp = publicAPI.getCoincidentParameters(ren, actor);
      cellBO.getProgram().setUniformf('coffset', cp.offset); // cfactor isn't always used when coffset is.

      if (cellBO.getProgram().isUniformUsed('cfactor')) {
        cellBO.getProgram().setUniformf('cfactor', cp.factor);
      }
    }

    var selector = model.openGLRenderer.getSelector();
    cellBO.getProgram().setUniform3fArray('mapperIndex', selector ? selector.getPropColorValue() : [0.0, 0.0, 0.0]);
    cellBO.getProgram().setUniformi('picking', selector ? selector.getCurrentPass() + 1 : 0);
  };

  publicAPI.setLightingShaderParameters = function (cellBO, ren, actor) {
    // for unlit and headlight there are no lighting parameters
    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');

    if (lastLightComplexity < 2) {
      return;
    }

    var program = cellBO.getProgram(); // bind some light settings

    var numberOfLights = 0;
    var lights = ren.getLightsByReference();

    for (var index = 0; index < lights.length; ++index) {
      var light = lights[index];
      var status = light.getSwitch();

      if (status > 0.0) {
        var dColor = light.getColorByReference();
        var intensity = light.getIntensity();
        model.lightColor[0] = dColor[0] * intensity;
        model.lightColor[1] = dColor[1] * intensity;
        model.lightColor[2] = dColor[2] * intensity; // get required info from light

        var ld = light.getDirection();
        var transform = ren.getActiveCamera().getViewMatrix();

        var newLightDirection = _toConsumableArray(ld);

        if (light.lightTypeIsSceneLight()) {
          newLightDirection[0] = transform[0] * ld[0] + transform[1] * ld[1] + transform[2] * ld[2];
          newLightDirection[1] = transform[4] * ld[0] + transform[5] * ld[1] + transform[6] * ld[2];
          newLightDirection[2] = transform[8] * ld[0] + transform[9] * ld[1] + transform[10] * ld[2];
          normalize(newLightDirection);
        }

        model.lightDirection[0] = newLightDirection[0];
        model.lightDirection[1] = newLightDirection[1];
        model.lightDirection[2] = newLightDirection[2];
        model.lightHalfAngle[0] = -model.lightDirection[0];
        model.lightHalfAngle[1] = -model.lightDirection[1];
        model.lightHalfAngle[2] = -model.lightDirection[2] + 1.0;
        normalize(model.lightDirection);
        program.setUniform3fArray("lightColor".concat(numberOfLights), model.lightColor);
        program.setUniform3fArray("lightDirectionVC".concat(numberOfLights), model.lightDirection);
        program.setUniform3fArray("lightHalfAngleVC".concat(numberOfLights), model.lightHalfAngle);
        numberOfLights++;
      }
    } // we are done unless we have positional lights


    if (lastLightComplexity < 3) {
      return;
    } // for lightkit case there are some parameters to set


    var cam = ren.getActiveCamera();
    var viewTF = cam.getViewMatrix();
    mat4.transpose(viewTF, viewTF);
    numberOfLights = 0;

    for (var _index = 0; _index < lights.length; ++_index) {
      var _light = lights[_index];

      var _status = _light.getSwitch();

      if (_status > 0.0) {
        var lp = _light.getTransformedPosition();

        var np = new Float64Array(3);
        vec3.transformMat4(np, lp, viewTF);
        program.setUniform3fArray("lightAttenuation".concat(numberOfLights), _light.getAttenuationValuesByReference());
        program.setUniformi("lightPositional".concat(numberOfLights), _light.getPositional());
        program.setUniformf("lightExponent".concat(numberOfLights), _light.getExponent());
        program.setUniformf("lightConeAngle".concat(numberOfLights), _light.getConeAngle());
        program.setUniform3fArray("lightPositionVC".concat(numberOfLights), [np[0], np[1], np[2]]);
        numberOfLights++;
      }
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
    var program = cellBO.getProgram(); // [WMVP]C == {world, model, view, projection} coordinates
    // E.g., WCPC == world to projection coordinate transformation

    var keyMats = model.openGLCamera.getKeyMatrices(ren);
    var cam = ren.getActiveCamera();
    var camm = model.openGLCamera.getKeyMatrixTime().getMTime();
    var progm = program.getLastCameraMTime();
    var shiftScaleEnabled = cellBO.getCABO().getCoordShiftAndScaleEnabled();
    var inverseShiftScaleMatrix = shiftScaleEnabled ? cellBO.getCABO().getInverseShiftAndScaleMatrix() : null;
    var actorIsIdentity = actor.getIsIdentity();
    var actMats = actorIsIdentity ? {
      mcwc: null,
      normalMatrix: null
    } : model.openGLActor.getKeyMatrices();
    program.setUniformMatrix('MCPCMatrix', safeMatrixMultiply([keyMats.wcpc, actMats.mcwc, inverseShiftScaleMatrix], mat4, model.tmpMat4));

    if (program.isUniformUsed('MCVCMatrix')) {
      program.setUniformMatrix('MCVCMatrix', safeMatrixMultiply([keyMats.wcvc, actMats.mcwc, inverseShiftScaleMatrix], mat4, model.tmpMat4));
    }

    if (program.isUniformUsed('normalMatrix')) {
      program.setUniformMatrix3x3('normalMatrix', safeMatrixMultiply([keyMats.normalMatrix, actMats.normalMatrix], mat3, model.tmpMat3));
    }

    if (progm !== camm) {
      if (program.isUniformUsed('cameraParallel')) {
        program.setUniformi('cameraParallel', cam.getParallelProjection());
      }

      program.setLastCameraMTime(camm);
    }

    if (!actorIsIdentity) {
      // reset the cam mtime as actor modified the shader values
      program.setLastCameraMTime(0);
    }
  };

  publicAPI.setPropertyShaderParameters = function (cellBO, ren, actor) {
    var program = cellBO.getProgram();
    var ppty = actor.getProperty();
    var opacity = ppty.getOpacity();
    var aColor = model.drawingEdges ? ppty.getEdgeColorByReference() : ppty.getAmbientColorByReference();
    var dColor = model.drawingEdges ? ppty.getEdgeColorByReference() : ppty.getDiffuseColorByReference();
    var aIntensity = model.drawingEdges ? 1.0 : ppty.getAmbient();
    var dIntensity = model.drawingEdges ? 0.0 : ppty.getDiffuse();
    var sIntensity = model.drawingEdges ? 0.0 : ppty.getSpecular();
    var specularPower = ppty.getSpecularPower();
    program.setUniformf('opacityUniform', opacity);
    program.setUniform3fArray('ambientColorUniform', aColor);
    program.setUniform3fArray('diffuseColorUniform', dColor);
    program.setUniformf('ambient', aIntensity);
    program.setUniformf('diffuse', dIntensity); // we are done unless we have lighting

    var lastLightComplexity = model.lastBoundBO.getReferenceByName('lastLightComplexity');

    if (lastLightComplexity < 1) {
      return;
    }

    var sColor = ppty.getSpecularColorByReference();
    program.setUniform3fArray('specularColorUniform', sColor);
    program.setUniformf('specularPowerUniform', specularPower);
    program.setUniformf('specular', sIntensity); // now set the backface properties if we have them

    if (program.isUniformUsed('ambientIntensityBF')) {
      ppty = actor.getBackfaceProperty();
      opacity = ppty.getOpacity();
      aColor = ppty.getAmbientColor();
      aIntensity = ppty.getAmbient();
      dColor = ppty.getDiffuseColor();
      dIntensity = ppty.getDiffuse();
      sColor = ppty.getSpecularColor();
      sIntensity = ppty.getSpecular();
      program.setUniformf('ambientIntensityBF', aIntensity);
      program.setUniformf('diffuseIntensityBF', dIntensity);
      program.setUniformf('opacityUniformBF', opacity);
      program.setUniform3fArray('ambientColorUniformBF', aColor);
      program.setUniform3fArray('diffuseColorUniformBF', dColor); // we are done unless we have lighting

      if (lastLightComplexity < 1) {
        return;
      }

      program.setUniformf('specularIntensityBF', sIntensity);
      program.setUniform3fArray('specularColorUniformBF', sColor);
      program.setUniformf('specularPowerUniformBF', specularPower);
    }
  };

  publicAPI.renderPieceStart = function (ren, actor) {
    model.primitiveIDOffset = 0;

    if (model.openGLRenderer.getSelector()) {
      switch (model.openGLRenderer.getSelector().getCurrentPass()) {
        default:
          model.openGLRenderer.getSelector().renderProp(actor);
      }
    } // make sure the BOs are up to date


    publicAPI.updateBufferObjects(ren, actor); // If we are coloring by texture, then load the texture map.
    // Use Map as indicator, because texture hangs around.

    if (model.renderable.getColorTextureMap()) {
      model.internalColorTexture.activate();
    } // Bind the OpenGL, this is shared between the different primitive/cell types.


    model.lastBoundBO = null;
  };

  publicAPI.renderPieceDraw = function (ren, actor) {
    var representation = actor.getProperty().getRepresentation();
    var gl = model.context;
    var drawSurfaceWithEdges = actor.getProperty().getEdgeVisibility() && representation === Representation.SURFACE;
    gl.lineWidth(actor.getProperty().getLineWidth()); // for every primitive type

    for (var i = primTypes.Start; i < primTypes.End; i++) {
      // if there are entries
      var cabo = model.primitives[i].getCABO();

      if (cabo.getElementCount()) {
        // are we drawing edges
        model.drawingEdges = drawSurfaceWithEdges && (i === primTypes.TrisEdges || i === primTypes.TriStripsEdges);
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

  publicAPI.getOpenGLMode = function (rep, type) {
    if (rep === Representation.POINTS || type === primTypes.Points) {
      return model.context.POINTS;
    }

    if (rep === Representation.WIREFRAME || type === primTypes.Lines || type === primTypes.TrisEdges || type === primTypes.TriStripsEdges) {
      return model.context.LINES;
    }

    return model.context.TRIANGLES;
  };

  publicAPI.renderPieceFinish = function (ren, actor) {
    if (model.LastBoundBO) {
      model.LastBoundBO.getVAO().release();
    }

    if (model.renderable.getColorTextureMap()) {
      model.internalColorTexture.deactivate();
    }
  };

  publicAPI.renderPiece = function (ren, actor) {
    // Make sure that we have been properly initialized.
    // if (ren.getRenderWindow().checkAbortStatus()) {
    //   return;
    // }
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
    } // apply faceCulling


    var gl = model.context;
    var backfaceCulling = actor.getProperty().getBackfaceCulling();
    var frontfaceCulling = actor.getProperty().getFrontfaceCulling();

    if (!backfaceCulling && !frontfaceCulling) {
      model.openGLRenderWindow.disableCullFace();
    } else if (frontfaceCulling) {
      model.openGLRenderWindow.enableCullFace();
      gl.cullFace(gl.FRONT);
    } else {
      model.openGLRenderWindow.enableCullFace();
      gl.cullFace(gl.BACK);
    }

    publicAPI.renderPieceStart(ren, actor);
    publicAPI.renderPieceDraw(ren, actor);
    publicAPI.renderPieceFinish(ren, actor);
  };

  publicAPI.computeBounds = function (ren, actor) {
    if (!publicAPI.getInput()) {
      uninitializeBounds(model.bounds);
      return;
    }

    model.bounds = publicAPI.getInput().getBounds();
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

    if (vmtime < publicAPI.getMTime() || vmtime < model.renderable.getMTime() || vmtime < actor.getMTime() || vmtime < model.currentInput.getMTime()) {
      return true;
    }

    return false;
  };

  publicAPI.buildBufferObjects = function (ren, actor) {
    var poly = model.currentInput;

    if (poly === null) {
      return;
    }

    model.renderable.mapScalars(poly, 1.0);
    var c = model.renderable.getColorMapColors();
    model.haveCellScalars = false;
    var scalarMode = model.renderable.getScalarMode();

    if (model.renderable.getScalarVisibility()) {
      // We must figure out how the scalars should be mapped to the polydata.
      if ((scalarMode === ScalarMode.USE_CELL_DATA || scalarMode === ScalarMode.USE_CELL_FIELD_DATA || scalarMode === ScalarMode.USE_FIELD_DATA || !poly.getPointData().getScalars()) && scalarMode !== ScalarMode.USE_POINT_FIELD_DATA && c) {
        model.haveCellScalars = true;
      }
    } // Do we have normals?


    var n = actor.getProperty().getInterpolation() !== Shading.FLAT ? poly.getPointData().getNormals() : null;

    if (n === null && poly.getCellData().getNormals()) {
      model.haveCellNormals = true;
      n = poly.getCellData().getNormals();
    } // rebuild the VBO if the data has changed we create a string for the VBO what
    // can change the VBO? points normals tcoords colors so what can change those?
    // the input data is clearly one as it can change all four items tcoords may
    // haveTextures or not colors may change based on quite a few mapping
    // parameters in the mapper


    var representation = actor.getProperty().getRepresentation();
    var tcoords = poly.getPointData().getTCoords();

    if (!model.openGLActor.getActiveTextures()) {
      tcoords = null;
    } // handle color mapping via texture


    if (model.renderable.getColorCoordinates()) {
      tcoords = model.renderable.getColorCoordinates();

      if (!model.internalColorTexture) {
        model.internalColorTexture = vtkOpenGLTexture.newInstance();
      }

      var tex = model.internalColorTexture; // the following 4 lines allow for NPOT textures

      tex.setMinificationFilter(Filter.NEAREST);
      tex.setMagnificationFilter(Filter.NEAREST);
      tex.setWrapS(Wrap.CLAMP_TO_EDGE);
      tex.setWrapT(Wrap.CLAMP_TO_EDGE);
      tex.setOpenGLRenderWindow(model.openGLRenderWindow);
      var input = model.renderable.getColorTextureMap();
      var ext = input.getExtent();
      var inScalars = input.getPointData().getScalars();
      tex.create2DFromRaw(ext[1] - ext[0] + 1, ext[3] - ext[2] + 1, inScalars.getNumberOfComponents(), inScalars.getDataType(), inScalars.getData());
      tex.activate();
      tex.sendParameters();
      tex.deactivate();
    }

    var toString = "".concat(poly.getMTime(), "A").concat(representation, "B").concat(poly.getMTime()) + "C".concat(n ? n.getMTime() : 1, "D").concat(c ? c.getMTime() : 1) + "E".concat(actor.getProperty().getEdgeVisibility()) + "F".concat(tcoords ? tcoords.getMTime() : 1);

    if (model.VBOBuildString !== toString) {
      // Build the VBOs
      var points = poly.getPoints();
      var options = {
        points: points,
        normals: n,
        tcoords: tcoords,
        colors: c,
        cellOffset: 0,
        haveCellScalars: model.haveCellScalars,
        haveCellNormals: model.haveCellNormals,
        customAttributes: model.renderable.getCustomShaderAttributes().map(function (arrayName) {
          return poly.getPointData().getArrayByName(arrayName);
        })
      };
      options.cellOffset += model.primitives[primTypes.Points].getCABO().createVBO(poly.getVerts(), 'verts', representation, options);
      options.cellOffset += model.primitives[primTypes.Lines].getCABO().createVBO(poly.getLines(), 'lines', representation, options);
      options.cellOffset += model.primitives[primTypes.Tris].getCABO().createVBO(poly.getPolys(), 'polys', representation, options);
      options.cellOffset += model.primitives[primTypes.TriStrips].getCABO().createVBO(poly.getStrips(), 'strips', representation, options);
      var drawSurfaceWithEdges = actor.getProperty().getEdgeVisibility() && representation === Representation.SURFACE; // if we have edge visibility build the edge VBOs

      if (drawSurfaceWithEdges) {
        model.primitives[primTypes.TrisEdges].getCABO().createVBO(poly.getPolys(), 'polys', Representation.WIREFRAME, {
          points: points,
          normals: n,
          tcoords: null,
          colors: null,
          cellOffset: 0,
          haveCellScalars: false,
          haveCellNormals: false
        });
        model.primitives[primTypes.TriStripsEdges].getCABO().createVBO(poly.getStrips(), 'strips', Representation.WIREFRAME, {
          points: points,
          normals: n,
          tcoords: null,
          colors: null,
          cellOffset: 0,
          haveCellScalars: false,
          haveCellNormals: false
        });
      } else {
        // otherwise free them
        model.primitives[primTypes.TrisEdges].releaseGraphicsResources(model.openGLRenderWindow);
        model.primitives[primTypes.TriStripsEdges].releaseGraphicsResources(model.openGLRenderWindow);
      }

      model.VBOBuildTime.modified();
      model.VBOBuildString = toString;
    }
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
  shaderRebuildString: null,
  tmpMat4: null,
  ambientColor: [],
  // used internally
  diffuseColor: [],
  // used internally
  specularColor: [],
  // used internally
  lightColor: [],
  // used internally
  lightHalfAngle: [],
  // used internally
  lightDirection: [],
  // used internally
  lastHaveSeenDepthRequest: false,
  haveSeenDepthRequest: false
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkViewNode.extend(publicAPI, model, initialValues);
  vtkReplacementShaderMapper.implementReplaceShaderCoincidentOffset(publicAPI, model, initialValues);
  model.primitives = [];
  model.primTypes = primTypes;
  model.tmpMat3 = mat3.identity(new Float64Array(9));
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

  vtkOpenGLPolyDataMapper(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = newInstance$1(extend, 'vtkOpenGLPolyDataMapper'); // ----------------------------------------------------------------------------

var vtkOpenGLPolyDataMapper$1 = {
  newInstance: newInstance,
  extend: extend,
  primTypes: primTypes
}; // Register ourself to OpenGL backend if imported

registerOverride('vtkMapper', newInstance);

export { vtkOpenGLPolyDataMapper$1 as default, extend, newInstance, primTypes };
