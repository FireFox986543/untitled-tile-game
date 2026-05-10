global using Console = server.SyncedConsole;

namespace server
{
    public static class Config
    {
        public static bool SavingEnabled = true;
        public static string SaveFile = "save.bin";
        public static double WorldSeed = 123;

        public static int MaxChunkDistanceServe = 4;
        public static float MinChunkInterval = 2000; // In milliseconds

        public static float MaxPlayerMovementHorizontal = 0.6f;
        public static float MinPlayerPacketInterval = 60; // In milliseconds

        public static bool BreakingEnabled = true;
    }
}
