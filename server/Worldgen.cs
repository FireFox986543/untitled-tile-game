using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;

namespace server
{
    public static class Worldgen
    {
        public static Chunk GenerateSimpleChunk(int chunkIdx)
        {
            byte[] tilemap = new byte[Chunk.totalSize];

            // Generate perlin terrain
            for (int x = 0; x < Chunk.chunkSizeX; x++)
            {
                int globalX = (int)World.GetXYFromChunkXY(new Vector2(x, 0), chunkIdx).X;
                int groundLevel = (int)Math.Floor(PerlinNoise.Perlin(globalX / 20.0 + 23.23454, 10.01, 30.01) * 40.0);
                int dirtAmount = (int)Math.Round(Pseudo.Rand01(x - 354.52, groundLevel + 984.523, -68.654) + 3.0);

                byte flower = Pseudo.Rand01(x + 45.45, groundLevel - 45.45, 3.435) < 0.1 ? TILES.TULIP : TILES.AIR;
                byte stoneMat = TILES.STONE;
                byte dirtMat = TILES.DIRT;
                byte grassMat = TILES.GRASS;

                // Desert biome
                if (PerlinNoise.Perlin(globalX / 40.0 + 832.168444, 486.325, -893.554) * 100.0 > 60.0)
                {
                    stoneMat = TILES.SANDSTONE;
                    dirtMat = TILES.SAND;
                    grassMat = TILES.SAND;
                    flower = Pseudo.Rand01(x - 3425.23, groundLevel + 234.324, -5734.3) < 0.3 ? TILES.DEAD_PLANT : TILES.AIR;

                    if (flower == TILES.AIR)
                    {
                        if (Pseudo.Rand01(x - 9134.3425, groundLevel - 782.32, -445.34) < 0.1)
                        {
                            flower = TILES.CACTUS;

                            for (int j = 1; j <= 3; j++)
                                if (Pseudo.Rand01(x + 324.4, groundLevel + 234.342, 43.33) < 0.6)
                                    tilemap[World.GetIdxAtTile(x, groundLevel + j)] = flower;
                                else
                                    break;
                        }
                        else if (Pseudo.Rand01(x + 5641.654, groundLevel - 68465.58, 9852.6546) < .6)
                            flower = TILES.DRY_GRASS;
                        else if (Pseudo.Rand01(x + 5641.654, groundLevel - 68465.58, 9852.6546) < .72)
                            flower = TILES.BOULDERS;
                    }
                }
                else if (flower == TILES.AIR && Pseudo.Rand01(x + 684.65, groundLevel - 84.3, -1011.8) < .7)
                {
                    flower = TILES.SHORT_GRASS;

                    if (Pseudo.Rand01(x + 4856.86, groundLevel + 165.16, -35735.43) < .3)
                        tilemap[World.GetIdxAtTile(x, groundLevel + 2)] = flower;
                }

                for (int y = 0; y < groundLevel; y++)
                    tilemap[World.GetIdxAtTile(x, y)] = (y >= groundLevel - dirtAmount) ? dirtMat : stoneMat;

                tilemap[World.GetIdxAtTile(x, groundLevel)] = grassMat;

                if (flower != TILES.AIR)
                    tilemap[World.GetIdxAtTile(x, groundLevel + 1)] = flower;
            }

            return new Chunk(chunkIdx, tilemap);
        }
    }
}
