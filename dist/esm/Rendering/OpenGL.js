import vtkActor from './OpenGL/Actor.js';
import vtkActor2D from './OpenGL/Actor2D.js';
import vtkBufferObject from './OpenGL/BufferObject.js';
import vtkCamera from './OpenGL/Camera.js';
import vtkCellArrayBufferObject from './OpenGL/CellArrayBufferObject.js';
import vtkConvolution2DPass from './OpenGL/Convolution2DPass.js';
import vtkForwardPass from './OpenGL/ForwardPass.js';
import vtkOpenGLFramebuffer from './OpenGL/Framebuffer.js';
import vtkGlyph3DMapper from './OpenGL/Glyph3DMapper.js';
import vtkHardwareSelector from './OpenGL/HardwareSelector.js';
import vtkHelper from './OpenGL/Helper.js';
import vtkImageMapper from './OpenGL/ImageMapper.js';
import vtkImageSlice from './OpenGL/ImageSlice.js';
import vtkPixelSpaceCallbackMapper from './OpenGL/PixelSpaceCallbackMapper.js';
import vtkOpenGLPolyDataMapper from './OpenGL/PolyDataMapper.js';
import vtkPolyDataMapper2D from './OpenGL/PolyDataMapper2D.js';
import vtkRenderer from './OpenGL/Renderer.js';
import vtkRenderWindow from './OpenGL/RenderWindow.js';
import vtkShader from './OpenGL/Shader.js';
import vtkShaderCache from './OpenGL/ShaderCache.js';
import vtkShaderProgram from './OpenGL/ShaderProgram.js';
import vtkSkybox from './OpenGL/Skybox.js';
import vtkSphereMapper from './OpenGL/SphereMapper.js';
import vtkStickMapper from './OpenGL/StickMapper.js';
import vtkOpenGLTexture from './OpenGL/Texture.js';
import vtkTextureUnitManager from './OpenGL/TextureUnitManager.js';
import vtkVertexArrayObject from './OpenGL/VertexArrayObject.js';
import vtkViewNodeFactory from './OpenGL/ViewNodeFactory.js';
import vtkVolume from './OpenGL/Volume.js';
import vtkVolumeMapper from './OpenGL/VolumeMapper.js';

var OpenGL = {
  vtkActor: vtkActor,
  vtkActor2D: vtkActor2D,
  vtkBufferObject: vtkBufferObject,
  vtkCamera: vtkCamera,
  vtkCellArrayBufferObject: vtkCellArrayBufferObject,
  vtkConvolution2DPass: vtkConvolution2DPass,
  vtkForwardPass: vtkForwardPass,
  vtkFramebuffer: vtkOpenGLFramebuffer,
  vtkGlyph3DMapper: vtkGlyph3DMapper,
  vtkHardwareSelector: vtkHardwareSelector,
  vtkHelper: vtkHelper,
  vtkImageMapper: vtkImageMapper,
  vtkImageSlice: vtkImageSlice,
  vtkPixelSpaceCallbackMapper: vtkPixelSpaceCallbackMapper,
  vtkPolyDataMapper: vtkOpenGLPolyDataMapper,
  vtkPolyDataMapper2D: vtkPolyDataMapper2D,
  vtkRenderer: vtkRenderer,
  vtkRenderWindow: vtkRenderWindow,
  vtkShader: vtkShader,
  vtkShaderCache: vtkShaderCache,
  vtkShaderProgram: vtkShaderProgram,
  vtkSkybox: vtkSkybox,
  vtkSphereMapper: vtkSphereMapper,
  vtkStickMapper: vtkStickMapper,
  vtkTexture: vtkOpenGLTexture,
  vtkTextureUnitManager: vtkTextureUnitManager,
  vtkVertexArrayObject: vtkVertexArrayObject,
  vtkViewNodeFactory: vtkViewNodeFactory,
  vtkVolume: vtkVolume,
  vtkVolumeMapper: vtkVolumeMapper
};

export { OpenGL as default };
