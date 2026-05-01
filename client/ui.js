let pointerType = PointerTypes.POINTER;
let selectedUIElement = null;

class UIElement {
    #enabled;
    #shadowed;
    selectable;

    constructor(rect, horizontalAlign = 0, verticalAlign = 0) {
        this.rect = rect;
        this.#enabled = true;
        this.#shadowed = false; // Shadowing means that one ancestor is disabled, so this one is considered inactive
        this.parent = null; // Null parent means it's attached to nothing
        this.children = [];
        this.horizontalAlign = horizontalAlign;
        this.verticalAlign = verticalAlign;
        this.selectable = true; // Can we select this element, aka catches ui events
    }

    #posHelper(align, offset, size) {
        switch (align) {
            case 1:
                return offset - size / 2;
            case 2:
                return -offset - size;
            default:
                return offset;
        }
    }
    get x() { return viewport.viewLeft + viewport.visibleWidth2 * this.horizontalAlign + this.#posHelper(this.horizontalAlign, this.rect.x, this.width); }
    get y() { return viewport.viewTop + viewport.visibleHeight2 * this.verticalAlign + this.#posHelper(this.verticalAlign, this.rect.y, this.height); }
    get width() { return this.rect.width; }
    get height() { return this.rect.height; }

    get enabled() { return this.#enabled; }
    set enabled(value) { this.setActive(value); }
    get shadowed() { return this.#shadowed; }
    set shadowed(value) { this.setShadowed(value); }

    // Whether this element is truly active, based on shadowing
    get isActive() { return !this.#shadowed && this.#enabled; }

    render(dt) { }
    update(dt) { }
    onMouseEnter() { }
    onMouseExit() { }
    onMouseClick(btn) { }

    isMyChild(child) { return this.children.indexOf(child) > -1; }
    appendMultiple(...children) { children.forEach(c => this.appendChild(c)); }
    appendChild(child) {
        if (this.isMyChild(child))
            return;

        this.children.push(child);
        child.parent = this;
    }
    detachChild(child) {
        if (!this.isMyChild(child))
            return;

        arrayRemove(this.children, child);
        child.parent = null;
    }
    setParent(parent) {
        if (parent === null) {
            parent = null;
            return;
        }

        parent.appendChild(this);
    }
    separateParent() {
        this.parent.detachChild(this);
    }

    setShadowed(value) {
        this.#shadowed = value;

        if (this.#enabled)
            this.children.forEach(c => c.setShadowed(value));
    }
    setActive(value) {
        this.#enabled = value;

        if (this.children.length > 0 && !this.shadowed)
            this.children.forEach(c => c.setShadowed(!value));
    }
}
class UIAnimated extends UIElement {
    mouseOver = false
    hoverStart = 0;
    hoverEnd = 0;
    activeTime = 0;

    get inStartAnimDuration() { return this.startAnimation !== null && animationNow() <= this.activeTime + this.startAnimation.duration; }

    constructor(point, clip, horizontalAlign = 0, verticalAlign = 0, animation = null, hoverAnimation = null, startAnimation = null) {
        super(new Rect(point.x, point.y, clip.width * clip.scale, clip.height * clip.scale), horizontalAlign, verticalAlign);
        this.mouseOver = false;
        this.animation = animation;
        this.hoverAnimation = hoverAnimation;
        this.startAnimation = startAnimation;
        this.activeTime = animationNow();
    }

    render(dt) {
        let renderPoint = new Vector2(this.x, this.y);

        if (this.startAnimation !== null && this.inStartAnimDuration) {
            // Temporarly disable hovering effects by turning off selection for this element
            this.selectable = false;
            this.startAnimation.render(this);
        }
        else {
            // Re-enable selection after the start animation is finished
            this.selectable = true;

            // Don't let hover effects play if playing start animations
            if (this.hoverAnimation !== null)
                // In the anim function we pass in this to refer to this ui element, it WON't return a new position (yet)
                this.hoverAnimation(this);
        }

        if (this.animation !== null)
            // In the anim function we pass in this to refer to this ui element, also it will return the new position after the animation
            renderPoint = this.animation(this);

        return renderPoint;
    }

    onMouseEnter() {
        pointerType = PointerTypes.HAND;
        this.mouseOver = true;
        this.hoverStart = animationNow();
    }
    onMouseExit() {
        pointerType = PointerTypes.POINTER;
        this.mouseOver = false;
        this.hoverEnd = animationNow();
    }

    setShadowed(value) {
        super.setShadowed(value);

        if (this.startAnimation !== null && this.startAnimation.shadowingUpdates)
            this.activeTime = value ? -1000 : animationNow();
    }
    setActive(value) {
        super.setActive(value); // Handle normal logic

        this.activeTime = value ? animationNow() : -1000;
    }
}
class UIButton extends UIAnimated {
    constructor(point, text, buttonType, clicked, horizontalAlign = 0, verticalAlign = 0, animation = null, hoverAnimation = null, startAnimation = null, textAlign = TextAlign.CENTER) {
        const clip = UIAtlas[buttonType];
        super(point, clip, horizontalAlign, verticalAlign, animation, hoverAnimation, startAnimation);
        this.text = text;
        this.buttonType = buttonType;
        this.clicked = clicked;
        this.textAlign = textAlign;
    }

    render() {
        const renderPoint = super.render();

        renderButton(UIAtlas[`${this.mouseOver ? "HL_" : ""}${this.buttonType}`], this.text, this.textAlign, renderPoint.x, renderPoint.y);
        ctx.globalAlpha = scaleAlpha(1);
    }

    onMouseClick(btn) { this.clicked(btn); }
}
class UIInputField extends UIAnimated {
    get text() { return this.catcher.text; }
    get cursor() { return this.catcher.cursor; }

    constructor(point, onInput = null, placeholder = '', maxLength = 1024, horizontalAlign = 0, verticalAlign = 0, animation = null, hoverAnimation = null, startAnimation = null, textAlign = TextAlign.LEFT) {
        const clip = UIAtlas['InputField'];
        super(point, clip, horizontalAlign, verticalAlign, animation, hoverAnimation, startAnimation);
        this.onInput = onInput;
        this.placeholder = placeholder;
        this.textAlign = textAlign;

        this.catcher = new InputCatcher(() => { this.catched(); });
        // We'll keep this catcher always alive, and only call catch when needed
        this.catcher.active = true;
        this.catcher.maxLength = maxLength;

        this.cursorXOffset = undefined;
        this.textLength = undefined;
        this.selected = false;
        this.timerOffset = animationNow();
    }

    render() {
        const renderPoint = super.render();

        renderInputField(this, UIAtlas[`${this.mouseOver || this.selected ? "HL_" : ""}InputField`], this.catcher.text.length === 0, renderPoint.x, renderPoint.y);
        ctx.globalAlpha = scaleAlpha(1);
    }

    update(dt) {
        if (getMouseButtonDown(MouseButtons.LEFT) && !this.mouseOver) {
            this.catcher.cursor = 0;
            this.selected = false;
            this.cursorXOffset = undefined;
            this.textLength = undefined;
            return;
        }

        if(this.selected)
            this.catcher.catch(dt);
    }
    
    catched() {
        this.timerOffset = animationNow();
        this.cursorXOffset = undefined;
        this.textLength = undefined;
    }

    onMouseClick(btn) {
        if (btn === MouseButtons.LEFT && !this.selected) {
            this.catcher.cursor = this.catcher.text.length;
            this.selected = true;
            this.cursorXOffset = undefined;
            this.textLength = undefined;

            this.timerOffset = animationNow();
        }
    }
}
class UIText extends UIAnimated {
    constructor(point, text, color, textAlign = 0, fontSize = 32, font = 'Jersey 10', horizontalAlign = 0, verticalAlign = 0, animation = null, hoverAnimation = null, startAnimation = null) {
        super(point, ClipRegion.identity, horizontalAlign, verticalAlign, animation, hoverAnimation, startAnimation);
        this.selectable = false;
        this.text = text;
        this.color = color;
        this.textAlign = textAlign;
        this.fontSize = fontSize;
        this.font = font;
    }

    render() {
        const renderPoint = super.render();

        ctx.font = `${this.fontSize}px "${this.font}"`;
        ctx.fillStyle = this.color;
        const before = [ctx.textBaseline, ctx.textAlign];
        ctx.textBaseline = 'middle';
        ctx.textAlign = this.textAlign;

        ctx.fillText(this.text, renderPoint.x, renderPoint.y);

        ctx.textBaseline = before[0];
        ctx.textAlign = before[1];
    }
}
class UIPanel extends UIElement {
    constructor() { super(Rect.identity); }
}

function setPointer(pt) { pointerType = pt; }
function renderPointer() {
    const transf = ctx.getTransform();
    const scale = Math.sin(animationNow() * 1.3) / 50 + 1 + (1 / 50);
    ctx.translate(mousePosition.x - pointerType.hotspot.x, mousePosition.y - pointerType.hotspot.y)
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1; // The pointer must be always opaque!!!
    ctx.drawImage(images['pointer' + pointerType.id], 0, 0, 100, 100);
    ctx.setTransform(transf);
}
function renderButton(clip, text, textAlign, x, y) {
    ctx.drawImage(images[clip.atlas], clip.x + 0.1, clip.y + 0.1, clip.width - 0.2, clip.height - 0.2, x, y, clip.width * clip.scale, clip.height * clip.scale);
    ctx.font = '64px "Jersey 10"';
    ctx.fillStyle = 'white';
    let xOffset = alignedInputHelper(textAlign, clip);
    const before = ctx.textBaseline;
    ctx.textBaseline = 'middle';
    ctx.textAlign = textAlign;
    ctx.fillText(text, x + xOffset, y + clip.height * clip.scale / 2)
    ctx.textBaseline = before;
}
function renderInputField(inputField, clip, isPlaceholder, x, y) {
    ctx.drawImage(images[clip.atlas], clip.x + 0.1, clip.y + 0.1, clip.width - 0.2, clip.height - 0.2, x, y, clip.width * clip.scale, clip.height * clip.scale);
    ctx.font = '64px "Jersey 10"';
    ctx.fillStyle = isPlaceholder ? 'gray' : 'black';
    let xOffset = alignedInputHelper(inputField.textAlign, clip);
    const before = [ctx.textBaseline, ctx.textAlign];
    ctx.textBaseline = 'middle';
    ctx.textAlign = inputField.textAlign;

    ctx.fillText(isPlaceholder ? inputField.placeholder : inputField.text, x + xOffset, y + clip.height * clip.scale / 2)

    if (inputField.textLength === undefined)
        inputField.textLength = ctx.measureText(inputField.text).width;
    
    ctx.fillStyle = 'black';
    if (inputField.selected && fraction(animationNow() - inputField.timerOffset) <= 0.5) {
        if (inputField.cursorXOffset === undefined)
            inputField.cursorXOffset = ctx.measureText(inputField.text.slice(0, inputField.cursor)).width;
        
        let offset = xOffset;
        
        if (inputField.textAlign === TextAlign.CENTER)
            offset = clip.width * clip.scale / 2 - inputField.textLength / 2;
        else if (inputField.textAlign === TextAlign.RIGHT)
            offset = xOffset - inputField.textLength;
        
        ctx.fillRect(x + offset + inputField.cursorXOffset, y + clip.height * clip.scale / 2 - 32, 1, 64);
    }

    ctx.textBaseline = before[0];
    ctx.textAlign = before[1];
}
function alignedInputHelper(align, clip) {
    switch (align) {
        case TextAlign.CENTER:
            return clip.width * clip.scale / 2;
        case TextAlign.RIGHT:
            return clip.width * clip.scale - clip.optionalPadding * clip.scale;
        default:
            return 0 + clip.optionalPadding * clip.scale;
    }
}

const HorizontalAlign = Object.freeze({
    LEFT: 0,
    CENTER: 1,
    RIGHT: 2,
});
const VerticalAlign = Object.freeze({
    TOP: 0,
    CENTER: 1,
    BOTTOM: 2,
});

const TextAlign = Object.freeze({
    LEFT: 'left',
    CENTER: 'center',
    RIGHT: 'right',
});

function getSelectedUIElement() {
    for (let i = 0; i < scene.uiElements.length; i++) {
        const e = scene.uiElements[i];
        if (e.isActive && e.selectable && AABBPoint(new Rect(e.x, e.y, e.width, e.height), mousePosition)) {
            if (selectedUIElement !== e) {
                if (selectedUIElement !== null)
                    selectedUIElement.onMouseExit();

                selectedUIElement = e;
                e.onMouseEnter();
            }

            return;
        }
    }

    if (selectedUIElement !== null)
        selectedUIElement.onMouseExit();

    selectedUIElement = null;
}
let _lastSelectedElement;
function handleUIClicks() {
    if (getMouseButtonDown(MouseButtons.LEFT))
        _lastSelectedElement = selectedUIElement;
    if (getMouseButtonUp(MouseButtons.LEFT) && selectedUIElement !== null && selectedUIElement === _lastSelectedElement)
        selectedUIElement.onMouseClick(MouseButtons.LEFT);
}