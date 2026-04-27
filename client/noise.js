/*
*
*  (Original was in C#, so I had to translate this to js)
*
* Source: https://gist.github.com/Flafla2/f0260a861be0ebdeef76
* Article: https://adrianb.io/2014/08/09/perlinnoise.html
* Made by: Adrian Biagioli
*/

class Noise {
    static #repeat = -1;
    static #permutations = [
        151, 160, 137, 91, 90, 15,
        131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
        190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
        88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
        77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
        102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
        135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
        5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
        223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
        129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
        251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
        49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
        138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
    ];
    static #_p = null;
    static get #p() {
        if (!this.#_p)
            this.#genP();

        return this.#_p;
    }
    static #inc(num) {
        num++;
        if (this.#repeat > 0) num %= this.#repeat;

        return num;
    };
    static #grad(hash, x, y, z) {
        let h = hash & 15;
        let u = h < 8 ? x : y;
        let v;

        if (h < 4)
            v = y;
        else if (h == 12 || h == 14)
            v = x;
        else
            v = z;

        return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
    }
    static #fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    static perlin(x, y, z, repeat = -1) {
        this.#repeat = repeat;

        if (repeat > 0) {
            x %= repeat;
            y %= repeat;
            z %= repeat;
        }

        let xi = Math.floor(x) & 255;
        let yi = Math.floor(y) & 255;
        let zi = Math.floor(z) & 255;
        let xf = x - Math.floor(x);
        let yf = y - Math.floor(y);
        let zf = z - Math.floor(z);

        let u = this.#fade(xf);
        let v = this.#fade(yf);
        let w = this.#fade(zf);

        let aaa, aba, aab, abb, baa, bba, bab, bbb;
        aaa = this.#p[this.#p[this.#p[xi] + yi] + zi];
        aba = this.#p[this.#p[this.#p[xi] + this.#inc(yi)] + zi];
        aab = this.#p[this.#p[this.#p[xi] + yi] + this.#inc(zi)];
        abb = this.#p[this.#p[this.#p[xi] + this.#inc(yi)] + this.#inc(zi)];
        baa = this.#p[this.#p[this.#p[this.#inc(xi)] + yi] + zi];
        bba = this.#p[this.#p[this.#p[this.#inc(xi)] + this.#inc(yi)] + zi];
        bab = this.#p[this.#p[this.#p[this.#inc(xi)] + yi] + this.#inc(zi)];
        bbb = this.#p[this.#p[this.#p[this.#inc(xi)] + this.#inc(yi)] + this.#inc(zi)];

        let x1, x2, y1, y2;
        x1 = lerp(this.#grad(aaa, xf, yf, zf), this.#grad(baa, xf - 1, yf, zf), u);
        x2 = lerp(this.#grad(aba, xf, yf - 1, zf), this.#grad(bba, xf - 1, yf - 1, zf), u);
        y1 = lerp(x1, x2, v);

        x1 = lerp(this.#grad(aab, xf, yf, zf - 1), this.#grad(bab, xf - 1, yf, zf - 1), u);
        x2 = lerp(this.#grad(abb, xf, yf - 1, zf - 1), this.#grad(bbb, xf - 1, yf - 1, zf - 1), u);
        y2 = lerp(x1, x2, v);

        return (lerp(y1, y2, w) + 1) / 2;
    }
    static octavePerlin(x, y, z, octaves, persistence, frequency, amplitude) {
        let total = 0;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.perlin(x * frequency, y * frequency, z * frequency) * amplitude;

            maxValue += amplitude;

            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }

    static #genP() {
        this.#_p = [];
        for (let x = 0; x < 512; x++)
            this.#_p[x] = this.#permutations[x % 256];
    }
}

function pseudo(s1, s2, s3, max = 1000000) {
    const a = (s1 + 86454.54) + (s1 - 524.6565) * (s1 + 684.68);
    const b = (s2 + 68454.864) + (s2 - 9865.6385) * (s2 + 1486.385);
    const c = (s3 + 3572.8563) + (s3 - 5342.357) * (s3 + 6314.52);
    const x = a ^ s1;
    const y = b ^ s2 ^ s3;
    const z = c ^ a ^ s1 + c ^ s2;

    return Math.abs((x * y * z + a - s3 * y) % max);
}

function fastPseudo(s1, s2, s3, max = 10) { return Math.abs(s1 ^ (s2 * (s3 - s1) ^ s1) * (s1 + 1) ^ s3 * (s2 + 1) ^ (s3 + 1)) % max; }

function pseudo01(s1, s2, s3) { return pseudo(s1, s2, s3, 1000000) / 1000000; }