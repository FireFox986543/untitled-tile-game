using System.IO.Compression;
using System.Numerics;
using System.Text.Json;

namespace server
{
    internal class Program
    {
        public const int MaxChunkDistanceServe = 4;
        public const float MaxPlayerMovement = 20f;
        public const float MinPlayerPacketInterval = 60; // In milliseconds
        public static World world;
        public static WebSocketServer server;

        public static readonly bool savingEnabled = true;

        public const string saveFile = "save.bin";

        static void Main(string[] args)
        {
            _ = Task.Run(async () =>
            {
                while (true)
                {
                    var k = Console.ReadKey(true);

                    if (!char.IsControl(k.KeyChar))
                    {
                        input = input[..cursor] + k.KeyChar + input[cursor..];
                        cursor++;
                    }
                    else if (k.Key == ConsoleKey.Backspace && input.Length > 0 && cursor > 0)
                    {
                        input = input[..(cursor - 1)] + input[cursor..];
                        cursor--;
                    }
                    else if (k.Key == ConsoleKey.Delete && input.Length > 0 && cursor < input.Length)
                        input = input[..cursor] + input[(cursor + 1)..];
                    else if (k.Key == ConsoleKey.LeftArrow && cursor > 0)
                        cursor--;
                    else if (k.Key == ConsoleKey.RightArrow && cursor < input.Length)
                        cursor++;
                    else if (k.Key == ConsoleKey.Enter)
                    {
                        await Commands.Execute(input);
                        input = "";
                        cursor = 0;
                    }

                    DisplayInput();
                }
            });

            WriteLine("Generating world...");

            if (savingEnabled && File.Exists(saveFile))
            {
                using var fs = File.OpenRead(saveFile);
                WriteLine($"Loaded world save {fs.Length} bytes");
                world = WorldSaving.GetWorld(fs);
            }
            else
            {
                WriteLine("Generating new world...");
                world = new();

                for (int i = -10; i <= 10; i++)
                    world.AddChunk(Worldgen.GenerateSimpleChunk(i));
            }

            WriteLine($"World has {world.chunks.Count} chunks and {world.savedPlayers.Count} players!");

            server = new WebSocketServer("http://+:5123/");
            server.AttachPacketHandler("chunkRequest", async data =>
            {
                try
                {
                    var playerChunkId = World.GetChunkId(data.Player.Position.X);

                    if (data.Payload.TryGetInt("id", out var id))
                    {
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
                    else if (data.Payload.TryGetString("range", out var rangeStr))
                    {
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

                        foreach (var id2 in ids)
                        {
                            // To prevent the player from getting chunks too far way we limit the number of chunks that could be sent
                            if (Math.Abs(id2 - playerChunkId) <= MaxChunkDistanceServe)
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
            });
            server.AttachPacketHandler("playerMovement", async data =>
            {
                throw new NotImplementedException();

                try
                {
                    if (DateTime.UtcNow - data.Player.LastMovementPacket < TimeSpan.FromMilliseconds(MinPlayerPacketInterval))
                        throw new MovementPacketException("Too many movement packets sent!");

                    if (data.Payload.TryGetFloat("x", out var x) && data.Payload.TryGetFloat("y", out var y))
                    {
                        if (Vector2.DistanceSquared(data.Player.Position, new Vector2(x, y)) > MaxPlayerMovement * MaxPlayerMovement)
                            throw new MovementPacketException($"Player tried to move too far! Current position: ({data.Player.Position.X}, {data.Player.Position.Y}), attempted position: ({x}, {y})");

                        data.Player.Position = new Vector2(x, y);
                        data.Player.savedState.x = x;
                        data.Player.savedState.y = y;
                        data.Player.LastMovementPacket = DateTime.UtcNow;
                        data.Player.DirtyMovement = true;
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
                    if (data.Payload.TryGetString("message", out var msg) && msg.Length > 0 && msg.Length < 256)
                        await server.SendChatMessage($"{data.Player.PlayerName}: {msg}");
                    else
                        throw new Exception("Invalid chat message!");
                }
                catch (Exception ex)
                {
                    await server.SendError(data.ClientId, ex.Message);
                }
            });
            server.AttachPacketHandler("input", async data =>
            {
                if (data.Payload.TryGetBool("a", out var a) &&
                    data.Payload.TryGetBool("d", out var d) &&
                    data.Payload.TryGetBool("w", out var w))
                {
                    data.Player.AKey = a;
                    data.Player.DKey= d;
                    data.Player.WKey = w;
                }
            });

            if (savingEnabled)
                Console.CancelKeyPress += (_, _) =>
                {
                    SaveWorld();

                    Environment.Exit(0);
                };

            server.StartServer().GetAwaiter().GetResult();

            WriteLine("Shutting down...");
        }

        public static void GameUpdate(float dt)
        {
            foreach (var (_, c) in server.connections)
            {
                var p = c.Player;
                p.Update(dt);
            }
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

        static string input = "";
        static int cursor = 0;

        public static void Error(string err) => WriteLine("[ERROR] " + err, ConsoleColor.Red);
        public static void Warn(string w) => WriteLine("[WARN] " + w, ConsoleColor.Yellow);
        public static void WriteLine(string text, ConsoleColor color = ConsoleColor.White) => Write(text + "\n", color);
        public static void Write(string text, ConsoleColor color = ConsoleColor.White)
        {
            ClearCurrentConsoleLine();
            Console.ForegroundColor = color;
            Console.Write(text);
            Console.ForegroundColor = ConsoleColor.White;
            DisplayInput();
        }

        public static void DisplayInput()
        {
            ClearCurrentConsoleLine();
            string prefix = "> ";
            Console.Write(prefix + input);
            Console.SetCursorPosition(prefix.Length + cursor, Console.CursorTop);
        }

        public static void ClearCurrentConsoleLine()
        {
            int currentLineCursor = Console.CursorTop;
            Console.SetCursorPosition(0, Console.CursorTop);
            Console.Write(new string(' ', Console.WindowWidth));
            Console.SetCursorPosition(0, currentLineCursor);
        }



        public static void SaveWorld()
        {
            WriteLine("Saving world...");
            var save = WorldSaving.GetBytes(world);
            WriteLine("Saved world. Size " + save.Length);

            File.WriteAllBytes("save.bin", save);
        }
    }
}
