namespace server
{
    public class Program
    {
        public static GameServer gameServer;

        public static void Main(string[] args)
        {
            _ = Console.StartConsole();

            gameServer = new GameServer("http://+:5123/");

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
