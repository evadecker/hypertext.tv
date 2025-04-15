import {
  GLSL3,
  HalfFloatType,
  type Texture,
  type TextureDataType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import vertexShader from "./rgbtrail.vert?raw";

export class RGBTrailPass extends ShaderPass {
  private oldTarget: WebGLRenderTarget;
  private newTarget: WebGLRenderTarget;

  constructor() {
    const fragmentShader = `
      #include <common>

      uniform sampler2D tOld;
      uniform sampler2D tNew;
      uniform float damp;
      
      in vec2 xy;
      out vec4 outputPixel;

      // Function to create a tighter falloff, similar to the Shadertoy example
      float tighten(float x) {
        return pow(1.0 - clamp(x, 0.0, 1.0), 8.0);
      }

      vec4 when_gt(vec4 x, float y) {
        return max(sign(x - y), 0.0);
      }

      void main() {
        vec4 texelOld = texture(tOld, xy);
        vec4 texelNew = texture(tNew, xy);
        
        // Check if there's new content
        bool hasNewContent = texelNew.r > 0.01 || texelNew.g > 0.01 || texelNew.b > 0.01;
        
        if (hasNewContent) {
          // For new content, preserve the original color and set alpha to 1.0
          outputPixel = vec4(texelNew.rgb, 1.0);
        } else {
          // For existing trail, apply damping with a tighter falloff
          vec4 damped = texelOld * damp;
          
          // Apply visibility threshold with tighter falloff
          float visibility = max(damped.r, max(damped.g, damped.b));
          float tightVisibility = tighten(1.0 - visibility);
          damped *= vec4(tightVisibility);
          
          // Check if the pixel is still visible
          if (damped.a > 0.01) {
            // Use the alpha value to determine the color
            // As alpha decreases, we transition from colors to transparent
            float alpha = damped.a;
            
            if (alpha > 0.65) {
              // Red phase
              outputPixel = vec4(1.0, 0.0, 0.0, alpha);
            } else if (alpha > 0.5) {
              // Green phase
              outputPixel = vec4(0.0, 1.0, 0.0, alpha);
            } else if (alpha > 0.1) {
              // Blue phase
              outputPixel = vec4(0.0, 0.0, 1.0, alpha);
            } else {
              // Fading out
              outputPixel = vec4(0.0, 0.0, 0.0, alpha);
            }
          } else {
            // Fully faded out
            outputPixel = vec4(0.0, 0.0, 0.0, 0.0);
          }
        }
      }
    `;

    const shader = {
      uniforms: {
        tOld: { value: null },
        tNew: { value: null },
        damp: { value: 0.96 }, // Higher value = longer trail
      },
      vertexShader,
      fragmentShader,
    };

    super(shader);

    this.material.glslVersion = GLSL3;

    const params: [number, number, { type: TextureDataType }] = [
      0,
      0,
      { type: HalfFloatType },
    ];

    // Create two render targets for ping-pong buffering
    this.oldTarget = new WebGLRenderTarget(...params);
    this.newTarget = new WebGLRenderTarget(...params);
  }

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget | null,
    readBuffer: { texture: Texture | null },
  ) {
    // Update uniforms
    this.material.uniforms.tNew.value = readBuffer.texture;
    this.material.uniforms.tOld.value = this.oldTarget.texture;

    // Render to new target
    renderer.setRenderTarget(this.newTarget);
    this.fsQuad.render(renderer);

    // Render to output buffer
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }

    // Swap buffers for next frame
    const temp = this.oldTarget;
    this.oldTarget = this.newTarget;
    this.newTarget = temp;
  }

  setSize(width: number, height: number) {
    this.oldTarget.setSize(width, height);
    this.newTarget.setSize(width, height);
  }

  dispose() {
    this.oldTarget.dispose();
    this.newTarget.dispose();
    super.dispose();
  }
}
