import _defineProperty from '@babel/runtime/helpers/defineProperty';
import vtkColorMaps from './Core/ColorTransferFunction/ColorMaps.js';
import vtkAbstractMapper from './Core/AbstractMapper.js';
import vtkAbstractMapper3D from './Core/AbstractMapper3D.js';
import vtkAbstractPicker from './Core/AbstractPicker.js';
import vtkActor from './Core/Actor.js';
import vtkActor2D from './Core/Actor2D.js';
import vtkAnnotatedCubeActor from './Core/AnnotatedCubeActor.js';
import vtkAxesActor from './Core/AxesActor.js';
import vtkCamera from './Core/Camera.js';
import vtkCellPicker from './Core/CellPicker.js';
import vtkColorTransferFunction from './Core/ColorTransferFunction.js';
import vtkCoordinate from './Core/Coordinate.js';
import vtkCubeAxesActor from './Core/CubeAxesActor.js';
import vtkFollower from './Core/Follower.js';
import vtkGlyph3DMapper from './Core/Glyph3DMapper.js';
import vtkHardwareSelector from './Core/HardwareSelector.js';
import vtkImageMapper from './Core/ImageMapper.js';
import vtkImageProperty from './Core/ImageProperty.js';
import vtkImageSlice from './Core/ImageSlice.js';
import vtkInteractorObserver from './Core/InteractorObserver.js';
import vtkInteractorStyle from './Core/InteractorStyle.js';
import vtkLight from './Core/Light.js';
import vtkMapper from './Core/Mapper.js';
import vtkMapper2D from './Core/Mapper2D.js';
import vtkPicker from './Core/Picker.js';
import vtkPixelSpaceCallbackMapper from './Core/PixelSpaceCallbackMapper.js';
import vtkPointPicker from './Core/PointPicker.js';
import vtkProp from './Core/Prop.js';
import vtkProp3D from './Core/Prop3D.js';
import vtkProperty from './Core/Property.js';
import vtkProperty2D from './Core/Property2D.js';
import vtkRenderer from './Core/Renderer.js';
import vtkRenderWindow from './Core/RenderWindow.js';
import vtkRenderWindowInteractor from './Core/RenderWindowInteractor.js';
import vtkScalarBarActor from './Core/ScalarBarActor.js';
import vtkSkybox from './Core/Skybox.js';
import vtkSphereMapper from './Core/SphereMapper.js';
import vtkStickMapper from './Core/StickMapper.js';
import vtkTexture from './Core/Texture.js';
import vtkViewport from './Core/Viewport.js';
import vtkVolume from './Core/Volume.js';
import vtkVolumeMapper from './Core/VolumeMapper.js';
import vtkVolumeProperty from './Core/VolumeProperty.js';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var Core = {
  vtkAbstractMapper: vtkAbstractMapper,
  vtkAbstractMapper3D: vtkAbstractMapper3D,
  vtkAbstractPicker: vtkAbstractPicker,
  vtkActor: vtkActor,
  vtkActor2D: vtkActor2D,
  vtkAnnotatedCubeActor: vtkAnnotatedCubeActor,
  vtkAxesActor: vtkAxesActor,
  vtkCamera: vtkCamera,
  vtkCellPicker: vtkCellPicker,
  vtkColorTransferFunction: _objectSpread({
    vtkColorMaps: vtkColorMaps
  }, vtkColorTransferFunction),
  vtkCoordinate: vtkCoordinate,
  vtkCubeAxesActor: vtkCubeAxesActor,
  vtkFollower: vtkFollower,
  vtkGlyph3DMapper: vtkGlyph3DMapper,
  vtkHardwareSelector: vtkHardwareSelector,
  vtkImageMapper: vtkImageMapper,
  vtkImageProperty: vtkImageProperty,
  vtkImageSlice: vtkImageSlice,
  vtkInteractorObserver: vtkInteractorObserver,
  vtkInteractorStyle: vtkInteractorStyle,
  vtkLight: vtkLight,
  vtkMapper: vtkMapper,
  vtkMapper2D: vtkMapper2D,
  vtkPicker: vtkPicker,
  vtkPixelSpaceCallbackMapper: vtkPixelSpaceCallbackMapper,
  vtkPointPicker: vtkPointPicker,
  vtkProp: vtkProp,
  vtkProp3D: vtkProp3D,
  vtkProperty: vtkProperty,
  vtkProperty2D: vtkProperty2D,
  vtkRenderer: vtkRenderer,
  vtkRenderWindow: vtkRenderWindow,
  vtkRenderWindowInteractor: vtkRenderWindowInteractor,
  vtkScalarBarActor: vtkScalarBarActor,
  vtkSkybox: vtkSkybox,
  vtkSphereMapper: vtkSphereMapper,
  vtkStickMapper: vtkStickMapper,
  vtkTexture: vtkTexture,
  vtkViewport: vtkViewport,
  vtkVolume: vtkVolume,
  vtkVolumeMapper: vtkVolumeMapper,
  vtkVolumeProperty: vtkVolumeProperty
};

export { Core as default };
