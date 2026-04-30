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
                Program.WriteLine("> " + input);

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
                        if (!Program.savingEnabled)
                            throw new Exception("Saving is disabled!");

                        Program.SaveWorld();
                        break;
                    case "echo":
                        if (args != null)
                            Program.WriteLine(string.Join(' ', args));
                        break;
                    case "kick":
                        if (arL < 0 || arL > 2 || args == null)
                            throw new Exception("You must provide 1 or 2 arguments!");

                        var cl = args[0];
                        var rs = arL == 1 ? "Kicked by operator." : args[1];

                        if (await Program.server.TryToKick(cl, rs))
                            Program.Warn("Kicked player.");
                        else
                            throw new Exception("Failed to kick player");
                        
                        break;
                    case "ls":
                        var c = Program.server.connections;

                        if(c.IsEmpty)
                        {
                            Program.WriteLine("No players connected yet.");
                            break;
                        }

                        Program.WriteLine($"Listing players ({c.Count})");

                        foreach (var (id, pl) in c)
                        {
                            Program.WriteLine($"    - [{id}] {pl.IP} {pl.Player.PlayerName}");
                        }
                        break;
                    case "tp":
                        if (arL != 3 || args == null)
                            throw new Exception("You must provide 3 arguments, (player, x, y)");

                        var pla = args[0];
                        var x = float.Parse(args[1]);
                        var y = float.Parse(args[2]);

                        await Program.server.Teleport(pla, new(x, y));

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

                                Program.world.AddChunk(Worldgen.GenerateSimpleChunk(chunkId));
                                Program.WriteLine("Generated chunk " + chunkId);
                                break;
                            case "del":
                                if (arL < 2)
                                    throw new Exception("You must provide the chunkId.");

                                chunkId = int.Parse(args[1]);

                                if (Program.world.chunks.Remove(chunkId, out _))
                                    Program.WriteLine("Removed chunk " + chunkId);
                                else
                                    throw new Exception("Failed to remove chunk " + chunkId);

                                break;
                            default:
                                throw new Exception("Unknown mode");
                        }

                        break;
                    default:
                        throw new Exception($"Unknown command '{kw}'");
                }
            }
            catch (Exception ex)
            {
                Program.Error(ex.Message);
            }
        }

        [GeneratedRegex("\\s+")]
        private static partial Regex multiSpace();
    }
}
