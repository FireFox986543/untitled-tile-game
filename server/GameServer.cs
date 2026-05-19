using System.Collections.Concurrent;
using System.IO.Compression;
using System.Numerics;
using System.Text.Json;

namespace server
{
    public class GameServer
    {
        public SocketServer server;
        public World world;

        public ConcurrentDictionary<string, ClientConnection> ClientConnections => server.connections;

        public GameServer(string uri)
        {
            server = new(uri, this);

            if (Config.SavingEnabled && File.Exists(Config.SaveFile))
            {
                using var fs = File.OpenRead(Config.SaveFile);
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

            Console.WriteLine($"World has {world.chunks.Count} chunks and {world.savedPlayers.Count} players!");

            server.AttachPacketHandler("chunkRequest", async data =>
            {
                try
                {
                    if ((DateTime.UtcNow - data.Player.LastChunkRequest).TotalMilliseconds < Config.MinChunkInterval)
                        throw new Exception("Too frequent chunk requests!");

                    var playerChunkId = World.GetChunkId(data.Player.Position.X);

                    if (data.Payload.TryGetInt("id", out var id))
                    {
                        // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                        if (Math.Abs(id - playerChunkId) <= Config.MaxChunkDistanceServe)
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
                    else if (data.Payload.TryGetString("range", out var rangeStr))
                    {
                        var rangeSplit = rangeStr.Split(',');
                        int rangeStart, rangeEnd;

                        if (rangeStr == "player")
                        {
                            rangeStart = playerChunkId - Config.MaxChunkDistanceServe;
                            rangeEnd = playerChunkId + Config.MaxChunkDistanceServe;
                        }
                        else if (rangeSplit.Length != 2)
                            throw new Exception("Invalid range format!");
                        else if (!int.TryParse(rangeSplit[0], out rangeStart) || !int.TryParse(rangeSplit[1], out rangeEnd) || rangeEnd <= rangeStart)
                            throw new Exception("Invalid range format!");

                        // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                        else if (Math.Abs(playerChunkId - rangeStart) > Config.MaxChunkDistanceServe || Math.Abs(playerChunkId - rangeEnd) > Config.MaxChunkDistanceServe)
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

                        foreach (var id2 in ids)
                        {
                            // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                            if (Math.Abs(id2 - playerChunkId) <= Config.MaxChunkDistanceServe)
                            {
                                if (!TryToServeChunk(id2, true, out var bytes))
                                    throw new Exception("Failed to generate or serve the requested chunk!");

                                chunksToSend.Add(new
                                {
                                    id = id2,
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
                finally
                {
                    data.Player.LastChunkRequest = DateTime.UtcNow;
                }
            });
            server.AttachPacketHandler("playerMovement", async data =>
            {
                try
                {
                    var delay = (DateTime.UtcNow - data.Player.LastMovementPacket).TotalMilliseconds;
                    if (delay < Config.MinPlayerPacketInterval)
                    {
                        throw new MovementPacketException("Too many movement packets sent!");
                    }

                    if (data.Payload.TryGetFloat("x", out var x) && data.Payload.TryGetFloat("y", out var y))
                    {
                        var attemptedPos = new Vector2(x, y);

                        if (Math.Abs(data.Player.Position.X - x) > Config.MaxPlayerMovementHorizontal)
                            throw new MovementPacketException($"Player tried to move too far! Current position: ({data.Player.Position.X}, {data.Player.Position.Y}), attempted position: ({x}, {y})");


                        // Check for tile collisions
                        if (data.Player.Collided(PlayerClient.points, attemptedPos))
                        {
                            data.Player.InTiles++;

                            // If the player was in tiles for longer than 3 packets of time
                            // We send back their last good position
                            if (data.Player.InTiles > 4)
                            {
                                data.Player.Position = data.Player.LastGoodPos;
                                data.Player.InTiles = 0;
                                throw new MovementPacketException($"Player tried to move inside tiles!");
                            }
                        }
                        else
                        {
                            data.Player.InTiles = 0;
                            data.Player.LastGoodPos = attemptedPos;
                        }

                        data.Player.DirtyMovement = true;
                        data.Player.Position = attemptedPos;
                        data.Player.savedState.x = x;
                        data.Player.savedState.y = y;
                    }
                    else
                        throw new MovementPacketException("Invalid position update packet format!");
                }
                catch (MovementPacketException mex)
                {
                    data.Player.DirtyMovement = true;
                    data.Player.savedState.x = data.Player.Position.X;
                    data.Player.savedState.y = data.Player.Position.Y;
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
                finally
                {
                    data.Player.LastMovementPacket = DateTime.UtcNow;
                }
            });
            server.AttachPacketHandler("tileModify", async data =>
            {
                try
                {
                    if (data.Payload.TryGetProperty("changes", out var changesProp))
                        foreach (var c in changesProp.EnumerateArray())
                        {
                            if (c.TryGetFloat("x", out var x) &&
                                c.TryGetFloat("y", out var y) &&
                                c.TryGetByte("to", out var to))
                            {
                                if (!Config.BreakingEnabled)
                                {
                                    world.dirtyChanges.Add(new { x, y, to = world.GetGlobalTileAt(x, y) });
                                    continue;
                                }

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
            server.AttachPacketHandler("sayMessage", async data =>
            {
                try
                {
                    if (DateTime.UtcNow - data.Player.LastChatPacket > TimeSpan.FromMilliseconds(Config.MaxSpamTime))
                        data.Player.SpammedMessages++;
                    else
                        data.Player.SpammedMessages = 0;

                    if (data.Player.SpammedMessages > Config.MaxSpammedAtOnce)
                    {
                        await server.DisconnectClient(data.ClientId, "Spamming is not enabled on this server!");
                        return;
                    }

                    data.Player.LastChatPacket = DateTime.UtcNow;

                    if (data.Payload.TryGetString("message", out var msg) && msg.Length > 0 && msg.Length < 256)
                        await SendChatMessage($"{data.Player.PlayerName}: {msg}");
                    else
                        throw new Exception("Invalid chat message!");
                }
                catch (Exception ex)
                {
                    await server.SendError(data.ClientId, ex.Message);
                }
            });
        }

        public async Task SendChatMessage(string msg)
        {
            Console.WriteLine("[Chat] " + msg);

            await server.Broadcast(JsonSerializer.Serialize(new
            {
                type = "chatMessage",
                message = msg,
            }));
        }
        public async Task Teleport(string clientId, Vector2 pos)
        {
            if (server.connections.TryGetValue(clientId, out var con))
            {
                con.Player.Position = pos;
                con.Player.DirtyMovement = true;
                await server.SendToClient(clientId, JsonSerializer.Serialize(new
                {
                    type = "playerMoved",
                    reason = "Teleported.",
                    x = pos.X,
                    y = pos.Y,
                }));
            }
        }
        public async Task<bool> TryToKick(string clientId, string message = "Kicked by an operator.")
        {
            if (server.connections.TryGetValue(clientId, out var con))
            {
                await server.DisconnectClient(clientId, message);
                return true;
            }

            return false;
        }

        private bool TryToServeChunk(int id, bool generateIfNull, out string? outChunk)
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

        public void SaveWorld()
        {
            Console.WriteLine("Saving world...");
            var save = WorldSaving.GetBytes(world);
            Console.WriteLine("Saved world. Size " + save.Length);

            File.WriteAllBytes("save.bin", save);
        }
    }
}
