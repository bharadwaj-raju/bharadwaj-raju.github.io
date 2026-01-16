+++
title = "Angled Random Walks for <abbr>DLA</abbr>-like Terrain Generation"
date = 2024-08-03
draft = false

[taxonomies]
category = ["procedural-generation"]

[extra]
image = "thumb.png"
+++

<script type="module">
    import init, { hello, generate, to_image, heightmap_blur } from './demo-wasm/angled_random_walker_demo_wasm.js';
    async function run() {
        await init();
        const result = hello();
        if (result !== 42)
            throw new Error("wasm hello doesn't work!");
    }
    window.generate = generate;
    window.to_image = to_image;
    window.heightmap_blur = heightmap_blur;
    window.init = init;
</script>

I watched this excellent video, [*Better Mountain Generators That Aren't Perlin Noise or Erosion*](https://www.youtube.com/watch?v=gsJHzBTPG0Y) by [Josh's Channel](https://www.youtube.com/@JoshsHandle). It discusses generating mountain heightmaps
using a technique called [Diffusion-Limited Aggregation](https://en.wikipedia.org/wiki/Diffusion-limited_aggregation). The structures produced by this process are known as Brownian trees.

{% figure(src="Brownian_tree.gif" alt="Brownian tree") %}Growing Brownian tree. Animation by [あるうぃんす](https://commons.wikimedia.org/wiki/File:Brownian_tree.gif).{% end %}

In <abbr>DLA</abbr>, we start with a seed typically placed at the center. At each step, we randomly place points on the grid and then random-walk them until they hit an existing particle, at which point they are frozen there. This is, of course, very inefficient. The video describes a good technique to get it to be faster, by starting with a small grid and doing a {% sidenote(ref="crisp upscale") %}This upscale isn't done directly on the pixels — instead, we keep track of which pixel sticks to which, and use that graph to populate a larger grid.{% end %} after the grid is filled to a certain degree, and repeating the process until we get to the desired size.

But my immediate thoughts after the video were that surely this would be faster the other way round — by generating outwards from the initial seed. After experimenting with a lot of approaches, I found a way that yields _fairly_ <abbr>DLA</abbr>-like results with much less computational cost.

## Approach

We have a number of *random walkers* on the grid. Each of them has these properties:

  1. *Age*: How many pixels it travelled since it was spawned.
  2. *Generation*: How many parent walkers it has.
  3. *Angle*: What angle the walker aims towards.
  4. *Type*: Is it a _long_ or _short_ walker. _Short_ walkers don't split into more walkers when they end.

The algorithm for generation is:

  1. Start with a grid of zeros.
  2. Place a number of walkers at the centre, all aimed at different angles.
  3. While there are any walkers:
      - If it is a long walker and its age module some frequency parameter is zero, spawn a short walker at that position.
      - If its age is greater than some maximum age, it dies, and…
        - If its generation is less than some maximum generation, and it is a long walker, spawn some number of long walkers where it stopped, each aimed slightly offset from the parent's angle.
      - Else, the walker moves in a random direction, chosen via weighted sampling where the weights are smaller the larger the angular distance between that direction and the target angle, and {% sidenote(ref="the most opposite direction is removed") %}Otherwise, the walkers wind back on themselves and fail to spread apart sufficiently. An example of what that looks like: ![with least likely included, the generated shape is a lot smaller and more bloblike](./with-least-likely-included.png){% end %} by subtracting its weight from every weight. The point it moves to is filled in on the grid.

## Implementation

I've written a Rust implementation of this algorithm.

  - *Repository*: [bharadwaj-raju / angled-random-walker](https://github.com/bharadwaj-raju/angled-random-walker)
  - *Crates.io*: [angled-random-walker](https://crates.io/crates/angled-random-walker)
  - *Documentation*: [angled_random_walker on docs.rs](https://docs.rs/angled-random-walker/latest/angled_random_walker/)

## Heightmap

By filling each walked pixel with the cumulative age of its walker, and blurring the result, we get a simple heightmap. But this just gives you mountain-like smooth blobs.

To get more interesting terrain, we superimpose a clamped and lightly-blurred version. This preserves the smaller and sharper details generated in the process. The effect is — in my estimation — close to the sought-after erosion look.

## Demonstration

This is a _live_ demonstration. Play around with the sliders to immediately see your changes. To make it easier to isolate the effects of varying parameters, the seed is held constant — click "Randomize Seed" to generate from a new seed.

<script src="/js/three.min.js"></script>
<script src="/js/OrbitControls.js"></script>
<script>
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1b1b);
    scene.fog = new THREE.Fog(0x0, 1, 10000);
    const light = new THREE.PointLight(0xffffff, 1)
    const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
    camera.add(light);
    const renderer = new THREE.WebGLRenderer();
    camera.position.z = 0.6;
    camera.position.y = 0.2;
    console.log(camera.position);
    renderer.setSize(512, 512);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
</script>

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

<script src="/js/alpine.min.js" defer></script>

<div x-data="{
    seed: [1, 2, 3, 4, 5, 6, 7, 8],
    canvas2dContext: undefined,
    canvas3dContainer: undefined,
    longAge: 75,
    shortAge: 35,
    generations: 4,
    maxChildren: 2,
    shortBranchFreq: 20,
    longDivergence: 0.2,
    shortDivergence: 0.3,
    blurRadius: 20,
    detailsMax: 15,
    async rawData() {
        await window.init();
        return window.generate(512, this.longAge, this.shortAge, this.generations, this.maxChildren, this.longDivergence, this.shortDivergence, this.shortBranchFreq, this.seed);
    },
    async image(data) {
        await window.init();
        return new Uint8ClampedArray(window.to_image(data));
    },
    async mesh(data) {
        await window.init();
        const heightmapTexture = new THREE.DataTexture(
            window.heightmap_blur(data, this.blurRadius, this.detailsMax),
            512,
            512,
            THREE.RedFormat,
            THREE.UnsignedByteType
        );
        heightmapTexture.wrapS = THREE.RepeatWrapping;
        heightmapTexture.repeat.x = -1;
        heightmapTexture.needsUpdate = true;
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            displacementMap: heightmapTexture,
            displacementScale: 205,
            side: THREE.DoubleSide,
            flatShading: true,
        });
        const geometry = new THREE.PlaneBufferGeometry(1024, 1024, 256, 256);
        geometry.computeVertexNormals();
        geometry.normalizeNormals();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -Math.PI;
        mesh.scale.set(1 / 1024, 1 / 1024, 1 / 1024);
        return mesh;
    }
}" x-effect="
    const depends = [longAge, shortAge, generations,
                     maxChildren, longDivergence, shortDivergence,
                     shortBranchFreq, seed, blurRadius, detailsMax];
    const data = await rawData();
    const mesh3d = await mesh(data);
    canvas2dContext && canvas2dContext.putImageData(new ImageData(await image(data), 512, 512), 0, 0);
    canvas3dContainer && canvas3dContainer.appendChild(renderer.domElement);
    scene.clear();
    scene.add(camera);
    scene.add(mesh3d);
">
    <style>
        #demo-container {
            margin-top: calc(3 * var(--gap));
            display: flex;
            gap: var(--gap);
        }
        #demo-3d-container {
            padding: 0px;
            margin: var(--gap) auto;
            width: 512px;
        }
        #demo-3d-container canvas {
            border: 1px solid var(--text);
            cursor: grab;
        }
        #demo-3d-controls {
            display: flex;
            justify-content: center;
            gap: var(--gap);
        }
        .demo-3d-control {
            display: flex;
            flex-direction: column;
        }
        @media (max-width: 1400px) {
            #demo-container {
                flex-direction: column;
                padding: 0;
                border: none;
                width: 100% !important;
            }
            #demo-canvas {
                width: 100% !important;
                min-width: 100% !important;
                max-width: 100% !important;
                height: unset !important;
            }
            #demo-3d-whole-container, #demo-3d-controls, #demo-3d-container {
                width: 100% !important;
            }
        }
        #demo-container-left {
            width: 512px;
            min-width: 512px;
            max-width: 512px;
            text-align: center;
        }
        #demo-canvas {
            border: 1px solid var(--text);
            background-color: var(--base-dark);
            width: 512px;
            min-width: 512px;
            max-width: 512px;
            height: 512px;
        }
        .demo-control {
            display: flex;
            flex-direction: column;
            width: 100%;
        }
        #demo-controls-container {
            display: flex;
            flex-direction: column;
            gap: calc(var(--gap) / 2);
            flex-grow: 1;
        }
        #gen-btn {
            background: none;
            border: none;
            color: inherit;
            font-size: inherit;
            font-family: inherit;
            text-decoration: underline;
            font-style: italic;
            font-weight: bold;
            cursor: pointer;
        }
    </style>
    {% marginnote() %}This demonstration uses the same implementation linked above, through a <abbr>WASM</abbr> layer. The source code of the <abbr>WASM</abbr> module can be found [here](https://github.com/bharadwaj-raju/angled-random-walker-demo-wasm).{% end %}
    {% marginnote() %}Eight initial walkers are used here, aimed at each of the cardinal and ordinal directions. The library lets you customize the number and angles of the walkers, if you wish.{% end %}
    <div id="demo-container">
        <div id="demo-container-left">
            <canvas x-init="canvas2dContext = $el.getContext('2d')" id="demo-canvas" width="512" height="512"></canvas>
            <button @click="seed = generateSeed()" id="gen-btn">Randomize Seed</button>
        </div>
        <div id="demo-controls-container">
            <div class="demo-control">
                <label for="max-long-age">Max long walker age: <span x-text="longAge"></span></label>
                <input type="range" id="max-long-age" x-model="longAge" min="1" max="100" step="1">
            </div>
            <div class="demo-control">
                <label for="max-short-age">Max short walker age: <span x-text="shortAge"></span></label>
                <input type="range" id="max-short-age" x-model="shortAge" min="1" max="100" step="1">
            </div>
            <div class="demo-control">
                <label for="max-gen">Max generations: <span x-text="generations"></span></label>
                <input type="range" id="max-gen" x-model="generations" min="1" max="10"  step="1">
            </div>
            <div class="demo-control">
                <label for="max-children">Children spawned: <span x-text="maxChildren"></span></label>
                <input type="range" id="max-children" x-model="maxChildren" min="1" max="5"  step="1">
            </div>
            <div class="demo-control">
                <label for="short-branch-freq">Short branch every: <span x-text="shortBranchFreq"></span> steps</label>
                <input type="range" id="short-branch-freq" x-model="shortBranchFreq" min="1" max="70"  step="1">
            </div>
            <div class="demo-control">
                <label for="long-angle-divergence">Max long child divergence: <span x-text="longDivergence"></span>&nbsp;π</label>
                <input type="range" id="long-angle-divergence" x-model="longDivergence" min="0.1" max="1.0"
                    step="0.05">
            </div>
            <div class="demo-control">
                <label for="short-angle-divergence">Max short child divergence: <span x-text="shortDivergence"></span>&nbsp;π</label>
                <input type="range" id="short-angle-divergence" x-model="shortDivergence" min="0.1" max="1.0"
                    step="0.05">
            </div>
        </div>
    </div>
    <p>And in <abbr>3D</abbr>:</p>
    {% marginnote() %}Please excuse the plainness. I don't yet know enough <abbr>3D</abbr> graphics to make it nicely Earth-colored _and_ give it lighting and shading such that you can actually see the details.{% end %}
    <div id="demo-3d-whole-container">
        <div x-init="canvas3dContainer = $el" id="demo-3d-container"></div>
        <div id="demo-3d-controls">
            <div class="demo-3d-control">
                <label for="blur-radius">Blur radius: <span x-text="blurRadius"></span></label>
                <input type="range" id="blur-radius" x-model="blurRadius" min="1" max="32" value="20" step="1">
            </div>
            <div class="demo-3d-control">
                <label for="details-max">Details layer max: <span x-text="detailsMax"></span></label>
                <input type="range" id="details-max" x-model="detailsMax" min="1" max="20" value="15" step="1">
            </div>
        </div>
    </div>
</div>

## Similar Stuff

[Planet Eleven Games](https://planet11games.com/) posted about [*Using drunken walk for height maps*](https://old.reddit.com/r/proceduralgeneration/comments/1bup6wm/using_drunken_walk_for_height_maps/). They were inspired by the exact same video, but the approach they use is different, involving an unbiased random expansion with each new pixel having a chance of dropping in height. Check out their [demo](https://planet11games.com/drunkwalk/).
