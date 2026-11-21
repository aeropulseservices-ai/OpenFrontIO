#version 300 es
precision highp float;

// Fog of war (SkyFront mod). Over fogged areas, paint dimmed bare terrain on
// top of everything drawn so far, so enemy land, buildings and units there
// are hidden while the shape of the map stays readable.

uniform sampler2D uTerrain; // RGBA8 terrain colors, nearest
uniform sampler2D uFog;     // R8 visibility (1 = visible), linear
uniform float uDim;         // brightness of fogged terrain, 0..1
uniform vec3 uTint;         // color the fogged terrain is pulled toward
uniform vec2 uFogScale;     // map size / fog grid size in tiles

in vec2 vUV;
out vec4 fragColor;

void main() {
  float visible = texture(uFog, vUV * uFogScale).r;
  float fog = 1.0 - smoothstep(0.25, 0.75, visible);
  if (fog <= 0.0) discard;
  vec3 terrain = texture(uTerrain, vUV).rgb;
  vec3 col = mix(terrain * uDim, uTint, 0.3);
  fragColor = vec4(col, fog);
}
