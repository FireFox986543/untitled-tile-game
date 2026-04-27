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

            SavedWorld w = new(chunks);

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

            foreach (var c in savedWorld.chunks)
                world.AddChunk(new (c.chunkId, c.bytes));

            return world;
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

        public SavedWorld(SavedChunk[] chunks)
        {
            this.chunks = chunks;
        }
    }
}
