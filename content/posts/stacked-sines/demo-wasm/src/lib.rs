use std::f32;

use rand::{Rng, SeedableRng};
use rand_xoshiro::Xoshiro256PlusPlus;
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy)]
struct Perturbation {
    start: u32,
    amplitude: f32,
    width: u32,
    up: bool,
}

impl Perturbation {
    fn dy(&self, x: u32) -> f32 {
        if self.amplitude == 0.0 {
            return 0.0;
        }
        let theta = ((x - self.start) as f32) / (self.width as f32);
        if x < self.start || theta >= f32::consts::PI {
            return 0.0;
        }
        let dy = -self.amplitude * f32::sin(theta);
        if self.up {
            dy
        } else {
            -dy
        }
    }
    fn dampen(&self, stages: u32, amp_reduction: f32) -> Perturbation {
        if stages == 0 {
            return self.clone();
        }
        Perturbation {
            amplitude: if self.amplitude == 0.0 || self.amplitude <= (amp_reduction * stages as f32)
            {
                0.0
            } else {
                self.amplitude - (amp_reduction * stages as f32)
            },
            width: self.width + (2 * stages),
            start: self.start.saturating_sub(3 * stages),
            up: self.up,
        }
    }
}

/*
#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}
*/

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen]
pub fn generate(
    size: usize,
    min_amp: u32,
    max_amp: u32,
    min_width: u32,
    max_width: u32,
    min_per_line: u32,
    max_per_line: u32,
    damp: f32,
    lines: usize,
    seed_bytes: &[u8],
) -> Vec<u8> {
    let seed_bytes: [u8; 8] = seed_bytes.try_into().unwrap_or([1, 2, 3, 4, 5, 6, 7, 8]);
    let seed = u64::from_le_bytes(seed_bytes);

    let mut img = vec![vec![0u8; size]; size];

    let mut rand_num_per_line = Xoshiro256PlusPlus::seed_from_u64(seed);
    let mut rand_meta_width = Xoshiro256PlusPlus::seed_from_u64(seed);
    let mut rand_meta_amp = Xoshiro256PlusPlus::seed_from_u64(seed);
    let mut rand_meta_start = Xoshiro256PlusPlus::seed_from_u64(seed);
    let mut rand_meta_dir = Xoshiro256PlusPlus::seed_from_u64(seed);

    let mut ptbs_by_line = vec![vec![]; lines];
    for line in 0..lines {
        let mut rand_width = Xoshiro256PlusPlus::seed_from_u64(rand_meta_width.r#gen());
        let mut rand_amp = Xoshiro256PlusPlus::seed_from_u64(rand_meta_amp.r#gen());
        let mut rand_start = Xoshiro256PlusPlus::seed_from_u64(rand_meta_start.r#gen());
        let mut rand_dir = Xoshiro256PlusPlus::seed_from_u64(rand_meta_dir.r#gen());
        for _i in 0..rand_num_per_line.gen_range(min_per_line..=max_per_line) {
            ptbs_by_line[line].push(Perturbation {
                start: rand_start.gen_range(0..size as u32),
                amplitude: rand_amp.gen_range(min_amp..=max_amp) as f32,
                width: rand_width.gen_range(min_width..=max_width),
                up: rand_dir.gen_bool(0.5),
            });
        }
    }

    for line in 0..lines {
        let mut ptbs_affecting_line = vec![];
        for other_line in 0..lines {
            let delta_line = line.abs_diff(other_line) as u32;
            for ptb in &ptbs_by_line[other_line] {
                let ptb_d = ptb.dampen(delta_line, damp);
                ptbs_affecting_line.push(ptb_d);
            }
        }
        // lines * 8 for padding
        let y = (size - (lines * 8)) / 2 + (line * 8) + max_amp as usize;
        for x in 0..size {
            let dy: f32 = ptbs_affecting_line.iter().map(|ptb| ptb.dy(x as u32)).sum();
            let y = y as f32;
            let offset_y = y + dy;
            if offset_y.round() < 0.0 || offset_y.round() as usize >= size {
                continue;
            }
            img[offset_y.round() as usize][x] = 1;
        }
    }
    img.iter()
        .flatten()
        .flat_map(|val| {
            if *val == 0 {
                [0, 0, 0, 0]
            } else {
                [255, 255, 255, 255]
            }
        })
        .collect()
}

#[wasm_bindgen]
pub fn hello() -> u32 {
    42
}
