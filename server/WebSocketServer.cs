using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace server
{
    public class WebSocketServer
    {
        public readonly ConcurrentDictionary<string, WebsocketConnection> connections;
        private readonly string uri;
        private readonly HttpListener listener;

        private readonly Dictionary<string, Action<PacketData>> packetHandlers;

        public WebSocketServer(string uri)
        {
            connections = [];
            listener = new();
            listener.Prefixes.Add(uri);
            packetHandlers = [];

            this.uri = uri;
        }

        public async Task StartServer()
        {
            listener.Start();
            Program.WriteLine($"Listening on {uri}");

            _ = Task.Run(() => ServerLoop());
            _ = Task.Run(() => HeartbeatLoop());

            while (true)
            {
                var context = await listener.GetContextAsync();

                if (!context.Request.IsWebSocketRequest)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    continue;
                }

                _ = Task.Run(() => HandleClient(context));
            }
        }

        private async Task HandleClient(HttpListenerContext context)
        {
            WebSocket ws = null;
            string clientId = null;

            try
            {
                var wsContext = await context.AcceptWebSocketAsync(null);
                var ip = context.Request.RemoteEndPoint.Address;
                ws = wsContext.WebSocket;

                Program.Warn($"Client connected ({ip})");

                while (ws.State == WebSocketState.Open)
                {
                    var message = await ReceiveFullMessage(ws, clientId);

                    if (message == null)
                        break;

                    var doc = JsonSerializer.Deserialize<JsonElement>(message);

                    if (!doc.TryGetProperty("type", out var typeProp) || typeProp.GetString() == null)
                    {
                        if (clientId != null)
                            await DisconnectClient(clientId, "Sent invalid packet");
                        else
                            await ws.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Invalid message format", CancellationToken.None);

                        break;
                    }

                    var type = typeProp.GetString();

                    // AUTH / RECONNECT
                    if (type == "auth")
                    {
                        if (!doc.TryGetProperty("clientId", out var prop) || prop.GetString() == null)
                        {
                            await ws.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Authentication failed", CancellationToken.None);
                            break;
                        }

                        clientId = prop.GetString();
                        string sessionKey;

                        // This client was connected before
                        if (connections.TryGetValue(clientId, out var con))
                        {
                            if (con.IP.ToString() != ip.ToString())
                            {
                                await ws.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Can't reconnect with a different ip", CancellationToken.None);
                                break;
                            }

                            if (con.Socket.State == WebSocketState.Open)
                            {
                                await ws.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Client already connected", CancellationToken.None);
                                break;
                            }

                            if (!doc.TryGetProperty("sessionKey", out var sesProp) || (sessionKey = sesProp.GetString()) != con.SessionKey)
                            {
                                await ws.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Authentication failed", CancellationToken.None);
                                break;
                            }

                            connections[clientId] = new(ws, DateTime.UtcNow, ip, sesProp.GetString(), con.Player);
                        }
                        else // The client is connecting for the first time
                        {
                            sessionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
                            string playerName;
                            int playerSkin = 0;

                            if (!doc.TryGetProperty("playerName", out var nameProp) || nameProp.GetString() == null)
                                playerName = "Player" + Random.Shared.Next(1000, 9999);
                            else
                                playerName = nameProp.GetString()?.Trim();

                            if(connections.Any(x => x.Value.Player.PlayerName.Equals(playerName, StringComparison.CurrentCultureIgnoreCase)))
                            {
                                await ws.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Player with that name already logged on.", CancellationToken.None);
                                break;
                            }

                            if (doc.TryGetProperty("playerSkin", out var skinProp))
                                playerSkin = skinProp.GetInt32();
                            else
                                Program.Warn("Failed to get player skin :P");

                            connections[clientId] = new(ws, DateTime.UtcNow, ip, sessionKey, new PlayerClient(new Vector2(-10, 136), playerName, playerSkin));
                        }

                        var player = connections[clientId].Player;
                        var sp = Program.world.savedPlayers.FirstOrDefault(x => x.playerName == player.PlayerName);
                        var defPos = new Vector2(0, 136);

                        if (sp != null)
                        {
                            defPos = new(sp.x, sp.y);
                            player.savedState = sp;
                        }
                        else
                        {
                            player.savedState = new(player.PlayerName, defPos.X, defPos.Y);
                            Program.world.savedPlayers.Add(player.savedState);
                        }

                        player.Position = player.LastGoodPos = defPos;

                        var playerList = new List<object>();

                        foreach (var c in connections)
                        {
                            if (c.Key != clientId)
                                playerList.Add(new
                                {
                                    id = c.Key,
                                    playerName = c.Value.Player.PlayerName,
                                    playerSkin = c.Value.Player.PlayerSkin,
                                    x = c.Value.Player.Position.X,
                                    y = c.Value.Player.Position.Y,
                                });
                        }

                        string sendData = JsonSerializer.Serialize(new
                        {
                            type = "authSuccess",
                            sessionKey,
                            player = new
                            {
                                posX = player.Position.X,
                                posY = player.Position.Y
                            },
                            players = playerList,
                        });

                        await connections[clientId].SendSafely(sendData);

                        Program.Warn($"Authenticated: {clientId} as {player.PlayerName}");

                        await BroadcastExcept(JsonSerializer.Serialize(new
                        {
                            type = "playerConnected",
                            id = clientId,
                            playerName = player.PlayerName,
                            playerSkin = player.PlayerSkin,
                            x = player.Position.X,
                            y = player.Position.Y,
                        }), clientId);
                        await SendChatMessage($"{player.PlayerName} joined the game");
                    }
                    else if (clientId == null)
                    {
                        await ws.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Authentication failed", CancellationToken.None);
                        break;
                    }
                    else if (type == "disconnect")
                    {
                        await DisconnectClient(clientId, "Client requested disconnect");
                        break;
                    }
                    else if (type != null && packetHandlers.TryGetValue(type, out var handler))
                        handler(new PacketData(clientId, doc, connections[clientId].Player));

                    connections[clientId].LastActivity = DateTime.UtcNow;
                }
            }
            catch (Exception ex)
            {
                Program.Error($"{ex.Message} ({clientId})");
            }
            finally
            {
                await DisconnectClient(clientId);

                ws?.Dispose();
                Program.Warn($"Client disconnected ({clientId})");
            }
        }

        private async Task<string?> ReceiveFullMessage(WebSocket ws, string clientId)
        {
            using var ms = new MemoryStream();
            var buffer = new byte[1024];
            WebSocketReceiveResult result;

            if (ws.State != WebSocketState.Open)
                return null;

            do
            {
                result = await ws.ReceiveAsync(buffer, CancellationToken.None);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                    return null;
                }

                if (ms.Length > 4096)
                {
                    if (clientId != null)
                    {
                        Program.Error($"Message too large. Closing connection on ({clientId}).");
                        await DisconnectClient(clientId, "Tried to send large data");
                    }
                    else // Fallback, as we might not always know the client id, and in this case it would fail
                        await ws.CloseAsync(WebSocketCloseStatus.MessageTooBig, "Message too large.", CancellationToken.None);

                    return null;
                }

                ms.Write(buffer, 0, result.Count);

            } while (!result.EndOfMessage && ws.State == WebSocketState.Open);

            return Encoding.UTF8.GetString(ms.ToArray());
        }
        public async Task SendToClient(string clientId, string message)
        {
            if (connections.TryGetValue(clientId, out var con))
                await con.SendSafely(message);
        }
        public async Task SendToClientBytes(string clientId, byte[] data, WebSocketMessageType type = WebSocketMessageType.Text)
        {
            if (connections.TryGetValue(clientId, out var con))
                await con.SendSafely(data, type);
        }
        public async Task SendError(string clientId, string error)
        {
            await SendToClient(clientId, JsonSerializer.Serialize(new
            {
                type = "error",
                message = error
            }));
        }
        public async Task DisconnectClient(string clientId, string reason = "Disconnected by server")
        {
            if (connections.TryGetValue(clientId, out var con))
            {
                Program.Warn($"Client disconnected ({clientId}), reason {reason}");
                await con.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, reason, CancellationToken.None);
                connections.TryRemove(clientId, out _);

                // This connection is no longer considered by this method
                await Broadcast(JsonSerializer.Serialize(new
                {
                    type = "playerDisconnected",
                    id = clientId,
                }));
                await SendChatMessage($"{con.Player.PlayerName} left the game");
            }
        }
        public async Task<bool> TryToKick(string clientId, string message = "Kicked by an operator.")
        {
            if (connections.TryGetValue(clientId, out var con))
            {
                await DisconnectClient(clientId, message);
                return true;
            }

            return false;
        }
        public async Task Broadcast(string message)
        {
            var data = Encoding.UTF8.GetBytes(message);

            foreach (var con in connections)
                try
                {
                    // Note: To avoid holding up the server's work by potentially waiting, we MUST NOT await this send
                    _ = con.Value.SendSafely(data);
                }
                catch { }
        }
        public async Task BroadcastExcept(string message, string except)
        {
            var data = Encoding.UTF8.GetBytes(message);

            foreach (var con in connections)
            {
                if (con.Key == except)
                    continue;

                try
                {
                    // Note: To avoid holding up the server's work by potentially waiting, we MUST NOT await this send
                    _ = con.Value.SendSafely(data);
                }
                catch { }
            }
        }

        public async Task SendChatMessage(string msg)
        {
            Program.WriteLine("[Chat] " + msg);

            await Broadcast(JsonSerializer.Serialize(new
            {
                type = "chatMessage",
                message = msg,
            }));
        }
        public async Task Teleport(string clientId, Vector2 pos)
        {
            if (connections.TryGetValue(clientId, out var con))
            {
                con.Player.Position = pos;
                con.Player.DirtyMovement = true;
                await SendToClient(clientId, JsonSerializer.Serialize(new
                {
                    type = "playerMoved",
                    reason = "Teleported.",
                    x = pos.X,
                    y = pos.Y,
                }));
            }
        }

        private async Task HeartbeatLoop()
        {
            while (true)
            {
                try
                {
                    var now = DateTime.UtcNow;
                    foreach (var con in connections)
                    {
                        if ((now - con.Value.LastActivity).TotalSeconds > 30)
                        {
                            Program.Warn($"Client timed out ({con.Key})");
                            await DisconnectClient(con.Key, "Player timed out");
                        }
                    }
                }
                catch { }

                await Task.Delay(10_000);
            }
        }
        private async Task ServerLoop()
        {
            while (true)
            {
                try
                {
                    List<object> entities = [];

                    foreach (var c in connections)
                    {
                        var p = c.Value.Player;

                        if (p.DirtyMovement)
                            entities.Add(new
                            {
                                id = c.Key,
                                x = p.Position.X,
                                y = p.Position.Y,
                                type = "player"
                            });

                        p.DirtyMovement = false;
                    }

                    if (entities.Count > 0)
                    {
                        var data = JsonSerializer.Serialize(new
                        {
                            type = "entityUpdate",
                            entities,
                        });

                        await Broadcast(data);
                    }

                    if (Program.world.dirtyChanges.Count > 0)
                    {
                        var data = JsonSerializer.Serialize(new
                        {
                            type = "tileUpdate",
                            changes = Program.world.dirtyChanges
                        });

                        Program.world.dirtyChanges.Clear();
                        await Broadcast(data);
                    }
                }
                catch { }

                await Task.Delay(80);
            }
        }

        public void AttachPacketHandler(string type, Action<PacketData> handler)
        {
            packetHandlers[type] = handler;
        }
    }

    public class WebsocketConnection(WebSocket socket, DateTime lastActivity, IPAddress ip, string sessionKey, PlayerClient player)
    {
        public WebSocket Socket = socket;
        public DateTime LastActivity = lastActivity;
        public IPAddress IP = ip;
        public string SessionKey = sessionKey;
        public PlayerClient Player = player;

        public SemaphoreSlim sendPool = new(1, 1);

        /// This is used to avoid C# complaining about more than one concurrent send tasks happening at a time
        public async Task SendSafely(byte[] data, WebSocketMessageType type = WebSocketMessageType.Text, bool close = true)
        {
            if (Socket.State != WebSocketState.Open)
                return;

            // Wait if we're already sending a message
            await sendPool.WaitAsync();

            try
            {
                await Socket.SendAsync(data, type, close, CancellationToken.None);
            }
            catch (Exception ex)
            {
                Program.Error($"Error happened while trying to send data to websocket! " + ex.Message);
            }
            finally
            {
                sendPool.Release();
            }
        }
        public async Task SendSafely(string data, WebSocketMessageType type = WebSocketMessageType.Text, bool close = true)
        {
            await SendSafely(Encoding.UTF8.GetBytes(data), type, close);
        }
    }

    public readonly struct PacketData(string ClientId, JsonElement Payload, PlayerClient player)
    {
        public readonly string ClientId = ClientId;
        public readonly JsonElement Payload = Payload;
        public readonly PlayerClient Player = player;
    }
}
