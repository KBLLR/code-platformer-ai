// src/utils/MathUtils.js
import * as THREE from "three";

const RadiansToDegrees = rad => rad * (180 / Math.PI);
const DegreesToRadians = deg => deg * (Math.PI / 180);

/*
 * 2-dimensional Vector (for UI, screen space, and 2D physics)
 */
class Vec2D {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /*
   * Get & Set
   */
  get width() {
    return this.x;
  }

  get height() {
    return this.y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(other) {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  clone() {
    return new Vec2D(this.x, this.y);
  }

  /*
   * Vector Compare
   */
  static equal(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  /*
   * get Magnitude
   */
  get magnitude() {
    return (this.x === 0 && this.y === 0) ? 0 : Math.sqrt(this.x * this.x + this.y * this.y);
  }

  get magnitudeSquared() {
    return this.x * this.x + this.y * this.y;
  }

  /*
   * Vector Arithmetic
   */
  static add(a, b) {
    return new Vec2D(a.x + b.x, a.y + b.y);
  }

  static sub(a, b) {
    return new Vec2D(a.x - b.x, a.y - b.y);
  }

  static mult(vec, num) {
    return new Vec2D(vec.x * num, vec.y * num);
  }

  static div(vec, num) {
    return new Vec2D(vec.x / num, vec.y / num);
  }

  static normalize(vec) {
    const mag = vec.magnitude;
    return mag > 0 ? Vec2D.div(vec, mag) : new Vec2D(0, 0);
  }

  static dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  }

  static crossProduct(v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
  }

  static angle(v1, v2) {
    const dot = Vec2D.dotProduct(v1, v2);
    const mag1 = v1.magnitude;
    const mag2 = v2.magnitude;
    if (mag1 === 0 || mag2 === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
  }

  static angleDegrees(v1, v2) {
    return RadiansToDegrees(Vec2D.angle(v1, v2));
  }

  static distance(a, b) {
    return Vec2D.sub(a, b).magnitude;
  }

  static lerp(a, b, t) {
    return new Vec2D(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t
    );
  }

  // Convert to Three.js Vector2
  toThreeVector2() {
    return new THREE.Vector2(this.x, this.y);
  }

  // Convert to Three.js Vector3 (Z = 0)
  toThreeVector3(z = 0) {
    return new THREE.Vector3(this.x, this.y, z);
  }
}

/*
 * 3-dimensional Vector utilities (extends Three.js Vector3)
 */
class Vec3DUtils {
  static fromVec2D(vec2d, z = 0) {
    return new THREE.Vector3(vec2d.x, vec2d.y, z);
  }

  static toVec2D(vec3d) {
    return new Vec2D(vec3d.x, vec3d.y);
  }

  // Enhanced movement utilities
  static moveTowards(current, target, maxDistanceDelta) {
    const toTarget = target.clone().sub(current);
    const distance = toTarget.length();
    
    if (distance <= maxDistanceDelta || distance === 0) {
      return target.clone();
    }
    
    return current.clone().add(toTarget.normalize().multiplyScalar(maxDistanceDelta));
  }

  static smoothDamp(current, target, velocity, smoothTime, deltaTime, maxSpeed = Infinity) {
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    
    const change = current.clone().sub(target);
    const originalTo = target.clone();
    
    // Clamp maximum speed
    const maxChange = maxSpeed * smoothTime;
    if (change.length() > maxChange) {
      change.normalize().multiplyScalar(maxChange);
    }
    
    target.copy(current).sub(change);
    
    const temp = velocity.clone().add(change.clone().multiplyScalar(omega)).multiplyScalar(deltaTime);
    velocity.copy(velocity.clone().sub(change.clone().multiplyScalar(omega)).sub(temp).multiplyScalar(exp));
    
    let output = target.clone().add(change.clone().add(temp).multiplyScalar(exp));
    
    // Prevent overshooting
    if ((originalTo.clone().sub(current)).dot(output.clone().sub(originalTo)) > 0) {
      output = originalTo.clone();
      velocity.set(0, 0, 0);
    }
    
    return output;
  }

  // Platform-specific movement
  static platformerMovement(position, velocity, input, config, deltaTime) {
    const {
      moveSpeed = 8,
      jumpForce = 15,
      gravity = 35,
      friction = 0.85,
      airControl = 0.7
    } = config;

    // Horizontal movement
    if (input.left) {
      velocity.x = Math.max(velocity.x - moveSpeed * deltaTime, -moveSpeed);
    } else if (input.right) {
      velocity.x = Math.min(velocity.x + moveSpeed * deltaTime, moveSpeed);
    } else {
      // Apply friction
      velocity.x *= Math.pow(friction, deltaTime * 60);
    }

    // Jumping
    if (input.jump && input.grounded) {
      velocity.y = jumpForce;
      input.grounded = false;
    }

    // Gravity
    if (!input.grounded) {
      velocity.y -= gravity * deltaTime;
    }

    // Apply velocity to position
    position.add(velocity.clone().multiplyScalar(deltaTime));

    return { position, velocity };
  }
}

/*
 * 2-dimensional Line
 */
class Line {
  constructor(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
  }

  get x1() { return this.p1.x; }
  get y1() { return this.p1.y; }
  get x2() { return this.p2.x; }
  get y2() { return this.p2.y; }

  get length() {
    return Vec2D.distance(this.p1, this.p2);
  }

  get direction() {
    return Vec2D.normalize(Vec2D.sub(this.p2, this.p1));
  }

  // Line Intersection
  static intersect(l1, l2) {
    const denom = (l1.p1.x - l1.p2.x) * (l2.p1.y - l2.p2.y) - (l1.p1.y - l1.p2.y) * (l2.p1.x - l2.p2.x);
    if (Math.abs(denom) < 1e-10) return null; // Lines are parallel
    
    return (
      ((l1.p1.x - l2.p1.x) * (l2.p1.y - l2.p2.y) - (l1.p1.y - l2.p1.y) * (l2.p1.x - l2.p2.x)) / denom
    );
  }

  static intersectPoint(line, t) {
    return new Vec2D(
      line.p1.x + t * (line.p2.x - line.p1.x),
      line.p1.y + t * (line.p2.y - line.p1.y)
    );
  }

  // Check if lines actually intersect (not just their extensions)
  static doIntersect(l1, l2) {
    const t1 = Line.intersect(l1, l2);
    const t2 = Line.intersect(l2, l1);
    
    return t1 !== null && t2 !== null && 
           t1 >= 0 && t1 <= 1 && 
           t2 >= 0 && t2 <= 1;
  }
}

/*
 * Physics utilities
 */
class PhysicsUtils {
  // Simple AABB collision detection
  static aabbCollision(box1, box2) {
    return (
      box1.x < box2.x + box2.width &&
      box1.x + box1.width > box2.x &&
      box1.y < box2.y + box2.height &&
      box1.y + box1.height > box2.y
    );
  }

  // Circle collision detection
  static circleCollision(circle1, circle2) {
    const distance = Vec2D.distance(
      new Vec2D(circle1.x, circle1.y),
      new Vec2D(circle2.x, circle2.y)
    );
    return distance < (circle1.radius + circle2.radius);
  }

  // Point in circle
  static pointInCircle(point, circle) {
    const distance = Vec2D.distance(point, new Vec2D(circle.x, circle.y));
    return distance <= circle.radius;
  }

  // Bounce vector off surface normal
  static bounce(velocity, normal, bounciness = 1) {
    const dot = Vec2D.dotProduct(velocity, normal);
    return Vec2D.sub(velocity, Vec2D.mult(normal, 2 * dot * bounciness));
  }

  // Apply impulse to object
  static applyImpulse(velocity, impulse, mass = 1) {
    return Vec2D.add(velocity, Vec2D.div(impulse, mass));
  }
}

/*
 * Easing functions
 */
class Easing {
  static linear(t) { return t; }
  static easeInQuad(t) { return t * t; }
  static easeOutQuad(t) { return t * (2 - t); }
  static easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  static easeInCubic(t) { return t * t * t; }
  static easeOutCubic(t) { return (--t) * t * t + 1; }
  static easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }
  static bounce(t) { 
    if (t < 1/2.75) return 7.5625 * t * t;
    if (t < 2/2.75) return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
    if (t < 2.5/2.75) return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
  }
}

/*
 * Utility functions
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function inverseLerp(a, b, value) {
  return (value - a) / (b - a);
}

function map(value, inMin, inMax, outMin, outMax) {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wrap(value, min, max) {
  const range = max - min;
  return value < min ? max - (min - value) % range : min + (value - min) % range;
}

export { 
  Vec2D, 
  Vec3DUtils, 
  Line, 
  PhysicsUtils, 
  Easing,
  RadiansToDegrees, 
  DegreesToRadians,
  clamp,
  lerp,
  inverseLerp,
  map,
  randomRange,
  randomInt,
  wrap
};