/**
 * FogPass (SkyFront mod) — fog of war.
 *
 * Draws dimmed bare terrain over every part of the map the local player
 * can't see, on top of territory, buildings and units, so what's under the
 * fog stays hidden. The visibility grid comes from
 * `frame/derive/FogOfWar.ts`; null turns the fog off.
 */

import type { FogGrid } from "../../frame/derive/FogOfWar";
import { FOG_CELL } from "../../frame/derive/FogOfWar";
import fogFragSrc from "../shaders/fog/fog.frag.glsl?raw";
import fogVertSrc from "../shaders/fog/fog.vert.glsl?raw";
import {
  createMapQuad,
  createProgram,
  createTexture2D,
  shaderSrc,
} from "../utils/GlUtils";

const FOG_DIM = 0.35;
const FOG_TINT: [number, number, number] = [0.1, 0.11, 0.14];

export class FogPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private fogTex: WebGLTexture | null = null;
  private fogW = 0;
  private fogH = 0;
  private enabled = false;
  private uCamera: WebGLUniformLocation;
  private uTerrain: WebGLUniformLocation;
  private uFog: WebGLUniformLocation;
  private uDim: WebGLUniformLocation;
  private uTint: WebGLUniformLocation;
  private uFogScale: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private mapW: number,
    private mapH: number,
    private terrainTex: () => WebGLTexture,
  ) {
    this.program = createProgram(
      gl,
      shaderSrc(fogVertSrc, { MAP_W: mapW, MAP_H: mapH }),
      fogFragSrc,
      "FogPass",
    );
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uTerrain = gl.getUniformLocation(this.program, "uTerrain")!;
    this.uFog = gl.getUniformLocation(this.program, "uFog")!;
    this.uDim = gl.getUniformLocation(this.program, "uDim")!;
    this.uTint = gl.getUniformLocation(this.program, "uTint")!;
    this.uFogScale = gl.getUniformLocation(this.program, "uFogScale")!;
    this.vao = createMapQuad(gl, mapW, mapH);
  }

  /** Upload a new visibility grid, or null to turn the fog off. */
  update(grid: FogGrid | null): void {
    this.enabled = grid !== null;
    if (grid === null) return;
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (
      this.fogTex === null ||
      this.fogW !== grid.width ||
      this.fogH !== grid.height
    ) {
      if (this.fogTex !== null) gl.deleteTexture(this.fogTex);
      this.fogW = grid.width;
      this.fogH = grid.height;
      this.fogTex = createTexture2D(gl, {
        width: grid.width,
        height: grid.height,
        internalFormat: gl.R8,
        format: gl.RED,
        type: gl.UNSIGNED_BYTE,
        data: grid.cells,
        filter: gl.LINEAR,
      });
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.fogTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      grid.width,
      grid.height,
      gl.RED,
      gl.UNSIGNED_BYTE,
      grid.cells,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Call with blending on (SRC_ALPHA, ONE_MINUS_SRC_ALPHA). */
  draw(cameraMatrix: Float32Array): void {
    if (!this.enabled || this.fogTex === null) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uDim, FOG_DIM);
    gl.uniform3f(this.uTint, FOG_TINT[0], FOG_TINT[1], FOG_TINT[2]);
    gl.uniform2f(
      this.uFogScale,
      this.mapW / (this.fogW * FOG_CELL),
      this.mapH / (this.fogH * FOG_CELL),
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.terrainTex());
    gl.uniform1i(this.uTerrain, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fogTex);
    gl.uniform1i(this.uFog, 1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    if (this.fogTex !== null) gl.deleteTexture(this.fogTex);
  }
}
