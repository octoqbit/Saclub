import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A small articulated model inspired by the supplied white-and-orange robot.
// Geometry is generated locally; no external model or image requests are needed.
export function createRobot(canvas, size) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.55, 2.55, 2.55, -2.55, 0.1, 40);
    camera.position.set(0, 0.45, 12);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xe9f7ff, 0x7d7468, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffbd77, 2.5);
    rim.position.set(5, 2, -3);
    scene.add(rim);

    const materials = {
        shell: new THREE.MeshStandardMaterial({ color: 0xe9eeea, roughness: 0.28, metalness: 0.2 }),
        orange: new THREE.MeshStandardMaterial({ color: 0xe58b28, roughness: 0.28, metalness: 0.35 }),
        joint: new THREE.MeshStandardMaterial({ color: 0x3b4549, roughness: 0.38, metalness: 0.65 }),
        face: new THREE.MeshStandardMaterial({ color: 0x101f28, roughness: 0.18, metalness: 0.4 }),
        eye: new THREE.MeshBasicMaterial({ color: 0xeaffff }),
        shine: new THREE.MeshBasicMaterial({ color: 0x91b7c0, transparent: true, opacity: 0.18 }),
        shadow: new THREE.MeshBasicMaterial({ color: 0x303a40, transparent: true, opacity: 0.12, depthWrite: false }),
    };
    const rig = new THREE.Group();
    rig.position.y = -0.2;
    scene.add(rig);
    const robot = new THREE.Group();
    rig.add(robot);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 28), materials.shadow);
    shadow.position.set(0, -2.32, -1);
    shadow.scale.set(0.8, 0.075, 1);
    scene.add(shadow);

    function box(parent, width, height, depth, radius, material, x, y, z) {
        const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, radius), material);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }
    function ball(parent, radius, material, x, y, z, scale = [1, 1, 1]) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), material);
        mesh.position.set(x, y, z);
        mesh.scale.set(...scale);
        parent.add(mesh);
        return mesh;
    }

    const head = new THREE.Group();
    head.position.y = 0.98;
    robot.add(head);
    box(head, 2.05, 1.62, 1.12, 0.32, materials.shell, 0, 0, 0);
    box(head, 1.9, 1.45, 0.27, 0.3, materials.orange, 0, 0, 0.55);
    box(head, 1.65, 1.2, 0.18, 0.25, materials.face, 0, 0, 0.73);
    box(head, 0.56, 0.065, 0.02, 0.03, materials.shine, -0.32, 0.45, 0.835);
    const eyes = [-1, 1].map(side => ball(head, 0.2, materials.eye, side * 0.4, 0.01, 0.84, [1, 1.12, 0.22]));
    for (const side of [-1, 1]) {
        box(head, 0.22, 0.76, 0.67, 0.1, materials.orange, side * 1.08, 0, 0);
        box(head, 0.12, 0.43, 0.35, 0.055, materials.shell, side * 1.2, 0, 0.025);
    }
    ball(head, 0.085, materials.joint, 0, -0.73, 0.6);
    box(robot, 0.35, 0.24, 0.35, 0.08, materials.joint, 0, 0.11, 0);
    box(robot, 1.18, 1.06, 0.8, 0.25, materials.shell, 0, -0.46, 0);
    box(robot, 0.83, 0.69, 0.045, 0.13, materials.shell, 0, -0.44, 0.415);
    ball(robot, 0.105, materials.orange, 0.23, -0.26, 0.455, [1, 1, 0.3]);
    box(robot, 0.2, 0.05, 0.03, 0.015, materials.orange, -0.21, -0.25, 0.46);
    box(robot, 0.33, 0.035, 0.03, 0.01, materials.joint, 0, -0.75, 0.46);

    const arms = [], legs = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.72, -0.15, 0);
        robot.add(arm);
        ball(arm, 0.21, materials.joint, 0, 0, 0);
        box(arm, 0.34, 0.46, 0.38, 0.12, materials.shell, 0, -0.27, 0);
        ball(arm, 0.16, materials.joint, 0, -0.52, 0);
        box(arm, 0.34, 0.43, 0.36, 0.11, materials.shell, 0, -0.74, 0);
        box(arm, 0.36, 0.1, 0.37, 0.035, materials.orange, 0, -0.91, 0);
        ball(arm, 0.13, materials.joint, 0, -1.07, 0);
        for (const finger of [-1, 1]) {
            box(arm, 0.09, 0.23, 0.15, 0.04, materials.joint, finger * 0.12, -1.19, 0.04);
        }
        arms.push(arm);

        const leg = new THREE.Group();
        leg.position.set(side * 0.32, -0.94, 0);
        robot.add(leg);
        ball(leg, 0.22, materials.joint, 0, 0, 0);
        box(leg, 0.43, 0.5, 0.5, 0.15, materials.shell, 0, -0.25, 0);
        ball(leg, 0.15, materials.joint, 0, -0.5, 0);
        box(leg, 0.49, 0.36, 0.71, 0.15, materials.shell, 0, -0.67, 0.13);
        box(leg, 0.48, 0.075, 0.63, 0.03, materials.orange, 0, -0.82, 0.15);
        legs.push(leg);
    }

    const stars = new THREE.Group();
    rig.add(stars);
    for (let i = 0; i < 3; i++) {
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), materials.orange);
        stars.add(star);
    }
    let yaw = 0;
    let gait = 0;
    return {
        render(body, target, dt, elapsed) {
            const running = body.grounded && !body.crash ? Math.min(Math.abs(body.vx) / 200, 1) : 0;
            gait += dt * (7 + Math.abs(body.vx) * 0.055);
            const direction = Math.max(-0.72, Math.min(0.72, (target.x - body.x) / 260));
            yaw += (direction - yaw) * Math.min(1, dt * 7);
            robot.rotation.y = yaw;
            robot.position.y = Math.abs(Math.sin(gait)) * 0.08 * running;
            head.rotation.z = Math.sin(elapsed * 1.8) * 0.035;
            head.rotation.x = Math.max(-0.16, Math.min(0.16, (target.y - body.y) / 1000));
            for (let i = 0; i < 2; i++) {
                const stride = Math.sin(gait + i * Math.PI) * running;
                legs[i].rotation.x = stride * 0.85;
                arms[i].rotation.x = -stride * 0.8;
                arms[i].rotation.z = (i ? 1 : -1) * (0.16 + (body.grounded ? 0 : 0.55));
            }
            const progress = body.crash ? 1 - body.crash / 0.85 : 0;
            rig.rotation.z = body.crash ? body.crashDirection * Math.sin(progress * Math.PI) * 1.35 : 0;
            shadow.visible = body.grounded;
            stars.visible = body.crash > 0.1;
            stars.children.forEach((star, i) => {
                const angle = elapsed * 7 + i * Math.PI * 2 / 3;
                star.position.set(Math.cos(angle) * 0.85, 2 + Math.sin(angle) * 0.12, Math.sin(angle) * 0.6);
                star.rotation.z = angle;
            });
            const blink = elapsed % 4.8 > 4.65 ? 0.12 : 1.12;
            eyes.forEach(eye => { eye.scale.y = body.crash ? 0.45 : blink; });
            renderer.render(scene, camera);
        },
        dispose() {
            scene.traverse(object => { object.geometry?.dispose(); });
            Object.values(materials).forEach(material => material.dispose());
            renderer.dispose();
        },
    };
}
