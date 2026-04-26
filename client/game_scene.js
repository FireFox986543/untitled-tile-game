class MeinkraftGameScene extends Scene {
    #sceneStart;
    #sceneEnds = undefined;
    #nextScene;
    #fadeDuration = .7;

    world;
    isMultiGame = false;

    constructor() {
        super();
        this.isMultiGame = multiGame !== null;

        this.horizontal = 0;

        this.scrollX = 0;
        this.scrollY = 0;

        this.player = null;

        this.brush = 0;

        this.DEBUG = false;
    }

    gameLoop(dt) {
        getSelectedUIElement();
        handleUIClicks();
        updateUIElements(dt);

        this.processReceivedChunks();

        if (getKeyDown(KeyCode.KeyPageUp))
            this.brush = Math.min(this.brush + 1, 255);
        if (getKeyDown(KeyCode.KeyPageDown))
            this.brush = Math.max(this.brush - 1, 0);

        let selectedTile = new Vector2(Math.floor(revTranslateX(mousePosition.x)), Math.floor(revTranslateY(mousePosition.y)));
        if (getMouseButton(0))
            this.setTileAt(selectedTile.x, selectedTile.y, this.brush);
        else if (getKeyDown(KeyCode.KeyE))
            this.brush = this.getTileAt(selectedTile.x, selectedTile.y);

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

        const keyA = getKey(KeyCode.KeyA) || getKey(KeyCode.KeyArrowLeft);
        const keyD = getKey(KeyCode.KeyD) || getKey(KeyCode.KeyArrowRight);

        this.horizontal = (keyA ? -1 : 0) + (keyD ? 1 : 0);
        this.player.syncInput(this.horizontal);

        updateEntities(dt);

        this.scrollX += (this.player.position.x - this.scrollX) * 0.2;
        this.scrollY += (this.player.position.y - this.scrollY) * 0.2;

        /*let scale = 1;

        if(getKey(KeyCode.KeyShift))
            scale = 4;
        else if(getKey(KeyCode.KeyControl))
            scale = 1000;

        if (getKey(KeyCode.KeyArrowUp))
            this.scrollY += dt * scale;
        if (getKey(KeyCode.KeyArrowDown))
            this.scrollY -= dt * scale;
        if (getKey(KeyCode.KeyArrowLeft))
            this.scrollX -= dt * scale;
        if (getKey(KeyCode.KeyArrowRight))
            this.scrollX += dt * scale;*/
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

        clearBuffer('#59b2ed');

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

        fillCircle(translateX(0), translateY(0), 10, 'purple');
        fillCircle(translateX(0), translateY(1), 10, 'darkpurple');

        let selectedTile = new Vector2(Math.floor(revTranslateX(mousePosition.x)), Math.floor(revTranslateY(mousePosition.y)));
        let onScreen = translatePoint(selectedTile)

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(onScreen.x, onScreen.y - oneTileScreenSize, oneTileScreenSize, oneTileScreenSize);

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
            ctx.fillText(`Player(xy): ${this.player.position.x.toFixed(2)} ${this.player.position.y.toFixed(2)}`, x, 120);
            ctx.fillText(`Scroll(xy): ${this.scrollX.toFixed(2)} ${this.scrollY.toFixed(2)}`, x, 140);
            ctx.fillText(`Input(x):  ${this.horizontal.toFixed(2)}`, x, 200);

            {
                ctx.textAlign = 'right';
                let x = viewport.viewRight - 20;

                ctx.fillText(`Scene: ${scene.constructor.name}`, x, 200);
            }

            ctx.textAlign = 'left';
        }

        renderUIElements();

        // Render selected brush tile
        if (this.brush > 0) {
            const renderSize = 128;
            const padding = 40;
            const tile = tileIDToClip(this.brush);
            const drawX = viewport.viewRight - padding - renderSize;
            const drawY = viewport.viewTop + padding;

            ctx.drawImage(images['tileAtlas'], Math.floor(tile.x) + 0.1, Math.floor(tile.y) + 0.1, Math.floor(tile.width) - 0.2, Math.floor(tile.height) - 0.2, drawX, drawY, renderSize, renderSize);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '72px "Jersey 10"';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(this.brush, viewport.viewRight - padding - renderSize / 2, viewport.viewTop + padding + renderSize / 2)
        }

        // Render mouse pointer
        ctx.restore();
    }

    getIdxAtTile(x, y) { return y * Chunk.chunkSizeX + x; }
    getXYCoordsFromIdx(idx) { return new Vector2(idx % Chunk.chunkSizeX, Math.floor(idx / Chunk.chunkSizeX)); }
    getTileAt(x, y) { return this.world.getGlobalTileAt(x, y); }
    setTileAt(x, y, tile) { return this.world.setGlobalTileAt(x, y, tile); }

    #loadMenu() {
        if (this.#sceneEnds !== undefined)
            return;

        this.#sceneEnds = animationNow() + this.#fadeDuration;
        this.#nextScene = new MenuScene();
        multiGame?.disconnect();
    }

    onLoad() {
        const homeArrowBtn = new UIButton(new Vector2(20, 20), '', ButtonTypes.Arrow, () => { this.#loadMenu(); }, HorizontalAlign.LEFT, VerticalAlign.TOP, HoverAnimation.apply, FlyHoverEvent.bind(.3, Vector2.left.multiply(16)));

        this.uiElements.push(homeArrowBtn);

        resetKeys();
        this.entities.length = 0;
        this.scrollX = 0;
        this.scrollY = 0;
        this.horizontal = 0;
        timeScale = 1;
        this.gameTime = 0;
        this.#sceneStart = animationNow();
        this.world = new World();

        if (this.isMultiGame) {
            multiGame.onClose = () => {
                this.#loadMenu();
            };
            this.player = new PlayerEntity(new Vector2(multiGame.playerDefPos.x, multiGame.playerDefPos.y), 6);

            if (multiGame.players.length > 0)
                multiGame.players.forEach(p => this.entities.push(p));
        }
        else {
            for (let i = -10; i <= 10; i++)
                this.world.addChunk(SimpleChunkGenerator.generateTestChunk(i));

            this.player = new PlayerEntity(new Vector2(3, 30), 6);
        }

        this.entities.push(this.player);
    }

    processReceivedChunks() {
        if (multiGame && multiGame.receivedChunks) {
            multiGame.receivedChunks.forEach(chunk => this.world.addChunk(chunk));
            multiGame.receivedChunks = null;
        }
    }
}