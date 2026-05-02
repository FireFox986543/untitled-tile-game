using System.Numerics;

namespace server
{
    public class PlayerClient(Vector2 position, string playerName, int playerSkin)
    {
        public static readonly float gravity = -9.81f;
        public static readonly Vector2 size = new(.45f, 1.8f);
        public static readonly float speed = 6f;

        public static readonly Vector2[] points = [
                new(-size.X / 2f, size.Y / 2f),
                new(size.X / 2f, size.Y / 2f),
                new(-size.X / 2f, 0f),
                new(size.X / 2f, 0f),
                new(-size.X / 2f, -size.Y / 2f),
                new(size.X / 2f, -size.Y / 2f),
        ];
        public static readonly Vector2[] northPoints = [points[0], points[1]];
        public static readonly Vector2[] eastPoints = [points[1], points[3], points[5]];
        public static readonly Vector2[] southPoints = [points[4], points[5]];
        public static readonly Vector2[] westPoints = [points[0], points[2], points[4]];

        public static readonly float stepSolverResolution = 20;

        public Vector2 Position = position;
        public Vector2 Velocity = new(0f, 0f);
        public string PlayerName = playerName;
        public int PlayerSkin = playerSkin;

        public PlayerSavedState savedState;
        public DateTime LastMovementPacket = DateTime.MinValue;
        public bool DirtyMovement = false;

        public bool onGround;

        public float horizontal;
        public float lastHorizontal;

        public bool AKey;
        public bool DKey;
        public bool WKey;

        public void Update(float dt)
        {
            var firstPos = Position;

            var keyA = AKey;
            var keyD = DKey;

            horizontal = (keyA ? -1f : 0f) + (keyD ? 1f : 0f);

            // Handle gravity
            if (onGround)
            {
                if (WKey)
                    Velocity.Y = 6.8f;
                else
                    // Push the player just a touch bit down to make sure the contact with the ground is maintained
                    Velocity.Y = -0.1f;
            }
            else
                Velocity.Y += World.gravity * dt;

            // Move the player along the x axis based on the velocities
            // If we've stopped or changed directions
            if (lastHorizontal != horizontal)
            {
                lastHorizontal = horizontal;
                Velocity.X = 0;
            }
            else
                Velocity.X = MathF.Max(MathF.Min(Velocity.X + horizontal * dt * speed, speed), -speed);

            if (MathF.Abs(Velocity.Y) > 0.01f)
            {
                // The tryToMove function returns if we've hit a collider
                // And by this way we could determine if we're grounded by checking if we moved down did we hit anything? 
                bool hitCollider = TryToMove(Velocity.Y > 0f ? 0 : 2, MathF.Abs(Velocity.Y) * dt);
                onGround = Velocity.Y < 0f && hitCollider;

                // If we hit the ceiling, give the player a little "headbump" ;D
                if (hitCollider && Velocity.Y > 0f)
                    Velocity.Y = -1f;
            }
            if (MathF.Abs(Velocity.X) > 0.01f)
            {
                bool hitCollider = TryToMove(Velocity.X > 0f ? 1 : 3, MathF.Abs(Velocity.X) * dt);

                // If we hit a wall, stop the player from going horizontally
                if (hitCollider)
                    Velocity.X = 0;
            }

            if (firstPos != Position)
                DirtyMovement = true;

            lastHorizontal = horizontal;
        }

        public bool TryToMove(int dir, float amount)
        {
            Vector2[] pointsNew = null;
            Vector2 vector = new(0f, 0f);

            switch (dir)
            {
                case 0:
                    pointsNew = northPoints;
                    vector = new Vector2(0f, 1f);
                    break;
                case 1:
                    pointsNew = eastPoints;
                    vector = new Vector2(1f, 0f);
                    break;
                case 2:
                    pointsNew = southPoints;
                    vector = new Vector2(0f, -1f);
                    break;
                case 3:
                    pointsNew = westPoints;
                    vector = new Vector2(-1f, 0f);
                    break;
            }

            if (pointsNew == null)
                throw new Exception("Unable to determine direction from 'dir' parameter! " + dir);

            var pos = Position + vector * amount;
            bool hitAnything = false;

            // We hit a collider
            if (Collided(pointsNew, pos))
            {
                hitAnything = true;
                float oneUnit = 1f / stepSolverResolution;
                pos = Position;

                for (int step = 0; step < stepSolverResolution; step++)
                {
                    var testPos = pos + vector * (amount * oneUnit);

                    // Here we've hit the wall/ceiling/floor
                    if (Collided(pointsNew, testPos))
                        break;

                    pos = testPos;
                }
            }

            Position = pos;
            return hitAnything;
        }
        public static TileProperty GetPropertiesAt(Vector2 point)
        {
            var p = World.GetTileProperties(Program.world.GetGlobalTileAt(MathF.Floor(point.X), MathF.Floor(point.Y)));
            return p;
        }
        public bool Collided(Vector2[] points, Vector2 origin)
        {
            bool collided = false;

            foreach (var p in points)
            {
                var dt = GetPropertiesAt(origin + p);

                if (dt.solid)
                {
                    collided = true;
                    break;
                }
            }

            return collided;
        }
    }

    public class PlayerSavedState(string playerName, float x, float y)
    {
        public string playerName = playerName;
        public float x = x;
        public float y = y;
    }

    public class MovementPacketException(string message) : Exception(message) { }
}
