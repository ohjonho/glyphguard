// src/entities/entity.js — Base class for all game entities (units and enemies).

export class Entity {
    /**
     * @param {object} opts
     * @param {number} opts.x
     * @param {number} opts.y
     * @param {number} opts.laneIndex
     * @param {number} opts.health
     * @param {number} opts.size    — bounding box half-width/height (square hitbox)
     */
    constructor({ x, y, laneIndex, health, size }) {
        this.x         = x;
        this.y         = y;
        this.laneIndex = laneIndex;
        this.health    = health;
        this.maxHealth = health;
        this.size      = size;
        this.dead      = false;
    }

    takeDamage(amount) {
        if (this.dead) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.dead   = true;
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    isDead() { return this.dead; }

    /** True if this entity's hitbox overlaps another entity's hitbox. */
    overlaps(other) {
        return Math.abs(this.x - other.x) < (this.size + other.size) / 2 &&
               Math.abs(this.y - other.y) < (this.size + other.size) / 2;
    }
}
