using static System.Runtime.InteropServices.JavaScript.JSType;

namespace server
{
    /*
    * 
    * (NOTE: Modified to static class)
    * 
    * Source: https://gist.github.com/Flafla2/f0260a861be0ebdeef76
    * Article: https://adrianb.io/2014/08/09/perlinnoise.html
    * Made by: Adrian Biagioli
    */

    public static class PerlinNoise
    {
        public static double OctavePerlin(double x, double y, double z, int octaves, double persistence, double frequency, double amplitude, int repeat = -1)
        {
            double total = 0;
            double maxValue = 0;
            for (int i = 0; i < octaves; i++)
            {
                total += Perlin(x * frequency, y * frequency, z * frequency, repeat) * amplitude;

                maxValue += amplitude;

                amplitude *= persistence;
                frequency *= 2;
            }

            return total / maxValue;
        }

        private static readonly int[] permutation = { 151,160,137,91,90,15,
        131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
        190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
        88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
        77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
        102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
        135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
        5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
        223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
        129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
        251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
        49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
        138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    };

        private static int[] _p;
        private static int[] p
        {
            get
            {
                if (_p == null)
                    genP();

                return _p;
            }
        }

        static void genP()
        {
            _p = new int[512];
            for (int x = 0; x < 512; x++)
                _p[x] = permutation[x % 256];
        }

        public static double Perlin(double x, double y, double z, int repeat = -1)
        {
            if (repeat > 0)
            {
                x %= repeat;
                y %= repeat;
                z %= repeat;
            }

            int xi = (int)x & 255;
            int yi = (int)y & 255;
            int zi = (int)z & 255;
            double xf = x - (int)x;
            double yf = y - (int)y;

            double zf = z - (int)z;
            double u = fade(xf);
            double v = fade(yf);
            double w = fade(zf);

            int aaa, aba, aab, abb, baa, bba, bab, bbb;
            aaa = p[p[p[xi] + yi] + zi];
            aba = p[p[p[xi] + inc(yi, repeat)] + zi];
            aab = p[p[p[xi] + yi] + inc(zi, repeat)];
            abb = p[p[p[xi] + inc(yi, repeat)] + inc(zi, repeat)];
            baa = p[p[p[inc(xi, repeat)] + yi] + zi];
            bba = p[p[p[inc(xi, repeat)] + inc(yi, repeat)] + zi];
            bab = p[p[p[inc(xi, repeat)] + yi] + inc(zi, repeat)];
            bbb = p[p[p[inc(xi, repeat)] + inc(yi, repeat)] + inc(zi, repeat)];

            double x1, x2, y1, y2;
            x1 = lerp(grad(aaa, xf, yf, zf), grad(baa, xf - 1, yf, zf), u);
            x2 = lerp(grad(aba, xf, yf - 1, zf), grad(bba, xf - 1, yf - 1, zf), u);
            y1 = lerp(x1, x2, v);

            x1 = lerp(grad(aab, xf, yf, zf - 1), grad(bab, xf - 1, yf, zf - 1), u);
            x2 = lerp(grad(abb, xf, yf - 1, zf - 1), grad(bbb, xf - 1, yf - 1, zf - 1), u);
            y2 = lerp(x1, x2, v);

            return (lerp(y1, y2, w) + 1) / 2;
        }

        static int inc(int num, int repeat)
        {
            num++;
            if (repeat > 0) num %= repeat;

            return num;
        }

        static double grad(int hash, double x, double y, double z)
        {
            int h = hash & 15;
            double u = h < 8 ? x : y;
            double v;

            if (h < 4)
                v = y;
            else if (h == 12 || h == 14)
                v = x;
            else
                v = z;

            return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
        }

        static double fade(double t) => t * t * t * (t * (t * 6 - 15) + 10);

        static double lerp(double a, double b, double x) => a + x * (b - a);
    }

    public static class Pseudo
    {
        public static double Rand(double s1, double s2, double s3, double max = 1000000)
        {
            double a = (s1 + 86454.54) + (s1 - 524.6565) * (s1 + 684.68);
            double b = (s2 + 68454.864) + (s2 - 9865.6385) * (s2 + 1486.385);
            double c = (s3 + 3572.8563) + (s3 - 5342.357) * (s3 + 6314.52);
            double x = (int)a ^ (int)s1;
            double y = (int)b ^ (int)s2 ^ (int)s3;
            double z = (int)c ^ (int)a ^ (int)s1 + (int)c ^ (int)s2;

            return Math.Abs((x * y * z + a - s3 * y) % max);
        }

        public static double Rand01(double s1, double s2, double s3) { return Rand(s1, s2, s3, 1000000) / 1000000; }
    }
}
