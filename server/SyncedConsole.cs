namespace server
{
    public class SyncedConsole
    {
        public static int Cursor => cursor;
        public static string Input => input;

        private static int cursor = 0;
        private static string input = "";

        public static Task StartConsole()
        {
            return Task.Run(async () =>
            {
                while (true)
                {
                    var k = System.Console.ReadKey(true);

                    if (!char.IsControl(k.KeyChar))
                    {
                        input = input[..cursor] + k.KeyChar + input[cursor..];
                        cursor++;
                    }
                    else if (k.Key == ConsoleKey.Backspace && input.Length > 0 && cursor > 0)
                    {
                        input = input[..(cursor - 1)] + input[cursor..];
                        cursor--;
                    }
                    else if (k.Key == ConsoleKey.Delete && input.Length > 0 && cursor < input.Length)
                        input = input[..cursor] + input[(cursor + 1)..];
                    else if (k.Key == ConsoleKey.LeftArrow && cursor > 0)
                        cursor--;
                    else if (k.Key == ConsoleKey.RightArrow && cursor < input.Length)
                        cursor++;
                    else if (k.Key == ConsoleKey.Enter)
                    {
                        await Commands.Execute(input);
                        input = "";
                        cursor = 0;
                    }

                    DisplayInput();
                }
            });
        }

        public static void Error(string err) => WriteLine("[ERROR] " + err, ConsoleColor.Red);
        public static void Warn(string w) => WriteLine("[WARN] " + w, ConsoleColor.Yellow);
        public static void WriteLine(string text, ConsoleColor color = ConsoleColor.White) => Write(text + "\n", color);
        public static void Write(string text, ConsoleColor color = ConsoleColor.White)
        {
            ClearCurrentConsoleLine();
            System.Console.ForegroundColor = color;
            System.Console.Write(text);
            System.Console.ForegroundColor = ConsoleColor.White;
            DisplayInput();
        }

        public static void DisplayInput()
        {
            ClearCurrentConsoleLine();
            string prefix = "> ";
            System.Console.Write(prefix + input);
            System.Console.SetCursorPosition(prefix.Length + cursor, System.Console.CursorTop);
        }

        public static void ClearCurrentConsoleLine()
        {
            int currentLineCursor = System.Console.CursorTop;
            System.Console.SetCursorPosition(0, System.Console.CursorTop);
            System.Console.Write(new string(' ', System.Console.WindowWidth));
            System.Console.SetCursorPosition(0, currentLineCursor);
        }
    }
}
