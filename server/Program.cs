namespace server
{
    internal class Program
    {
        static void Main(string[] args)
        {
            var server = new WebSocketServer("http://192.168.1.65:8123/");
            server.StartServer().GetAwaiter().GetResult();

            Console.WriteLine("Shutting down...");
        }
    }
}
