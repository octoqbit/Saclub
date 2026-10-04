// Screen-space physics. The complete square canvas is the collision envelope,
// including the robot's limbs and its tumble animation.
export const SIZE = 144;
export const HALF = SIZE / 2;
const GAP = 6;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class RobotPhysics {
    constructor() {
        this.x = 160;
        this.y = 160;
        this.vx = 0;
        this.vy = 0;
        this.width = 0;
        this.height = 0;
        this.obstacles = [];
        this.grounded = false;
        this.visible = false;
        this.crash = 0;
        this.crashDirection = 1;
        this.cooldown = 0;
        this.hopCooldown = 1;
        this.impacts = 0;
    }

    overlaps(x, y, box) {
        return x + HALF > box.left - GAP && x - HALF < box.right + GAP
            && y + HALF > box.top - GAP && y - HALF < box.bottom + GAP;
    }

    isSafe(x, y) {
        return x >= HALF + GAP && x <= this.width - HALF - GAP
            && y >= HALF + GAP && y <= this.height - HALF - GAP
            && !this.obstacles.some(box => this.overlaps(x, y, box));
    }

    setWorld(width, height, obstacles) {
        this.width = width;
        this.height = height;
        this.obstacles = obstacles;
        if (this.isSafe(this.x, this.y)) {
            this.visible = true;
            return;
        }

        // A scroll or resize can move a banner over the old position. Relocate
        // before painting; never animate through the banner to escape it.
        const xs = [clamp(this.x, HALF + GAP, width - HALF - GAP), HALF + GAP, width - HALF - GAP];
        const ys = [clamp(this.y, HALF + GAP, height - HALF - GAP), HALF + GAP, height - HALF - GAP];
        for (const box of obstacles) {
            xs.push(box.left - HALF - GAP, box.right + HALF + GAP);
            ys.push(box.top - HALF - GAP, box.bottom + HALF + GAP);
        }
        let nearest = null;
        let distance = Infinity;
        for (const x of xs) for (const y of ys) {
            if (!this.isSafe(x, y)) continue;
            const score = (x - this.x) ** 2 + (y - this.y) ** 2;
            if (score < distance) { nearest = { x, y }; distance = score; }
        }
        this.visible = Boolean(nearest);
        this.vx = this.vy = 0;
        this.grounded = false;
        if (nearest) Object.assign(this, nearest);
    }

    impact(speed, direction) {
        if (speed < 170 || this.cooldown > 0) return;
        this.crash = 0.85;
        this.cooldown = 1.2;
        this.crashDirection = direction || 1;
        this.impacts++;
    }

    step(dt, target) {
        if (!this.visible) return;
        // Substeps prevent tunneling even when a rendering frame is delayed.
        const frames = Math.ceil(Math.min(dt, 0.05) / (1 / 120));
        for (let i = 0; i < frames; i++) this.advance(Math.min(dt, 0.05) / frames, target);
    }

    advance(dt, target) {
        this.crash = Math.max(0, this.crash - dt);
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.hopCooldown = Math.max(0, this.hopCooldown - dt);
        const dx = target.x - this.x;
        const desiredSpeed = this.crash > 0 || Math.abs(dx) < 42 ? 0 : clamp(dx * 3.5, -300, 300);
        this.vx += (desiredSpeed - this.vx) * Math.min(1, dt * 7);
        if (this.grounded && !this.crash && !this.hopCooldown
            && target.active && target.y < this.y - 100) {
            this.vy = -570;
            this.hopCooldown = 1.7;
            this.grounded = false;
        }

        const oldX = this.x;
        this.x += this.vx * dt;
        const boundedX = clamp(this.x, HALF + GAP, this.width - HALF - GAP);
        if (boundedX !== this.x) {
            this.impact(Math.abs(this.vx), Math.sign(this.vx));
            this.vx *= -0.35;
            this.x = boundedX;
        }
        for (const box of this.obstacles) {
            if (!this.overlaps(this.x, this.y, box)) continue;
            this.impact(Math.abs(this.vx), Math.sign(this.vx));
            this.x = oldX <= box.left - HALF - GAP
                ? box.left - HALF - GAP : box.right + HALF + GAP;
            this.vx *= -0.35;
        }

        const oldY = this.y;
        this.vy += 1150 * dt;
        this.y += this.vy * dt;
        this.grounded = false;
        if (this.y >= this.height - HALF - GAP) {
            this.y = this.height - HALF - GAP;
            if (this.vy > 430) this.impact(this.vy, Math.sign(this.vx));
            this.vy = 0;
            this.grounded = true;
        } else if (this.y < HALF + GAP) {
            this.y = HALF + GAP;
            this.impact(Math.abs(this.vy), Math.sign(this.vx));
            this.vy = Math.abs(this.vy) * 0.25;
        }
        for (const box of this.obstacles) {
            if (!this.overlaps(this.x, this.y, box)) continue;
            if (oldY <= box.top - HALF - GAP) {
                this.y = box.top - HALF - GAP;
                if (this.vy > 430) this.impact(this.vy, Math.sign(this.vx));
                this.vy = 0;
                this.grounded = true;
            } else {
                this.y = box.bottom + HALF + GAP;
                this.impact(Math.abs(this.vy), Math.sign(this.vx));
                this.vy = Math.abs(this.vy) * 0.25;
            }
        }
        // Intersecting or tightly packed obstacles can leave no valid space.
        // Re-evaluate the envelope rather than displaying an overlapping frame.
        if (!this.isSafe(this.x, this.y)) this.setWorld(this.width, this.height, this.obstacles);
    }
}
