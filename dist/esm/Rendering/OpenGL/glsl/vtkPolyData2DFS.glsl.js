var vtkPolyData2DFS = "//VTK::System::Dec\n\n/*=========================================================================\n\n  Program:   Visualization Toolkit\n  Module:    vtkPolyData2DFS.glsl\n\n  Copyright (c) Ken Martin, Will Schroeder, Bill Lorensen\n  All rights reserved.\n  See Copyright.txt or http://www.kitware.com/Copyright.htm for details.\n\n     This software is distributed WITHOUT ANY WARRANTY; without even\n     the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR\n     PURPOSE.  See the above copyright notice for more information.\n\n=========================================================================*/\n\nuniform int PrimitiveIDOffset;\n\n// Texture coordinates\n//VTK::TCoord::Dec\n\n// Scalar coloring\n//VTK::Color::Dec\n\n// Depth Peeling\n//VTK::DepthPeeling::Dec\n\n// picking support\n//VTK::Picking::Dec\n\n// the output of this shader\n//VTK::Output::Dec\n\n// Apple Bug\n//VTK::PrimID::Dec\n\nvoid main()\n{\n  // Apple Bug\n  //VTK::PrimID::Impl\n\n  //VTK::Color::Impl\n  //VTK::TCoord::Impl\n\n  //VTK::DepthPeeling::Impl\n  //VTK::Picking::Impl\n\n  if (gl_FragData[0].a <= 0.0)\n    {\n    discard;\n    }\n}\n";

export { vtkPolyData2DFS as v };
