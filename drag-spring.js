// Small fixed integration steps keep the drag feel consistent across frame rates.
export function createDragSpring(stiffness = 220, damping = 22) {
  const position = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  return {
    reset(point) {
      Object.assign(position, point);
      Object.assign(target, point);
      velocity.x = velocity.y = 0;
    },
    aim(point) { Object.assign(target, point); },
    step(delta) {
      const elapsed = Math.max(0, Math.min(delta, 0.05));
      const steps = Math.max(1, Math.ceil(elapsed / (1 / 240)));
      const dt = elapsed / steps;
      for (let i = 0; i < steps; i++) {
        for (const axis of ['x', 'y']) {
          velocity[axis] += ((target[axis] - position[axis]) * stiffness - velocity[axis] * damping) * dt;
          position[axis] += velocity[axis] * dt;
        }
      }
      return position;
    },
  };
}
