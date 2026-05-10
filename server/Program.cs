namespace server
{
    public class Program
    {
        public static void Main(string[] args)
        {
            _ = Console.StartConsole();

            var gameServer = new GameServer("http://+:5123/");
            // Attach this game server to the one which commands will use
            Commands.server = gameServer;

            System.Console.CancelKeyPress += (_, _) =>
            {
                if (Config.SavingEnabled)
                    gameServer.SaveWorld();

                Environment.Exit(0);
            };

            gameServer.server.StartServer().GetAwaiter().GetResult();

            Console.WriteLine("Shutting down...");
        }
    }
}
