using System.Numerics;

namespace server
{
    public class PlayerClient(Vector2 position, string playerName, int playerSkin)
    {
        public Vector2 Position = position;
        public string PlayerName = playerName;
        public int PlayerSkin = playerSkin;

        public DateTime LastMovementPacket = DateTime.MinValue;
        public bool DirtyMovement = false;
    }

    public class MovementPacketException(string message) : Exception(message) { }
}
