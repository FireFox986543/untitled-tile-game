class MenuScene extends Scene {
    #sceneStart;
    #fadeDuration = .7;
    #sceneEnds = undefined;
    #nextScene;

    constructor() {
        super();

        this.scrollX = 0;
        this.scrollY = 0;
    }

    gameLoop(dt) {
        getSelectedUIElement();
        handleUIClicks();
        updateUIElements(dt);

        if (animationNow() >= this.#sceneEnds) {
            loadScene(this.#nextScene);
            return;
        }
    }
    render(dt) {
        // Clear, Render background
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

        // This is only for the first fade in that happens when the player loads the document, not when the scene changes
        // At later points the scene changes will be covered with the circleing animation
        globalAlpha = interpolateEaseOut(Math.min(1, (animationNow()) / .5), 4);
        ctx.globalAlpha = scaleAlpha(1);

        // Draw "background", so this way loading animations still work
        clearBuffer('#59b2ed');

        ctx.font = '256px "Jersey 10"';
        ctx.fillStyle = '#434343';
        ctx.strokeStyle = 'white';
        ctx.lineJoin = "square";
        ctx.lineCap = "square";
        ctx.miterLimit = 2;
        ctx.lineWidth = 48;
        ctx.textAlign = 'center';
        outlinedText(VIRTUAL_WIDTH / 2, 200, 0, 8, 'MEINKRAFT');

        renderUIElements(dt);

        ctx.restore();
    }

    onLoad() {
        const mainPanel = new UIPanel();
        const playBtn = new UIButton(new Vector2(0, 120), 'PLAY GAME', ButtonTypes.RedLarge, () => { playModesPanel.setActive(true); mainPanel.setActive(false); }, HorizontalAlign.CENTER, VerticalAlign.BOTTOM, ScaleAndRotateAnimation.apply, FlyHoverEvent.apply, FadeFlyStartAnimation.bind(.4, Vector2.up.multiply(120), false));
        playBtn.setParent(mainPanel);
        
        const playModesPanel = new UIPanel();
        const singleplayerBtn = new UIButton(new Vector2(-220, 0), 'SINGLEPLAYER', ButtonTypes.GreenSmall, () => { this.#playBtnClick(); }, HorizontalAlign.CENTER, VerticalAlign.CENTER, HoverAnimation.apply, FlyHoverEvent.apply, FadeFlyStartAnimation.bind(.4, Vector2.up.multiply(60), false));
        singleplayerBtn.setParent(playModesPanel);
        const multiplayerBtn = new UIButton(new Vector2(220, 0), 'MULTIPLAYER', ButtonTypes.BlueSmall, () => { playModesPanel.setActive(false); multiPanel.setActive(true); }, HorizontalAlign.CENTER, VerticalAlign.CENTER, HoverAnimation.apply, FlyHoverEvent.apply, FadeFlyStartAnimation.bind(.4, Vector2.up.multiply(60), false));
        multiplayerBtn.setParent(playModesPanel);
        const backBtn = new UIButton(new Vector2(0, 200), 'BACK', ButtonTypes.RedSmall, () => { playModesPanel.setActive(false); mainPanel.setActive(true); }, HorizontalAlign.CENTER, VerticalAlign.CENTER, HoverAnimation.apply, FlyHoverEvent.apply, FadeFlyStartAnimation.bind(.4, Vector2.up.multiply(60), false));
        backBtn.setParent(playModesPanel);
        playModesPanel.setActive(false);

        const multiPanel = new UIPanel();
        const multiBackBtn = new UIButton(new Vector2(0, 200), 'BACK', ButtonTypes.RedSmall, () => { multiPanel.setActive(false); playModesPanel.setActive(true); }, HorizontalAlign.CENTER, VerticalAlign.CENTER, HoverAnimation.apply, FlyHoverEvent.apply, FadeFlyStartAnimation.bind(.4, Vector2.up.multiply(60), false));
        multiBackBtn.setParent(multiPanel);
        const ipInput = new UIInputField(Vector2.zero, null, 'Enter ip...', 15, HorizontalAlign.CENTER, VerticalAlign.CENTER, null, null, null, TextAlign.CENTER);
        ipInput.setParent(multiPanel);
        const infoText = new UIText(new Vector2(0, -100), '', 'black', TextAlign.CENTER, 48, 'Jersey 10', HorizontalAlign.CENTER, VerticalAlign.CENTER);
        infoText.setParent(multiPanel);
        const connectBtn = new UIButton(new Vector2(380, 0), '', ButtonTypes.ArrowSmall, () => { }, HorizontalAlign.CENTER, VerticalAlign.CENTER, null, FlyHoverEvent.bind(.3, Vector2.right.multiply(8)), null);
        connectBtn.setParent(multiPanel);
        multiPanel.setActive(false);
        
        this.uiElements.push(mainPanel, playBtn, playModesPanel, singleplayerBtn, multiplayerBtn, backBtn, multiBackBtn, multiPanel, ipInput, infoText, connectBtn);

        if (animationNow() > 1)
            this.#sceneStart = animationNow();
        else // If we didn't start the game yet
            this.#sceneStart = -1 / 0;
    }

    #playBtnClick() {
        if (this.#sceneEnds !== undefined)
            return;

        this.#sceneEnds = animationNow() + this.#fadeDuration;
        this.#nextScene = new MeinkraftGameScene();
    }
}