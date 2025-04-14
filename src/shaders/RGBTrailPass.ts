import {
  GLSL3,
  HalfFloatType,
  MeshBasicMaterial,
  type Texture,
  type TextureDataType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import vertexShader from "./rgbtrail.vert?raw";

export class RGBTrailPass extends ShaderPass {
  frames: {
    target: WebGLRenderTarget;
    quad: FullScreenQuad;
  }[];
  comp: {
    target: WebGLRenderTarget;
    quad: FullScreenQuad;
  };

  constructor() {
    const echoes = [
      ["r", "g", "b", "a"],
      // Red
      ["2.0", "0.0", "0.0", "0.8 * a"],
      // Green
      ["0.0", "2.0", "0.0", "0.6 * a"],
      // Blue
      ["0.0", "0.0", "2.0", "0.4 * a"],
      ["0.0", "0.0", "2.0", "0.3 * a"],
      ["0.0", "0.0", "2.0", "0.2 * a"],
      ["0.0", "0.0", "2.0", "0.1 * a"],
    ].map(([r, g, b, a], i) => ({ r, g, b, a, i }));

    const fragmentShader = `
      #include <common>

      uniform sampler2D frames[${echoes.length}];
      in vec2 xy;
      out vec4 outputPixel;

      vec4 blend(vec4 bg, vec4 fg) {
        vec4 result = mix(bg, fg, fg.a);
        result = max(bg, result);
        return result;
      }

      void main() {
        outputPixel = vec4(0.0);
        ${echoes
          .map(
            ({ r, g, b, a, i }) => `
        {
          vec4 pixel = texture(frames[${i}], xy);
          pixel.r = ${r.replace("r", "pixel.r")};
          pixel.g = ${g.replace("g", "pixel.g")};
          pixel.b = ${b.replace("b", "pixel.b")};
          pixel.a = ${a.replace("a", "pixel.a")};
          outputPixel = blend(outputPixel, pixel);
        }`,
          )
          .join("\n")}
      }
    `;

    const shader = {
      uniforms: {
        frames: { value: null },
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

    this.comp = {
      target: new WebGLRenderTarget(...params),
      quad: new FullScreenQuad(this.material),
    };

    this.frames = Array(echoes.length)
      .fill(null)
      .map(() => ({
        target: new WebGLRenderTarget(...params),
        quad: new FullScreenQuad(new MeshBasicMaterial({ transparent: true })),
      }));
  }

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget | null,
    readBuffer: { texture: Texture | null },
  ) {
    // Update frame buffers
    // biome-ignore lint/style/noNonNullAssertion: Array is always available
    this.frames.unshift(this.frames.pop()!);

    renderer.setRenderTarget(this.frames[0].target);
    (this.frames[0].quad.material as MeshBasicMaterial).map =
      readBuffer.texture;
    this.frames[0].quad.render(renderer);

    // Update uniforms
    this.material.uniforms.frames.value = this.frames.map(
      (frame) => frame.target.texture,
    );

    // Render final composition
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  setSize(width: number, height: number) {
    this.comp.target.setSize(width, height);
    for (const frame of this.frames) {
      frame.target.setSize(width, height);
    }
  }

  dispose() {
    this.comp.target.dispose();
    this.comp.quad.dispose();

    for (const frame of this.frames) {
      frame.target.dispose();
      frame.quad.dispose();
    }

    super.dispose();
  }
}
