class GameScene extends Scene {
    #sceneStart;
    #sceneEnds = undefined;
    #nextScene;
    #fadeDuration = .7;

    #chatTimerOffset;
    #chatCursorXOffset;
    #lastChatMsg;

    world;
    isMultiGame = false;
    chatOpened = false;
    chat = [];
    #receivedFirstChunks = false;

    #lastRCChunk = new Vector2(0, 0);

    constructor() {
        super();
        this.isMultiGame = multiGame !== null;
        this.chatCatcher = new InputCatcher(() => { this.chatInput(); });
        this.chatCatcher.maxLength = 256;
        this.chatCatcher.active = true;
        this.chatCatcher.onSubmit = () => { this.chatSubmit(); };

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

        if (this.chatOpened) {
            this.chatCatcher.catch(dt);
        }
        else {
            if (getKeyDown(KeyCode.KeyPageUp))
                this.brush = Math.min(this.brush + 1, 255);
            else if (getKeyDown(KeyCode.KeyPageDown))
                this.brush = Math.max(this.brush - 1, 0);

            let selectedTile = new Vector2(Math.floor(revTranslateX(mousePosition.x)), Math.floor(revTranslateY(mousePosition.y)));
            if (getMouseButton(0)) {
                if (this.setTileAt(selectedTile.x, selectedTile.y, this.brush) && this.isMultiGame) {
                    const x = multiGame.tileChanges.find(c => c.x === selectedTile.x && c.y === selectedTile.y);

                    if (x)
                        x.to = this.brush;
                    else
                        multiGame.tileChanges.push({ x: selectedTile.x, y: selectedTile.y, to: this.brush });
                }
            }
            else if (getKeyDown(KeyCode.KeyE)) {
                this.brush = this.getTileAt(selectedTile.x, selectedTile.y);
            }
        }

        if (!this.chatOpened && getKeyDown(KeyCode.KeyT)) {
            this.chatOpened = true;
            this.chatCatcher.active = false; // Disable chat listening until the player released the key
            this.#chatTimerOffset = animationNow();
        }
        // Only enable the listener if we've released the t key
        else if (this.chatOpened && !this.chatCatcher.active && getKeyUp(KeyCode.KeyT))
            this.chatCatcher.active = true;
        else if (getKeyDown(KeyCode.KeyEscape))
            this.chatOpened = false;

        const keyA = getKey(KeyCode.KeyA) || getKey(KeyCode.KeyArrowLeft);
        const keyD = getKey(KeyCode.KeyD) || getKey(KeyCode.KeyArrowRight);

        this.horizontal = this.chatOpened ? 0 : (keyA ? -1 : 0) + (keyD ? 1 : 0);
        this.player.syncInput(this.horizontal);

        updateEntities(dt);

        if (Math.abs(this.player.position.x - this.scrollX) > 10) {
            this.scrollX = this.player.position.x;
            this.scrollY = this.player.position.y;
        }
        else {
            this.scrollX += (this.player.position.x - this.scrollX) * 0.2;
            this.scrollY += (this.player.position.y - this.scrollY) * 0.2;
        }

        const vwH2 = toTileCoords(viewport.visibleHeight2 + 2); // NOTE: +2 pixels just to avoid "unprecision"
        this.scrollY = clamp(this.scrollY, vwH2, 256 - vwH2);

        /*let scale = 1;

        if (getKey(KeyCode.KeyShift))
            scale = 4;
        else if (getKey(KeyCode.KeyControl))
            scale = 1000;

        if (getKey(KeyCode.KeyArrowUp))
            this.scrollY += dt * scale;
        if (getKey(KeyCode.KeyArrowDown))
            this.scrollY -= dt * scale;
        if (getKey(KeyCode.KeyArrowLeft))
            this.scrollX -= dt * scale;
        if (getKey(KeyCode.KeyArrowRight))
            this.scrollX += dt * scale;*/

        const curRCX = Math.floor(this.scrollX / renderChunksSize);
        const curRCY = Math.floor(this.scrollY / renderChunksSize);

        if (curRCX !== this.#lastRCChunk.x || curRCY !== this.#lastRCChunk.y)
            organizeChunks();

        this.#lastRCChunk.x = curRCX;
        this.#lastRCChunk.y = curRCY;
    }
    render(dt) {
        // Clear
        clearBuffer('white');
        ctx.save();

        let scale;

        if (animationNow() <= this.#sceneStart + this.#fadeDuration)
            scale = interpolateEaseOut(Math.min(1, (animationNow() - this.#sceneStart) / this.#fadeDuration), 4);
        else if (animationNow() <= this.#sceneEnds)
            scale = interpolateEaseOut(Math.min(1, (this.#sceneEnds - animationNow()) / this.#fadeDuration), 4);

        if (scale !== undefined) {
            ctx.beginPath();
            ctx.arc(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, VIRTUAL_WIDTH * scale, 0, Math.PI * 2);
            ctx.clip();
        }

        renderBackground();

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

        if (this.chatOpened)
            this.renderChat();
        else if ((animationNow() - this.#lastChatMsg) <= 5)
            this.renderNewMessages();

        /*for (let x = 0; x < renderChunksAmount; x++) {
            for (let y = 0; y < renderChunksAmount; y++) {
                const idx = x * renderChunksAmount + y;
                const rc = renderChunks[idx];

                ctx.fillStyle = 'green';
                ctx.font = '24px Arial';
                ctx.fillText(`${rc.x}  ${rc.y}`, x * 70 + 100 + viewport.viewLeft, y * 70 + 300);
            }
        }*/

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
            this.world.seed = Math.random() * World.seedDiff - World.seedDiff / 2;

            for (let i = -10; i <= 10; i++)
                this.world.addChunk(SimpleChunkGenerator.generateTestChunk(i));

            const startX = 4.5;
            let startY = 140;
            for (let y = 255; y >= 0; y--) {
                if(getTileProperties(this.getTileAt(startX, y)).solid) {
                    startY = y + 1.9;
                    break;
                }
            }

            this.player = new PlayerEntity(new Vector2(startX, startY), 6);
        }

        this.entities.push(this.player);

        this.scrollX = this.player.position.x;
        this.scrollY = this.player.position.y;

        if (!this.isMultiGame)
            setupTileRenderer(this.scrollX, this.scrollY);
    }

    processReceivedChunks() {
        if (multiGame && multiGame.receivedChunks) {
            multiGame.receivedChunks.forEach(chunk => this.world.addChunk(chunk));
            multiGame.receivedChunks = null;

            if (!this.#receivedFirstChunks) {
                setupTileRenderer(this.scrollX, this.scrollY);
                this.#receivedFirstChunks = true;
            }
        }
    }

    addToChat(msg) {
        if (this.chat.length >= 16)
            this.chat.shift();

        this.chat.push([msg, animationNow()]);

        this.#lastChatMsg = animationNow();
    }
    chatInput() {
        this.#chatCursorXOffset = undefined;
        this.#chatTimerOffset = animationNow();
    }
    chatSubmit() {
        const text = this.chatCatcher.text;

        if (text.startsWith('.')) {
            if (text === '.fly') {
                scene.player.flyHack = !scene.player.flyHack;
                this.addToChat(`§rHACK: fly hack is turned ${scene.player.flyHack ? 'ON' : 'OFF'}`);

                this.chatCatcher.setText('');
                return;
            }
            if (text === '.suppress') {
                multiSettings.suppressed = !multiSettings.suppressed;
                this.addToChat(`§rHACK: suppression is ${multiSettings.suppressed ? 'ON' : 'OFF'}`);

                this.chatCatcher.setText('');
                return;
            }
        }

        console.log('Player said: ' + text);

        if (this.isMultiGame)
            multiGame.sendChatMessage(text);
        else
            this.addToChat('You: ' + text);

        this.chatCatcher.setText('');
    }
    renderChat() {
        // Render inputbox
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        const padding = 10;
        const size = 60;
        const left = viewport.viewLeft + padding;
        const top = viewport.viewBottom - padding - size;
        const width = 1200;
        ctx.fillRect(left, top, width, size);

        // Render input text
        ctx.fillStyle = 'white';
        ctx.font = '48px "Jersey 10"';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        if (this.#chatCursorXOffset === undefined)
            this.#chatCursorXOffset = ctx.measureText(this.chatCatcher.text.slice(0, this.chatCatcher.cursor)).width;

        ctx.fillText(this.chatCatcher.text, left + 10, top + size / 2);

        if (fraction(animationNow() - this.#chatTimerOffset) <= 0.5)
            ctx.fillRect(left + 10 + this.#chatCursorXOffset, top + 4, 1, size - 8);

        // Render chat messages
        if (this.chat.length > 0) {
            const l = this.chat.length * size;
            const start = top - 10 - l;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(left, start, width, l);

            for (let i = this.chat.length - 1; i >= 0; i--) {
                let msg = this.chat[i][0];

                const startY = start + (i + .5) * size;
                const [col, has] = this.getChatColor(msg);
                ctx.fillStyle = col;

                if (has)
                    msg = msg.substring(2, msg.length);

                ctx.fillText(msg, left + 10, startY);
            }
        }
    }
    renderNewMessages() {
        // Render chat messages
        const padding = 10;
        const size = 60;
        const left = viewport.viewLeft + padding;
        const top = viewport.viewBottom - padding - size;
        const width = 1200;
        const msgs = this.chat.filter((c) => { return (animationNow() - c[1]) <= 5; });

        const l = msgs.length * size;
        const start = top - 10 - l;

        ctx.font = '48px "Jersey 10"';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        for (let i = msgs.length - 1; i >= 0; i--) {
            ctx.globalAlpha = scaleAlpha(1 - clamp01(animationNow() - (msgs[i][1] + 4)));
            let msg = msgs[i][0];

            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(left, start + i * size, width, size);

            const startY = start + (i + .5) * size;
            const [col, has] = this.getChatColor(msg);
            ctx.fillStyle = col;

            if (has)
                msg = msg.substring(2, msg.length);

            ctx.fillText(msg, left + 10, startY);

            ctx.globalAlpha = scaleAlpha(1);
        }
    }
    getChatColor(msg) {
        if (msg.startsWith('§') && msg.length > 1) {
            switch (msg[1]) {
                case 'r':
                    return ['red', true];
                case 'g':
                    return ['green', true];
                case 'b':
                    return ['blue', true];
                case 'w':
                    return ['white', true];
                case 'b':
                    return ['black', true];
                default:
                    return ['white', true];
            }
        }

        return ['white', false];
    }
}