+++
title = "Stacked Sines"
date = 2025-09-13

[taxonomies]
category = ["procedural-generation"]

[extra]
image = "thumb.png"
+++

<script>
    function getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }
    function generateSeed() {
        const arr = [];
        for (let i = 0; i < 8; i++) {
            arr.push(getRandomInt(256));
        }
        return arr;
    }
</script>

<script type="module">
    import init, { hello, generate } from './demo-wasm/pkg/demo_wasm.js';
    async function run() {
        await init();
        const result = hello();
        console.log("hello from WASM: ", result);
        if (result !== 42)
            throw new Error("wasm hello doesn't work!");
    }
    window.generate = generate;
    window.init = init;
</script>

<script src="/js/alpine.min.js" defer></script>

<style>
.demo-container {
    margin-top: calc(3 * var(--gap));
    display: flex;
    gap: var(--gap);
}

@media (max-width: 1500px) {
    .demo-container {
        flex-direction: column;
        padding: 0;
        border: none;
        width: 100% !important;
    }
    
    .demo-container canvas {
        width: 100% !important;
        min-width: 100% !important;
        max-width: 100% !important;
        height: unset !important;
    }
}

#demo-container-single .demo-container-left {
    width: 600px;
    min-width: 600px;
    max-width: 600px;
    text-align: center;
}

.demo-container canvas {
    border: 1px solid var(--text);
    background-color: var(--base-dark);
}

#demo-container-single canvas {
    width: 600px;
    min-width: 600px;
    max-width: 600px;
    height: 200px;
}

#demo-container-stacked canvas {
    width: 600px;
    min-width: 600px;
    max-width: 600px;
    height: 600px;
}

.demo-control {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.demo-controls-container {
    display: flex;
    flex-direction: column;
    gap: calc(var(--gap));
    flex-grow: 1;
}
</style>
{% figure(src="sterk_hvalros_you_are_not_a_robot_5d5AmwolYpo_2.jpg" alt="You are not a robot, by Sterk Hvalros." height=500 float="right") %}[*"You are not a robot"*](//youtu.be/5d5AmwolYpo){% end %}

[Sterk Hvalros](https://www.youtube.com/@SterkHvalros) creates a lot of art around the ideas of ripples and waves, and documents his process of making these pieces.


Watching them, I wanted to experiment with some procedural generation along those lines.

I thought about and tried some ways of representing and propagating perturbations like in the video, and my eventual idea was to generate pieces of sine waves for each horizontal line, and to "dampen" them to generate their ripple effects on all other lines.

<p style="clear: both"></p>

Sine waves make this pretty nice, mathematically. If you have a function of `y(x) = amplitude * sin((x - start) / width)`, you can vary the `amplitude` and `width` parameters to control the size.

<div x-data="{
  clip: true,
  start: 280,
  amplitude: 15,
  width: 20,
}" x-effect="
const ctx = $refs.canvas.getContext('2d');
ctx.clearRect(0, 0, $refs.canvas.width, $refs.canvas.height);
ctx.fillStyle = 'rgb(255 255 255)';
for (var x = 0; x < $refs.canvas.width; x++) {
  y = ($refs.canvas.height / 2);
  if (!clip || !(x < start || (x - start) / width >= Math.PI)) {
    y += -amplitude * Math.sin((x - start) / width);
  }
  ctx.fillRect(x, y, 1, 1);
}       
">
  <div class="demo-container" id="demo-container-single" style="clear: both;">
    <div class="demo-container-left">
      <canvas x-ref="canvas" id="sine-stacked-canvas" width=600 height=200></canvas>
    </div>
    <div class="demo-controls-container">
      <div class="demo-control">
        <label for="start">Start: <span x-text="start"></span></label>
        <input type="range" id="start" x-model="start" min="1" max="600" step="1">
      </div>
      <div class="demo-control">
        <label for="amplitude">Amplitude: <span x-text="amplitude"></span></label>
        <input type="range" id="amplitude" x-model="amplitude" min="1" max="100" step="1">
      </div>
      <div class="demo-control">
        <label for="width">Width: <span x-text="width"></span></label>
        <input type="range" id="width" x-model="width" min="1" max="100" step="1">
      </div>
    </div>
  </div>
</div>

{{ break() }}

Then, the idea is that you generate a set of such sine perturbations at random lines and at random starting positions, and add their effect (`y(x)`) to each line, dampened by how far the line being rendered is from the origin line of that perturbation.

For each stage of dampening, reduce the amplitude by a constant, increase the width by 2 units, and decrease the start position by π units.{% marginnote() %}The choice to increase width by 2 units is arbitrary.{% end %}
{% marginnote() %}Still, whatever our choice for the increase in width, we can calculate the corresponding decrease in starting coordinate which will keep the peaks aligned by equating `(x-s)/w` and `(x-s')/w'` both to `π/2`.{% end %}
That lets it spread out while still being on-center.

<script type="text/javascript">
function perturbation_y(ptb, x) {
  //console.log(ptb);
  if (!ptb) return 0;
  if (x < ptb.start || (x - ptb.start) / ptb.width >= Math.PI) {
    return 0;
  }
  let dy = -ptb.amplitude * Math.sin((x - ptb.start) / ptb.width);
  //if (Math.abs(dy - -ptb.amplitude) < 0.01)
  //  return 0;
  if (ptb.direction === "down") {
    return -dy;
  }
  return dy;
}
function dampen(ptb, stages, amplitude_reduction) {
  if (ptb.amplitude <= amplitude_reduction * stages) {
    return null;
  }
  return {
    amplitude: ptb.amplitude - (amplitude_reduction * stages),
    width: ptb.width + (2 * stages),
    start: ptb.start - (Math.PI * stages),
    direction: ptb.direction,
  };
}
</script>

<div x-data="{
  clip: true,
  start: 280,
  amplitude: 15,
  width: 20,
  amplitude_reduction: 0.5,
  lines: 20
}" x-effect="
const ctx = $refs.canvas.getContext('2d');
ctx.clearRect(0, 0, $refs.canvas.width, $refs.canvas.height);
ctx.fillStyle = 'rgb(255 255 255)';
const base_ptb = {
  start: start,
  amplitude: amplitude,
  width: width,
};
const ptbs = {};
for (var line = 0; line < lines; line++) {
  delta_line = Math.abs(line - (lines / 2));
  ptbs[line] = dampen(base_ptb, delta_line, amplitude_reduction);
  y = ($refs.canvas.height - (lines * 20)) / 2 + (line * 20);
  for (var x = 0; x < $refs.canvas.width; x++) {
    if (delta_line == 0) {
      ctx.fillStyle = 'rgb(234 157 52)';
    } else {
      ctx.fillStyle = 'rgb(255 255 255)';
    }
    dy = perturbation_y(ptbs[line], x);
    ctx.fillRect(x, y + dy, 1, 1);
  }
}
">
  <div class="demo-container" id="demo-container-stacking">
    <div class="demo-container-left">
      <canvas x-ref="canvas" id="sine-canvas" width=600 height=600></canvas>
    </div>
    <div class="demo-controls-container">
      <div class="demo-control">
        <label for="start">Start: <span x-text="start"></span></label>
        <input type="range" id="start" x-model.number="start" min="1" max="600" step="1">
      </div>
      <div class="demo-control">
        <label for="amplitude">Amplitude: <span x-text="amplitude"></span></label>
        <input type="range" id="amplitude" x-model.number="amplitude" min="1" max="100" step="1">
      </div>
      <div class="demo-control">
        <label for="width">Width: <span x-text="width"></span></label>
        <input type="range" id="width" x-model.number="width" min="1" max="100" step="1">
      </div>
      <div class="demo-control">
        <label for="amplitude_reduction">Amplitude reduction: <span x-text="amplitude_reduction"></span></label>
        <input type="range" id="amplitude_reduction" x-model.number="amplitude_reduction" min="-2" max="2" step="0.5">
      </div>
    </div>
  </div>
</div>

{{ break() }}

Thus far this looks simplistic, but when adding multiple randomly-generated sines to one image, the effect is cool.

<div x-data="{
  min_amp: 10,
  max_amp: 25,
  min_width: 10,
  max_width: 20,
  min_per_line: 1,
  max_per_line: 3,
  damp: 1,
  lines: 60,
  seed: [203, 174, 240, 244, 80, 8, 38, 1],
  async getImageData() {
    await window.init();
    return new ImageData(new Uint8ClampedArray(window.generate(600, this.min_amp, this.max_amp, this.min_width, this.max_width, this.min_per_line, this.max_per_line, this.damp, this.lines, this.seed)), 600, 600);
  }
}" x-effect="
  const depends = [min_amp, max_amp, min_width,
                   max_width, min_per_line,
                   max_per_line,
                   damp, lines, seed];
  const ctx = $refs.canvas.getContext('2d');
  ctx.putImageData(await getImageData(), 0, 0);
">
{% marginnote() %}This demonstration uses a Rust + WASM implementation. The source code can be found [here](https://github.com/bharadwaj-raju/bharadwaj-raju.github.io/tree/main/content/posts/stacked-sines/demo-wasm/).{% end %}
  <div class="demo-container" id="demo-container-stacking">
    <div class="demo-container-left">
      <canvas x-ref="canvas" id="sine-canvas" width=600 height=600></canvas>
    </div>
    <div x-data class="demo-controls-container" style="height: 602px">
      <div class="demo-control">
        <label for="min_amp">Min amplitude: <span x-text="min_amp"></span></label>
        <input type="range" id="min_amp" x-model.number="min_amp" min="1" max="50" step="1">
      </div>
      <div class="demo-control">
        <label for="max_amp">Max amplitude: <span x-text="max_amp"></span></label>
        <input type="range" id="max_amp" x-model.number="max_amp" min="1" max="50" step="1">
      </div>
      <div class="demo-control">
        <label for="min_width">Min width: <span x-text="min_width"></span></label>
        <input type="range" id="min_width" x-model.number="min_width" min="1" max="50" step="1">
      </div>
      <div class="demo-control">
        <label for="max_width">Max width: <span x-text="max_width"></span></label>
        <input type="range" id="max_width" x-model.number="max_width" min="1" max="50" step="1">
      </div>
      <div class="demo-control">
        <label for="min_per_line">Min per line: <span x-text="min_per_line"></span></label>
        <input type="range" id="min_per_line" x-model.number="min_per_line" min="0" max="15" step="1">
      </div>
      <div class="demo-control">
        <label for="max_per_line">Max per line: <span x-text="max_per_line"></span></label>
        <input type="range" id="max_per_line" x-model.number="max_per_line" min="1" max="15" step="1">
      </div>
      <div class="demo-control">
        <label for="damp">Amplitude reduction: <span x-text="damp"></span></label>
        <input type="range" id="damp" x-model.number="damp" min="-2" max="2" step="0.5">
      </div>
      <button x-bind:title="seed" @click="seed = generateSeed()" style="margin-top: auto" class="demo-control-button">Randomize Seed</button>
    </div>
  </div>
</div>

<p></p>
