"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

// VRM model URL — AvatarSample_B is a high-quality anime model
const DEFAULT_VRM_URL =
  "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

/**
 * The core 3D scene component.
 * Renders a VRM avatar with idle animation, breathing, auto-blink,
 * and lip-sync blendshape control driven by an audio AnalyserNode.
 */
export default function Scene3D({ audioAnalyserRef, isSpeaking, vrmUrl }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const vrmRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const frameRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState(null);

  // Smooth lip-sync values
  const lipSyncRef = useRef({ aa: 0, oh: 0, ou: 0, ee: 0, ih: 0 });

  // Track mouse for subtle head-follow effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Background gradient (deep dark with subtle purple)
    const bgColor = new THREE.Color(0x0a0a0f);
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(bgColor, 0.08);

    // Camera — bust-shot framing
    const camera = new THREE.PerspectiveCamera(
      28,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.35, 2.8);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;

    // === LIGHTING — dramatic anime-style three-point setup ===

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambientLight);

    // Key light — warm, top-right (main illumination)
    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
    keyLight.position.set(2, 3, 2);
    scene.add(keyLight);

    // Fill light — cool violet, from left
    const fillLight = new THREE.DirectionalLight(0x9b59ff, 0.7);
    fillLight.position.set(-3, 2, 1);
    scene.add(fillLight);

    // Rim light — cyan, from behind for anime edge glow
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 0.6);
    rimLight.position.set(0, 2.5, -3);
    scene.add(rimLight);

    // Under-face glow — soft pink
    const bottomLight = new THREE.PointLight(0xec4899, 0.25, 5);
    bottomLight.position.set(0, 0.3, 1.2);
    scene.add(bottomLight);

    // === ENVIRONMENT ===

    // Glowing ground disc
    const groundGeom = new THREE.CircleGeometry(1.5, 64);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.06,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // Animated particle system
    createParticles(scene);

    // Background orbiting lights
    createOrbLights(scene);

    return { renderer, scene, camera };
  }, []);

  // Create floating particle system
  const createParticles = (scene) => {
    const count = 80;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;

      // Varied purple-pink-cyan colors
      const colorChoice = Math.random();
      if (colorChoice < 0.4) {
        // Purple
        colors[i * 3] = 0.48;
        colors[i * 3 + 1] = 0.23;
        colors[i * 3 + 2] = 0.93;
      } else if (colorChoice < 0.7) {
        // Pink
        colors[i * 3] = 0.93;
        colors[i * 3 + 1] = 0.29;
        colors[i * 3 + 2] = 0.6;
      } else {
        // Cyan
        colors[i * 3] = 0.13;
        colors[i * 3 + 1] = 0.83;
        colors[i * 3 + 2] = 0.93;
      }

      sizes[i] = 0.015 + Math.random() * 0.03;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData.isParticles = true;
    particles.userData.initialPositions = positions.slice();
    scene.add(particles);
  };

  // Subtle orbiting light orbs
  const createOrbLights = (scene) => {
    const orbGeom = new THREE.SphereGeometry(0.05, 16, 16);

    const orbs = [
      { color: 0x7c3aed, intensity: 0.5, radius: 3, speed: 0.3, y: 1.5 },
      { color: 0xec4899, intensity: 0.3, radius: 2.5, speed: -0.2, y: 2.0 },
      { color: 0x22d3ee, intensity: 0.3, radius: 3.5, speed: 0.15, y: 0.8 },
    ];

    orbs.forEach((config, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.6,
      });
      const orb = new THREE.Mesh(orbGeom, mat);
      orb.userData.isOrb = true;
      orb.userData.orbConfig = config;
      scene.add(orb);

      // Attach a dim point light
      const light = new THREE.PointLight(config.color, config.intensity, 4);
      orb.add(light);
    });
  };

  // Load VRM model
  const loadVRM = useCallback(async (url) => {
    const scene = sceneRef.current;
    if (!scene) return;

    setLoading(true);
    setError(null);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          url,
          (g) => resolve(g),
          (progress) => {
            if (progress.total > 0) {
              setLoadProgress(
                Math.round((progress.loaded / progress.total) * 100)
              );
            }
          },
          (err) => reject(err)
        );
      });

      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error("No VRM data found in the model file");

      // Remove old VRM if exists
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
        scene.remove(vrmRef.current.scene);
      }

      // Optimize & setup
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);

      // Face camera
      vrm.scene.rotation.y = 0;

      // Set initial pose (arms down instead of T-pose)
      if (vrm.humanoid) {
        const leftUpperArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
        if (leftUpperArm) leftUpperArm.rotation.z = -1.1;
        const rightUpperArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
        if (rightUpperArm) rightUpperArm.rotation.z = 1.1;

        const leftLowerArm = vrm.humanoid.getNormalizedBoneNode("leftLowerArm");
        if (leftLowerArm) leftLowerArm.rotation.z = -0.2;
        const rightLowerArm = vrm.humanoid.getNormalizedBoneNode("rightLowerArm");
        if (rightLowerArm) rightLowerArm.rotation.z = 0.2;
      }

      scene.add(vrm.scene);
      vrmRef.current = vrm;

      console.log("[VRM] Model loaded successfully:", url);
      if (vrm.expressionManager) {
        console.log(
          "[VRM] Available expressions:",
          Object.keys(vrm.expressionManager.expressionMap || {})
        );
      }

      setLoading(false);
      setLoadProgress(100);
    } catch (err) {
      console.error("[VRM] Load error:", err);
      setError("Could not load 3D model. Please refresh the page.");
      setLoading(false);
    }
  }, []);

  // Idle animation: breathing, subtle sway, auto-blink, head look-at
  const animateIdle = (vrm, elapsed) => {
    if (!vrm || !vrm.humanoid) return;

    // Breathing — spine oscillation
    const spine = vrm.humanoid.getNormalizedBoneNode("spine");
    if (spine) {
      spine.rotation.x = Math.sin(elapsed * 1.5) * 0.004;
    }

    // Upper chest micro-motion
    const upperChest = vrm.humanoid.getNormalizedBoneNode("upperChest");
    if (upperChest) {
      upperChest.rotation.x = Math.sin(elapsed * 1.3 + 0.5) * 0.002;
    }

    // Natural head sway + mouse follow
    const head = vrm.humanoid.getNormalizedBoneNode("head");
    if (head) {
      const idleSwayY = Math.sin(elapsed * 0.5) * 0.015;
      const idleSwayX = Math.sin(elapsed * 0.7) * 0.008;

      // Mouse follow — subtle head tracking
      const targetY = idleSwayY + mouseRef.current.x * 0.08;
      const targetX = idleSwayX - mouseRef.current.y * 0.04;

      // Smooth lerp
      head.rotation.y += (targetY - head.rotation.y) * 0.03;
      head.rotation.x += (targetX - head.rotation.x) * 0.03;
    }

    // Auto-blink
    if (vrm.expressionManager) {
      const blinkCycle = elapsed % 4;
      if (blinkCycle > 3.6 && blinkCycle < 3.85) {
        const t = (blinkCycle - 3.6) / 0.25;
        const blinkValue = t < 0.5 ? t * 2 : (1 - t) * 2;
        vrm.expressionManager.setValue("blink", blinkValue);
      } else {
        vrm.expressionManager.setValue("blink", 0.0);
      }

      // Subtle happy expression when idle
      vrm.expressionManager.setValue(
        "happy",
        0.1 + Math.sin(elapsed * 0.3) * 0.05
      );
    }
  };

  // Lip-sync driven by audio analyser frequency data
  const animateLipSync = (vrm) => {
    if (!vrm || !vrm.expressionManager) return;

    const analyser = audioAnalyserRef?.current;
    const target = lipSyncRef.current;
    const lerpFactor = 0.25;

    if (!analyser || !isSpeaking) {
      // Smoothly close mouth when not speaking
      target.aa *= 0.85;
      target.oh *= 0.85;
      target.ou *= 0.85;
      target.ee *= 0.85;
      target.ih *= 0.85;

      vrm.expressionManager.setValue("aa", target.aa);
      vrm.expressionManager.setValue("oh", target.oh);
      vrm.expressionManager.setValue("ou", target.ou);
      vrm.expressionManager.setValue("ee", target.ee);
      vrm.expressionManager.setValue("ih", target.ih);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Map frequency bands to mouth shapes
    const low = average(dataArray, 0, 6) / 255;
    const midLow = average(dataArray, 6, 16) / 255;
    const mid = average(dataArray, 16, 32) / 255;
    const midHigh = average(dataArray, 32, 56) / 255;
    const high = average(dataArray, 56, 100) / 255;

    // Smooth interpolation toward target values
    target.aa += (clamp(low * 1.6, 0, 1) - target.aa) * lerpFactor;
    target.oh += (clamp(midLow * 1.3, 0, 1) - target.oh) * lerpFactor;
    target.ou += (clamp(mid * 1.0, 0, 1) - target.ou) * lerpFactor;
    target.ee += (clamp(midHigh * 0.9, 0, 1) - target.ee) * lerpFactor;
    target.ih += (clamp(high * 0.7, 0, 1) - target.ih) * lerpFactor;

    vrm.expressionManager.setValue("aa", target.aa);
    vrm.expressionManager.setValue("oh", target.oh);
    vrm.expressionManager.setValue("ou", target.ou);
    vrm.expressionManager.setValue("ee", target.ee);
    vrm.expressionManager.setValue("ih", target.ih);
  };

  // Animation loop
  const animate = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const vrm = vrmRef.current;

    if (!renderer || !scene || !camera) return;

    const delta = clockRef.current.getDelta();
    const elapsed = clockRef.current.getElapsedTime();

    // Animate VRM
    if (vrm) {
      animateIdle(vrm, elapsed);
      animateLipSync(vrm);
      vrm.update(delta);
    }

    // Animate particles — gentle floating
    scene.traverse((obj) => {
      if (obj.userData.isParticles) {
        obj.rotation.y += delta * 0.03;
        const positions = obj.geometry.attributes.position.array;
        const initial = obj.userData.initialPositions;
        if (initial) {
          for (let i = 0; i < positions.length; i += 3) {
            positions[i] =
              initial[i] + Math.sin(elapsed * 0.5 + i) * 0.15;
            positions[i + 1] =
              initial[i + 1] + Math.sin(elapsed * 0.3 + i * 0.5) * 0.1;
            positions[i + 2] =
              initial[i + 2] + Math.cos(elapsed * 0.4 + i) * 0.1;
          }
        }
        obj.geometry.attributes.position.needsUpdate = true;
      }

      // Animate orbiting lights
      if (obj.userData.isOrb) {
        const cfg = obj.userData.orbConfig;
        obj.position.x = Math.cos(elapsed * cfg.speed) * cfg.radius;
        obj.position.y = cfg.y + Math.sin(elapsed * cfg.speed * 2) * 0.3;
        obj.position.z = Math.sin(elapsed * cfg.speed) * cfg.radius;
      }
    });

    // Subtle camera breathing
    camera.position.y = 1.35 + Math.sin(elapsed * 0.5) * 0.008;

    renderer.render(scene, camera);
    frameRef.current = requestAnimationFrame(animate);
  }, [audioAnalyserRef, isSpeaking]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return;

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Init scene and start render loop
  useEffect(() => {
    initScene();

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }
      rendererRef.current?.dispose();
    };
  }, [initScene, animate]);

  // Load VRM when URL changes
  useEffect(() => {
    loadVRM(vrmUrl || DEFAULT_VRM_URL);
  }, [vrmUrl, loadVRM]);

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} id="vrm-canvas" />

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">
              Loading Sakura...{" "}
              {loadProgress > 0 && loadProgress < 100
                ? `${loadProgress}%`
                : ""}
            </p>
            {loadProgress > 0 && (
              <div className="loading-progress">
                <div
                  className="loading-progress__bar"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <p className="loading-text" style={{ color: "#ef4444" }}>
              {error}
            </p>
            <button
              className="retry-btn"
              onClick={() => loadVRM(vrmUrl || DEFAULT_VRM_URL)}
            >
              🔄 Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function average(arr, start, end) {
  let sum = 0;
  const count = Math.min(end, arr.length) - start;
  if (count <= 0) return 0;
  for (let i = start; i < Math.min(end, arr.length); i++) {
    sum += arr[i];
  }
  return sum / count;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
