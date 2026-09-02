import * as THREE from "three";

export class Trail {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  add(o) {
    let color = 0xffffff;
    o.traverse?.((c) => {
      if (c.isMesh && c.material?.color) color = c.material.color.getHex();
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })
    );
    line.userData.points = [];
    this.scene.add(line);
    this.items.push({ o, line });
  }

  update() {
    this.items = this.items.filter((t) => {
      if (!t.o.parent) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        return false;
      }
      const p = t.o.position.clone();
      t.line.userData.points.push(p);
      if (t.line.userData.points.length > 16) t.line.userData.points.shift();
      t.line.geometry.setFromPoints(t.line.userData.points);
      return true;
    });
  }
}
