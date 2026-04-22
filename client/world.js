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
        const chunkIdx = Math.floor(x / Chunk.chunkSizeX);
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
            return;

        // Set the tile from that chunk
        chunk.chunkTiles[scene.getIdxAtTile(cx, cy)] = tile;
    }

    static getXYFromChunkXY(chunkXY, chunkID) {
        return new Vector2(
            chunkID * Chunk.chunkSizeX + chunkXY.x,
            chunkXY.y
        );
    }
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

        for (let i = 0; i < tilemap.length; i++) {
            const c = scene.getXYCoordsFromIdx(i);
            const globalCoords = World.getXYFromChunkXY(c, chunkIdx);
            const groundLevel = 20 + Math.round(Math.sin(globalCoords.x / 4.23) * 2.5 + Math.cos(globalCoords.x / 1.8) * .6);
            let t = 0;

            // Stone + 4 layers of dirt
            if (c.y < groundLevel)
                t = c.y >= groundLevel - 4 ? TILES.DIRT : TILES.STONE;
            // At ground level there's grass
            else if (c.y === groundLevel)
                t = TILES.GRASS;

            tilemap[i] = t;
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

    BORDER_TILE: 255
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
    [TILES.DIAMOND_ORE]: { solid: true, breakable: true }
});

// HELPERS
function getTileProperties(tileID) { const p = TILEPROPERTIES[tileID]; return p != null ? p : { solid: true, breakable: false }; }