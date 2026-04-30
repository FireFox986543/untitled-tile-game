class World {
    static gravity = -9.81;

    constructor() {
        this.chunks = new Map();
    }

    addChunk(chunk) {
        this.chunks.set(chunk.chunkIdx, chunk);
    }
    getChunk(idx) { return this.chunks.get(idx); }
    chunkIdxExists(idx) { return this.chunks[idx] != null; }

    #getChunkSpace(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);

        // This is outside of the bounds on the y axis
        if (y < 0 || y >= Chunk.chunkSizeY)
            return [null, x, y];

        // Convert the x coordinate into a chunkIdx
        const chunkIdx = World.getChunkId(x);
        const chunk = this.getChunk(chunkIdx);

        // This x coordinate cannot be mapped onto an existing chunk
        if (chunk == null)
            return [null, x, y];

        // If the x coordinate is in the negative range, we want to convert it to the left (0) --> right (max) format, likewise in the positives, as the chunks expect that fromat
        if (x < 0)
            // Remember - this formula is similar to the one we've used in the background rendering algorithm
            x = (Chunk.chunkSizeX + (x % Chunk.chunkSizeX)) % Chunk.chunkSizeX;
        else
            // Or otherwise make sure that the x falls into the 0 through Chunk size X (default 16, like in the block-game)
            x %= Chunk.chunkSizeX;

        return [chunk, x, y];
    }

    getGlobalTileAt(x, y) {
        const [chunk, cx, cy] = this.#getChunkSpace(x, y);

        // The coordinates couldn't be mapped onto existing chunks or is at outside of the bounds
        if (chunk == null)
            return 255;

        // Get the tile from that chunk
        return chunk.chunkTiles[scene.getIdxAtTile(cx, cy)];
    }
    setGlobalTileAt(x, y, tile) {
        const [chunk, cx, cy] = this.#getChunkSpace(x, y);

        // The coordinates couldn't be mapped onto existing chunks or is at outside of the bounds
        if (chunk == null)
            return false;

        // Set the tile from that chunk
        chunk.chunkTiles[scene.getIdxAtTile(cx, cy)] = tile;
        return true;
    }

    static getXYFromChunkXY(chunkXY, chunkID) {
        return new Vector2(
            chunkID * Chunk.chunkSizeX + chunkXY.x,
            chunkXY.y
        );
    }
    static getChunkId(x) { return Math.floor(x / Chunk.chunkSizeX); }
}

class Chunk {
    static chunkSizeX = 16;
    static chunkSizeY = 256;
    static totalSize = this.chunkSizeX * this.chunkSizeY;

    chunkIdx;
    chunkTiles;

    constructor(chunkIdx, chunkTiles) {
        this.chunkIdx = chunkIdx;
        this.chunkTiles = chunkTiles;
    }
}

class SimpleChunkGenerator {
    static generateTestChunk(chunkIdx) {
        const tilemap = new Uint8Array(Chunk.totalSize);

        // Generate perlin terrain
        for (let x = 0; x < Chunk.chunkSizeX; x++) {
            const globalX = World.getXYFromChunkXY(new Vector2(x, 0), chunkIdx).x;
            const groundLevel = Math.floor(fraction(Noise.perlin(globalX / 20 + 23.23454, 10.01, 30.01)) * 40) + 110;
            const dirtAmount = Math.round(pseudo01(x - 354.52, groundLevel + 984.523, -68.654) + 3);

            let flower = pseudo01(x + 45.45, groundLevel - 45.45, 3.435) < 0.1 ? TILES.TULIP : null;
            let stoneMat = TILES.STONE;
            let dirtMat = TILES.DIRT;
            let grassMat = TILES.GRASS;

            // Desert biome
            if (Noise.perlin(globalX / 40 + 832.168444, 486.325, -893.554) * 100 > 60) {
                stoneMat = TILES.SANDSTONE;
                dirtMat = TILES.SAND;
                grassMat = TILES.SAND;
                flower = pseudo01(x - 3425.23, groundLevel + 234.324, -5734.3) < 0.3 ? TILES.DEAD_PLANT : null;

                if (!flower) {
                    if (pseudo01(x - 9134.3425, groundLevel - 782.32, -445.34) < 0.1) {
                        flower = TILES.CACTUS;

                        for (let j = 1; j <= 3; j++)
                            if (pseudo01(x + 324.4, groundLevel + 234.342, 43.33) < 0.6)
                                tilemap[scene.getIdxAtTile(x, groundLevel + j)] = flower;
                            else
                                break;
                    }
                    else if (pseudo01(x + 5641.654, groundLevel - 68465.58, 9852.6546) < .6)
                        flower = TILES.DRY_GRASS;
                    else if (pseudo01(x + 5641.654, groundLevel - 68465.58, 9852.6546) < .72)
                        flower = TILES.BOULDERS;
                }
            }
            else if (!flower && pseudo01(x + 684.65, groundLevel - 84.3, -1011.8) < .7) {
                flower = TILES.SHORT_GRASS;

                if (pseudo01(x + 4856.86, groundLevel + 165.16, -35735.43) < .3)
                    tilemap[scene.getIdxAtTile(x, groundLevel + 2)] = flower;
            }

            for (let y = 0; y < groundLevel; y++)
                tilemap[scene.getIdxAtTile(x, y)] = (y >= groundLevel - dirtAmount) ? dirtMat : stoneMat;

            tilemap[scene.getIdxAtTile(x, groundLevel)] = grassMat;

            if (flower)
                tilemap[scene.getIdxAtTile(x, groundLevel + 1)] = flower;
        }

        // Carvers
        for (let x = 0; x < Chunk.chunkSizeX; x++) {
            for (let y = 0; y < Chunk.chunkSizeY; y++) {
                const global = World.getXYFromChunkXY(new Vector2(x, y), chunkIdx)
                const idx = scene.getIdxAtTile(x, y);

                if(Noise.perlin(global.x / 20 + 46.564, global.y / 20 - 846.35, -464.84) < .42 - clamp01(y / 1200))
                    tilemap[idx] = 0;
            }
        }

        return new Chunk(chunkIdx, tilemap);
    }
}

const TILES = Object.freeze({
    AIR: 0,
    STONE: 1,
    COBBLE_STONE: 2,
    DIRT: 3,
    GRASS: 4,
    SAND: 5,
    LOG1: 6,
    PLANK1: 7,
    LEAVES1: 8,
    LOG2: 9,
    PLANK2: 10,
    LEAVES2: 11,
    WATER: 12,
    LAVA: 13,
    OBSIDIAN: 14,
    TULIP: 15,
    CACTUS: 16,
    DEAD_PLANT: 17,
    ANCIENT_THINGY: 18,
    ANCIENT_THINGY2: 19,
    DARK_BRICKS: 20,
    DIAMOND_ORE: 21,
    SANDSTONE: 22,
    SHORT_GRASS: 23,
    LADDER: 24,
    BOULDERS: 25,
    DRY_GRASS: 26,

    BORDER_TILE: 255,
});
const TILEPROPERTIES = Object.freeze({
    [TILES.AIR]: { solid: false, breakable: false },
    [TILES.STONE]: { solid: true, breakable: true },
    [TILES.COBBLE_STONE]: { solid: true, breakable: true },
    [TILES.DIRT]: { solid: true, breakable: true },
    [TILES.GRASS]: { solid: true, breakable: true },
    [TILES.SAND]: { solid: true, breakable: true },
    [TILES.LOG1]: { solid: true, breakable: true },
    [TILES.PLANK1]: { solid: true, breakable: true },
    [TILES.LEAVES1]: { solid: false, breakable: true },
    [TILES.LOG2]: { solid: true, breakable: true },
    [TILES.PLANK2]: { solid: true, breakable: true },
    [TILES.LEAVES2]: { solid: false, breakable: true },
    [TILES.WATER]: { solid: false, breakable: false },
    [TILES.LAVA]: { solid: false, breakable: false },
    [TILES.OBSIDIAN]: { solid: true, breakable: true },
    [TILES.TULIP]: { solid: false, breakable: true },
    [TILES.CACTUS]: { solid: false, breakable: true },
    [TILES.DEAD_PLANT]: { solid: false, breakable: true },
    [TILES.ANCIENT_THINGY]: { solid: true, breakable: true },
    [TILES.ANCIENT_THINGY2]: { solid: true, breakable: true },
    [TILES.DARK_BRICKS]: { solid: true, breakable: true },
    [TILES.DIAMOND_ORE]: { solid: true, breakable: true },
    [TILES.SANDSTONE]: { solid: true, breakable: true },
    [TILES.SHORT_GRASS]: { solid: false, breakable: true },
    [TILES.LADDER]: { solid: false, breakable: true, climbable: true },
    [TILES.BOULDERS]: { solid: false, breakable: true, },
    [TILES.DRY_GRASS]: { solid: false, breakable: true, },
});

// HELPERS
function getTileProperties(tileID) { const p = TILEPROPERTIES[tileID]; return p != null ? p : { solid: true, breakable: false }; }