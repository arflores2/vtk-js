import macro from '../../macros.js';
import vtkImageData from './ImageData.js';
import vtkDataArray from '../Core/DataArray.js';

var vtkErrorMacro = macro.vtkErrorMacro; // see itk.js PixelTypes.js

var ITKJSPixelTypes = {
  Unknown: 0,
  Scalar: 1,
  RGB: 2,
  RGBA: 3,
  Offset: 4,
  Vector: 5,
  Point: 6,
  CovariantVector: 7,
  SymmetricSecondRankTensor: 8,
  DiffusionTensor3D: 9,
  Complex: 10,
  FixedArray: 11,
  Array: 12,
  Matrix: 13,
  VariableLengthVector: 14,
  VariableSizeMatrix: 15
}; // itk-wasm pixel types from https://github.com/InsightSoftwareConsortium/itk-wasm/blob/master/src/core/PixelTypes.ts

var ITKWASMPixelTypes = {
  Unknown: 'Unknown',
  Scalar: 'Scalar',
  RGB: 'RGB',
  RGBA: 'RGBA',
  Offset: 'Offset',
  Vector: 'Vector',
  Point: 'Point',
  CovariantVector: 'CovariantVector',
  SymmetricSecondRankTensor: 'SymmetricSecondRankTensor',
  DiffusionTensor3D: 'DiffusionTensor3D',
  Complex: 'Complex',
  FixedArray: 'FixedArray',
  Array: 'Array',
  Matrix: 'Matrix',
  VariableLengthVector: 'VariableLengthVector',
  VariableSizeMatrix: 'VariableSizeMatrix'
};
/**
 * Converts an itk.js image to a vtk.js image.
 *
 * Requires an itk.js image as input.
 */

function convertItkToVtkImage(itkImage) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var vtkImage = {
    origin: [0, 0, 0],
    spacing: [1, 1, 1]
  };
  var dimensions = [1, 1, 1];
  var direction = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // Check whether itkImage is an itk.js Image or an itk-wasm Image?

  var isITKWasm = itkImage.direction.data === undefined;
  var ITKPixelTypes = isITKWasm ? ITKWASMPixelTypes : ITKJSPixelTypes;

  for (var idx = 0; idx < itkImage.imageType.dimension; ++idx) {
    vtkImage.origin[idx] = itkImage.origin[idx];
    vtkImage.spacing[idx] = itkImage.spacing[idx];
    dimensions[idx] = itkImage.size[idx];

    for (var col = 0; col < itkImage.imageType.dimension; ++col) {
      // ITK (and VTKMath) use a row-major index axis, but the direction
      // matrix on the vtkImageData is a webGL matrix, which uses a
      // column-major data layout. Transpose the direction matrix from
      // itkImage when instantiating that vtkImageData direction matrix.
      if (isITKWasm) {
        direction[col + idx * 3] = itkImage.direction[idx + col * itkImage.imageType.dimension];
      } else {
        direction[col + idx * 3] = itkImage.direction.data[idx + col * itkImage.imageType.dimension];
      }
    }
  } // Create VTK Image Data


  var imageData = vtkImageData.newInstance(vtkImage); // Create VTK point data -- the data associated with the pixels / voxels

  var pointData = vtkDataArray.newInstance({
    name: options.scalarArrayName || 'Scalars',
    values: itkImage.data,
    numberOfComponents: itkImage.imageType.components
  });
  imageData.setDirection(direction);
  imageData.setDimensions.apply(imageData, dimensions); // Always associate multi-component pixel types with vtk.js point data
  // scalars to facilitate multi-component volume rendering

  imageData.getPointData().setScalars(pointData); // Associate the point data that are 3D vectors / tensors
  // Refer to itk-js/src/PixelTypes.js for numerical values

  switch (ITKPixelTypes[itkImage.imageType.pixelType]) {
    case ITKPixelTypes.Scalar:
      break;

    case ITKPixelTypes.RGB:
      break;

    case ITKPixelTypes.RGBA:
      break;

    case ITKPixelTypes.Offset:
      break;

    case ITKPixelTypes.Vector:
      if (itkImage.imageType.dimension === 3 && itkImage.imageType.components === 3) {
        imageData.getPointData().setVectors(pointData);
      }

      break;

    case ITKPixelTypes.Point:
      break;

    case ITKPixelTypes.CovariantVector:
      if (itkImage.imageType.dimension === 3 && itkImage.imageType.components === 3) {
        imageData.getPointData().setVectors(pointData);
      }

      break;

    case ITKPixelTypes.SymmetricSecondRankTensor:
      if (itkImage.imageType.dimension === 3 && itkImage.imageType.components === 6) {
        imageData.getPointData().setTensors(pointData);
      }

      break;

    case ITKPixelTypes.DiffusionTensor3D:
      if (itkImage.imageType.dimension === 3 && itkImage.imageType.components === 6) {
        imageData.getPointData().setTensors(pointData);
      }

      break;

    case ITKPixelTypes.Complex:
      break;

    case ITKPixelTypes.FixedArray:
      break;

    case ITKPixelTypes.Array:
      break;

    case ITKPixelTypes.Matrix:
      break;

    case ITKPixelTypes.VariableLengthVector:
      break;

    case ITKPixelTypes.VariableSizeMatrix:
      break;

    default:
      vtkErrorMacro("Cannot handle unexpected ITK.js pixel type ".concat(itkImage.imageType.pixelType));
      return null;
  }

  return imageData;
}

var vtkArrayTypeToItkComponentType = new Map([['Uint8Array', 'uint8_t'], ['Int8Array', 'int8_t'], ['Uint16Array', 'uint16_t'], ['Int16Array', 'int16_t'], ['Uint32Array', 'uint32_t'], ['Int32Array', 'int32_t'], ['Float32Array', 'float'], ['Float64Array', 'double']]);
/**
 * Converts a vtk.js image to an itk.js image.
 *
 * Requires a vtk.js image as input.
 */

function convertVtkToItkImage(vtkImage) {
  var copyData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var itkImage = {
    imageType: {
      dimension: 3,
      pixelType: ITKJSPixelTypes.Scalar,
      componentType: '',
      components: 1
    },
    name: 'name',
    origin: vtkImage.getOrigin(),
    spacing: vtkImage.getSpacing(),
    direction: {
      data: [1, 0, 0, 0, 1, 0, 0, 0, 1]
    },
    size: vtkImage.getDimensions()
  };
  var direction = vtkImage.getDirection();
  var dimension = itkImage.size.length;
  itkImage.imageType.dimension = dimension;
  itkImage.direction.rows = dimension;
  itkImage.direction.columns = dimension; // Transpose the direction matrix from column-major to row-major

  for (var idx = 0; idx < dimension; ++idx) {
    for (var idy = 0; idy < dimension; ++idy) {
      itkImage.direction.data[idx + idy * dimension] = direction[idy + idx * dimension];
    }
  }

  var pointData = vtkImage.getPointData();
  var vtkArray;

  if (pointData.getTensors() !== null) {
    itkImage.imageType.pixelType = ITKJSPixelTypes.DiffusionTensor3D;
    vtkArray = pointData.getTensors();
  } else if (pointData.getVectors() != null) {
    itkImage.imageType.pixelType = ITKJSPixelTypes.Vector;
    vtkArray = pointData.getVectors();
  } else {
    vtkArray = pointData.getScalars();
  }

  itkImage.imageType.componentType = vtkArrayTypeToItkComponentType.get(vtkArray.getDataType());

  if (copyData) {
    // Copy the data array
    itkImage.data = vtkArray.getData().slice(0);
  } else {
    itkImage.data = vtkArray.getData();
  }

  return itkImage;
}

var ITKHelper = {
  convertItkToVtkImage: convertItkToVtkImage,
  convertVtkToItkImage: convertVtkToItkImage
};

export { ITKHelper as default };
