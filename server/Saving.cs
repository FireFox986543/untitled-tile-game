using MemoryPack;
using System.IO.Compression;

namespace server
{
    public static class WorldSaving
    {
        public static byte[] GetBytes(World world)
        {
            SavedChunk[] chunks = new SavedChunk[world.chunks.Count];

            int idx = 0;
            foreach (var (i, c) in world.chunks)
            {
                chunks[idx] = new(i, c.chunkTiles);
                idx++;
            }

            SavedPlayer[] savedPlayers = [.. world.savedPlayers.Select(p => new SavedPlayer(p.playerName, p.x, p.y))];

            SavedWorld w = new(chunks, savedPlayers, world.seed);

            var serialized = MemoryPackSerializer.Serialize(w);
            using var ms = new MemoryStream();

            using (var gzip = new GZipStream(ms, CompressionLevel.SmallestSize))
            {
                gzip.Write(serialized);
            }

            return ms.ToArray();
        }

        public static World GetWorld(FileStream fs)
        {
            using var ms = new MemoryStream();

            using (var gzip = new GZipStream(fs, CompressionMode.Decompress))
            {
                gzip.CopyTo(ms);
            }

            var save = ms.ToArray();
            var savedWorld = MemoryPackSerializer.Deserialize<SavedWorld>(save) ?? throw new Exception("Failed to load world!");
            var world = new World();
            world.savedPlayers = [.. savedWorld.players.Select(p => new PlayerSavedState(p.playerName, p.x, p.y))];

            foreach (var c in savedWorld.chunks)
                world.AddChunk(new (c.chunkId, c.bytes));

            return world;
        }
    }

    [MemoryPackable]
    public partial class SavedPlayer
    {
        public string playerName;
        public float x;
        public float y;

        public SavedPlayer(string playerName, float x, float y)
        {
            this.playerName = playerName;
            this.x = x;
            this.y = y;
        }
    }

    [MemoryPackable]
    public partial class SavedChunk
    {
        public int chunkId;
        public byte[] bytes;

        public SavedChunk(int chunkId, byte[] bytes)
        {
            this.chunkId = chunkId;
            this.bytes = bytes;
        }
    }

    [MemoryPackable]
    public partial class SavedWorld
    {
        public SavedChunk[] chunks;
        public SavedPlayer[] players;
        public double seed = 0;

        public SavedWorld(SavedChunk[] chunks, SavedPlayer[] players, double seed)
        {
            this.chunks = chunks;
            this.players = players;
            this.seed = seed;
        }
    }
}
