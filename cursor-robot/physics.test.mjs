import test from 'node:test';
import assert from 'node:assert/strict';
import { RobotPhysics, HALF } from './physics.mjs';

const run = (body, target, seconds = 3) => {
    for (let frame = 0; frame < seconds * 60; frame++) {
        body.step(1 / 60, target);
        if (body.visible) assert.ok(body.isSafe(body.x, body.y), `Unsafe frame ${frame}: ${body.x}, ${body.y}`);
    }
};

test('runs toward the pointer and keeps the entire canvas inside the viewport', () => {
    const body = new RobotPhysics();
    body.setWorld(1440, 900, []);
    run(body, { x: 1400, y: 850, active: true }, 6);
    assert.ok(body.x > 1000);
    assert.ok(body.grounded);
    assert.ok(body.x <= 1440 - HALF - 6);
});

test('falls onto a banner, tumbles from the impact, then recovers', () => {
    const body = new RobotPhysics();
    body.x = 400;
    body.y = 100;
    body.setWorld(1000, 900, [{ left: 0, top: 550, right: 1000, bottom: 650 }]);
    run(body, { x: 400, y: 850, active: true });
    assert.equal(body.y, 550 - HALF - 6);
    assert.equal(body.impacts, 1);
    assert.equal(body.crash, 0);
    assert.ok(body.grounded);
});

test('bumps into a banner side instead of crossing it', () => {
    const body = new RobotPhysics();
    body.x = 150;
    body.y = 822;
    body.setWorld(1200, 900, [{ left: 600, top: 500, right: 900, bottom: 900 }]);
    run(body, { x: 1100, y: 820, active: true }, 5);
    assert.ok(body.x <= 600 - HALF - 6);
    assert.ok(body.impacts >= 1);
});

test('jumping into a banner underside cannot pass through', () => {
    const body = new RobotPhysics();
    body.x = 450;
    body.y = 822;
    body.setWorld(1000, 900, [{ left: 0, top: 500, right: 1000, bottom: 600 }]);
    run(body, { x: 450, y: 200, active: true }, 4);
    assert.ok(body.y >= 600 + HALF + 6);
    assert.ok(body.impacts >= 1);
});

test('scrolling a banner into the robot relocates it before the next paint', () => {
    const body = new RobotPhysics();
    body.setWorld(1200, 900, []);
    body.setWorld(1200, 900, [{ left: 0, top: 100, right: 1200, bottom: 500 }]);
    assert.ok(body.visible && body.isSafe(body.x, body.y));
    body.setWorld(1200, 900, [{ left: 0, top: 0, right: 1200, bottom: 900 }]);
    assert.equal(body.visible, false);
    body.setWorld(1200, 900, []);
    assert.ok(body.visible && body.isSafe(body.x, body.y));
});

test('irregular frame times, overlapping obstacles, scrolling, and resize stay safe', () => {
    const body = new RobotPhysics();
    let seed = 19;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let world = 0; world < 60; world++) {
        const width = 901 + random() * 800;
        const height = 420 + random() * 700;
        const obstacles = Array.from({ length: 5 }, () => {
            const left = random() * width;
            const top = random() * height;
            return { left, top, right: left + random() * 500, bottom: top + random() * 200 };
        });
        body.setWorld(width, height, obstacles);
        for (let frame = 0; frame < 120; frame++) {
            body.step(random() * 0.1, { x: random() * width, y: random() * height, active: true });
            if (body.visible) assert.ok(body.isSafe(body.x, body.y));
        }
    }
});
