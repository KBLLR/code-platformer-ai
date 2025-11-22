// src/CharacterController.js
// Custom 3D character controller with physics integration
import * as THREE from "three";

export class CharacterController {
  constructor(mesh, physicsWorld, playerNumber = 0) {
    this.mesh = mesh;
    this.physicsWorld = physicsWorld;
    this.playerNumber = playerNumber;

    // Physics properties
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isGrounded = false;
    this.isJumping = false;

    // Movement properties
    this.moveSpeed = 5.0;
    this.jumpForce = 8.0;
    this.gravity = 25.0;

    // Input state
    this.inputDirection = new THREE.Vector2(0, 0);
    this.jumpPressed = false;

    // Collision properties
    this.capsuleHeight = 2.0;
    this.capsuleRadius = 0.5;
    this.groundCheckDistance = 0.2;

    // Direction tracking
    this.facingAngle = 0;
  }

  // Set input direction (x, z in world space)
  setInputDirection(x, z) {
    this.inputDirection.set(x, z);
  }

  // Request jump
  jump() {
    if (this.isGrounded && !this.isJumping) {
      this.velocity.y = this.jumpForce;
      this.isJumping = true;
      this.isGrounded = false;
      console.log(`[CharacterController] Player ${this.playerNumber + 1} jumped`);
      return true;
    }
    return false;
  }

  // Check ground collision using raycasting
  checkGroundCollision() {
    const raycaster = new THREE.Raycaster();
    const rayOrigin = this.mesh.position.clone();
    const rayDirection = new THREE.Vector3(0, -1, 0);

    raycaster.set(rayOrigin, rayDirection);
    raycaster.far = this.capsuleHeight / 2 + this.groundCheckDistance;

    // Get all meshes from the physics world
    // For simplicity, we'll raycast against scene children
    // In a real implementation, we'd query the BVH structure
    const intersects = raycaster.intersectObjects(
      this.mesh.parent.children.filter(
        (child) =>
          child.isMesh &&
          child !== this.mesh &&
          !this.mesh.children.includes(child) &&
          (child.userData.isTile || child.userData.isObstacle)
      ),
      true
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      const distanceToGround = hit.distance - this.capsuleHeight / 2;

      if (distanceToGround < this.groundCheckDistance) {
        // Snap to ground
        this.mesh.position.y = hit.point.y + this.capsuleHeight / 2;
        this.velocity.y = 0;
        this.isGrounded = true;
        this.isJumping = false;
        return true;
      }
    }

    // Not grounded
    if (this.mesh.position.y <= this.capsuleHeight / 2) {
      // Fallback ground level
      this.mesh.position.y = this.capsuleHeight / 2;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.isJumping = false;
      return true;
    }

    this.isGrounded = false;
    return false;
  }

  // Update character physics and movement
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.033); // Cap delta

    // Apply gravity
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
    }

    // Horizontal movement
    if (this.inputDirection.length() > 0) {
      const moveDir = new THREE.Vector3(
        this.inputDirection.x,
        0,
        this.inputDirection.y
      ).normalize();

      this.velocity.x = moveDir.x * this.moveSpeed;
      this.velocity.z = moveDir.z * this.moveSpeed;

      // Update facing direction
      this.facingAngle = Math.atan2(moveDir.x, moveDir.z);
      this.mesh.rotation.y = this.facingAngle;
    } else {
      // Apply friction
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
    }

    // Clamp velocities
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -20, 20);

    // Apply velocity to position
    this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));

    // Check ground collision
    this.checkGroundCollision();

    // Boundary constraints
    const maxBounds = 24;
    this.mesh.position.x = THREE.MathUtils.clamp(
      this.mesh.position.x,
      -maxBounds,
      maxBounds
    );
    this.mesh.position.z = THREE.MathUtils.clamp(
      this.mesh.position.z,
      -maxBounds,
      maxBounds
    );
  }

  // Get world direction the character is facing
  getWorldDirection(target) {
    target.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    return target;
  }

  // Get position
  get position() {
    return this.mesh.position;
  }
}
