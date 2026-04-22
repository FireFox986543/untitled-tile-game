const DEFAULT_PORT = 43169;

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

function createMultiConnection(ip, port = DEFAULT_PORT) {
    if (multiGame !== null && multiGame.socket.readyState === WebSocket.OPEN) {
        console.warn('Already connected to a multiplayer game, closing previous connection');
        
        clearInterval(multiGame.heartbeatLoop);
        multiGame.socket.close();
    }

    const clientId = self.crypto.randomUUID();
    const playerName = gamerTags[Math.floor(Math.random() * gamerTags.length)];
    multiGame = {
        authenticated: false,
        clientId: clientId,
        playerName: playerName,
        heartbeatLoop: setInterval(() => {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: 'heartbeat' }));
        }, 25000),
    };

    const socket = multiGame.socket = new WebSocket(`ws://${ip}:${port}`);

    socket.addEventListener('open', () => {
        console.log('Connecting to server...');
        socket.send(JSON.stringify({ type: 'auth', clientId: clientId, name: playerName }));
    });
    socket.addEventListener('close', (e) => {
        console.log('Disconnected from server' + (e.reason ? `: ${e.reason}` : ''));

        clearInterval(multiGame.heartbeatLoop);
        multiGame = null;
    });
    socket.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);

        if (data.type === 'auth_success') {
            console.log('Successfully authenticated with server');
            multiGame.authenticated = true;
            multiGame.sessionId = data.sessionId;
        }
    });
    socket.addEventListener('error', (e) => {
        console.error('WebSocket error:', e);

        clearInterval(multiGame.heartbeatLoop);
        socket.close();
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
    "LaggyButLucky"
];