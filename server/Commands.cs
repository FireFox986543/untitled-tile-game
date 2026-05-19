using System.Data.SqlTypes;
using System.Text.RegularExpressions;

namespace server
{
    public static partial class Commands
    {
        public static async Task Execute(string input)
        {
            try
            {
                input = input.Trim();
                Console.WriteLine("> " + input);

                input = multiSpace().Replace(input, " ");
                var p = input.Split(' ');

                if (p.Length < 1)
                    throw new Exception("Invalid command input!");

                string kw = p[0].ToLower();
                var args = p.Length > 1 ? p[1..] : null;
                var arL = args == null ? 0 : args.Length;

                switch (kw)
                {
                    case "save":
                        if (!Config.SavingEnabled)
                            throw new Exception("Saving is disabled!");

                        Program.gameServer.SaveWorld();
                        break;
                    case "echo":
                        if (args != null)
                            Console.WriteLine(string.Join(' ', args));
                        break;
                    case "kick":
                        if (arL == 0 || args == null)
                            throw new Exception("You must provide atleast one argument!");

                        var cl = args[0];
                        var rs = arL == 1 ? "Kicked by operator." : string.Join(" ", args[1..]);

                        if (await Program.gameServer.TryToKick(cl, rs))
                            Console.Warn("Kicked player.");
                        else
                            throw new Exception("Failed to kick player");

                        break;
                    case "ls":
                        var c = Program.gameServer.ClientConnections;

                        if (c.IsEmpty)
                        {
                            Console.WriteLine("No players connected yet.");
                            break;
                        }

                        Console.WriteLine($"Listing players ({c.Count})");

                        foreach (var (id, pl) in c)
                        {
                            Console.WriteLine($"    - [{id}] {pl.IP} {pl.Player.PlayerName}");
                        }
                        break;
                    case "tp":
                        if (arL != 3 || args == null)
                            throw new Exception("You must provide 3 arguments, (player, x, y)");

                        var pla = args[0];
                        var x = float.Parse(args[1]);
                        var y = float.Parse(args[2]);

                        await Program.gameServer.Teleport(pla, new(x, y));

                        break;
                    case "world":
                        if (arL < 1 || args == null)
                            throw new Exception("You must provide atleast one argument.");

                        string mode = args[0];

                        switch (mode)
                        {
                            case "gen":
                                if (arL < 2)
                                    throw new Exception("You must provide the chunkId.");

                                int chunkId = int.Parse(args[1]);

                                Program.gameServer.world.AddChunk(Worldgen.GenerateSimpleChunk(chunkId));
                                Console.WriteLine("Generated chunk " + chunkId);
                                break;
                            case "del":
                                if (arL < 2)
                                    throw new Exception("You must provide the chunkId.");

                                chunkId = int.Parse(args[1]);

                                if (Program.gameServer.world.chunks.Remove(chunkId, out _))
                                    Console.WriteLine("Removed chunk " + chunkId);
                                else
                                    throw new Exception("Failed to remove chunk " + chunkId);

                                break;
                            case "seed":
                                if (arL == 2)
                                {
                                    double seed = double.Parse(args[1]);

                                    Config.WorldSeed = seed;
                                }

                                Console.WriteLine("World seed is " + Config.WorldSeed);
                                break;
                            default:
                                throw new Exception("Unknown mode");
                        }

                        break;
                    case "break":
                        Config.BreakingEnabled = !Config.BreakingEnabled;
                        Console.WriteLine("Breaking is set to " + Config.BreakingEnabled);
                        break;
                    case "say":
                        if (arL == 0 || args == null)
                            throw new Exception("Atleast one argument is required!");

                        await Program.gameServer.SendChatMessage(string.Join(" ", args[0..]));
                        break;
                    case "exit":
                        Environment.Exit(0);
                        break;
                    default:
                        throw new Exception($"Unknown command '{kw}'");
                }
            }
            catch (Exception ex)
            {
                Console.Error(ex.Message);
            }
        }

        [GeneratedRegex("\\s+")]
        private static partial Regex multiSpace();
    }
}
