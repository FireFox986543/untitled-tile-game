let renderChunks = [];
let renderChunksToRerender = [];
const renderChunksAmount = 10; // There'll be a 10x10 pooled renderchunks available
const renderChunksSize = 4; // One render chunk will occupy 4 tiles

function setupTileRenderer(startX, startY) {
    renderChunks = [];

    for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
            const rc = {
                x: x,
                y: y,
                canvas: new OffscreenCanvas(oneTileScreenSize * renderChunksSize, oneTileScreenSize * renderChunksSize)
            };

            renderChunks.push(rc);
        }
    }

    organizeAt(startX, startY);
}
function renderChunk(rc) {
    const c = rc.canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    const height = oneTileScreenSize * renderChunksSize;

    c.clearRect(0, 0, height, height);

    for (let x = 0; x < renderChunksSize; x++) {
        for (let y = 0; y < renderChunksSize; y++) {
            const globalX = rc.x * renderChunksSize + x;
            const globalY = rc.y * renderChunksSize + (renderChunksSize - 1 - y);

            const drawX = x * oneTileScreenSize;
            const drawY = y * oneTileScreenSize;

            let tileID = scene.getTileAt(globalX, globalY);

            if (tileID === 0)
                continue;

            tileID = handleTileVariants(globalX, globalY, tileID);
            let tileThis = tileIDToClip(tileID);

            //c.filter = `brightness(${Math.random() * 100}%)`;
            c.drawImage(images['tileAtlas'], tileThis.x, tileThis.y, tileThis.width, tileThis.height,
                drawX, drawY, oneTileScreenSize + 1, oneTileScreenSize + 1);
        }

        c.filter = 'none';
    }
}
function getRenderChunk(rcX, rcY) {
    return renderChunks.find(v => v.x === rcX && v.y === rcY);
}
function organizeChunks() {
    const sx = Math.floor(scene.scrollX / renderChunksSize);
    const sy = Math.floor(scene.scrollY / renderChunksSize);

    const limit = renderChunksAmount - 4; // The player should always have atleast 4 render chunks in each direction

    for (let i = 0; i < renderChunks.length; i++) {
        const rc = renderChunks[i];
        let changed = false;

        if (rc.x < sx - limit) {
            rc.x += renderChunksAmount;
            changed = true;
        }
        else if (rc.x > sx + limit) {
            rc.x -= renderChunksAmount;
            changed = true;
        }

        if (rc.y < sy - limit) {
            rc.y += renderChunksAmount;
            changed = true;
        }
        else if (rc.y > sy + limit) {
            rc.y -= renderChunksAmount;
            changed = true;
        }

        if (changed) {
            renderChunk(rc);
        }
    }
}
function organizeAt(startX, startY) {
    startX = Math.floor(startX / renderChunksSize);
    startY = Math.floor(startY / renderChunksSize);
    startX -= Math.floor(renderChunksAmount / 2);
    startY -= Math.floor(renderChunksAmount / 2);

    for (let i = 0; i < renderChunksAmount * renderChunksAmount; i++) {
        const x = Math.floor(i / renderChunksAmount);
        const y = i % renderChunksAmount;

        renderChunks[i].x = x + startX;
        renderChunks[i].y = y + startY;
        renderChunk(renderChunks[i]);
    };
}
function updateTileModification(x, y) {
    const rcX = Math.floor(x / renderChunksSize);
    const rcY = Math.floor(y / renderChunksSize);

    const offsets = [
        new Vector2(0, 0),
        new Vector2(0, 1),
        new Vector2(0, -1),
        new Vector2(1, 0),
        new Vector2(-1, 0),
    ]

    // Update neighbors as well as the current RC
    // This is to make sure connected tiles work too!
    for (let i = 0; i < offsets.length; i++) {
        const o = offsets[i];
        const c = getRenderChunk(rcX + o.x, rcY + o.y);

        if (c)
            renderChunk(c);
    }
}

function renderParallax() {
    const parallaxScaleX = 0.006;
    const parallaxScaleY = 0.015; // 0.015625 -> Perfect alignment with tiles, oneTileSize / renderSize (e.g.: 96 / 6144)
    const renderSize = 6144;
    let startX = viewport.viewLeft - revTranslateX(viewport.viewLeft) * parallaxScaleX * renderSize % renderSize;
    let startY = viewport.viewTop + revTranslateY(viewport.viewTop) * parallaxScaleY * renderSize % renderSize - renderSize;
    let cellX = Math.floor(revTranslateX(viewport.viewLeft) * parallaxScaleX);
    let cellY = Math.floor(revTranslateY(viewport.viewTop) * parallaxScaleY);

    if (scene.scrollX <= toTileCoords(viewport.visibleWidth2))
        startX -= renderSize;
    if (scene.scrollY <= -toTileCoords(viewport.visibleHeight2))
        startY += renderSize;

    const visibleFirstX = renderSize - (viewport.viewLeft - startX);
    const amountX = Math.ceil((viewport.visibleWidth - visibleFirstX) / renderSize) + 1;
    const visibleFirstY = renderSize - (viewport.viewTop - startY);
    const amountY = Math.ceil((viewport.visibleHeight - visibleFirstY) / renderSize) + 1;

    ctx.font = '24px "Jersey 10"';
    ctx.fillStyle = 'black';
    ctx.globalAlpha = 1; // Note, we don't care about the scaled alpha, as the background must be opaque!!!

    for (let y = 0; y < amountY; y++) {
        for (let x = 0; x < amountX; x++) {
            const tileX = ((cellX + x) % 4 + 4) % 4;
            const tileY = ((cellY - y) % 4 + 4) % 4;

            const sourceX = tileX * 512;
            const sourceY = (3 - tileY) * 512;

            const drawX = Math.ceil(startX + renderSize * x);
            const drawY = Math.ceil(startY + renderSize * y);

            ctx.drawImage(images['parallax'], sourceX, sourceY, 512, 512, Math.floor(drawX), Math.floor(drawY), Math.floor(renderSize + 1), Math.floor(renderSize + 1)); // Overdraw just 1 px to fix stitching issues, it's gone now
            /*ctx.fillStyle = 'white';
            ctx.fillText(`${tileX}   ${tileY}`, drawX + 20, startY + renderSize * (y + .5));*/
        }
    }

    /*ctx.fillStyle = 'red';
    ctx.fillText(`START ${startX}   ${startY}`, 700, 500);
    ctx.fillText(`CELL  ${cellX}   ${cellY}`, 700, 550);
    ctx.fillText(`DRAWN ${amountX}   ${amountY}`, 700, 600);*/
}

function renderBackground() {
    renderParallax();

    // Render backgrounds, SOOOOO many hours spent on this!!!
    const renderSize = oneTileScreenSize * renderChunksSize;
    let startX = viewport.viewLeft - revTranslateX(viewport.viewLeft) / renderChunksSize * renderSize % renderSize;
    let startY = viewport.viewTop + revTranslateY(viewport.viewTop) / renderChunksSize * renderSize % renderSize - renderSize;
    let cellX = Math.floor(revTranslateX(viewport.viewLeft) / renderChunksSize);
    let cellY = Math.floor(revTranslateY(viewport.viewTop) / renderChunksSize);

    if (scene.scrollX <= toTileCoords(viewport.visibleWidth2))
        startX -= renderSize;
    if (scene.scrollY <= -toTileCoords(viewport.visibleHeight2))
        startY += renderSize;

    const visibleFirstX = renderSize - (viewport.viewLeft - startX);
    const amountX = Math.ceil((viewport.visibleWidth - visibleFirstX) / renderSize) + 1;
    const visibleFirstY = renderSize - (viewport.viewTop - startY);
    const amountY = Math.ceil((viewport.visibleHeight - visibleFirstY) / renderSize) + 1;

    ctx.font = '24px "Jersey 10"';
    ctx.fillStyle = 'black';
    ctx.globalAlpha = 1; // Note, we don't care about the scaled alpha, as the background must be opaque!!!

    let skipped = 0;

    for (let y = 0; y < amountY; y++) {
        for (let x = 0; x < amountX; x++) {
            const tileX = cellX + x;
            const tileY = cellY - y;

            const rc = getRenderChunk(tileX, tileY);

            // No render chunk exist for this specific area
            if (rc === undefined) {
                skipped++;
                continue;
            }

            const drawX = Math.ceil(startX + renderSize * x);
            const drawY = Math.ceil(startY + renderSize * y);

            /*ctx.fillStyle = `rgb(${pseudo01(tileX, tileY, 23434.34) * 256}, ${pseudo01(tileX, tileY, 532.38) * 256}, ${pseudo01(tileX, tileY, -532.851) * 256})`
            ctx.fillRect(drawX, drawY, renderSize, renderSize);*/
            ctx.drawImage(rc.canvas, Math.floor(drawX), Math.floor(drawY), Math.floor(renderSize + 1), Math.floor(renderSize + 1)); // Overdraw just 1 px to fix stitching issues, it's gone now
            
            /*ctx.fillStyle = 'white';
            ctx.fillText(`${tileX}   ${tileY}`, drawX + 20, startY + renderSize * (y + .5));*/
        }
    }

    /*ctx.fillStyle = 'red';
    ctx.fillText(`START ${startX}   ${startY}`, 700, 500);
    ctx.fillText(`CELL  ${cellX}   ${cellY}`, 700, 550);
    ctx.fillText(`DRAWN ${amountX}   ${amountY}`, 700, 600);
    ctx.fillText(`SKIPPED ${skipped}`, 700, 650);*/
}
function tileIDToClip(x) {
    // Air doesn't get a place in the altas! How dare you?
    if (x === 0)
        return Rect.identity;
    else
        x--;

    const column = x % 16;
    const row = Math.floor(x / 16);

    return new Rect(Math.floor(column * 16), Math.floor(row * 16), Math.floor(16), Math.floor(16));
}
function handleTileVariants(x, y, t) {
    const upperNeighbour = scene.getTileAt(x, y + 1);

    // Handle cacti
    if (t === TILES.CACTUS && upperNeighbour === TILES.AIR)
        return 256; // Note: 256 cannot be a tile id, but this represents the very last texture in the atlas
    // Handle short grass
    else if (t === TILES.SHORT_GRASS && upperNeighbour === TILES.SHORT_GRASS)
        return 254; // Large grass texture
    else if (t === TILES.DRY_GRASS && fastPseudo(x, y, 64.465, 100) % 3 === 0)
        return 253 // Dry grass second variation texture

    return t;
}