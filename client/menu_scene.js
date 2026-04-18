class MenuScene extends Scene {
    #sceneStart;
    #fadeDuration = .7;
    #sceneEnds = undefined;
    #nextScene;

    #mainPanel;

    constructor() {
        super();

        this.scrollX = 0;
        this.scrollY = 0;
    }

    gameLoop(dt) {
        getSelectedUIElement();
        handleUIClicks();

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
        clearBuffer('lightblue');

        ctx.font = '256px "Jersey 10"';
        ctx.fillStyle = '#de291f';
        ctx.strokeStyle = 'white';
        ctx.lineJoin = "square";
        ctx.lineCap = "square";
        ctx.miterLimit = 2;
        ctx.lineWidth = 48;
        ctx.textAlign = 'center';
        outlinedText(VIRTUAL_WIDTH / 2, 200, 0, 8, '2D MEINKRAFT');

        renderUIElements(dt);
        
        ctx.restore();
    }

    onLoad() {
        this.#mainPanel = new UIPanel();
        const playBtn = new UIButton(new Vector2(0, 120), 'PLAY GAME', ButtonTypes.RedLarge, () => { this.#playBtnClick(); }, HorizontalAlign.CENTER, VerticalAlign.BOTTOM, ScaleAndRotateAnimation.apply, HoverFlyAnimation.apply, StartFadeFlyUpAnimation.bind(.4, Vector2.up.multiply(120), false));
        playBtn.setParent(this.#mainPanel);

        this.uiElements.push(this.#mainPanel, playBtn);

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