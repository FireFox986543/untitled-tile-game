using System.Drawing;
using System.Numerics;

namespace server
{
    public class PlayerClient(Vector2 position, string playerName, int playerSkin)
    {
        public Vector2 Position = position;
        public Vector2 LastGoodPos;
        public string PlayerName = playerName;
        public int PlayerSkin = playerSkin;

        public PlayerSavedState savedState;
        public bool DirtyMovement = false;

        public DateTime LastMovementPacket = DateTime.MinValue;
        public DateTime LastChunkRequest = DateTime.MinValue;
        public int InTiles = 0;

        public DateTime LastChatPacket = DateTime.MinValue;
        public int SpammedMessages = 0;

        public static readonly Vector2 size = new(.45f, 1.8f);

        public static readonly Vector2[] points = [
                new(-size.X / 2f, size.Y / 2f),
                new(size.X / 2f, size.Y / 2f),
                new(-size.X / 2f, 0f),
                new(size.X / 2f, 0f),
                new(-size.X / 2f, -size.Y / 2f),
                new(size.X / 2f, -size.Y / 2f),
        ];

        public bool Collided(Vector2[] points, Vector2 origin)
        {
            bool collided = false;

            foreach (var p in points)
            {
                var dt = Program.gameServer.world.GetPropertiesAt(origin + p);

                if (dt.solid)
                {
                    collided = true;
                    break;
                }
            }

            return collided;
        }
    }

    public class PlayerSavedState(string playerName, float x, float y)
    {
        public string playerName = playerName;
        public float x = x;
        public float y = y;
    }

    public class MovementPacketException(string message) : Exception(message) { }
}
