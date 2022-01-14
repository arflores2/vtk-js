import { newInstance as newInstance$1, setGet, get } from '../../macros.js';
import vtkViewNode from '../SceneGraph/ViewNode.js';
import { registerOverride } from './ViewNodeFactory.js';

// vtkOpenGLActor methods
// ----------------------------------------------------------------------------

function vtkOpenGLActor2D(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkOpenGLActor2D'); // Builds myself.

  publicAPI.buildPass = function (prepass) {
    if (prepass) {
      if (!model.renderable) {
        return;
      }

      model.openGLRenderWindow = publicAPI.getFirstAncestorOfType('vtkOpenGLRenderWindow');
      model.openGLRenderer = publicAPI.getFirstAncestorOfType('vtkOpenGLRenderer');
      model.context = model.openGLRenderWindow.getContext();
      publicAPI.prepareNodes();
      publicAPI.addMissingNodes(model.renderable.getTextures());
      publicAPI.addMissingNode(model.renderable.getMapper());
      publicAPI.removeUnusedNodes(); // we store textures and mapper

      model.ogltextures = null;
      model.activeTextures = null;

      for (var index = 0; index < model.children.length; index++) {
        var child = model.children[index];

        if (child.isA('vtkOpenGLTexture')) {
          if (!model.ogltextures) {
            model.ogltextures = [];
          }

          model.ogltextures.push(child);
        } else {
          model.oglmapper = child;
        }
      }
    }
  };

  publicAPI.queryPass = function (prepass, renderPass) {
    if (prepass) {
      if (!model.renderable || !model.renderable.getVisibility()) {
        return;
      }

      renderPass.incrementOverlayActorCount();
    }
  }; // we draw textures, then mapper, then post pass textures


  publicAPI.traverseOpaquePass = function (renderPass) {
    if (!model.oglmapper || !model.renderable || !model.renderable.getNestedVisibility() || !model.renderable.getIsOpaque() || model.openGLRenderer.getSelector() && !model.renderable.getNestedPickable()) {
      return;
    }

    publicAPI.apply(renderPass, true);
    model.oglmapper.traverse(renderPass);
    publicAPI.apply(renderPass, false);
  }; // we draw textures, then mapper, then post pass textures


  publicAPI.traverseTranslucentPass = function (renderPass) {
    if (!model.oglmapper || !model.renderable || !model.renderable.getNestedVisibility() || model.renderable.getIsOpaque() || model.openGLRenderer.getSelector() && !model.renderable.getNestedPickable()) {
      return;
    }

    publicAPI.apply(renderPass, true);
    model.oglmapper.traverse(renderPass);
    publicAPI.apply(renderPass, false);
  };

  publicAPI.traverseOverlayPass = function (renderPass) {
    if (!model.oglmapper || !model.renderable || !model.renderable.getNestedVisibility() || model.openGLRenderer.getSelector() && !model.renderable.getNestedPickable) {
      return;
    }

    publicAPI.apply(renderPass, true);
    model.oglmapper.traverse(renderPass);
    publicAPI.apply(renderPass, false);
  };

  publicAPI.activateTextures = function () {
    // always traverse textures first, then mapper
    if (!model.ogltextures) {
      return;
    }

    model.activeTextures = [];

    for (var index = 0; index < model.ogltextures.length; index++) {
      var child = model.ogltextures[index];
      child.render();

      if (child.getHandle()) {
        model.activeTextures.push(child);
      }
    }
  }; // Renders myself


  publicAPI.opaquePass = function (prepass, renderPass) {
    if (prepass) {
      model.context.depthMask(true);
      publicAPI.activateTextures();
    } else if (model.activeTextures) {
      // deactivate textures
      for (var index = 0; index < model.activeTextures.length; index++) {
        model.activeTextures[index].deactivate();
      }
    }
  }; // Renders myself


  publicAPI.translucentPass = function (prepass, renderPass) {
    if (prepass) {
      model.context.depthMask(false);
      publicAPI.activateTextures();
    } else if (model.activeTextures) {
      for (var index = 0; index < model.activeTextures.length; index++) {
        model.activeTextures[index].deactivate();
      }
    }
  }; // Renders myself


  publicAPI.overlayPass = function (prepass, renderPass) {
    if (prepass) {
      model.context.depthMask(true);
      publicAPI.activateTextures();
    } else if (model.activeTextures) {
      // deactivate textures
      for (var index = 0; index < model.activeTextures.length; index++) {
        model.activeTextures[index].deactivate();
      }
    }
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------


var DEFAULT_VALUES = {
  context: null,
  activeTextures: null
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkViewNode.extend(publicAPI, model, initialValues); // Build VTK API

  setGet(publicAPI, model, ['context']);
  get(publicAPI, model, ['activeTextures']); // Object methods

  vtkOpenGLActor2D(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = newInstance$1(extend); // ----------------------------------------------------------------------------

var vtkActor2D = {
  newInstance: newInstance,
  extend: extend
}; // Register ourself to OpenGL backend if imported

registerOverride('vtkActor2D', newInstance);

export { vtkActor2D as default, extend, newInstance };
