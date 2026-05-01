using System.Numerics;

namespace server
{
    public class PlayerClient(Vector2 position, string playerName, int playerSkin)
    {
        public Vector2 Position = position;
        public string PlayerName = playerName;
        public int PlayerSkin = playerSkin;

        public PlayerSavedState savedState;
        public DateTime LastMovementPacket = DateTime.MinValue;
        public bool DirtyMovement = false;
    }

    public class PlayerSavedState(string playerName, float x, float y)
    {
        public string playerName = playerName;
        public float x = x;
        public float y = y;
    }

    public class MovementPacketException(string message) : Exception(message) { }
}
