using System.Text.Json;

namespace server
{
    public static class JSONExtensions
    {
        public static bool TryGetString(this JsonElement e, string prop, out string s)
        {
            s = "";

            if(e.TryGetProperty(prop, out var p))
            {
                s = p.GetString() ?? "";
                return true;
            }

            return false;
        }
        public static bool TryGetInt(this JsonElement e, string prop, out int s)
        {
            s = 0;

            if (e.TryGetProperty(prop, out var p))
            {
                s = p.GetInt32();
                return true;
            }

            return false;
        }
        public static bool TryGetFloat(this JsonElement e, string prop, out float s)
        {
            s = 0;

            if (e.TryGetProperty(prop, out var p))
            {
                s = p.GetSingle();
                return true;
            }

            return false;
        }
        public static bool TryGetDouble(this JsonElement e, string prop, out double s)
        {
            s = 0;

            if (e.TryGetProperty(prop, out var p))
            {
                s = p.GetDouble();
                return true;
            }

            return false;
        }
        public static bool TryGetByte(this JsonElement e, string prop, out byte s)
        {
            s = 0;

            if (e.TryGetProperty(prop, out var p))
            {
                s = p.GetByte();
                return true;
            }

            return false;
        }
    }
}
