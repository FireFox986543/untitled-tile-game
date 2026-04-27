using System.IO.Compression;
using System.Numerics;
using System.Text.Json;

namespace server
{
    internal class Program
    {
        public const int MaxChunkDistanceServe = 4;
        public const float MaxPlayerMovement = 20f;
        public const float MinPlayerPacketInterval = 100; // In milliseconds
        public static World world;

        public static readonly bool savingEnabled = true;

        public const string saveFile = "save.bin";

        static void Main(string[] args)
        {
            Console.WriteLine("Generating world...");

            if (savingEnabled && File.Exists(saveFile))
            {
                using var fs = File.OpenRead(saveFile);
                Console.WriteLine($"Loaded world save {fs.Length} bytes");
                world = WorldSaving.GetWorld(fs);
            }
            else
            {
                Console.WriteLine("Generating new world...");
                world = new();

                for (int i = -10; i <= 10; i++)
                    world.AddChunk(Worldgen.GenerateSimpleChunk(i));
            }

            Console.WriteLine($"World has {world.chunks.Count} chunks!");

            var server = new WebSocketServer("http://+:5123/");
            server.AttachPacketHandler("chunkRequest", async data =>
            {
                try
                {
                    var playerChunkId = World.GetChunkId(data.Player.Position.X);

                    if (data.Payload.TryGetProperty("id", out var idProp))
                    {
                        var id = idProp.GetInt32();

                        // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                        if (Math.Abs(id - playerChunkId) <= MaxChunkDistanceServe)
                        {
                            if (!TryToServeChunk(id, true, out var bytes))
                                throw new Exception("Failed to generate or serve the requested chunk!");

                            await server.SendToClient(data.ClientId, JsonSerializer.Serialize(new
                            {
                                type = "chunkData",
                                coverage = "single",
                                chunk = new
                                {
                                    id,
                                    bytes
                                }
                            }));
                            return;
                        }
                        else
                            throw new Exception("The request failed, as the chunk is outside of the players vicinity!");
                    }
                    else if (data.Payload.TryGetProperty("range", out var rangeProp))
                    {
                        string rangeStr = rangeProp.GetString() ?? "";
                        var rangeSplit = rangeStr.Split(',');
                        int rangeStart, rangeEnd;

                        if (rangeStr == "player")
                        {
                            rangeStart = playerChunkId - MaxChunkDistanceServe;
                            rangeEnd = playerChunkId + MaxChunkDistanceServe;
                        }
                        else if (rangeSplit.Length != 2)
                            throw new Exception("Invalid range format!");
                        else if (!int.TryParse(rangeSplit[0], out rangeStart) || !int.TryParse(rangeSplit[1], out rangeEnd) || rangeEnd <= rangeStart)
                            throw new Exception("Invalid range format!");

                        // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                        else if (Math.Abs(playerChunkId - rangeStart) > MaxChunkDistanceServe || Math.Abs(playerChunkId - rangeEnd) > MaxChunkDistanceServe)
                            throw new Exception("The request failed, as the chunk is outside of the players vicinity!");

                        List<(int id, string bytes)> toSend = [];

                        for (int i = rangeStart; i <= rangeEnd; i++)
                        {
                            if (!TryToServeChunk(i, true, out var bytes))
                                throw new Exception("Failed to generate or serve the requested chunk!");

                            toSend.Add(new(i, bytes));
                        }

                        await server.SendToClient(data.ClientId, JsonSerializer.Serialize(new
                        {
                            type = "chunkData",
                            coverage = "range",
                            chunks = toSend.Select(c => new
                            {
                                c.id,
                                c.bytes
                            })
                        }));
                        return;
                    }
                    else if (data.Payload.TryGetProperty("multi", out var multiProp))
                    {
                        var ids = multiProp.EnumerateArray().Select(p => p.GetInt32()).ToArray();
                        List<object> chunksToSend = [];

                        foreach (var id in ids)
                        {
                            // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                            if (Math.Abs(id - playerChunkId) <= MaxChunkDistanceServe)
                            {
                                if (!TryToServeChunk(id, true, out var bytes))
                                    throw new Exception("Failed to generate or serve the requested chunk!");

                                chunksToSend.Add(new
                                {
                                    id,
                                    bytes,
                                });
                            }
                            else
                                throw new Exception("The request failed, as the chunk is outside of the players vicinity!");
                        }

                        await server.SendToClient(data.ClientId, JsonSerializer.Serialize(new
                        {
                            type = "chunkData",
                            coverage = "multi",
                            chunks = chunksToSend
                        }));
                        return;
                    }
                }
                catch (Exception ex)
                {
                    await server.SendError(data.ClientId, ex.Message);
                }
            });
            server.AttachPacketHandler("playerMovement", async data =>
            {
                try
                {
                    if (DateTime.UtcNow - data.Player.LastMovementPacket < TimeSpan.FromMilliseconds(MinPlayerPacketInterval))
                        throw new MovementPacketException("Too many movement packets sent!");

                    if (data.Payload.TryGetProperty("x", out var xProp) && data.Payload.TryGetProperty("y", out var yProp))
                    {
                        var x = xProp.GetSingle();
                        var y = yProp.GetSingle();

                        if (Vector2.DistanceSquared(data.Player.Position, new Vector2(x, y)) > MaxPlayerMovement * MaxPlayerMovement)
                            throw new MovementPacketException($"Player tried to move too far! Current position: ({data.Player.Position.X}, {data.Player.Position.Y}), attempted position: ({x}, {y})");

                        data.Player.Position = new Vector2(x, y);
                        data.Player.LastMovementPacket = DateTime.UtcNow;
                        data.Player.DirtyMovement = true;
                    }
                    else
                        throw new MovementPacketException("Invalid position update packet format!");
                }
                catch (MovementPacketException mex)
                {
                    data.Player.DirtyMovement = true;
                    await server.SendToClient(data.ClientId, JsonSerializer.Serialize(new
                    {
                        type = "playerMoved",
                        reason = mex.Message,
                        x = data.Player.Position.X,
                        y = data.Player.Position.Y,
                    }));
                }
                catch (Exception ex)
                {
                    await server.SendError(data.ClientId, ex.Message);
                }
            });
            server.AttachPacketHandler("tileModify", async data =>
            {
                try
                {
                    if (data.Payload.TryGetProperty("changes", out var changesProp))
                        foreach (var c in changesProp.EnumerateArray())
                        {
                            if (c.TryGetProperty("x", out var xProp) &&
                                c.TryGetProperty("y", out var yProp) &&
                                c.TryGetProperty("to", out var toProp))
                            {
                                var x = xProp.GetSingle();
                                var y = yProp.GetSingle();
                                var to = toProp.GetByte();

                                if (!world.SetGlobalTileAt(x, y, to))
                                    throw new Exception($"Failed to set tile at {x} {y}");

                                world.dirtyChanges.Add(new { x, y, to });
                            }
                            else
                                throw new Exception("Tile modify packet contains invalid modifications");
                        }
                }
                catch (Exception ex)
                {
                    await server.SendError(data.ClientId, ex.Message);
                }
            });

            if (savingEnabled)
                Console.CancelKeyPress += (_, _) =>
                {
                    Console.WriteLine("Saving world...");
                    var save = WorldSaving.GetBytes(world);
                    Console.WriteLine("Saved world. Size " + save.Length);

                    File.WriteAllBytes("save.bin", save);

                    Environment.Exit(0);
                };

            server.StartServer().GetAwaiter().GetResult();

            Console.WriteLine("Shutting down...");
        }

        private static bool TryToServeChunk(int id, bool generateIfNull, out string? outChunk)
        {
            var chunk = world.GetChunk(id);
            outChunk = null;

            if (chunk == null && generateIfNull)
            {
                chunk = Worldgen.GenerateSimpleChunk(id);
                world.AddChunk(chunk);
            }

            if (chunk == null)
                return false;

            using var ms = new MemoryStream();

            using (var gzip = new GZipStream(ms, CompressionLevel.Optimal))
            {
                gzip.Write(chunk.chunkTiles, 0, chunk.chunkTiles.Length);
            }

            outChunk = Convert.ToBase64String(ms.ToArray());
            return true;
        }
    }
}
