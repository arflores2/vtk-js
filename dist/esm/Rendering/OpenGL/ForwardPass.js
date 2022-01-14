import macro from '../../macros.js';
import vtkOpenGLFramebuffer from './Framebuffer.js';
import vtkRenderPass from '../SceneGraph/RenderPass.js';

function vtkForwardPass(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkForwardPass'); // this pass implements a forward rendering pipeline
  // if both volumes and opaque geometry are present
  // it will mix the two together by capturing a zbuffer
  // first

  publicAPI.traverse = function (viewNode) {
    var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    if (model.deleted) {
      return;
    } // we just render our delegates in order


    model.currentParent = parent; // build

    publicAPI.setCurrentOperation('buildPass');
    viewNode.traverse(publicAPI);
    var numlayers = viewNode.getRenderable().getNumberOfLayers(); // iterate over renderers

    var renderers = viewNode.getChildren();

    for (var i = 0; i < numlayers; i++) {
      for (var index = 0; index < renderers.length; index++) {
        var renNode = renderers[index];
        var ren = viewNode.getRenderable().getRenderers()[index];

        if (ren.getDraw() && ren.getLayer() === i) {
          // check for both opaque and volume actors
          model.opaqueActorCount = 0;
          model.translucentActorCount = 0;
          model.volumeCount = 0;
          model.overlayActorCount = 0;
          publicAPI.setCurrentOperation('queryPass');
          renNode.traverse(publicAPI); // do we need to capture a zbuffer?

          if (model.opaqueActorCount > 0 && model.volumeCount > 0 || model.depthRequested) {
            var size = viewNode.getFramebufferSize(); // make sure the framebuffer is setup

            if (model.framebuffer === null) {
              model.framebuffer = vtkOpenGLFramebuffer.newInstance();
            }

            model.framebuffer.setOpenGLRenderWindow(viewNode);
            model.framebuffer.saveCurrentBindingsAndBuffers();
            var fbSize = model.framebuffer.getSize();

            if (fbSize === null || fbSize[0] !== size[0] || fbSize[1] !== size[1]) {
              model.framebuffer.create(size[0], size[1]);
              model.framebuffer.populateFramebuffer();
            }

            model.framebuffer.bind();
            publicAPI.setCurrentOperation('opaqueZBufferPass');
            renNode.traverse(publicAPI);
            model.framebuffer.restorePreviousBindingsAndBuffers(); // reset now that we have done it

            model.depthRequested = false;
          }

          publicAPI.setCurrentOperation('cameraPass');
          renNode.traverse(publicAPI);

          if (model.opaqueActorCount > 0) {
            publicAPI.setCurrentOperation('opaquePass');
            renNode.traverse(publicAPI);
          }

          if (model.translucentActorCount > 0) {
            publicAPI.setCurrentOperation('translucentPass');
            renNode.traverse(publicAPI);
          }

          if (model.volumeCount > 0) {
            publicAPI.setCurrentOperation('volumePass');
            renNode.traverse(publicAPI);
          }

          if (model.overlayActorCount > 0) {
            publicAPI.setCurrentOperation('overlayPass');
            renNode.traverse(publicAPI);
          }
        }
      }
    }
  };

  publicAPI.getZBufferTexture = function () {
    if (model.framebuffer) {
      return model.framebuffer.getColorTexture();
    }

    return null;
  };

  publicAPI.requestDepth = function () {
    model.depthRequested = true;
  };

  publicAPI.incrementOpaqueActorCount = function () {
    return model.opaqueActorCount++;
  };

  publicAPI.incrementTranslucentActorCount = function () {
    return model.translucentActorCount++;
  };

  publicAPI.incrementVolumeCount = function () {
    return model.volumeCount++;
  };

  publicAPI.incrementOverlayActorCount = function () {
    return model.overlayActorCount++;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  opaqueActorCount: 0,
  translucentActorCount: 0,
  volumeCount: 0,
  overlayActorCount: 0,
  framebuffer: null,
  depthRequested: false
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Build VTK API

  vtkRenderPass.extend(publicAPI, model, initialValues);
  macro.get(publicAPI, model, ['framebuffer']); // Object methods

  vtkForwardPass(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkForwardPass'); // ----------------------------------------------------------------------------

var vtkForwardPass$1 = {
  newInstance: newInstance,
  extend: extend
};

export { vtkForwardPass$1 as default, extend, newInstance };
