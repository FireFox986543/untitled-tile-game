// I KNEW IT, that this "POINT" would come, heh-eh
// So I made the points into vector2-s, like a normal game engine would have
class Vector2 {
    static get zero() { return new Vector2(0, 0); };
    static get one() { return new Vector2(1, 1); };
    static get up() { return new Vector2(0, 1); };
    static get down() { return new Vector2(0, -1); };
    static get left() { return new Vector2(-1, 0); };
    static get right() { return new Vector2(1, 0); };

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(p) { return new Vector2(this.x + p.x, this.y + p.y); }
    subtr(p) { return new Vector2(this.x - p.x, this.y - p.y); }
    negate() { return new Vector2(-this.x, -this.y); }
    multiply(b) { return new Vector2(this.x * b, this.y * b); }
    divide(b) { return new Vector2(this.x / b, this.y / b); }
    equals(p) { return this.x === p.x && this.y === p.y; }

    get sqrMagnitude() { return this.x * this.x + this.y * this.y; }
    get magnitude() { return Math.sqrt(this.sqrMagnitude); }

    static distance(a, b) { return Math.sqrt(this.sqrDistance(a, b)); }
    static sqrDistance(a, b) { return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2); }

    static angleTowards(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
    // NOTE: before it was called 'moveDirection', so replace that old knowledge with this more accurate name
    static fromAngle(angle, magnitude = 1) { return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude); }
    static normalize(a) {
        const mag = a.magnitude;
        return mag === 0 ? Vector2.zero : a.divide(mag);
    }

    toString() { return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`; }
}
class Size {
    static get zero() { return new Size(0, 0); };
    static get one() { return new Size(1, 1); };

    get area() { return this.width * this.height; }

    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}
class Rect {
    static get identity() { return new Rect(0, 0, 0, 0); };

    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    static fromPointSize(point, size) {
        return new Rect(point.x, point.y, size.width, size.height);
    }
}

const DIRECTION = Object.freeze({
    NORTH: 0,
    EAST: 1,
    SOUTH: 2,
    WEST: 3,
});

class ClipRegion extends Rect {
    static get identity() { return new ClipRegion(0, 0, 0, 0, '', 0, 0); }

    constructor(x, y, width, height, atlas, scale, optionalPadding = 0) {
        super(x, y, width, height);
        this.atlas = atlas;
        this.scale = scale;
        this.optionalPadding = optionalPadding;
    }

    fullSize() { return new Size(this.width * this.scale, this.height * this.scale); }
}
const UIAtlas = Object.freeze({
    ButtonRedLarge: new ClipRegion(0, 0, 62, 12, 'uiAtlas', 10, 4),
    ButtonRedSmall: new ClipRegion(61, 0, 42, 12, 'uiAtlas', 10, 4),
    ButtonYellowLarge: new ClipRegion(0, 11, 62, 12, 'uiAtlas', 10, 4),
    ButtonYellowSmall: new ClipRegion(61, 11, 42, 12, 'uiAtlas', 10, 4),
    ButtonBlueLarge: new ClipRegion(0, 22, 62, 12, 'uiAtlas', 10, 4),
    ButtonBlueSmall: new ClipRegion(61, 22, 42, 12, 'uiAtlas', 10, 4),
    ButtonGreenLarge: new ClipRegion(0, 33, 62, 12, 'uiAtlas', 10, 4),
    ButtonGreenSmall: new ClipRegion(61, 33, 42, 12, 'uiAtlas', 10, 4),
    HL_ButtonRedLarge: new ClipRegion(0, 45, 62, 12, 'uiAtlas', 10, 4),
    HL_ButtonRedSmall: new ClipRegion(61, 45, 42, 12, 'uiAtlas', 10, 4),
    HL_ButtonYellowLarge: new ClipRegion(0, 56, 62, 12, 'uiAtlas', 10, 4),
    HL_ButtonYellowSmall: new ClipRegion(61, 56, 42, 12, 'uiAtlas', 10, 4),
    HL_ButtonBlueLarge: new ClipRegion(0, 67, 62, 12, 'uiAtlas', 10, 4),
    HL_ButtonBlueSmall: new ClipRegion(61, 67, 42, 12, 'uiAtlas', 10, 4),
    HL_ButtonGreenLarge: new ClipRegion(0, 78, 62, 12, 'uiAtlas', 10, 4),
    HL_ButtonGreenSmall: new ClipRegion(61, 78, 42, 12, 'uiAtlas', 10, 4),
    ButtonArrow: new ClipRegion(103, 0, 26, 19, 'uiAtlas', 5),
    HL_ButtonArrow: new ClipRegion(103, 19, 26, 19, 'uiAtlas', 5),
    InputField: new ClipRegion(0, 90, 62, 12, 'uiAtlas', 10, 4),
    HL_InputField: new ClipRegion(0, 102, 62, 12, 'uiAtlas', 10, 4),
    ButtonArrowSmall: new ClipRegion(103, 38, 15, 11, 'uiAtlas', 5),
    HL_ButtonArrowSmall: new ClipRegion(103, 49, 15, 11, 'uiAtlas', 5),
});
const ButtonTypes = Object.freeze({
    RedLarge: 'ButtonRedLarge',
    RedSmall: 'ButtonRedSmall',
    YellowLarge: 'ButtonYellowLarge',
    YellowSmall: 'ButtonYellowSmall',
    BlueLarge: 'ButtonBlueLarge',
    BlueSmall: 'ButtonBlueSmall',
    GreenLarge: 'ButtonGreenLarge',
    GreenSmall: 'ButtonGreenSmall',
    Arrow: 'ButtonArrow',
    ArrowSmall: 'ButtonArrowSmall',
});
function getButtonSize(btntype) { return UIAtlas[btntype].fullSize(); }

class PointerType {
    constructor(id, hotspot) {
        this.id = id;
        this.hotspot = hotspot;
    }
}
const PointerTypes = Object.freeze({
    POINTER: new PointerType(1, new Vector2(11, 6)),
    HAND: new PointerType(2, new Vector2(17, 3)),
});

class ScaleAndRotateAnimation {
    static apply = this.bind(2, 0.05235, 32); // Note rotate = 3 degrees in radians
    static #handle(e, speed, rotate, scaleAmount) {
        // Ensure that the xy coordinates are at the button's center
        const x = e.x + e.width / 2;
        const y = e.y + e.height / 2;
        const scale = Math.cos(animationNow() * speed) / scaleAmount + 1 + (1 / scaleAmount);

        // We set the pivot point for the rotation to the center of the button
        ctx.translate(x, y);
        ctx.rotate(Math.sin(animationNow() * (speed + .5)) * rotate);
        ctx.scale(scale, scale);
        return new Vector2(-e.width / 2, -e.height / 2);
    }
    static bind(speed, rotate, scaleAmount) { return (e) => { return ScaleAndRotateAnimation.#handle(e, speed, rotate, scaleAmount); } };
}
class HoverAnimation {
    static apply = this.bind(2, Vector2.up.multiply(3), 0);
    static #handle(e, speed, vector, offset) {
        const t = Math.sin(animationNow() * speed + offset);
        const vec = vector.multiply(t);
        ctx.translate(-vec.x, vec.y);
        return new Vector2(e.x, e.y);
    }
    static bind(speed, vector, offset) { return (e) => { return HoverAnimation.#handle(e, speed, vector, offset); } };
}
class FlyHoverEvent {
    static apply = this.bind(.3, Vector2.up.multiply(16));
    static #handle(e, duration, vector) {
        if (e.mouseOver) {
            const t = Math.min(1, (animationNow() - e.hoverStart) / duration);
            const vec = vector.multiply(-interpolateEaseIn(t, 3));
            ctx.translate(-vec.x, vec.y);
            return;
        }
        const hoverEnds = e.hoverEnd + duration
        if (animationNow() <= hoverEnds) {
            const t = Math.min(1, (hoverEnds - animationNow()) / duration);
            const vec = vector.multiply(-interpolateEaseIn(t, 3));
            ctx.translate(-vec.x, vec.y);
        }
    }
    static bind(duration, vector) { return (e) => { FlyHoverEvent.#handle(e, duration, vector); }; }
}
class FadeFlyStartAnimation {
    static apply = this.bind(.4, Vector2.up.multiply(120));
    static #handle(e, duration, vector) {
        // For this we could use the canvas translating, I may modify this to return a point instead in the future to replace the canvas transformations

        // TODO: Make something similar to these animation classes for easing functions, eg: linear, ease in/out, quadratic, cubic etc.
        // And more complex ones
        // Also for waves, like sine, cosine, but more complex, that would produce more natural-looking animations

        const t = interpolateEaseOut(Math.min(1, (animationNow() - e.activeTime) / duration), 3);
        const newVector = vector.multiply(1 - t);
        ctx.globalAlpha = scaleAlpha(t);
        ctx.translate(newVector.x, newVector.y);
    }
    static bind(duration, vector, shadowingUpdates = true) {
        return {
            duration: duration,
            shadowingUpdates: shadowingUpdates,
            render: (e) => { FadeFlyStartAnimation.#handle(e, duration, vector); }
        };
    }
}