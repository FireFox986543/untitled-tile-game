using System.Numerics;

namespace server
{
    public class World
    {
        public const float gravity = -9.81f;
        public Dictionary<int, Chunk> chunks;
        public List<object> dirtyChanges = [];
        public List<PlayerSavedState> savedPlayers = [];

        public World()
        {
            chunks = [];
        }

        public void AddChunk(Chunk chunk)
        {
            chunks[chunk.chunkIdx] = chunk;
        }
        public Chunk? GetChunk(int idx) { return chunks.TryGetValue(idx, out Chunk? value) ? value : null; }
        public bool ChunkIdxExists(int idx) { return chunks.ContainsKey(idx); }

        private void GetChunkSpace(float x, float y, out Chunk? chunk, out int cX, out int cY)
        {
            x = MathF.Floor(x);
            y = MathF.Floor(y);

            cX = (int)x;
            cY = (int)y;
            chunk = null;

            // This is outside of the bounds on the y axis
            if (y < 0 || y >= Chunk.chunkSizeY)
                return;

            // Convert the x coordinate into a chunkIdx
            int chunkIdx = GetChunkId(x);
            chunk = GetChunk(chunkIdx);

            // This x coordinate cannot be mapped onto an existing chunk
            if (chunk == null)
                return;

            // If the x coordinate is in the negative range, we want to convert it to the left (0) --> right (max) format, likewise in the positives, as the chunks expect that fromat
            if (x < 0)
                // Remember - this formula is similar to the one we've used in the background rendering algorithm
                x = (Chunk.chunkSizeX + (x % Chunk.chunkSizeX)) % Chunk.chunkSizeX;
            else
                // Or otherwise make sure that the x falls into the 0 through Chunk size X (default 16, like in the block-game)
                x %= Chunk.chunkSizeX;

            cX = (int)x;
            cY = (int)y;
            return;
        }

        public byte GetGlobalTileAt(float x, float y)
        {
            GetChunkSpace(x, y, out Chunk? chunk, out int cx, out int cy);

            // The coordinates couldn't be mapped onto existing chunks or is at outside of the bounds
            if (chunk == null)
                return 255;

            // Get the tile from that chunk
            return chunk.chunkTiles[GetIdxAtTile(cx, cy)];
        }
        public bool SetGlobalTileAt(float x, float y, byte tile)
        {
            GetChunkSpace(x, y, out Chunk? chunk, out int cx, out int cy);

            // The coordinates couldn't be mapped onto existing chunks or is at outside of the bounds
            if (chunk == null)
                return false;

            // Set the tile from that chunk
            chunk.chunkTiles[GetIdxAtTile(cx, cy)] = tile;
            return true;
        }

        public static Vector2 GetXYFromChunkXY(Vector2 chunkXY, int chunkID)
        {
            return new Vector2(
                chunkID * Chunk.chunkSizeX + chunkXY.X,
                chunkXY.Y
            );
        }

        public static int GetChunkId(float x) => (int)MathF.Floor(x / Chunk.chunkSizeX);
        public static int GetIdxAtTile(int x, int y) => y * Chunk.chunkSizeX + x;
        public static Vector2 GetXYCoordsFromIdx(int idx) => new(idx % Chunk.chunkSizeX, MathF.Floor(idx / Chunk.chunkSizeX));
    }

    public class Chunk(int chunkIdx, byte[] chunkTiles)
    {
        public const int chunkSizeX = 16;
        public const int chunkSizeY = 256;
        public const int totalSize = chunkSizeX * chunkSizeY;

        public int chunkIdx = chunkIdx;
        public byte[] chunkTiles = chunkTiles;
    }

    public static class TILES
    {
        public const byte AIR = 0;
        public const byte STONE = 1;
        public const byte COBBLE_STONE = 2;
        public const byte DIRT = 3;
        public const byte GRASS = 4;
        public const byte SAND = 5;
        public const byte LOG1 = 6;
        public const byte PLANK1 = 7;
        public const byte LEAVES1 = 8;
        public const byte LOG2 = 9;
        public const byte PLANK2 = 10;
        public const byte LEAVES2 = 11;
        public const byte WATER = 12;
        public const byte LAVA = 13;
        public const byte OBSIDIAN = 14;
        public const byte TULIP = 15;
        public const byte CACTUS = 16;
        public const byte DEAD_PLANT = 17;
        public const byte ANCIENT_THINGY = 18;
        public const byte ANCIENT_THINGY2 = 19;
        public const byte DARK_BRICKS = 20;
        public const byte DIAMOND_ORE = 21;
        public const byte SANDSTONE = 22;
        public const byte SHORT_GRASS = 23;
        public const byte LADDER = 24;
        public const byte BOULDERS = 25;
        public const byte DRY_GRASS = 26;

        public const byte BORDER_TILE = 255;
    }

    public struct TileProperty(bool solid, bool breakable, bool climbable = false)
    {
        public bool solid = solid;
        public bool breakable = breakable;
        public bool climbable = climbable;
    }

    public static class TILEPROPERITES
    {
        public static readonly Dictionary<byte, TileProperty> props = new()
        {
            { TILES.AIR, new (false, false) },
            { TILES.STONE, new( true, true ) },
            { TILES.COBBLE_STONE, new( true, true ) },
            { TILES.DIRT, new( true, true ) },
            { TILES.GRASS, new( true, true ) },
            { TILES.SAND, new( true, true ) },
            { TILES.LOG1, new( true, true ) },
            { TILES.PLANK1, new( true, true ) },
            { TILES.LEAVES1, new( false, true ) },
            { TILES.LOG2, new( true, true ) },
            { TILES.PLANK2, new( true, true ) },
            { TILES.LEAVES2, new( false, true ) },
            { TILES.WATER, new( false, false ) },
            { TILES.LAVA, new( false, false ) },
            { TILES.OBSIDIAN, new( true, true ) },
            { TILES.TULIP, new( false, true ) },
            { TILES.CACTUS, new( false, true ) },
            { TILES.DEAD_PLANT, new( false, true ) },
            { TILES.ANCIENT_THINGY, new( true, true ) },
            { TILES.ANCIENT_THINGY2, new( true, true ) },
            { TILES.DARK_BRICKS, new( true, true ) },
            { TILES.DIAMOND_ORE, new( true, true) },
            { TILES.SANDSTONE, new( true, true) },
            { TILES.SHORT_GRASS, new( false, true) },
            { TILES.LADDER, new( false, true, true) },
            { TILES.BOULDERS, new( false, true) },
            { TILES.DRY_GRASS, new( false, true) },
        };
    }
}
