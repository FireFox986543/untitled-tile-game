class MeinkraftGameScene extends Scene {
    #sceneStart;
    #sceneEnds = undefined;
    #nextScene;
    #fadeDuration = .7;

    world;

    constructor() {
        super();

        this.horizontal = 0;

        this.scrollX = 0;
        this.scrollY = 0;

        this.DEBUG = false;
    }

    gameLoop(dt) {
        getSelectedUIElement();
        handleUIClicks();

        if (animationNow() >= this.#sceneEnds) {
            loadScene(this.#nextScene);
            return;
        }

        if (getKeyDown(KeyCode.KeyF1))
            this.DEBUG = !this.DEBUG;

        // We clicked the home button
        if (scene !== this)
            return;

        if (timeScale === 0)
            return;

        let scale = 1;

        if(getKey(KeyCode.KeyShift))
            scale = 4;

        if (getKey(KeyCode.KeyArrowUp))
            this.scrollY -= 500 * dt * scale;
        if (getKey(KeyCode.KeyArrowDown))
            this.scrollY += 500 * dt * scale;
        if (getKey(KeyCode.KeyArrowLeft))
            this.scrollX -= 500 * dt * scale;
        if (getKey(KeyCode.KeyArrowRight))
            this.scrollX += 500 * dt * scale;
    }
    render(dt) {
        // Clear
        clearBuffer('white');
        ctx.save();

        if (animationNow() <= this.#sceneStart + this.#fadeDuration) {
            const scale = interpolateEaseOut(Math.min(1, (animationNow() - this.#sceneStart) / this.#fadeDuration), 4);
            ctx.beginPath();
            ctx.arc(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, VIRTUAL_WIDTH * scale, 0, Math.PI * 2);
            ctx.clip();
        }
        else if (animationNow() <= this.#sceneEnds) {
            const scale = interpolateEaseOut(Math.min(1, (this.#sceneEnds - animationNow()) / this.#fadeDuration), 4);
            ctx.beginPath();
            ctx.arc(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, VIRTUAL_WIDTH * scale, 0, Math.PI * 2);
            ctx.clip();
        }

        // Render xy axis lines
        if (this.DEBUG) {
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(translateX(), viewport.viewTop);
            ctx.lineTo(translateX(), viewport.viewTop + viewport.visibleHeight);
            ctx.stroke()
            ctx.beginPath();
            ctx.moveTo(viewport.viewLeft, translateY());
            ctx.lineTo(viewport.viewLeft + viewport.visibleWidth, translateY());
            ctx.stroke()
        }

        renderBackground();

        // Render entities
        const culled = renderEntities(dt);

        ctx.globalAlpha = scaleAlpha(1);

        // Render debug entries
        if (this.DEBUG) {
            ctx.fillStyle = 'black';
            ctx.font = "20px Arial";
            const x = viewport.viewLeft + 10;
            ctx.fillText(`Entities: ${this.entities.length}   culled: ${culled}`, x, 40);
            ctx.fillText(`Delta: ${dt.toFixed(4)} FPS: ${(1 / dt).toFixed(2)}`, x, 80);
            //ctx.fillText(`Player(xy): ${this.player.position.x.toFixed(2)} ${this.player.position.y.toFixed(2)}`, x, 120);
            ctx.fillText(`Scroll(xy): ${this.scrollX.toFixed(2)} ${this.scrollY.toFixed(2)}`, x, 140);
            //ctx.fillText(`Input(xy):  ${this.horizontal.toFixed(2)} ${this.vertical.toFixed(2)}`, x, 200);

            {
                ctx.textAlign = 'right';
                let x = viewport.viewRight - 20;

                ctx.fillText(`Scene: ${scene.constructor.name}`, x, 200);
            }

            ctx.textAlign = 'left';
        }

        renderUIElements();

        // Render mouse pointer
        ctx.restore();
    }

    restartGame() {
        Object.keys(keys).forEach(key => delete keys[key]);
        this.entities.length = 0;
        this.scrollX = 0;
        this.scrollY = 0;
        this.horizontal = 0;
        timeScale = 1;
        this.gameTime = 0;
        this.#sceneStart = animationNow();
        this.world = new World();

        for (let i = -5; i <= 5; i++) {
            this.world.addChunk(SimpleChunkGenerator.generateTestChunk(i));
        }
    }

    getIdxAtTile(x, y) { return y * Chunk.chunkSizeX + x; }
    getXYCoordsFromIdx(idx) { return new Vector2(idx % Chunk.chunkSizeX, Math.floor(idx / Chunk.chunkSizeX)); }
    getTileAt(x, y) { return this.world.getGlobalTileAt(x, y); }

    #loadMenu() {
        if (this.#sceneEnds !== undefined)
            return;

        this.#sceneEnds = animationNow() + this.#fadeDuration;
        this.#nextScene = new MenuScene();
    }

    onLoad() {
        const homeArrowBtn = new UIButton(new Vector2(20, 20), '', ButtonTypes.Arrow, () => { this.#loadMenu(); }, HorizontalAlign.LEFT, VerticalAlign.TOP, HoverAnimation.apply, HoverFlyAnimation.bind(.3, Vector2.left.multiply(16)));

        this.uiElements.push(homeArrowBtn);
        this.restartGame();
    }
}