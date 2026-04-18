class World {
    constructor() {
        this.chunks = new Map();
    }

    addChunk(chunk) {
        this.chunks.set(chunk.chunkIdx, chunk);
    }
    getChunk(idx) { return this.chunks.get(idx); }
    chunkIdxExists(idx) { return this.chunks[idx] != null; }

    getGlobalTileAt(x, y) {
        // This is outside of the bounds on the y axis
        if(y < 0 || y >= Chunk.chunkSizeY)
            return 1;

        // Convert the x coordinate into a chunkIdx
        const chunkIdx = Math.floor(x / Chunk.chunkSizeX);
        const chunk = this.getChunk(chunkIdx);

        // This x coordinate cannot be mapped onto an existing chunk
        if(chunk == null)
            return 1;

        // If the x coordinate is in the negative range, we want to convert it to the left (0) --> right (max) format, likewise in the positives, as the chunks except that fromat
        if(x < 0)
            // Remember - this formula is similar to the one we've used in the background rendering algorithm
            x = (Chunk.chunkSizeX + (x % Chunk.chunkSizeX)) % Chunk.chunkSizeX;
        else
            // Or otherwise make sure that the x falls into the 0 through Chunk size X (default 16, like in the block-game)
            x %= Chunk.chunkSizeX;

        // Get the tile from that chunk
        return chunk.chunkTiles[scene.getIdxAtTile(x, y)];
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
            let t = 0;

            // 19 tiles of stone
            if(c.y < 20)
                t = 3;
            // At y = 20 there's grass
            else if (c.y === 20)
                t = 2;
            /*// At x = 0 we generate a chunkIdx tall pillar of blocks
            else if (c.x === 0 && c.y > 30 && c.y <= 30 + chunkIdx)
                t = 4;*/

            tilemap[i] = t;
        }

        return new Chunk(chunkIdx, tilemap);
    }
}