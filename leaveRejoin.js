function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBotCallback) {
    let leaveTimer = null;
    let jumpTimer = null;
    let jumpOffTimer = null;
    let reconnectTimer = null;
    let stopped = false;
    let reconnectAttempts = 0;
    let lastLogAt = 0;

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now();
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now;
            console.log(msg);
        }
    }

    function cleanup() {
        stopped = true;
        if (leaveTimer) clearTimeout(leaveTimer);
        if (jumpTimer) clearTimeout(jumpTimer);
        if (jumpOffTimer) clearTimeout(jumpOffTimer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        leaveTimer = jumpTimer = jumpOffTimer = reconnectTimer = null;
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return;
        bot.setControlState('jump', true);
        jumpOffTimer = setTimeout(() => {
            if (bot && !stopped) bot.setControlState('jump', false);
        }, 300);
        const nextJump = randomMs(20000, 5 * 60 * 1000);
        jumpTimer = setTimeout(scheduleNextJump, nextJump);
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return;
        let delay = randomMs(2000, 10000);
        reconnectAttempts++;
        if (reconnectAttempts > 3) delay += 5000;
        delay = Math.min(delay, 15000);
        logThrottled(`[AFK] Rejoin scheduled in ${Math.round(delay / 1000)}s (reason: ${reason}, attempt: ${reconnectAttempts})`);
        reconnectTimer = setTimeout(() => {
            if (stopped) return;
            try {
                if (typeof createBotCallback === 'function') createBotCallback();
            } catch (e) {
                console.log('[AFK] createBot error:', e?.message || e);
                scheduleReconnect('createBot-error');
            }
        }, delay);
    }

    bot.once('spawn', () => {
        reconnectAttempts = 0;
        cleanup();
        stopped = false;
        const stayTime = randomMs(60000, 300000);
        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`);
        scheduleNextJump();
        leaveTimer = setTimeout(() => {
            if (stopped) return;
            logThrottled('[AFK] Leaving server (timer)');
            cleanup();
            try { bot.quit(); } catch (e) {}
        }, stayTime);
    });

    bot.on('end', cleanup);
    bot.on('kicked', cleanup);
    bot.on('error', cleanup);
}

module.exports = setupLeaveRejoin;
