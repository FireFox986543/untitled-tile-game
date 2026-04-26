const DEFAULT_PORT = 5123;
const multiSettings = {
    playerChunkReceivalDistance: 3, // How far away should we request the empty chunks when the player moved, this shouldn't be larger than the server's max chunk requestal distance
    maxLoadedChunks: 7, // What distance beyond we should unload chunks?
};

let multiGame = null;

async function tryToConnect(ip, port = DEFAULT_PORT) {
    if (!checkValidIP(ip))
        return { error: 'Invalid ip address', success: false };

    let reached = undefined;

    try {
        const pingSocket = new WebSocket(`ws://${ip}:${port}`);
        const startTime = Date.now();
        let endTime = null;

        pingSocket.addEventListener('open', () => {
            reached = true;
            endTime = Date.now();
            pingSocket.close();
        });
        pingSocket.addEventListener('error', () => {
            reached = false;
            pingSocket.close();
        });
        !reached && Date.now() - startTime < 5000
        const wait = () => new Promise(r => setTimeout(r, 0));

        return await new Promise(async (r) => {
            while (reached === undefined && Date.now() - startTime < 5000) {
                await wait();
            }

            return reached ? r({ success: true, ping: endTime - startTime }) : r({ error: 'Failed to reach the server', success: false });
        });
    }
    catch (e) {
        console.error('Error while trying to connect to the game server: ', ip, e);
        return { error: 'Failed to connect to the server', success: false };
    }
}
function checkValidIP(ip) {
    const ipRegex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
    return ipRegex.test(ip.trim());
}

function createMultiConnection(ip, port = DEFAULT_PORT, onConnected) {
    if (multiGame !== null && multiGame.socket.readyState === WebSocket.OPEN) {
        console.warn('Already connected to a multiplayer game, closing previous connection');

        multiGame.closeConnection();
        return;
    }

    const clientId = uuidv4();
    const playerName = gamerTags[Math.floor(Math.random() * gamerTags.length)];
    const playerSkin = Math.round(Math.random() * 4);
    multiGame = {
        authenticated: false,
        clientId: clientId,
        playerName: playerName,
        playerSkin: playerSkin,

        players: [],

        onClose: null,

        heartbeatLoop: setInterval(() => {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: 'heartbeat' }));
        }, 25000),
        disconnect: () => {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: 'disconnect' }));

            multiGame.closeConnection();
        },
        closeConnection: () => {
            clearInterval(multiGame.heartbeatLoop);

            if (socket.readyState === WebSocket.OPEN)
                socket.close();

            if (typeof multiGame.onClose === 'function')
                multiGame.onClose();

            multiGame = null;
        },

        requestEmptyChunks: () => {
            // Where is the player in chunk ids?
            const chunkBase = scene.player.chunkId;
            const toRequest = [];

            for (let i = -multiSettings.playerChunkReceivalDistance; i < multiSettings.playerChunkReceivalDistance; i++) {
                // "i" is relative to the player
                const globalId = chunkBase + i;

                // This chunk hasn't been requested yet
                if (!scene.world.getChunk(globalId))
                    toRequest.push(globalId);
            }

            if (toRequest.length === 0)
                return;

            socket.send(JSON.stringify({ type: 'chunkRequest', multi: toRequest }));
        },
        cleanUpChunks: () => {
            const chunkBase = scene.player.chunkId;

            scene.world.chunks.forEach((v, k) => {
                if (Math.abs(k - chunkBase) > multiSettings.maxLoadedChunks) {
                    scene.world.chunks.delete(k);
                    console.log('Unloaded chunk ' + k);
                }
            });
        },
        sendMovementPacket: () => {
            socket.send(JSON.stringify({ type: 'playerMovement', x: scene.player.position.x, y: scene.player.position.y }));
        },
        _registerNewPlayer: (pl, pushToScene) => {
            const p = new MultiPlayerEntity(new Vector2(pl.x, pl.y), pl.id, pl.playerName, pl.playerSkin || 0);

            multiGame.players.push(p);

            if(pushToScene)
                scene.entities.push(p);
        }
    };

    const socket = multiGame.socket = new WebSocket(`ws://${ip}:${port}`);

    socket.addEventListener('open', () => {
        console.log('Connecting to server...');
        socket.send(JSON.stringify({ type: 'auth', clientId: clientId, playerName: playerName, playerSkin: playerSkin }));
        socket.send(JSON.stringify({ type: 'chunkRequest', range: 'player' }));
    });
    socket.addEventListener('close', (e) => {
        console.log('Disconnected from server' + (e.reason ? `: ${e.reason}` : ''));

        multiGame?.closeConnection();
    });
    socket.addEventListener('message', async (e) => {
        const data = JSON.parse(e.data);

        switch (data.type) {
            case 'authSuccess':
                console.log('Successfully authenticated with server');
                multiGame.authenticated = true;
                multiGame.sessionId = data.sessionId;
                multiGame.playerDefPos = new Vector2(data.player.posX, data.player.posY);

                if (typeof onConnected === 'function')
                    onConnected();

                data.players.forEach(multiGame._registerNewPlayer);
                break;
            case 'chunkData':
                let chunksToProcess = [];

                if (data.coverage === 'single')
                    chunksToProcess.push(data.chunk);
                else if (data.coverage === 'range' || data.coverage === 'multi')
                    chunksToProcess = data.chunks;

                chunksToProcess.forEach(async chunkData => {
                    const gzip = new DecompressionStream('gzip');
                    const w = gzip.writable.getWriter();
                    w.write(Uint8Array.fromBase64(chunkData.bytes));
                    w.close();

                    const bytes = await new Response(gzip.readable).arrayBuffer();
                    const tiles = new Uint8Array(bytes);

                    const chunk = new Chunk(chunkData.id, tiles);
                    multiGame.receivedChunks = multiGame.receivedChunks || [];
                    multiGame.receivedChunks.push(chunk);
                    console.log('Received chunk ' + chunkData.id + ' from server');
                });
                break;
            case 'playerMoved':
                console.warn('Received movement update packet: ' + data.reason);
                scene.player.position = new Vector2(data.x, data.y);
                scene.player.velocity = Vector2.zero;
                break;
            case 'playerConnected':
                console.log(`Player connected: ${data.id}, ${data.playerName} at ${data.x} ${data.y}`)
                multiGame._registerNewPlayer(data, true);

                break;
            case 'playerDisconnected':
                console.log(`Player disconnected ${data.id}`);
                const pa = multiGame.players.find(v => v.clientId === data.id);

                if (pa) {
                    arrayRemove(multiGame.players, pa);
                    arrayRemove(scene.entities, pa);
                }
                else
                    console.error('Failed to remove disconnected player!');

                break;
            case 'entityUpdate':
                data.entities.forEach(e => {
                    if (e.type === 'player') {
                        const pl = multiGame.players.find(v => v.clientId === e.id);

                        if (e.id !== multiGame.clientId) {
                            if (pl) {
                                pl.targetPosition = new Vector2(e.x, e.y);
                                pl.lastPosUpdate = animationNow();
                            }
                            else
                                console.error(`Received entity update for an unknown player ${e.id}`);
                        }
                    }
                });

                break;
            default:
                break;
        }
    });
    socket.addEventListener('error', (e) => {
        console.error('WebSocket error:', e);
        multiGame.closeConnection();
    });
}

const gamerTags = [
    "xX_NoScopeNoodle_Xx",
    "PixelPanic42",
    "LaggingLegend",
    "SirSpamsALot",
    "ToastedHitbox",
    "AFK_AllDay",
    "CriticalMissClick",
    "RespawnRaccoon",
    "KeyboardWarlock",
    "CtrlAltDefeat",
    "SneakyPotato",
    "404SkillNotFound",
    "PingOfDoom",
    "LootGoblinMode",
    "CouchCamper",
    "NoobSlayer9000",
    "BananaAimBot",
    "ShadowDerp",
    "TurboTurtle",
    "GlitchGremlin",
    "RageQuitWizard",
    "ButtonMasherPro",
    "InvisibleToast",
    "SaltySniper",
    "WaffleWarrior",
    "ClutchOrKickMe",
    "EpicFailWhale",
    "StealthySausage",
    "BoomHeadshotish",
    "CasualCarnage",
    "SweatyThumbs",
    "MidnightMisclick",
    "AimlessArrow",
    "FriendlyFireGuy",
    "SpamuraiJack",
    "JoystickJester",
    "TeabagTitan",
    "LagzillaReturns",
    "PanicBuilder",
    "GhostOfNoobs",
    "CerealKillerXP",
    "ChickenDinnerish",
    "AutoAimAnxiety",
    "DerpyDestroyer",
    "UltraNoobPrime",
    "CampfireCamper",
    "SnaccAttack",
    "GG_EZ_Not",
    "LootOrLeave",
    "RespawnReaperish",
    "HitboxHoudini",
    "CrateExpectations",
    "NerfOrNothing",
    "AimBotButWorse",
    "PotatoPredator",
    "ClumsyClutcher",
    "XPThief",
    "DodgeThisMaybe",
    "SpawnPointBandit",
    "HyperHiccup",
    "OopsAllHeadshots",
    "BackupPlanB",
    "ScopeCreep",
    "PixelPirate",
    "GlhfGoodbye",
    "TryHardlyWorking",
    "SnackBarSniper",
    "DustyConsole",
    "AnalogAnarchy",
    "SilentButLaggy",
    "BoomerangBoi",
    "NoScopeGrandma",
    "CrouchSpamKing",
    "PewPewPenguin",
    "MissionImpastable",
    "KeyboardCatastrophe",
    "Rektangle",
    "TacticalTurnip",
    "AimAssistAddict",
    "DeadWeightCarry",
    "FlukeMaster",
    "ReloadAndRegret",
    "PingPingGoAway",
    "ShadowOfLag",
    "HeadshotHoliday",
    "ButtonMelt",
    "Sneak100Fail100",
    "LootLlamaDrama",
    "FragileVictory",
    "CampyMcCampface",
    "SlideCancelOops",
    "ControllerChaos",
    "OopsIDidItAgainGG",
    "Victoryish",
    "LastPlaceLegend",
    "AlmostMVP",
    "RubberBandRunner",
    "LaggyButLucky",
    "ToasterInTheBath",
    "BreadWithWiFi",
    "CouchGoblin",
    "SirLagsALot",
    "PotatoWithAPlan",
    "WaffleSniper",
    "PanicAtTheRespawn",
    "KeyboardWarrior69",
];