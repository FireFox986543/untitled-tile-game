using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace server
{
    public class WebSocketServer
    {
        private readonly ConcurrentDictionary<string, WebsocketConnection> connections;
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
            Console.WriteLine($"Listening on {uri}");

            //_ = Task.Run(() => ServerLoop());
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

                Console.WriteLine($"Client connected ({ip})");

                while (ws.State == WebSocketState.Open)
                {
                    var message = await ReceiveFullMessage(ws);

                    if (message == null)
                        break;

                    var doc = JsonSerializer.Deserialize<JsonElement>(message);

                    if(!doc.TryGetProperty("type", out var typeProp) || typeProp.GetString() == null)
                    {
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
                        
                        // This client was connected before
                        if(connections.TryGetValue(clientId, out var con))
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

                            if (!doc.TryGetProperty("sessionKey", out var sesProp) || sesProp.GetString() != con.SessionKey)
                            {
                                await ws.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Authentication failed", CancellationToken.None);
                                break;
                            }

                            connections[clientId] = new(ws, DateTime.UtcNow, ip, sesProp.GetString(), con.PlayerName);
                        }
                        else // The client is connecting for the first time
                        {
                            string sessionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
                            string playerName;

                            if(!doc.TryGetProperty("playerName", out var nameProp) || nameProp.GetString() == null)
                                playerName = "Player" + Random.Shared.Next(1000, 9999);
                            else
                                playerName = nameProp.GetString();

                            connections[clientId] = new(ws, DateTime.UtcNow, ip, sessionKey, playerName);

                            string sendData = JsonSerializer.Serialize(new
                            {
                                type = "auth_success",
                                sessionKey
                            });

                            await Send(ws, sendData);
                        }

                        Console.WriteLine($"Authenticated: {clientId}");
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
                        handler(new PacketData(clientId, doc));

                    connections[clientId].LastActivity = DateTime.UtcNow;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message} ({clientId})");
            }
            finally
            {
                if (ws != null && ws.State != WebSocketState.Closed)
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);

                if (clientId != null)
                    connections.TryRemove(clientId, out _);

                ws?.Dispose();
                Console.WriteLine($"Client disconnected ({clientId})");
            }
        }

        private static async Task<string?> ReceiveFullMessage(WebSocket ws)
        {
            using var ms = new MemoryStream();
            var buffer = new byte[1024];
            WebSocketReceiveResult result;

            do
            {
                result = await ws.ReceiveAsync(buffer, CancellationToken.None);

                if (result.MessageType == WebSocketMessageType.Close)
                    return null;

                if (ms.Length > 4096)
                {
                    Console.WriteLine("Message too large. Closing connection on ({clientId}).");
                    await ws.CloseAsync(WebSocketCloseStatus.MessageTooBig, "Message too large", CancellationToken.None);

                    return null;
                }

                ms.Write(buffer, 0, result.Count);

            } while (!result.EndOfMessage);

            return Encoding.UTF8.GetString(ms.ToArray());
        }
        public async Task SendToClient(string clientId, string message)
        {
            if (connections.TryGetValue(clientId, out var con) && con.Socket.State == WebSocketState.Open)
            {
                var data = Encoding.UTF8.GetBytes(message);
                await con.Socket.SendAsync(data, WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
        public async Task SendToClientBytes(string clientId, byte[] data, WebSocketMessageType type = WebSocketMessageType.Text)
        {
            if (connections.TryGetValue(clientId, out var con) && con.Socket.State == WebSocketState.Open)
                await con.Socket.SendAsync(data, type, true, CancellationToken.None);
        }
        public async Task Send(WebSocket socket, byte[] data, WebSocketMessageType type = WebSocketMessageType.Text, bool close = true)
        {
            if(socket.State == WebSocketState.Open)
                await socket.SendAsync(data, type, close, CancellationToken.None);
        }
        public async Task Send(WebSocket socket, string text, WebSocketMessageType type = WebSocketMessageType.Text, bool close = true)
        {
            if (socket.State == WebSocketState.Open)
                await socket.SendAsync(Encoding.UTF8.GetBytes(text), type, close, CancellationToken.None);
        }
        public async Task DisconnectClient(string clientId, string reason = "Disconnected by server")
        {
            if (connections.TryGetValue(clientId, out var con))
            {
                Console.WriteLine($"Client disconnected ({clientId}), reason {reason}");
                await con.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, reason, CancellationToken.None);
                connections.TryRemove(clientId, out _);
            }
        }
        public async Task Broadcast(string message)
        {
            var data = Encoding.UTF8.GetBytes(message);

            foreach (var con in connections)
                try
                {
                    if (con.Value.Socket.State == WebSocketState.Open)
                        await con.Value.Socket.SendAsync(data, WebSocketMessageType.Text, true, CancellationToken.None);
                }
                catch { }
        }

        private async Task HeartbeatLoop()
        {
            while (true)
            {
                var now = DateTime.UtcNow;
                foreach (var con in connections)
                {
                    if ((now - con.Value.LastActivity).TotalSeconds > 30)
                    {
                        Console.WriteLine($"Client timed out ({con.Key})");
                        await con.Value.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Timeout", CancellationToken.None);
                        connections.TryRemove(con.Key, out _);
                    }
                }
                await Task.Delay(10000);
            }
        }


        public void AttachPacketHandler(string type, Action<PacketData> handler)
        {
            packetHandlers[type] = handler;
        }
    }

    public class WebsocketConnection(WebSocket socket, DateTime lastActivity, IPAddress ip, string sessionKey, string playerName)
    {
        public WebSocket Socket = socket;
        public DateTime LastActivity = lastActivity;
        public IPAddress IP = ip;
        public string SessionKey = sessionKey;
        public string PlayerName = playerName;
    }

    public readonly struct PacketData(string ClientId, JsonElement Payload)
    {
        public readonly string ClientId = ClientId;
        public readonly JsonElement Payload = Payload;
    }
}
