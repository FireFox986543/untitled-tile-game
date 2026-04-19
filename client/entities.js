class Entity {
    constructor(position, size) {
        this.position = position;
        this.size = size;
    }

    // Note: sizes are in screen pixels, whereas the translate methods expect tile coords
    get screenX() { return translateX(this.position.x) - this.screenSize.width / 2; }
    get screenY() { return translateY(this.position.y) - this.screenSize.height / 2; }

    get screenSize() { return new Size(fromTileCoords(this.size.width), fromTileCoords(this.size.height)); }

    update(dt) { }
    render(dt, images) { }

    destroy() {
        arrayRemove(scene.entities, this);
    }
}

class PlayerEntity extends Entity {

    constructor(position, size, speed) {
        super(position, size);
        this.speed = speed;
        this.horizontal = 0;
        this.lastHorizontal = 0;
        this.velocity = new Vector2(0, 0);
        this.onGround = false;

        this.collision = {
            points: [
                new Vector2(-this.size.width / 2, this.size.height / 2),
                new Vector2(this.size.width / 2, this.size.height / 2),
                new Vector2(-this.size.width / 2, 0),
                new Vector2(this.size.width / 2, 0),
                new Vector2(-this.size.width / 2, -this.size.height / 2),
                new Vector2(this.size.width / 2, -this.size.height / 2),
            ],
            stepSolverResolution: 20,
        };
        this.collision.northPoints = [this.collision.points[0], this.collision.points[1]];
        this.collision.eastPoints = [this.collision.points[1], this.collision.points[3], this.collision.points[5]];
        this.collision.southPoints = [this.collision.points[4], this.collision.points[5]];
        this.collision.westPoints = [this.collision.points[0], this.collision.points[2], this.collision.points[4]];
    }

    syncInput(h) {
        this.lastHorizontal = this.horizontal;
        this.horizontal = h;
    }
    update(dt) {
        // Handle gravity
        if (this.onGround) {
            if (getKeyDown(KeyCode.KeySpace) || getKeyDown(KeyCode.KeyW))
                this.velocity.y = 6.8;
            else
                // Push the player just a touch bit down to make sure the contact with the ground is maintained
                this.velocity.y = -0.1;
        }
        else
            this.velocity.y += World.gravity * dt;

        // We've went inside the ground, so push the player to the top
        if (this.position.y < this.groundY)
            this.position.y = this.groundY;

        // Move the player along the x axis based on the velocities
        // If we've stopped or changed directions
        if (this.lastHorizontal !== this.horizontal) {
            this.lastHorizontal = this.horizontal;
            this.velocity.x = 0;
        }
        else
            this.velocity.x = Math.max(Math.min(this.velocity.x + this.horizontal * dt * this.speed, this.speed), -this.speed)

        //this.position = this.position.add(this.velocity.multiply(dt));

        if (Math.abs(this.velocity.y) > 0.01) {
            // The tryToMove function returns if we've hit a collider
            // And by this way we could determine if we're grounded by checking if we moved down did we hit anything? 
            let hitCollider = this.tryToMove(this.velocity.y > 0 ? DIRECTION.NORTH : DIRECTION.SOUTH, Math.abs(this.velocity.y) * dt);
            this.onGround = this.velocity.y < 0 && hitCollider;
            
            // If we hit the ceiling, give the player a little "headbump" ;D
            if(hitCollider && this.velocity.y > 0)
                this.velocity.y = -1;
        }
        if (Math.abs(this.velocity.x) > 0.01)
            this.tryToMove(this.velocity.x > 0 ? DIRECTION.EAST : DIRECTION.WEST, Math.abs(this.velocity.x) * dt);
    }
    render(dt, images) {
        ctx.drawImage(images['player'], this.screenX, this.screenY, this.screenSize.width, this.screenSize.height);

        if (!scene.DEBUG) return;
        let screenPosition = translatePoint(this.position);
        fillCircle(screenPosition.x, screenPosition.y, 3, 'pink');
    }

    tryToMove(dir, amount) {
        let pointsNew = null;
        let vector = null;

        switch (dir) {
            case DIRECTION.NORTH:
                pointsNew = this.collision.northPoints;
                vector = new Vector2(0, 1);
                break;
            case DIRECTION.EAST:
                pointsNew = this.collision.eastPoints;
                vector = new Vector2(1, 0);
                break;
            case DIRECTION.SOUTH:
                pointsNew = this.collision.southPoints;
                vector = new Vector2(0, -1);
                break;
            case DIRECTION.WEST:
                pointsNew = this.collision.westPoints;
                vector = new Vector2(-1, 0);
                break;
        }

        if (pointsNew == null)
            throw new Error("Unable to determine direction from 'dir' parameter!", dir);

        let pos = this.position.add(vector.multiply(amount));
        let hitAnything = false;

        // We hit a collider
        if (this.collided(pointsNew, pos)) {
            hitAnything = true;
            const oneUnit = 1 / this.collision.stepSolverResolution;
            pos = this.position;

            for (let step = 0; step < this.collision.stepSolverResolution; step++) {
                let testPos = pos.add(vector.multiply(amount * oneUnit));

                // Here we've hit the wall/ceiling/floor
                if (this.collided(pointsNew, testPos))
                    break;

                pos = testPos;
            }
        }

        this.position = pos;
        return hitAnything;
    }
    checkForCollision(point) { return scene.getTileAt(Math.floor(point.x), Math.floor(point.y)) !== 0; }
    collided(points, origin) {
        let collided = false;

        points.forEach(p => {
            if (this.checkForCollision(origin.add(p)))
                collided = true;
        });

        return collided;
    }

    destroy() { console.error("Sorry, you can't destroy the player!"); }
}