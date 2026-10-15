/**
 * Anonymous usage telemetry for Arcane Warding.
 *
 * Foundry has no native way to report how many installs are actively using a
 * module, so this sends a small anonymous beacon to our own endpoint when a
 * world loads with the module active, a periodic heartbeat while the tab stays
 * open, and a best-effort "session-end" beacon on unload.
 *
 * What is sent: a random per-world id, the module / Foundry / game-system
 * versions, and the client language. No account info, no world content, no
 * player data. Reporting is gated behind the "usageTelemetry" world setting and
 * only the primary GM client reports, so a full table counts once.
 *
 * Expected server response: 204 No Content (body is ignored either way).
 */

const MODULE_ID = 'arcane-warding';
const TELEMETRY_ENDPOINT = 'https://www.dungeonsandderps.com/foundry-modules/analytics/usage-ping.php';
const HEARTBEAT_INTERVAL_MS = 1000 * 60 * 30; // 30 minutes
const PAYLOAD_VERSION = 1;

// The developer's own servers - games hosted here are never counted.
const EXCLUDED_HOSTS = [
	'vtt.dungeonsandderps.com',
	'vtt.mondarth.com',
	'vtt-dev.mondarth.com'
];

let heartbeatTimer = null;

/**
 * Whether the GM has left telemetry enabled for this world.
 *
 * @returns {boolean}
 */
function telemetryEnabled() {
	if (EXCLUDED_HOSTS.includes(window.location.hostname.toLowerCase())) return false;
	try {
		return game.settings.get(MODULE_ID, 'usageTelemetry') === true;
	} catch (err) {
		return false;
	}
}

/**
 * Build the anonymous telemetry payload.
 *
 * @param {string} event - Lifecycle event: "session-start" | "heartbeat" | "session-end"
 * @param {string} instanceId - Stable anonymous id for this world
 * @returns {string} - JSON string ready to hand to sendBeacon
 */
function buildPayload(event, instanceId) {
	return JSON.stringify({
		v: PAYLOAD_VERSION,
		id: instanceId,
		event: event,
		module: game.modules.get(MODULE_ID)?.version ?? 'unknown',
		foundry: game.version ?? 'unknown',
		generation: game.release?.generation ?? null,
		system: game.system ? `${game.system.id}@${game.system.version}` : 'unknown',
		language: game.i18n?.lang ?? 'unknown'
	});
}

/**
 * Fire a single anonymous telemetry beacon. Never throws, never blocks.
 *
 * Sent as a text/plain Blob so the browser treats it as a "simple" request and
 * skips the CORS preflight - the endpoint only needs Access-Control-Allow-Origin.
 *
 * @param {string} event - Lifecycle event name
 * @param {string} instanceId - Stable anonymous id for this world
 */
function sendBeacon(event, instanceId) {
	try {
		const body = new Blob([buildPayload(event, instanceId)], { type: 'text/plain' });
		navigator.sendBeacon(TELEMETRY_ENDPOINT, body);
	} catch (err) {
		console.debug(`Arcane Warding | Telemetry beacon skipped.`, err);
	}
}

/**
 * Get (or lazily create and persist) the stable anonymous id for this world.
 *
 * @returns {Promise<string>} - The instance id
 */
async function getInstanceId() {
	let id = game.settings.get(MODULE_ID, 'instanceId');
	if (!id) {
		id = foundry.utils.randomID(16);
		await game.settings.set(MODULE_ID, 'instanceId', id);
	}
	return id;
}

/**
 * Wire up anonymous usage telemetry.
 *
 * Called from the module's `init` hook; the actual reporting starts on `ready`
 * once we know the world, system, and connected users.
 */
export function registerAnalytics() {
	Hooks.once('ready', async () => {
		if (!telemetryEnabled()) return;

		// Elect a single reporter per world. `activeGM` resolves to the same
		// User for every connected client, so players and secondary GMs stay
		// silent and each world is counted once.
		if (game.users.activeGM !== game.user) return;

		const instanceId = await getInstanceId();

		sendBeacon('session-start', instanceId);

		heartbeatTimer = window.setInterval(() => {
			if (!telemetryEnabled()) return;
			sendBeacon('heartbeat', instanceId);
		}, HEARTBEAT_INTERVAL_MS);

		// `pagehide` is more reliable than `beforeunload` for beacons and does
		// not fire on tab switches the way `visibilitychange` does.
		window.addEventListener('pagehide', () => {
			if (heartbeatTimer) window.clearInterval(heartbeatTimer);
			if (!telemetryEnabled()) return;
			sendBeacon('session-end', instanceId);
		}, { once: true });
	});
}
