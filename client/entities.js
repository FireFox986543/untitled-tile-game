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

    static get playerSize() { return new Size(.45, 1.8); };

    get chunkId() { return World.getChunkId(this.position.x); }

    constructor(position, speed) {
        super(position, PlayerEntity.playerSize);
        this.speed = speed;
        this.horizontal = 0;
        this.lastHorizontal = 0;
        this.velocity = new Vector2(0, 0);
        this.onGround = false;
        this.inLadder = false;
        this.jumpTime = 0;
        this.animation = '';

        this.lastChunkId = undefined;
        this.lastPosition = undefined;
        this.lastMovementPacket = scene.gameTime;
        this.lastTileChangePacket = scene.gameTime;

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

        this.clip = PlayerEntity.getPlayerClip(multiGame ? multiGame.playerSkin : Math.round(Math.random() * 4));
    }

    syncInput(h) {
        this.lastHorizontal = this.horizontal;
        this.horizontal = h;
    }
    update(dt) {
        this.inLadder = false;

        // Check if the player is inside a ladder
        this.collision.points.forEach(p => {
            const dt = this.getPropertiesAt(this.position.add(p));
            this.inLadder ||= !!dt.climbable;
        });

        if (this.inLadder) {
            // Handle movement in ladder
            const vertical = (getKey(KeyCode.KeyW) ? 1 : 0) + (getKey(KeyCode.KeyS) ? -1 : 0);

            if (vertical !== 0)
                this.velocity.y = clamp(this.velocity.y + vertical / 2, -2, 2);
            else
                this.velocity.y *= 0.95;
        }
        else {
            // Handle gravity
            if (this.onGround) {
                if (getKey(KeyCode.KeySpace) || getKey(KeyCode.KeyW)) {
                    this.velocity.y = 6.8;
                    this.animation = 'jumping';
                }
                else {
                    // Push the player just a touch bit down to make sure the contact with the ground is maintained
                    this.velocity.y = -0.1;

                    if (this.animation === 'jumping')
                        this.animation = 'idle';
                }
            }
            else
                this.velocity.y += World.gravity * dt;

                this.jumpTime = this.animation === 'jumping' ? this.jumpTime + dt : 0;
        }

        // Move the player along the x axis based on the velocities
        // If we've stopped or changed directions
        if (this.lastHorizontal !== this.horizontal) {
            this.lastHorizontal = this.horizontal;
            this.velocity.x = 0;
        }
        else
            this.velocity.x = Math.max(Math.min(this.velocity.x + this.horizontal * dt * this.speed, this.speed), -this.speed)

        if (Math.abs(this.velocity.y) > 0.01) {
            // The tryToMove function returns if we've hit a collider
            // And by this way we could determine if we're grounded by checking if we moved down did we hit anything? 
            let hitCollider = this.tryToMove(this.velocity.y > 0 ? DIRECTION.NORTH : DIRECTION.SOUTH, Math.abs(this.velocity.y) * dt);
            this.onGround = this.velocity.y < 0 && hitCollider;

            // If we hit the ceiling, give the player a little "headbump" ;D
            if (hitCollider && this.velocity.y > 0)
                this.velocity.y = -1;
        }
        if (Math.abs(this.velocity.x) > 0.01) {
            let hitCollider = this.tryToMove(this.velocity.x > 0 ? DIRECTION.EAST : DIRECTION.WEST, Math.abs(this.velocity.x) * dt);

            // If we hit a wall, stop the player from going horizontally
            if (hitCollider)
                this.velocity.x = 0;
        }

        if (this.animation !== 'jumping') {
            if (Math.abs(this.velocity.x) > 0.001)
                this.animation = 'walking';
            else
                this.animation = 'idle';
        }

        if (multiGame) {
            if (this.chunkId !== this.lastChunkId && this.lastChunkId !== undefined) {
                multiGame.requestEmptyChunks();
                multiGame.cleanUpChunks();
            }

            if (this.position !== this.lastPosition && scene.gameTime - this.lastMovementPacket > .13) {
                multiGame.sendMovementPacket();
                this.lastMovementPacket = scene.gameTime;
                this.lastPosition = this.position;
            }

            if (multiGame.tileChanges.length > 0 && scene.gameTime - this.lastTileChangePacket > .33) {
                multiGame.sendTileChanges();
                this.lastTileChangePacket = scene.gameTime;
            }
        }

        this.lastChunkId = this.chunkId;
    }
    render(dt, images) {
        const width = this.screenSize.width * 2;
        const height = this.screenSize.height;

        let upperOffsetY = 0;
        let upperOffsetX = 0;
        let armRR, armLR, legRR, legLR;

        const drawLeg = (n, x, r) => {
            ctx.save();
            ctx.translate(this.screenX + width * n + width / 8 + upperOffsetX, this.screenY + height * .625 + upperOffsetY);
            ctx.rotate(r);
            ctx.drawImage(images['player'], 4 + x, 20, 4, 12, -width / 8, 0, width / 4, height * .375);

            if (scene.DEBUG) {
                fillCircle(0, 0, 2, 'red');
                line(Vector2.zero, new Vector2(0, 100), 'brown');
            }

            ctx.restore();
        }
        const drawTorso = () => {
            ctx.save();
            ctx.translate(this.screenX + width / 4 + upperOffsetX, this.screenY + height * .25 + upperOffsetY);
            ctx.drawImage(images['player'], 4, 8, 8, 12, -width / 4, 0, width / 2, height * .375);

            if (scene.DEBUG)
                fillCircle(0, 0, 2, 'blue');

            ctx.restore();
        };
        const drawHead = (r) => {
            ctx.save();
            ctx.translate(this.screenX + width / 4 + upperOffsetX, this.screenY + height * .25 + upperOffsetY);
            ctx.rotate(r);
            // NOTE: this one's height should be 8 pixels from the source image, but to avoid rendering issues, we want to set it at almost 8 - that's why it's set at 7.9
            ctx.drawImage(images['player'], 0, 0, 16, 7.9, -width / 2, -height * .25, width, height * .25);

            if (scene.DEBUG) {
                fillCircle(0, 0, 2, 'green');
                line(Vector2.zero, new Vector2(0, 100), 'cyan');
            }

            ctx.restore();
        };
        const drawHands = (n, x, r) => {
            ctx.save();
            ctx.translate(this.screenX + width * n - width * .125 + upperOffsetX, this.screenY + height * .25 + upperOffsetY);
            ctx.rotate(r);
            ctx.drawImage(images['player'], 0 + x, 8, 4, 12, -width * .125, 0, width / 4, height * .375);

            if (scene.DEBUG) {
                fillCircle(0, 0, 2, 'red');
                line(Vector2.zero, new Vector2(0, 100), 'brown');
            }

            ctx.restore();
        }

        /*if (this.animation === 'walking') {
            upperOffsetX = Math.pow(Math.sin(animationNow() * 8 * 2), 4) * 4;
            upperOffsetY = Math.pow(Math.sin(animationNow() * 8), 4) * 4 - 2
            armLR = Math.pow(Math.sin(animationNow() * 18), 4) * .3 + .3;
            armRR = Math.pow(Math.sin(animationNow() * 18), 4) * -.3 - .3;
            legLR = Math.pow(Math.cos(animationNow() * 18), 4) * .3 + .12;
            legRR = Math.pow(Math.cos(animationNow() * 18), 4) * -.3 - .12;

            const multiplier = clamp01(Math.abs(this.velocity.x / 2));

            armLR *= multiplier;
            armRR *= multiplier;
            legLR *= multiplier;
            legRR *= multiplier;
        }
        else {
            upperOffsetX = 0;
            upperOffsetY = 0;
            armLR = 0;
            armRR = 0;
            legLR = 0;
            legRR = 0;
        }*/

        drawLeg(0, 0, legLR); // Draw left leg (4, 20)
        drawLeg(.25, 4, legRR); // Draw right leg (8, 20)
        drawTorso();
        drawHead();
        drawHands(0, 0, armLR); // Draw left hand
        drawHands(.75, 12, armRR); // Draw right hand

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
    getPropertiesAt(point) {
        const p = getTileProperties(scene.getTileAt(Math.floor(point.x), Math.floor(point.y)));
        return p;
    }
    collided(points, origin) {
        let collided = false;

        points.forEach(p => {
            const dt = this.getPropertiesAt(origin.add(p));
            if (dt.solid)
                collided = true;
        });

        return collided;
    }

    destroy() { console.error("Sorry, you can't destroy the player!"); }

    static getPlayerClip(x) {
        x %= 4;
        return new ClipRegion(11 * x, 0, 10, 34);
    }
}

class MultiPlayerEntity extends Entity {

    constructor(pos, clientId, playerName, playerSkin) {
        super(pos, PlayerEntity.playerSize);
        this.clientId = clientId;
        this.playerName = playerName;
        this.players = playerSkin;
        this.targetPosition = pos;
        this.lastPosUpdate = 0;

        this.clip = PlayerEntity.getPlayerClip(playerSkin);
    }

    update(dt) {
        this.position.x = lerp(this.position.x, this.targetPosition.x, clamp01((animationNow() - this.lastPosUpdate) / 1));
        this.position.y = lerp(this.position.y, this.targetPosition.y, clamp01((animationNow() - this.lastPosUpdate) / 1));
    }

    render(dt, images) {
        ctx.drawImage(images['player'], this.clip.x, this.clip.y, this.clip.width, this.clip.height, this.screenX, this.screenY, this.screenSize.width, this.screenSize.height);

        ctx.font = '32px "Jersey 10"';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.playerName, this.screenX + this.screenSize.width / 2, this.screenY - 20);

        if (!scene.DEBUG) return;
        let screenPosition = translatePoint(this.position);
        fillCircle(screenPosition.x, screenPosition.y, 3, 'pink');
    }
}